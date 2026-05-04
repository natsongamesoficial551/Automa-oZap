# Integração com WhatsApp

## Objetivo
Receber, processar e responder mensagens com confiabilidade, idempotencia e rastreabilidade por tenant.

## Provedor Recomendado
WhatsApp Cloud API da Meta.

## Dados por Empresa
- `phone_number_id`
- `business_account_id`
- `access_token`
- `app_secret`
- `webhook_verify_token`

Todos os segredos devem ficar criptografados na tabela `api_keys`.

## Webhook
- `GET`: verificação inicial (`hub.challenge`).
- `POST`: eventos reais.

Regra critica: nunca processar IA integral dentro do request de webhook.

## Verificação de Assinatura
Validar `X-Hub-Signature-256` com HMAC SHA-256 e `app_secret`.

Se assinatura for invalida:
- retornar `403`
- registrar evento de seguranca
- nao processar payload

## Mapeamento de Tenant
Resolver `company_id` por `phone_number_id` ou `business_account_id`.

Se mapeamento falhar:
- registrar log de integracao
- marcar evento como `ignored_unmapped_tenant`
- nao tentar responder

## Tratamento de Mensagem Recebida
1. Validar assinatura.
2. Persistir evento bruto.
3. Deduplicar.
4. Salvar mensagem inbound.
5. Criar job assíncrono.
6. Retornar `200` rápido.

Campos importantes para idempotencia:
- `provider_message_id`
- `external_event_id`
- `company_id`

## Resposta Automática
Processar IA em background function e enviar resposta pela API da Meta.

Fluxo sugerido:
1. Job carrega contexto e gera resposta IA.
2. Moderador valida saida.
3. Envia mensagem no endpoint `/messages` da Meta.
4. Persiste status inicial (`sent` ou `failed`).
5. Atualiza com eventos de delivery/read quando chegarem.

## Retry e Limites
- Retry com backoff para timeout/429.
- Não retry automático para token inválido.
- Respeitar janela de 24 horas e templates quando necessário.

Backoff recomendado:
- tentativa 1: imediato
- tentativa 2: +30s
- tentativa 3: +2m
- tentativa 4: +10m
- dead-letter apos limite

## Matriz de Erros WhatsApp
| Erro | Causa comum | Ação |
|---|---|---|
| 400 | payload invalido | corrigir schema e bloquear retry |
| 401 | token expirado/invalido | marcar integracao `error` e pedir renovacao |
| 403 | permissao ausente | validar app/scopes na Meta |
| 404 | `phone_number_id` incorreto | revisar dados da integracao |
| 409 | conflito de estado | reenfileirar com idempotencia |
| 429 | rate limit | retry com backoff |
| 5xx | indisponibilidade Meta | retry com backoff |

## Exemplo Conceitual TypeScript
```ts
export async function sendWhatsAppTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}) {
  const response = await fetch(`https://graph.facebook.com/v20.0/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.text },
    }),
  });

  if (!response.ok) {
    throw new Error(`WHATSAPP_SEND_FAILED: ${await response.text()}`);
  }

  return response.json();
}
```

## Health Check da Integração
Implementar rotina periodica para:
- validar token ainda funcional
- verificar data do ultimo webhook
- alertar inatividade suspeita
- identificar tenant com integracao quebrada antes de perder mensagens

## Sem Acesso ao WhatsApp Real
- Implementar `MockWhatsAppProvider`.
- Simular payload de webhook.
- Registrar TODOs de credenciais reais.

Payload minimo recomendado para simulacao:
- mensagem de texto inbound
- status `sent`
- status `delivered`
- status `failed`
