import {useEffect, useState} from 'preact/hooks';
import {useLocation} from 'preact-iso';
import {AdminGraphqlError, directAdminGraphql} from 'eligibility';

const adminGraphql = directAdminGraphql();

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;
const SEARCH_FIELDS = ['first_name', 'last_name', 'email'];

const CUSTOMER_SEARCH_QUERY = `#graphql
  query CustomerSearch($query: String, $first: Int, $after: String, $last: Int, $before: String) {
    customers(query: $query, first: $first, after: $after, last: $last, before: $before, sortKey: NAME) {
      nodes {
        id
        displayName
        defaultEmailAddress {
          emailAddress
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

/**
 * @typedef {{
 *   id: string,
 *   displayName: string,
 *   defaultEmailAddress: {emailAddress: string} | null,
 * }} CustomerRow
 * @typedef {{
 *   hasNextPage: boolean,
 *   hasPreviousPage: boolean,
 *   startCursor: string | null,
 *   endCursor: string | null,
 * }} PageInfo
 * @typedef {{customers: CustomerRow[], pageInfo: PageInfo}} SearchResult
 */

/**
 * The previous result stays on screen while the next one loads.
 * @typedef {{status: 'loading', result?: SearchResult}
 *   | {status: 'loaded', result: SearchResult}
 *   | {status: 'error', message: string}} PageState
 */

/**
 * The search term and page live in the URL (`/?q=ada&after=<cursor>`), so the
 * back button from a customer's page returns to the same page of results.
 */
export default function HomePage() {
  const {query, route} = useLocation();
  // `q` is the search in the URL; `term` is the field's text, which reaches
  // the URL once typing pauses.
  const q = query.q ?? '';
  const after = query.after;
  const before = after ? undefined : query.before;

  const [term, setTerm] = useState(q);
  const [state, setState] = useState(
    /** @type {PageState} */ ({status: 'loading'}),
  );

  // Follow the URL when it changes from outside the field (back, nav link).
  useEffect(() => {
    if (term.trim() !== q) setTerm(q);
  }, [q]);

  // Searching replaces the history entry, so typing doesn't fill up history.
  useEffect(() => {
    if (term.trim() === q) return;
    const timeout = setTimeout(
      () => route(searchUrl(term.trim()), true),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [term]);

  /** Paging pages through the results on screen, so drop any unsent search. */
  const goToPage = (/** @type {{after?: string, before?: string}} */ page) => {
    setTerm(q);
    route(searchUrl(q, page));
  };

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({
      status: 'loading',
      result: previous.status === 'error' ? undefined : previous.result,
    }));
    shopify.loading(true);
    searchCustomers(q, {after, before})
      .then((result) => {
        if (!cancelled) setState({status: 'loaded', result});
      })
      .catch((error) => {
        if (!cancelled) setState({status: 'error', message: errorMessage(error)});
      })
      .finally(() => {
        if (!cancelled) shopify.loading(false);
      });
    return () => {
      cancelled = true;
      shopify.loading(false);
    };
  }, [q, after, before]);

  const result = state.status === 'error' ? undefined : state.result;
  const customers = result?.customers ?? [];
  const pageInfo = result?.pageInfo;

  return (
    <s-page heading="Customers">
      {state.status === 'error' && (
        <s-banner tone="critical" heading="Couldn't search customers">
          {state.message}
        </s-banner>
      )}

      <s-section padding="none" accessibilityLabel="Customers">
        <s-table
          paginate
          loading={state.status === 'loading'}
          hasPreviousPage={pageInfo?.hasPreviousPage ?? false}
          hasNextPage={pageInfo?.hasNextPage ?? false}
          onPreviousPage={() => {
            if (pageInfo?.startCursor) goToPage({before: pageInfo.startCursor});
          }}
          onNextPage={() => {
            if (pageInfo?.endCursor) goToPage({after: pageInfo.endCursor});
          }}
        >
          <s-search-field
            slot="filters"
            label="Search customers"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search by name or email"
            value={term}
            onInput={(event) => setTerm(event.currentTarget.value)}
          />
          <s-table-header-row>
            <s-table-header listSlot="primary">Customer</s-table-header>
            <s-table-header listSlot="secondary">Email</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {customers.map((customer) => (
              <s-table-row key={customer.id}>
                <s-table-cell>
                  <s-link href={`/customers/${numericId(customer.id)}`}>
                    {customer.displayName}
                  </s-link>
                </s-table-cell>
                <s-table-cell>
                  {customer.defaultEmailAddress?.emailAddress ?? ''}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>

        {state.status === 'loaded' && customers.length === 0 && (
          <s-box padding="base">
            <s-paragraph color="subdued">
              {q.trim()
                ? `No customers match “${q.trim()}”. Try a different name or email.`
                : 'This store has no customers yet.'}
            </s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

/**
 * @param {string} q
 * @param {{after?: string, before?: string}} [page]
 */
function searchUrl(q, page = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page.after) params.set('after', page.after);
  if (page.before) params.set('before', page.before);
  const search = params.toString();
  return search ? `/?${search}` : '/';
}

/**
 * @param {string} term
 * @param {{after?: string, before?: string}} page
 * @returns {Promise<SearchResult>}
 */
async function searchCustomers(term, {after, before}) {
  const page = before
    ? {last: PAGE_SIZE, before}
    : {first: PAGE_SIZE, after: after ?? null};
  const data = await adminGraphql(CUSTOMER_SEARCH_QUERY, {
    query: customerSearchSyntax(term),
    ...page,
  });
  return {
    customers: data.customers.nodes,
    pageInfo: data.customers.pageInfo,
  };
}

/**
 * Builds a Shopify search query matching customers whose name or email
 * starts with every word of `term`: `ada love` becomes
 * `(first_name:ada* OR last_name:ada* OR email:ada*) (first_name:love* OR …)`.
 * An empty term matches every customer.
 *
 * @param {string} term
 * @returns {string | null}
 */
function customerSearchSyntax(term) {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words
    .map((word) => {
      const escaped = escapeSearchTerm(word);
      return `(${SEARCH_FIELDS.map((field) => `${field}:${escaped}*`).join(' OR ')})`;
    })
    .join(' ');
}

/**
 * Backslash-escapes the characters Shopify's search syntax treats specially,
 * so input like `o'brien` or `a:b` is searched for literally.
 * See https://shopify.dev/docs/api/usage/search-syntax
 *
 * @param {string} word
 */
function escapeSearchTerm(word) {
  return word.replace(/[\\:()"'*<>=~!-]/g, '\\$&');
}

/** @param {string} gid */
function numericId(gid) {
  return gid.split('/').pop() ?? '';
}

/** @param {unknown} error */
function errorMessage(error) {
  if (error instanceof AdminGraphqlError && error.code === 'ACCESS_DENIED') {
    return 'You don’t have permission to view customers. Ask the store owner for access to customers.';
  }
  return 'Something went wrong while searching customers. Search again, or reload the page if it keeps happening.';
}
