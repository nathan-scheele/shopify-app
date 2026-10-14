import type { AdminGraphql } from "../adminGraphql";

type Variables = Record<string, unknown>;
type Fixture = unknown | ((variables: Variables) => unknown);

/**
 * A fake Admin GraphQL client. Serves fixture data by operation name;
 * a fixture is either the response data or a function of the variables
 * (see `paginated`).
 */
export function fakeAdminGraphql(fixtures: Record<string, Fixture>): AdminGraphql {
  return async (query, variables = {}) => {
    const operationName = /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
    if (!operationName || !(operationName in fixtures)) {
      throw new Error(`No fixture for operation ${operationName ?? "(anonymous)"}`);
    }
    const fixture = fixtures[operationName];
    return typeof fixture === "function" ? fixture(variables) : fixture;
  };
}

/**
 * Serves `nodes` as a connection at `field`, `pageSize` at a time, following
 * the `after` cursor in the variables.
 */
export function paginated(field: string, nodes: unknown[], pageSize = 2) {
  return (variables: Variables) => {
    const start = variables.after == null ? 0 : Number(variables.after);
    const end = start + pageSize;
    return {
      [field]: {
        nodes: nodes.slice(start, end),
        pageInfo: {
          hasNextPage: end < nodes.length,
          endCursor: end < nodes.length ? String(end) : null,
        },
      },
    };
  };
}
