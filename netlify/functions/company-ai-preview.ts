import type { Handler } from "@netlify/functions";
import { z } from "zod";
import { correlationId, json } from "./_lib/http";
import { requireTenant, tenantErrorCode, tenantErrorStatus } from "./_lib/tenant";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  customerMessage: z.string().min(2).max(1000)
});

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

  function deepFindText(node: unknown): string | null {
    if (!node) return null;
    if (typeof node === "string") {
      const trimmed = node.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = deepFindText(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (typeof record.text === "string" && record.text.trim().length > 0) {
        return record.text.trim();
      }
      if (typeof record.output_text === "string" && record.output_text.trim().length > 0) {
        return record.output_text.trim();
      }
      for (const value of Object.values(record)) {
        const found = deepFindText(value);
        if (found) return found;
      }
    }
    return null;
  }

  return deepFindText((payload as { output?: unknown }).output);
}

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
    const model = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini";
    const tenant = await requireTenant(event, parsed.data.companyId);

    const { data: company } = await tenant.admin
      .from("companies")
      .select("name, settings_json")
      .eq("id", tenant.companyId)
      .single();

    const ai = (company?.settings_json as {
      ai?: {
        assistant_name?: string;
        tone?: string;
        objective?: string;
        forbidden_topics?: string;
        escalation_rules?: string;
        business?: { description?: string; hours?: string };
        playbook?: Array<{ intent?: string; baseReply?: string }>;
      };
    } | null)?.ai;
    const playbookLines = (ai?.playbook ?? [])
      .slice(0, 8)
      .map((item) => `- Intencao: ${item.intent ?? ""} | Resposta base: ${item.baseReply ?? ""}`)
      .join("\n");

    const prompt = [
      `Voce e ${ai?.assistant_name ?? "um assistente"} da empresa ${company?.name ?? "empresa"}.`,
      `Objetivo: ${ai?.objective ?? "nao informado"}.`,
      `Tom: ${ai?.tone ?? "profissional"}.`,
      `Descricao: ${ai?.business?.description ?? "Nao informada"}.`,
      `Horario: ${ai?.business?.hours ?? "Nao informado"}.`,
      `Topicos proibidos: ${ai?.forbidden_topics ?? "nao informado"}.`,
      `Escalonamento humano: ${ai?.escalation_rules ?? "nao informado"}.`,
      playbookLines ? `Playbook:\n${playbookLines}` : "",
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
    return json(tenantErrorStatus(error), {
      error: tenantErrorCode(error),
      cid,
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
};
