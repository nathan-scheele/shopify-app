/**
 * Runs an Admin GraphQL operation and resolves to its `data`. Injected so the
 * eligibility package works with any transport (App Home's direct API access,
 * an admin block's, or a fake in tests).
 */
export type AdminGraphql = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<any>;
