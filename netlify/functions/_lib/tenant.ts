import type { HandlerEvent } from "@netlify/functions";

export interface TenantScope {
  companyId: string;
  userId?: string;
}

export function getTenantScope(event: HandlerEvent): TenantScope {
  const companyId =
    event.headers["x-company-id"] ||
    event.headers["X-Company-Id"] ||
    event.queryStringParameters?.company_id;

  if (!companyId) {
    throw new Error("TENANT_SCOPE_MISSING: informe x-company-id ou company_id.");
  }

  const userId = event.headers["x-user-id"] || event.headers["X-User-Id"];

  return {
    companyId,
    userId: userId || undefined
  };
}
