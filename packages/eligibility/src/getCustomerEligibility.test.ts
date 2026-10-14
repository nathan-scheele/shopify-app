import { describe, expect, it } from "vitest";
import { CustomerNotFoundError, getCustomerEligibility } from "./index";
import { fakeAdminGraphql, paginated } from "./testing/fakeAdminGraphql";

const CUSTOMER_ID = "gid://shopify/Customer/1";

let nextId = 1;

type DiscountFixture = {
  title?: string;
  status?: "ACTIVE" | "SCHEDULED" | "EXPIRED";
  startsAt?: string;
  endsAt?: string | null;
  summary?: string;
  buyers?: "all" | "customers" | "segments";
};

const CONTEXTS = {
  all: { __typename: "DiscountBuyerSelectionAll" },
  customers: { __typename: "DiscountCustomers" },
  segments: { __typename: "DiscountCustomerSegments" },
};

function discountFields(fixture: DiscountFixture) {
  return {
    title: fixture.title ?? "Discount",
    status: fixture.status ?? "ACTIVE",
    startsAt: fixture.startsAt ?? "2026-01-01T00:00:00Z",
    endsAt: fixture.endsAt ?? null,
    summary: fixture.summary ?? "10% off entire order",
    context: CONTEXTS[fixture.buyers ?? "all"],
  };
}

function codeDiscount(fixture: DiscountFixture & { codes?: string[]; codesCount?: number } = {}) {
  const codes = fixture.codes ?? ["SAVE10"];
  return {
    id: `gid://shopify/DiscountCodeNode/${nextId++}`,
    discount: {
      __typename: "DiscountCodeBasic",
      ...discountFields(fixture),
      codes: { nodes: codes.slice(0, 1).map((code) => ({ code })) },
      codesCount: { count: fixture.codesCount ?? codes.length },
    },
  };
}

function automaticDiscount(fixture: DiscountFixture = {}) {
  return {
    id: `gid://shopify/DiscountAutomaticNode/${nextId++}`,
    discount: { __typename: "DiscountAutomaticBasic", ...discountFields(fixture) },
  };
}

function store(discounts: unknown[], { pageSize = 2 } = {}) {
  return fakeAdminGraphql({
    CustomerEligibilityCustomer: ({ id }: { id?: unknown }) => ({
      customer: id === CUSTOMER_ID ? { id: CUSTOMER_ID, displayName: "Ada Lovelace" } : null,
    }),
    CustomerEligibilityDiscounts: paginated("discountNodes", discounts, pageSize),
  });
}

const titles = (discounts: { title: string }[]) => discounts.map((d) => d.title);

describe("getCustomerEligibility", () => {
  it("lists a discount open to all customers in its status group", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Summer sale", status: "ACTIVE" }),
        automaticDiscount({ title: "Fall preview", status: "SCHEDULED" }),
        codeDiscount({ title: "Spring sale", status: "EXPIRED", endsAt: "2026-05-01T00:00:00Z" }),
      ]),
    );

    expect(titles(eligibility.active)).toEqual(["Summer sale"]);
    expect(titles(eligibility.scheduled)).toEqual(["Fall preview"]);
    expect(titles(eligibility.expired)).toEqual(["Spring sale"]);
  });

  it("leaves out discounts limited to specific customers or segments", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Everyone", buyers: "all" }),
        codeDiscount({ title: "VIPs only", buyers: "segments" }),
        automaticDiscount({ title: "Named customers", buyers: "customers" }),
      ]),
    );

    expect(titles(eligibility.active)).toEqual(["Everyone"]);
  });

  it("leaves out app discounts until they can be told apart from Undeterminable ones", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Built-in" }),
        {
          id: "gid://shopify/DiscountAutomaticNode/99",
          discount: { __typename: "DiscountAutomaticApp" },
        },
      ]),
    );

    expect(titles(eligibility.active)).toEqual(["Built-in"]);
  });

  it("sorts Active discounts ending soonest first, with no end date last", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Open-ended", endsAt: null }),
        codeDiscount({ title: "Ends in December", endsAt: "2026-12-31T00:00:00Z" }),
        automaticDiscount({ title: "Ends this week", endsAt: "2026-10-16T00:00:00Z" }),
      ]),
    );

    expect(titles(eligibility.active)).toEqual(["Ends this week", "Ends in December", "Open-ended"]);
  });

  it("sorts Scheduled discounts starting soonest first", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Black Friday", status: "SCHEDULED", startsAt: "2026-11-27T00:00:00Z" }),
        codeDiscount({ title: "Halloween", status: "SCHEDULED", startsAt: "2026-10-31T00:00:00Z" }),
        codeDiscount({ title: "New Year", status: "SCHEDULED", startsAt: "2027-01-01T00:00:00Z" }),
      ]),
    );

    expect(titles(eligibility.scheduled)).toEqual(["Halloween", "Black Friday", "New Year"]);
  });

  it("sorts Expired discounts most recently ended first", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({ title: "Spring sale", status: "EXPIRED", endsAt: "2026-05-01T00:00:00Z" }),
        codeDiscount({ title: "Summer sale", status: "EXPIRED", endsAt: "2026-09-01T00:00:00Z" }),
        codeDiscount({ title: "Winter sale", status: "EXPIRED", endsAt: "2026-02-01T00:00:00Z" }),
      ]),
    );

    expect(titles(eligibility.expired)).toEqual(["Summer sale", "Spring sale", "Winter sale"]);
  });

  it("shows the code of a single-code discount", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([codeDiscount({ codes: ["WELCOME10"] })]),
    );

    expect(eligibility.active[0]).toMatchObject({
      method: "code",
      codeSummary: { kind: "single", code: "WELCOME10" },
    });
  });

  it("shows a count, not the codes, for a discount with many codes", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([codeDiscount({ codes: ["A1B2C3"], codesCount: 5000 })]),
    );

    expect(eligibility.active[0]).toMatchObject({
      method: "code",
      codeSummary: { kind: "count", count: 5000 },
    });
  });

  it("shows an automatic discount without a code", async () => {
    const eligibility = await getCustomerEligibility(CUSTOMER_ID, store([automaticDiscount()]));

    expect(eligibility.active[0]).toMatchObject({ method: "automatic", codeSummary: null });
  });

  it("shows each discount's value summary, dates and Shopify discount page", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        {
          ...codeDiscount({
            title: "Shoe sale",
            summary: "15% off Shoes collection",
            startsAt: "2026-10-01T00:00:00Z",
            endsAt: "2026-10-31T00:00:00Z",
          }),
          id: "gid://shopify/DiscountCodeNode/1057371179",
        },
      ]),
    );

    expect(eligibility.active[0]).toMatchObject({
      title: "Shoe sale",
      valueSummary: "15% off Shoes collection",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-31T00:00:00Z",
      adminUrl: "shopify://admin/discounts/1057371179",
    });
  });

  it("keeps only the value part of Shopify's discount summary", async () => {
    const eligibility = await getCustomerEligibility(
      CUSTOMER_ID,
      store([
        codeDiscount({
          summary: "15% off Shoes collection • Minimum purchase of $50.00 • One use per customer",
        }),
      ]),
    );

    expect(eligibility.active[0]?.valueSummary).toBe("15% off Shoes collection");
  });

  it("lists discounts from every page of a multi-page discount list", async () => {
    const discounts = Array.from({ length: 7 }, (_, i) =>
      codeDiscount({ title: `Discount ${i + 1}`, endsAt: `2026-11-0${i + 1}T00:00:00Z` }),
    );

    const eligibility = await getCustomerEligibility(CUSTOMER_ID, store(discounts, { pageSize: 3 }));

    expect(titles(eligibility.active)).toEqual([
      "Discount 1",
      "Discount 2",
      "Discount 3",
      "Discount 4",
      "Discount 5",
      "Discount 6",
      "Discount 7",
    ]);
  });

  it("names the customer", async () => {
    const eligibility = await getCustomerEligibility(CUSTOMER_ID, store([]));

    expect(eligibility.customer).toEqual({ id: CUSTOMER_ID, displayName: "Ada Lovelace" });
  });

  it("accepts a numeric customer ID, as in the page URL", async () => {
    const eligibility = await getCustomerEligibility("1", store([]));

    expect(eligibility.customer.id).toBe(CUSTOMER_ID);
  });

  it("fails with CustomerNotFoundError for an unknown customer", async () => {
    await expect(getCustomerEligibility("999", store([]))).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});
