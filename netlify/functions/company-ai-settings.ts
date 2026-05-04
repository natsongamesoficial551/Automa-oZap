import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";

const querySchema = z.object({
  company_id: z.string().uuid()
});

const bodySchema = z.object({
  assistantName: z.string().min(2).max(80),
  tone: z.string().min(2).max(60),
  welcomeEnabled: z.boolean(),
  welcomeMessage: z.string().min(2).max(400),
  businessName: z.string().max(120).optional().default(""),
  businessDescription: z.string().max(2000).optional().default(""),
  businessHours: z.string().max(200).optional().default(""),
  faq: z.array(z.object({ question: z.string().min(2).max(200), answer: z.string().min(2).max(500) })).max(20)
});

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ENV_MISSING: ${name}`);
  return value;
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "").replace(/\/rest\/v1.*$/, "");
}

export const handler: Handler = async (event) => {
  const cid = correlationId();

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "UNAUTHORIZED", cid, detail: "missing bearer token" });
  }

  const queryParsed = querySchema.safeParse(event.queryStringParameters ?? {});
  if (!queryParsed.success) {
    return json(422, { error: "VALIDATION_ERROR", cid, issues: queryParsed.error.issues });
  }

  try {
    const supabaseUrl = normalizeSupabaseUrl(readEnv("SUPABASE_URL"));
    const anonKey = readEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const {
      data: { user },
      error: userError
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json(401, { error: "UNAUTHORIZED", cid, detail: userError?.message ?? "invalid token" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const companyId = queryParsed.data.company_id;

    const { data: membership, error: membershipError } = await admin
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return json(403, { error: "FORBIDDEN", cid, detail: membershipError?.message ?? "no membership" });
    }

    if (event.httpMethod === "GET") {
      const { data: company, error: companyError } = await admin
        .from("companies")
        .select("id, name, settings_json")
        .eq("id", companyId)
        .single();

      if (companyError || !company) {
        return json(404, { error: "COMPANY_NOT_FOUND", cid });
      }

      return json(200, {
        ok: true,
        cid,
        role: membership.role,
        company
      });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED", cid });
    }

    if (!(["owner", "admin"] as const).includes(membership.role as "owner" | "admin" | "operator" | "viewer")) {
      return json(403, { error: "FORBIDDEN_ROLE", cid, detail: "requires owner/admin" });
    }

    const bodyParsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!bodyParsed.success) {
      return json(422, { error: "VALIDATION_ERROR", cid, issues: bodyParsed.error.issues });
    }

    const payload = bodyParsed.data;
    const fixedModel = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini";
    const normalizedBusinessName = payload.businessName.trim();
    const normalizedBusinessDescription = payload.businessDescription.trim();
    const normalizedBusinessHours = payload.businessHours.trim();

    const settingsJson = {
      ai: {
        assistant_name: payload.assistantName,
        model: fixedModel,
        tone: payload.tone,
        welcome_enabled: payload.welcomeEnabled,
        welcome_message: payload.welcomeMessage,
        business: {
          name: normalizedBusinessName || "Nao informado",
          description: normalizedBusinessDescription || "Nao informado",
          hours: normalizedBusinessHours || "Nao informado",
          faq: payload.faq
        }
      }
    };

    const { error: updateError } = await admin
      .from("companies")
      .update({
        settings_json: settingsJson,
        updated_at: new Date().toISOString()
      })
      .eq("id", companyId);

    if (updateError) {
      return json(400, { error: "SAVE_FAILED", cid, detail: updateError.message });
    }

    return json(200, { ok: true, cid });
  } catch (error) {
    return json(500, { error: "INTERNAL_ERROR", cid, detail: error instanceof Error ? error.message : "unknown" });
  }
};
