import type { Handler } from "@netlify/functions";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(120),
  timezone: z.string().min(3).max(80),
  language: z.string().min(2).max(12).default("pt-BR"),
});

function hasRole(event: Parameters<Handler>[0], allowed: string[]) {
  const role = event.headers["x-user-role"] ?? "viewer";
  return allowed.includes(role);
}

export const handler: Handler = async (event) => {
  const cid = correlationId();

  if (event.httpMethod !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED", cid });
  }

  if (!hasRole(event, ["owner", "admin"])) {
    return json(403, { error: "FORBIDDEN_ROLE", cid });
  }

  const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return json(422, { error: "VALIDATION_ERROR", cid, issues: parsed.error.issues });
  }

  return json(200, {
    ok: true,
    cid,
    companyId: parsed.data.companyId,
    message: "Configuracao validada. Persistencia Supabase sera conectada no proximo bloco.",
    todo: "TODO[TENANT-RBAC-01]: substituir header x-user-role por claims de JWT Supabase",
  });
};
