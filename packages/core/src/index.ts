export type IntegrationMode = "real" | "mock";

export interface TenantContext {
  companyId: string;
  correlationId: string;
}

export interface OpenAIProvider {
  generateReply(input: {
    tenant: TenantContext;
    customerMessage: string;
    model: string;
  }): Promise<{ text: string; mode: IntegrationMode; tokensIn: number; tokensOut: number }>;
}

export class MockOpenAIProvider implements OpenAIProvider {
  async generateReply(input: {
    tenant: TenantContext;
    customerMessage: string;
    model: string;
  }): Promise<{ text: string; mode: IntegrationMode; tokensIn: number; tokensOut: number }> {
    return {
      text: `[mock/${input.model}] Recebemos sua mensagem: \"${input.customerMessage}\". Um atendente retornara em seguida.`,
      mode: "mock",
      tokensIn: Math.max(6, Math.round(input.customerMessage.length / 4)),
      tokensOut: 24
    };
  }
}

export interface WhatsAppProvider {
  sendText(input: {
    tenant: TenantContext;
    to: string;
    text: string;
  }): Promise<{ providerMessageId: string; mode: IntegrationMode }>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendText(input: {
    tenant: TenantContext;
    to: string;
    text: string;
  }): Promise<{ providerMessageId: string; mode: IntegrationMode }> {
    const safePhone = input.to.replace(/\D/g, "").slice(-6);
    return {
      providerMessageId: `mock-${input.tenant.companyId}-${safePhone}-${Date.now()}`,
      mode: "mock"
    };
  }
}
