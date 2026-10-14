import type { AdminGraphql } from "./adminGraphql";

const ADMIN_API_VERSION = "2026-10";

export class AdminGraphqlError extends Error {
  /** The first GraphQL error's code, e.g. "ACCESS_DENIED". */
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AdminGraphqlError";
    this.code = code;
  }
}

/**
 * An `AdminGraphql` over the extension's direct Admin API access. Requests run
 * as the signed-in staff member, so results respect their permissions.
 */
export function directAdminGraphql(): AdminGraphql {
  return async (query, variables) => {
    const response = await fetch(`shopify:admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new AdminGraphqlError(`Admin API request failed (${response.status})`);
    }
    const json = await response.json();
    const [error] = json.errors ?? [];
    if (error) throw new AdminGraphqlError(error.message, error.extensions?.code);
    return json.data;
  };
}
