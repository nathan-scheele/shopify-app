import type { AdminGraphql } from "./adminGraphql";

export type DiscountStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED";

export type CodeSummary =
  | { kind: "single"; code: string }
  | { kind: "count"; count: number };

export interface EligibleDiscount {
  id: string;
  title: string;
  method: "code" | "automatic";
  status: DiscountStatus;
  /** e.g. "15% off Shoes collection". */
  valueSummary: string;
  /** Null for automatic discounts. */
  codeSummary: CodeSummary | null;
  startsAt: string;
  endsAt: string | null;
  /** The discount's page in the Shopify admin. */
  adminUrl: string;
}

export interface Customer {
  id: string;
  displayName: string;
}

export interface CustomerEligibility {
  customer: Customer;
  active: EligibleDiscount[];
  scheduled: EligibleDiscount[];
  expired: EligibleDiscount[];
}

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}

const CUSTOMER_QUERY = `#graphql
  query CustomerEligibilityCustomer($id: ID!) {
    customer(id: $id) { id displayName }
  }
`;

// `Discount` is a union, so every discount type needs its own fragment. App
// discounts are left out until our own Capped Discounts can be told apart from
// other apps' (Undeterminable) ones; they come back with just `__typename`.
const COMMON_FIELDS = "title status startsAt endsAt summary context { __typename }";
const CODE_FIELDS = "codes(first: 1) { nodes { code } } codesCount { count }";

const DISCOUNT_FRAGMENTS = {
  DiscountCodeBasic: [COMMON_FIELDS, CODE_FIELDS],
  DiscountCodeBxgy: [COMMON_FIELDS, CODE_FIELDS],
  DiscountCodeFreeShipping: [COMMON_FIELDS, CODE_FIELDS],
  DiscountAutomaticBasic: [COMMON_FIELDS],
  DiscountAutomaticBxgy: [COMMON_FIELDS],
  DiscountAutomaticFreeShipping: [COMMON_FIELDS],
};

const DISCOUNTS_QUERY = `#graphql
  query CustomerEligibilityDiscounts($after: String) {
    discountNodes(first: 50, after: $after) {
      nodes {
        id
        discount {
          __typename
          ${Object.entries(DISCOUNT_FRAGMENTS)
            .map(([type, fields]) => `... on ${type} { ${fields.join(" ")} }`)
            .join("\n          ")}
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface Discount {
  __typename: keyof typeof DISCOUNT_FRAGMENTS;
  title: string;
  status: DiscountStatus;
  startsAt: string;
  endsAt: string | null;
  summary: string;
  context: { __typename: string };
  codes?: { nodes: { code: string }[] };
  codesCount?: { count: number };
}

interface DiscountNode {
  id: string;
  /** Only `__typename` for discount types without a fragment. */
  discount: Discount | { __typename: string };
}

interface SupportedDiscountNode extends DiscountNode {
  discount: Discount;
}

const isSupported = (node: DiscountNode): node is SupportedDiscountNode =>
  node.discount.__typename in DISCOUNT_FRAGMENTS;

async function fetchCustomer(customerId: string, adminGraphql: AdminGraphql): Promise<Customer> {
  const id = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;
  const data = await adminGraphql(CUSTOMER_QUERY, { id });
  if (!data.customer) throw new CustomerNotFoundError(customerId);
  return data.customer;
}

async function fetchAllDiscounts(adminGraphql: AdminGraphql): Promise<DiscountNode[]> {
  const nodes: DiscountNode[] = [];
  let after: string | null = null;
  do {
    const data = await adminGraphql(DISCOUNTS_QUERY, { after });
    nodes.push(...data.discountNodes.nodes);
    after = data.discountNodes.pageInfo.hasNextPage ? data.discountNodes.pageInfo.endCursor : null;
  } while (after);
  return nodes;
}

function toEligibleDiscount({ id, discount }: SupportedDiscountNode): EligibleDiscount {
  return {
    id,
    title: discount.title,
    method: discount.__typename.startsWith("DiscountCode") ? "code" : "automatic",
    status: discount.status,
    // Shopify's summary appends conditions ("15% off Shoes • Minimum purchase
    // of $50.00 • One use per customer"); those aren't part of the value.
    valueSummary: discount.summary.split(" • ")[0]!,
    codeSummary: codeSummary(discount),
    startsAt: discount.startsAt,
    endsAt: discount.endsAt,
    adminUrl: `shopify://admin/discounts/${id.split("/").pop()}`,
  };
}

function codeSummary({ codes, codesCount }: Discount): CodeSummary | null {
  if (!codes || !codesCount) return null;
  if (codesCount.count === 1 && codes.nodes[0]) {
    return { kind: "single", code: codes.nodes[0].code };
  }
  return { kind: "count", count: codesCount.count };
}

/**
 * The discounts a customer is Eligible for, grouped by status.
 * `customerId` is a Customer GID or its numeric ID.
 */
export async function getCustomerEligibility(
  customerId: string,
  adminGraphql: AdminGraphql,
): Promise<CustomerEligibility> {
  const [customer, discountNodes] = await Promise.all([
    fetchCustomer(customerId, adminGraphql),
    fetchAllDiscounts(adminGraphql),
  ]);

  // Only discounts open to all customers are listed so far; other buyer
  // contexts (specific customers, segments, Markets) are not evaluated yet.
  const discounts = discountNodes
    .filter(isSupported)
    .filter((node) => node.discount.context.__typename === "DiscountBuyerSelectionAll")
    .map(toEligibleDiscount);

  const withStatus = (status: DiscountStatus) => discounts.filter((d) => d.status === status);

  return {
    customer,
    active: withStatus("ACTIVE").sort(byEndingSoonest),
    scheduled: withStatus("SCHEDULED").sort(byStartingSoonest),
    expired: withStatus("EXPIRED").sort(byMostRecentlyEnded),
  };
}

const timestampOrInfinity = (date: string | null) =>
  date == null ? Infinity : Date.parse(date);

// No end date sorts last. `|| 0` keeps two open-ended discounts (NaN) equal.
const byEndingSoonest = (a: EligibleDiscount, b: EligibleDiscount) =>
  timestampOrInfinity(a.endsAt) - timestampOrInfinity(b.endsAt) || 0;

const byStartingSoonest = (a: EligibleDiscount, b: EligibleDiscount) =>
  timestampOrInfinity(a.startsAt) - timestampOrInfinity(b.startsAt);

const byMostRecentlyEnded = (a: EligibleDiscount, b: EligibleDiscount) =>
  timestampOrInfinity(b.endsAt) - timestampOrInfinity(a.endsAt) || 0;
