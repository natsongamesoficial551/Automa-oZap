import type { Handler } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MockOpenAIProvider, MockWhatsAppProvider } from "@automacaozap/core";
import { inboundMessageExists, saveInboundMessage } from "@automacaozap/db";
import { logger } from "./_lib/logger";
import { getTenantScope } from "./_lib/tenant";

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
    const payload = inboundSchema.parse(event.body ? JSON.parse(event.body) : {});
    const companyId = payload.company_id ?? getTenantScope(event).companyId;

    const alreadyProcessed = await inboundMessageExists(payload.message_id);
    if (alreadyProcessed) {
      return json(200, { ok: true, deduplicated: true, correlation_id: correlationId });
    }

    await saveInboundMessage({
      id: randomUUID(),
      companyId,
      from: payload.from,
      text: payload.text,
      providerMessageId: payload.message_id,
      createdAt: new Date().toISOString()
    });

    const openAI = new MockOpenAIProvider();
    const whatsapp = new MockWhatsAppProvider();

    const reply = await openAI.generateReply({
      tenant: { companyId, correlationId },
      customerMessage: payload.text,
      model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini"
    });

    const sendResult = await whatsapp.sendText({
      tenant: { companyId, correlationId },
      to: payload.from,
      text: reply.text
    });

    logger.info(
      {
        correlation_id: correlationId,
        company_id: companyId,
        inbound_message_id: payload.message_id,
        outbound_message_id: sendResult.providerMessageId,
        integration_mode: { openai: reply.mode, whatsapp: sendResult.mode }
      },
      "inbound processed in mock mode"
    );

    return json(200, {
      ok: true,
      correlation_id: correlationId,
      mode: "mock",
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
