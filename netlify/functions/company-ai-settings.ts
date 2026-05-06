import type { Handler } from "@netlify/functions";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";
import { requireRole, requireTenant, tenantErrorCode, tenantErrorStatus } from "./_lib/tenant";

const querySchema = z.object({
  company_id: z.string().uuid()
});

const bodySchema = z.object({
  assistantName: z.string().min(2).max(80),
  tone: z.string().min(2).max(60),
  welcomeEnabled: z.boolean(),
  welcomeMessage: z.string().min(2).max(400),
  objective: z.string().max(200).optional().default(""),
  forbiddenTopics: z.string().max(2000).optional().default(""),
  escalationRules: z.string().max(2000).optional().default(""),
  businessName: z.string().max(120).optional().default(""),
  businessDescription: z.string().max(2000).optional().default(""),
  businessHours: z.string().max(200).optional().default(""),
  faq: z.array(z.object({ question: z.string().min(2).max(200), answer: z.string().min(2).max(500) })).max(20).default([]),
  playbook: z
    .array(
      z.object({
        intent: z.string().min(2).max(100),
        baseReply: z.string().min(2).max(500),
        variations: z.array(z.string().min(2).max(300)).max(5)
      })
    )
    .max(20)
    .default([])
});

export const handler: Handler = async (event) => {
  const cid = correlationId();

  const queryParsed = querySchema.safeParse(event.queryStringParameters ?? {});
  if (!queryParsed.success) {
    return json(422, { error: "VALIDATION_ERROR", cid, issues: queryParsed.error.issues });
  }

  try {
    const tenant = await requireTenant(event, queryParsed.data.company_id);

    if (event.httpMethod === "GET") {
      const { data: company, error: companyError } = await tenant.admin
        .from("companies")
        .select("id, name, settings_json")
        .eq("id", tenant.companyId)
        .single();

      if (companyError || !company) {
        return json(404, { error: "COMPANY_NOT_FOUND", cid });
      }

      return json(200, {
        ok: true,
        cid,
        role: tenant.role,
        company
      });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED", cid });
    }

    requireRole(tenant.role, ["owner", "admin"]);

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
        objective: payload.objective.trim() || "Nao informado",
        forbidden_topics: payload.forbiddenTopics.trim() || "Nao informado",
        escalation_rules: payload.escalationRules.trim() || "Nao informado",
        business: {
          name: normalizedBusinessName || "Nao informado",
          description: normalizedBusinessDescription || "Nao informado",
          hours: normalizedBusinessHours || "Nao informado",
          faq: payload.faq
        },
        playbook: payload.playbook
      }
    };

    const { error: updateError } = await tenant.admin
      .from("companies")
      .update({
        settings_json: settingsJson,
        updated_at: new Date().toISOString()
      })
      .eq("id", tenant.companyId);

    if (updateError) {
      return json(400, { error: "SAVE_FAILED", cid, detail: updateError.message });
    }

    return json(200, { ok: true, cid });
  } catch (error) {
    return json(tenantErrorStatus(error), {
      error: tenantErrorCode(error),
      cid,
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
};
