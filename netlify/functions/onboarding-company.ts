import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes")
});

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`ENV_MISSING: ${name}`);
  }
  return value;
}

function normalizeSupabaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.includes("/rest/v1")) {
    return trimmed.replace(/\/rest\/v1.*$/, "");
  }
  return trimmed;
}

export const handler: Handler = async (event) => {
  const cid = correlationId();

  if (event.httpMethod !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED", cid });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "UNAUTHORIZED", cid, detail: "missing bearer token" });
  }

  try {
    const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) {
      return json(422, { error: "VALIDATION_ERROR", cid, issues: parsed.error.issues });
    }

    const supabaseUrl = normalizeSupabaseUrl(readEnv("SUPABASE_URL"));
    if (!/^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl)) {
      return json(500, {
        error: "ENV_INVALID",
        cid,
        detail: "SUPABASE_URL deve ser https://<project-ref>.supabase.co"
      });
    }
    const anonKey = readEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const {
      data: { user },
      error: userError
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json(401, { error: "UNAUTHORIZED", cid, detail: userError?.message ?? "invalid token" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingMembership, error: membershipError } = await adminClient
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return json(500, { error: "MEMBERSHIP_CHECK_FAILED", cid, detail: membershipError.message });
    }

    if (existingMembership) {
      return json(409, { error: "ONBOARDING_ALREADY_DONE", cid });
    }

    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug
      })
      .select("id, name")
      .single();

    if (companyError || !company) {
      return json(400, { error: "COMPANY_CREATE_FAILED", cid, detail: companyError?.message ?? "unknown" });
    }

    const { error: memberCreateError } = await adminClient.from("company_members").insert({
      company_id: company.id,
      user_id: user.id,
      role: "owner"
    });

    if (memberCreateError) {
      return json(400, { error: "MEMBER_CREATE_FAILED", cid, detail: memberCreateError.message });
    }

    await adminClient.from("audit_logs").insert({
      company_id: company.id,
      actor_user_id: user.id,
      actor_type: "user",
      action: "company.created",
      entity_type: "company",
      severity: "info",
      details_json: {
        source: "onboarding-company",
        slug: parsed.data.slug
      }
    });

    return json(201, {
      ok: true,
      cid,
      company: {
        id: company.id,
        name: company.name
      }
    });
  } catch (error) {
    return json(500, {
      error: "INTERNAL_ERROR",
      cid,
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
};
