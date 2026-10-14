import '@shopify/ui-extensions/preact';
import {render} from 'preact';
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
const HEADING = 'Discount eligibility';

export default async () => {
  render(<Extension />, document.body);
};

/**
 * @typedef {{status: 'loading'}
 *   | {status: 'loaded', eligibility: CustomerEligibility}
 *   | {status: 'error', message: string}} BlockState
 */

function Extension() {
  // The Customer GID of the page's customer.
  const customerId = shopify.data.selected[0]?.id ?? '';
  const [state, setState] = useState(
    /** @type {BlockState} */ ({status: 'loading'}),
  );

  useEffect(() => {
    getCustomerEligibility(customerId, adminGraphql)
      .then((eligibility) => setState({status: 'loaded', eligibility}))
      .catch((error) =>
        setState({status: 'error', message: eligibilityErrorMessage(error)}),
      );
  }, [customerId]);

  if (state.status === 'loading') {
    return (
      <s-admin-block heading={HEADING}>
        <s-stack alignItems="center" padding="base">
          <s-spinner accessibilityLabel="Loading discounts" />
        </s-stack>
      </s-admin-block>
    );
  }

  if (state.status === 'error') {
    return (
      <s-admin-block heading={HEADING}>
        <s-banner tone="critical" heading="Couldn't load discounts">
          {state.message}
        </s-banner>
      </s-admin-block>
    );
  }

  const {active, scheduled, expired} = state.eligibility;
  // The Undeterminable count joins these once #9 adds it to CustomerEligibility.
  const counts = [
    {label: 'Scheduled', count: scheduled.length},
    {label: 'Expired', count: expired.length},
  ];

  return (
    <s-admin-block
      heading={HEADING}
      collapsedSummary={`${active.length} active`}
    >
      <s-stack direction="block" gap="base">
        <s-heading>Active ({active.length})</s-heading>
        {active.length === 0 ? (
          <s-paragraph color="subdued">No active discounts.</s-paragraph>
        ) : (
          <ActiveDiscounts discounts={active} />
        )}
        <s-stack direction="inline" gap="base">
          {counts.map(({label, count}) => (
            <s-text key={label}>
              {label}: {count}
            </s-text>
          ))}
        </s-stack>
        <s-link href={`app:customers/${customerId.split('/').pop()}`}>
          View all
        </s-link>
      </s-stack>
    </s-admin-block>
  );
}

/** @param {{discounts: EligibleDiscount[]}} props */
function ActiveDiscounts({discounts}) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Discount</s-table-header>
        <s-table-header listSlot="secondary">Value</s-table-header>
        <s-table-header listSlot="inline">Code</s-table-header>
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
              <CodeSummary discount={discount} />
            </s-table-cell>
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
function CodeSummary({discount}) {
  const text = codeSummaryText(discount);
  return discount.codeSummary ? (
    <s-text>{text}</s-text>
  ) : (
    <s-badge>{text}</s-badge>
  );
}
