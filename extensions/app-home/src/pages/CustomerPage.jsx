import {useEffect, useState} from 'preact/hooks';
import {directAdminGraphql, getCustomerEligibility} from 'eligibility';
import {
  codeSummaryText,
  eligibilityErrorMessage,
  formatDate,
} from 'eligibility/format';

/** @typedef {import('eligibility').CustomerEligibility} CustomerEligibility */
/** @typedef {import('eligibility').EligibleDiscount} EligibleDiscount */

const adminGraphql = directAdminGraphql();

/**
 * @typedef {{status: 'loading'}
 *   | {status: 'loaded', eligibility: CustomerEligibility}
 *   | {status: 'error', message: string}} PageState
 */

/** @param {{ id?: string }} props */
export default function CustomerPage({id = ''}) {
  const [state, setState] = useState(
    /** @type {PageState} */ ({status: 'loading'}),
  );

  useEffect(() => {
    let cancelled = false;
    setState({status: 'loading'});
    shopify.loading(true);
    getCustomerEligibility(id, adminGraphql)
      .then((eligibility) => {
        if (!cancelled) setState({status: 'loaded', eligibility});
      })
      .catch((error) => {
        if (!cancelled) {
          setState({status: 'error', message: eligibilityErrorMessage(error)});
        }
      })
      .finally(() => shopify.loading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // An empty heading also hides the breadcrumb, so only use one while loading.
  const heading =
    state.status === 'loaded'
      ? state.eligibility.customer.displayName
      : state.status === 'error'
        ? 'Customer'
        : '';

  return (
    <s-page heading={heading}>
      <s-link slot="breadcrumb-actions" href="/">
        Customers
      </s-link>

      {state.status === 'loading' && (
        <s-section accessibilityLabel="Loading discounts">
          <s-stack alignItems="center" padding="large">
            <s-spinner accessibilityLabel="Loading discounts" />
          </s-stack>
        </s-section>
      )}

      {state.status === 'error' && (
        <s-banner tone="critical" heading="Couldn't load discounts">
          {state.message}
        </s-banner>
      )}

      {state.status === 'loaded' && (
        <>
          <DiscountGroup heading="Active" discounts={state.eligibility.active} />
          <DiscountGroup
            heading="Scheduled"
            discounts={state.eligibility.scheduled}
          />
          <DiscountGroup
            heading="Expired"
            discounts={state.eligibility.expired}
            collapsible
          />
        </>
      )}
    </s-page>
  );
}

/**
 * @param {{heading: string, discounts: EligibleDiscount[], collapsible?: boolean}} props
 */
function DiscountGroup({heading, discounts, collapsible = false}) {
  const [open, setOpen] = useState(!collapsible);
  const showTable = open && discounts.length > 0;

  return (
    <s-section
      heading={`${heading} (${discounts.length})`}
      padding={showTable ? 'none' : 'base'}
    >
      {collapsible && discounts.length > 0 && (
        <s-button
          slot="secondary-actions"
          variant="tertiary"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide' : 'Show'}
        </s-button>
      )}
      {discounts.length === 0 && (
        <s-paragraph color="subdued">
          No {heading.toLowerCase()} discounts.
        </s-paragraph>
      )}
      {showTable && <DiscountTable discounts={discounts} />}
    </s-section>
  );
}

/** @param {{discounts: EligibleDiscount[]}} props */
function DiscountTable({discounts}) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Discount</s-table-header>
        <s-table-header listSlot="secondary">Value</s-table-header>
        <s-table-header listSlot="inline">Code</s-table-header>
        <s-table-header listSlot="labeled">Starts</s-table-header>
        <s-table-header listSlot="labeled">Ends</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {discounts.map((discount) => (
          <s-table-row key={discount.id}>
            <s-table-cell>
              <s-link href={discount.adminUrl}>{discount.title}</s-link>
            </s-table-cell>
            <s-table-cell>{discount.valueSummary}</s-table-cell>
            <s-table-cell>
              <CodeCell discount={discount} />
            </s-table-cell>
            <s-table-cell>{formatDate(discount.startsAt)}</s-table-cell>
            <s-table-cell>
              {discount.endsAt ? formatDate(discount.endsAt) : 'No end date'}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

/** @param {{discount: EligibleDiscount}} props */
function CodeCell({discount}) {
  const text = codeSummaryText(discount);
  return discount.codeSummary ? (
    <s-text>{text}</s-text>
  ) : (
    <s-badge>{text}</s-badge>
  );
}
