import type { Handler } from "@netlify/functions";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";
import { requireRole, requireTenant, tenantErrorCode, tenantErrorStatus } from "./_lib/tenant";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(120),
  timezone: z.string().min(3).max(80),
  language: z.string().min(2).max(12).default("pt-BR"),
});

export const handler: Handler = async (event) => {
  const cid = correlationId();

  if (event.httpMethod !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED", cid });
  }

  const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return json(422, { error: "VALIDATION_ERROR", cid, issues: parsed.error.issues });
  }

  try {
    const tenant = await requireTenant(event, parsed.data.companyId);
    requireRole(tenant.role, ["owner", "admin"]);

    const { data: currentCompany, error: loadError } = await tenant.admin
      .from("companies")
      .select("settings_json")
      .eq("id", tenant.companyId)
      .single();

    if (loadError) {
      return json(404, { error: "COMPANY_NOT_FOUND", cid, detail: loadError.message });
    }

    const currentSettings =
      currentCompany?.settings_json && typeof currentCompany.settings_json === "object" ? currentCompany.settings_json : {};

    const { error } = await tenant.admin
      .from("companies")
      .update({
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        settings_json: {
          ...currentSettings,
          language: parsed.data.language
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", tenant.companyId);

    if (error) {
      return json(400, { error: "SAVE_FAILED", cid, detail: error.message });
    }

    return json(200, {
      ok: true,
      cid,
      companyId: tenant.companyId,
      role: tenant.role
    });
  } catch (error) {
    return json(tenantErrorStatus(error), {
      error: tenantErrorCode(error),
      cid,
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
};
