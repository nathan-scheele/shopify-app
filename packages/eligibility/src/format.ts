// Display text shared by the extensions that show eligibility (App Home and the
// Customer eligibility block), so both describe discounts and errors the same way.

import { AdminGraphqlError } from "./directAdminGraphql";
import { CustomerNotFoundError, type EligibleDiscount } from "./getCustomerEligibility";

/**
 * "Automatic", the single code, or a count such as "5,000 codes". Only
 * automatic discounts have no `codeSummary`, so callers can branch on it too.
 */
export function codeSummaryText({ codeSummary }: EligibleDiscount): string {
  if (!codeSummary) return "Automatic";
  if (codeSummary.kind === "single") return codeSummary.code;
  return `${codeSummary.count.toLocaleString()} codes`;
}

/** A discount date in the staff member's locale, e.g. "Oct 13, 2026". */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** What to tell staff when `getCustomerEligibility` fails. */
export function eligibilityErrorMessage(error: unknown): string {
  if (error instanceof CustomerNotFoundError) {
    return "This customer doesn’t exist or was deleted.";
  }
  if (error instanceof AdminGraphqlError && error.code === "ACCESS_DENIED") {
    return "You don’t have permission to view this customer’s discounts. Ask the store owner for access to customers, discounts and orders.";
  }
  return "Something went wrong while loading discounts. Reload the page to try again.";
}
