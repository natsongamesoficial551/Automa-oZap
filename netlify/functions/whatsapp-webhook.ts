import type { Handler } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MockOpenAIProvider, MockWhatsAppProvider } from "@automacaozap/core";
import { logger } from "./_lib/logger";
import { getTenantScope } from "./_lib/tenant";
import { decryptSecret, verifyMetaSignature } from "./_lib/crypto";

const querySchema = z.object({
  "hub.mode": z.string(),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string()
});

const inboundSchema = z.object({
  company_id: z.string().min(1).optional(),
  message_id: z.string().min(1),
  from: z.string().min(8),
  text: z.string().min(1)
});

const metaPayloadSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({ phone_number_id: z.string().optional() }).optional(),
            contacts: z.array(z.object({ wa_id: z.string().optional() })).optional(),
            messages: z
              .array(
                z.object({
                  id: z.string(),
                  from: z.string(),
                  type: z.string().optional(),
                  text: z.object({ body: z.string().optional() }).optional()
                })
              )
              .optional()
          })
        })
      )
    })
  )
});

function json(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`ENV_MISSING: ${name} nao definida. Consulte .env.example.`);
  }
  return value;
}

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "").replace(/\/rest\/v1.*$/, "");
}

function isMockEnabled(name: "USE_MOCK_OPENAI" | "USE_MOCK_WHATSAPP"): boolean {
  return String(process.env[name] ?? "true").toLowerCase() === "true";
}

async function findCompanyByPhoneNumberId(admin: ReturnType<typeof createClient>, phoneNumberId?: string): Promise<string | null> {
  if (!phoneNumberId) return null;

  const { data } = await admin
    .from("integrations")
    .select("company_id")
    .eq("provider", "whatsapp")
    .contains("metadata_json", { phone_number_id: phoneNumberId })
    .maybeSingle();

  return data?.company_id ?? null;
}

async function getTenantSecret(admin: ReturnType<typeof createClient>, companyId: string, provider: "openai" | "whatsapp"): Promise<string | null> {
  const { data } = await admin
    .from("integrations")
    .select("encrypted_secret")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data?.encrypted_secret) return null;
  if (!process.env.APP_ENCRYPTION_KEY) return null;

  try {
    return decryptSecret(data.encrypted_secret, process.env.APP_ENCRYPTION_KEY);
  } catch {
    return null;
  }
}

async function generateReply(input: {
  companyId: string;
  correlationId: string;
  customerMessage: string;
  model: string;
  admin: ReturnType<typeof createClient>;
}): Promise<{ text: string; mode: "mock" | "real"; tokenIn: number | null; tokenOut: number | null }> {
  if (isMockEnabled("USE_MOCK_OPENAI")) {
    const mock = new MockOpenAIProvider();
    const result = await mock.generateReply({
      tenant: { companyId: input.companyId, correlationId: input.correlationId },
      customerMessage: input.customerMessage,
      model: input.model
    });

    return { text: result.text, mode: "mock", tokenIn: result.tokensIn, tokenOut: result.tokensOut };
  }

  const tenantKey = await getTenantSecret(input.admin, input.companyId, "openai");
  const apiKey = tenantKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const mock = new MockOpenAIProvider();
    const result = await mock.generateReply({
      tenant: { companyId: input.companyId, correlationId: input.correlationId },
      customerMessage: input.customerMessage,
      model: input.model
    });
    return { text: result.text, mode: "mock", tokenIn: result.tokensIn, tokenOut: result.tokensOut };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        {
          role: "system",
          content: "Voce e um assistente de atendimento no WhatsApp. Seja objetivo e educado."
        },
        {
          role: "user",
          content: input.customerMessage
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`openai_error_${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  return {
    text: payload.output_text ?? "Recebemos sua mensagem e vamos responder em instantes.",
    mode: "real",
    tokenIn: payload.usage?.input_tokens ?? null,
    tokenOut: payload.usage?.output_tokens ?? null
  };
}

async function sendWhatsAppReply(input: {
  admin: ReturnType<typeof createClient>;
  companyId: string;
  correlationId: string;
  to: string;
  text: string;
}): Promise<{ providerMessageId: string; mode: "mock" | "real" }> {
  if (isMockEnabled("USE_MOCK_WHATSAPP")) {
    const mock = new MockWhatsAppProvider();
    const result = await mock.sendText({ tenant: { companyId: input.companyId, correlationId: input.correlationId }, to: input.to, text: input.text });
    return { providerMessageId: result.providerMessageId, mode: "mock" };
  }

  const tenantToken = await getTenantSecret(input.admin, input.companyId, "whatsapp");
  const accessToken = tenantToken ?? process.env.WHATSAPP_ACCESS_TOKEN;

  const { data: integration } = await input.admin
    .from("integrations")
    .select("metadata_json")
    .eq("company_id", input.companyId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  const phoneNumberId =
    (integration?.metadata_json as { phone_number_id?: string } | null)?.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    const mock = new MockWhatsAppProvider();
    const result = await mock.sendText({ tenant: { companyId: input.companyId, correlationId: input.correlationId }, to: input.to, text: input.text });
    return { providerMessageId: result.providerMessageId, mode: "mock" };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { body: input.text }
    })
  });

  if (!response.ok) {
    throw new Error(`whatsapp_error_${response.status}`);
  }

  const payload = (await response.json()) as { messages?: Array<{ id: string }> };
  return { providerMessageId: payload.messages?.[0]?.id ?? `wpp-${Date.now()}`, mode: "real" };
}

function parseInboundPayload(bodyRaw: string): {
  source: "custom" | "meta";
  companyId?: string;
  messageId: string;
  from: string;
  text: string;
  phoneNumberId?: string;
} {
  const parsed = JSON.parse(bodyRaw);

  const customParsed = inboundSchema.safeParse(parsed);
  if (customParsed.success) {
    return {
      source: "custom",
      companyId: customParsed.data.company_id,
      messageId: customParsed.data.message_id,
      from: customParsed.data.from,
      text: customParsed.data.text
    };
  }

  const metaParsed = metaPayloadSchema.parse(parsed);
  const firstValue = metaParsed.entry[0]?.changes[0]?.value;
  const message = firstValue?.messages?.[0];
  if (!message || !message.text?.body) {
    throw new Error("unsupported_meta_payload");
  }

  return {
    source: "meta",
    messageId: message.id,
    from: message.from,
    text: message.text.body,
    phoneNumberId: firstValue?.metadata?.phone_number_id
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "GET") {
    try {
      const parsed = querySchema.parse(event.queryStringParameters ?? {});
      const token = requireEnv("WHATSAPP_VERIFY_TOKEN");

      if (parsed["hub.mode"] !== "subscribe" || parsed["hub.verify_token"] !== token) {
        return json(403, { error: "invalid_verify_token" });
      }

      return { statusCode: 200, body: parsed["hub.challenge"] };
    } catch (error) {
      return json(400, {
        error: "invalid_challenge_request",
        detail: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const correlationId = randomUUID();

  try {
    const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const bodyRaw = event.body ?? "{}";
    const parsedInbound = parseInboundPayload(bodyRaw);

    if (parsedInbound.source === "meta" && process.env.WHATSAPP_APP_SECRET) {
      const signature = event.headers["x-hub-signature-256"] || event.headers["X-Hub-Signature-256"];
      const valid = verifyMetaSignature(bodyRaw, signature, process.env.WHATSAPP_APP_SECRET);
      if (!valid) {
        return json(403, { error: "invalid_meta_signature", correlation_id: correlationId });
      }
    }

    const headerCompanyId = (() => {
      try {
        return getTenantScope(event).companyId;
      } catch {
        return undefined;
      }
    })();

    const companyId =
      parsedInbound.companyId ??
      headerCompanyId ??
      (await findCompanyByPhoneNumberId(admin, parsedInbound.phoneNumberId));

    if (!companyId) {
      return json(400, { error: "company_resolution_failed", correlation_id: correlationId });
    }

    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("company_id", companyId)
      .eq("provider_message_id", parsedInbound.messageId)
      .maybeSingle();

    if (existing) {
      return json(200, { ok: true, deduplicated: true, correlation_id: correlationId });
    }

    const { data: conversation } = await admin
      .from("conversations")
      .upsert(
        {
          company_id: companyId,
          customer_phone: parsedInbound.from,
          last_message_at: new Date().toISOString()
        },
        { onConflict: "company_id,customer_phone" }
      )
      .select("id")
      .single();

    if (!conversation?.id) {
      throw new Error("conversation_upsert_failed");
    }

    await admin.from("messages").insert({
      company_id: companyId,
      conversation_id: conversation.id,
      direction: "inbound",
      provider_message_id: parsedInbound.messageId,
      body: parsedInbound.text,
      status: "received",
      metadata_json: {
        source: parsedInbound.source,
        correlation_id: correlationId
      }
    });

    const reply = await generateReply({
      companyId,
      correlationId,
      customerMessage: parsedInbound.text,
      model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini",
      admin
    });

    const sendResult = await sendWhatsAppReply({
      admin,
      companyId,
      correlationId,
      to: parsedInbound.from,
      text: reply.text
    });

    await admin.from("messages").insert({
      company_id: companyId,
      conversation_id: conversation.id,
      direction: "outbound",
      provider_message_id: sendResult.providerMessageId,
      body: reply.text,
      status: "sent",
      token_input: reply.tokenIn,
      token_output: reply.tokenOut,
      model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini",
      metadata_json: {
        correlation_id: correlationId,
        integration_mode: { openai: reply.mode, whatsapp: sendResult.mode }
      }
    });

    await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

    logger.info(
      {
        correlation_id: correlationId,
        company_id: companyId,
        inbound_message_id: parsedInbound.messageId,
        outbound_message_id: sendResult.providerMessageId,
        integration_mode: { openai: reply.mode, whatsapp: sendResult.mode }
      },
      "inbound processed"
    );

    return json(200, {
      ok: true,
      correlation_id: correlationId,
      mode: { openai: reply.mode, whatsapp: sendResult.mode },
      response_preview: reply.text
    });
  } catch (error) {
    logger.error(
      {
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : "unknown"
      },
      "webhook processing failed"
    );

    return json(400, {
      ok: false,
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
};
