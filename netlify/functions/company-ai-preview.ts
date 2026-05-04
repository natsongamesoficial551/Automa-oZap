import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  customerMessage: z.string().min(2).max(1000)
});

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "").replace(/\/rest\/v1.*$/, "");
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ENV_MISSING: ${name}`);
  return v;
}

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (data.output_text && data.output_text.trim().length > 0) {
    return data.output_text.trim();
  }

  const chunks = data.output ?? [];
  for (const chunk of chunks) {
    for (const part of chunk.content ?? []) {
      if (part.type === "output_text" && part.text && part.text.trim().length > 0) {
        return part.text.trim();
      }
      if (part.text && part.text.trim().length > 0) {
        return part.text.trim();
      }
    }
  }

  return null;
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

  const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return json(422, { error: "VALIDATION_ERROR", cid, issues: parsed.error.issues });
  }

  try {
    const supabaseUrl = normalizeSupabaseUrl(env("SUPABASE_URL"));
    const anon = env("SUPABASE_ANON_KEY");
    const service = env("SUPABASE_SERVICE_ROLE_KEY");
    const model = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini";

    const authClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user }
    } = await authClient.auth.getUser();

    if (!user) {
      return json(401, { error: "UNAUTHORIZED", cid, detail: "invalid token" });
    }

    const admin = createClient(supabaseUrl, service);
    const { data: membership } = await admin
      .from("company_members")
      .select("id")
      .eq("company_id", parsed.data.companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return json(403, { error: "FORBIDDEN", cid });
    }

    const { data: company } = await admin
      .from("companies")
      .select("name, settings_json")
      .eq("id", parsed.data.companyId)
      .single();

    const ai = (company?.settings_json as { ai?: { assistant_name?: string; tone?: string; business?: { description?: string; hours?: string } } } | null)?.ai;
    const prompt = [
      `Voce e ${ai?.assistant_name ?? "um assistente"} da empresa ${company?.name ?? "empresa"}.`,
      `Tom: ${ai?.tone ?? "profissional"}.`,
      `Descricao: ${ai?.business?.description ?? "Nao informada"}.`,
      `Horario: ${ai?.business?.hours ?? "Nao informado"}.`,
      "Responda de forma curta e util."
    ].join("\n");

    if (String(process.env.USE_MOCK_OPENAI ?? "true").toLowerCase() === "true" || !process.env.OPENAI_API_KEY) {
      return json(200, {
        ok: true,
        cid,
        mode: "mock",
        response: `[preview/mock] ${parsed.data.customerMessage} -> resposta baseada no contexto de ${company?.name ?? "empresa"}.`
      });
    }

    const openaiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: prompt },
          { role: "user", content: parsed.data.customerMessage }
        ]
      })
    });

    if (!openaiResp.ok) {
      const txt = await openaiResp.text();
      return json(400, { error: "OPENAI_PREVIEW_FAILED", cid, detail: txt });
    }

    const out = (await openaiResp.json()) as unknown;
    const text = extractResponseText(out);

    if (!text) {
      return json(200, {
        ok: true,
        cid,
        mode: "real",
        response: "Sem resposta",
        detail: "OPENAI_EMPTY_OUTPUT",
        raw: out
      });
    }

    return json(200, { ok: true, cid, mode: "real", response: text });
  } catch (error) {
    return json(500, { error: "INTERNAL_ERROR", cid, detail: error instanceof Error ? error.message : "unknown" });
  }
};
