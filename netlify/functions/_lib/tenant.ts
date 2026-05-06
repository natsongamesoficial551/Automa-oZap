import type { HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type UserRole = "owner" | "admin" | "operator" | "viewer";

export interface TenantContext {
  authHeader: string;
  user: User;
  admin: SupabaseClient;
  companyId: string;
  role: UserRole;
}

export interface AuthContext {
  authHeader: string;
  user: User;
  admin: SupabaseClient;
}

export interface TenantScope {
  companyId: string;
  userId?: string;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ENV_MISSING: ${name}`);
  return value;
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "").replace(/\/rest\/v1.*$/, "");
}

function getAuthHeader(event: HandlerEvent): string {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED: missing bearer token");
  }
  return authHeader;
}

export function getCompanyId(event: HandlerEvent, fallback?: string): string {
  const companyId =
    fallback ||
    event.headers["x-company-id"] ||
    event.headers["X-Company-Id"] ||
    event.queryStringParameters?.company_id;

  if (!companyId) {
    throw new Error("TENANT_SCOPE_MISSING: informe company_id ou x-company-id");
  }

  return companyId;
}

export function getTenantScope(event: HandlerEvent): TenantScope {
  const companyId = getCompanyId(event);
  const userId = event.headers["x-user-id"] || event.headers["X-User-Id"];

  return {
    companyId,
    userId: userId || undefined
  };
}

export async function requireAuth(event: HandlerEvent): Promise<AuthContext> {
  const authHeader = getAuthHeader(event);
  const supabaseUrl = normalizeSupabaseUrl(readEnv("SUPABASE_URL"));
  const anonKey = readEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new Error(`UNAUTHORIZED: ${error?.message ?? "invalid token"}`);
  }

  return {
    authHeader,
    user,
    admin: createClient(supabaseUrl, serviceRoleKey)
  };
}

export async function requireTenant(event: HandlerEvent, companyId?: string): Promise<TenantContext> {
  const auth = await requireAuth(event);
  const scopedCompanyId = getCompanyId(event, companyId);

  const { data: membership, error } = await auth.admin
    .from("company_members")
    .select("role")
    .eq("company_id", scopedCompanyId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !membership?.role) {
    throw new Error(`FORBIDDEN_TENANT: ${error?.message ?? "no membership"}`);
  }

  return {
    ...auth,
    companyId: scopedCompanyId,
    role: membership.role as UserRole
  };
}

export function requireRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    throw new Error(`FORBIDDEN_ROLE: requires ${allowed.join("/")}`);
  }
}

export function tenantErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (message.startsWith("UNAUTHORIZED")) return 401;
  if (message.startsWith("FORBIDDEN")) return 403;
  if (message.startsWith("TENANT_SCOPE_MISSING")) return 422;
  return 500;
}

export function tenantErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  return message.split(":")[0] || "INTERNAL_ERROR";
}
