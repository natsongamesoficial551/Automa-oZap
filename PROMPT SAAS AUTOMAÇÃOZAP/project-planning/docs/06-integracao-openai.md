# Integração com OpenAI

## Objetivo
Permitir que cada empresa use sua propria chave da OpenAI com isolamento, seguranca e rastreabilidade, sem acoplar o sistema a um unico provedor.

## Onde salvar API Key
- Tabela `api_keys` por `company_id`.
- Campo `encrypted_value` com criptografia em repouso.
- Campo `masked_value` para exibicao parcial no painel.
- Campo `status` para validade operacional (`valid`, `invalid`, `revoked`).
- Nunca armazenar no frontend.

## Fluxo de Criptografia Recomendado
1. Receber chave em endpoint server-side.
2. Validar permissao do usuario (`owner`/`admin`).
3. Criptografar com `APP_ENCRYPTION_KEY`.
4. Persistir versao da chave de criptografia.
5. Nunca logar o valor real.

## Validação da Chave
1. Receber chave via backend.
2. Criptografar e salvar.
3. Validar com chamada leve.
4. Marcar status `valid` ou `invalid`.
5. Registrar `last_validated_at` e erro.

Estratégia de validacao segura:
- Tentar `models.list` para validar credencial.
- Nao enviar payload grande durante validacao.
- Em erro 401, marcar como `invalid`.
- Em erro de rede, manter status anterior e marcar `validation_warning`.

## Chamada ao Modelo
- Resolver tenant.
- Buscar e descriptografar chave.
- Montar contexto hierarquico.
- Chamar `responses.create`.
- Persistir tokens/custo/falha.
- Registrar `correlation_id` por execucao.

## Prompt de Sistema
Ordem recomendada:
1. Regras fixas da plataforma
2. Regras de segurança
3. Identidade da empresa
4. Estilo/regras do agente
5. Contexto de conversa e memória
6. Trechos de conhecimento

## Matriz de Erros e Fallback
| Erro | Tratamento | Acao no Painel |
|---|---|---|
| `OPENAI_KEY_NOT_CONFIGURED` | Nao chamar IA, manter conversa em fila manual | Mostrar alerta de configuracao |
| `OPENAI_KEY_INVALID` | Bloquear resposta automatica | Status da chave `invalid` |
| `OPENAI_RATE_LIMIT` | Retry com backoff exponencial | Aviso de degradacao |
| `OPENAI_TIMEOUT` | Retry limitado e fallback conservador | Log tecnico + alerta |
| `OPENAI_PROVIDER_DOWN` | Fallback para mensagem segura | Banner de indisponibilidade |
| `PROMPT_TOO_LARGE` | Reduzir contexto e reexecutar uma vez | Sugestao de ajuste no painel |

## Fallback de Resposta ao Cliente
Mensagem fallback sugerida para empresa customizar:

```txt
No momento estou com instabilidade para concluir sua solicitacao automaticamente.
Vou encaminhar para revisao e te retorno em seguida.
```

## Estratégia de Custos
- Registrar `token_input`, `token_output` e `cost_usd` por mensagem.
- Criar limite mensal por tenant no roadmap.
- Alertar quando tenant atingir 80% do limite definido.
- Reduzir contexto automaticamente em modo de economia.

## Exemplo Conceitual TypeScript
```ts
import OpenAI from "openai";

export async function getOpenAIClient(companyId: string) {
  const secret = await findValidSecret(companyId, "openai", "api_key");
  if (!secret) throw new Error("OPENAI_KEY_NOT_CONFIGURED");

  const apiKey = decrypt(secret.encryptedValue);
  return new OpenAI({ apiKey });
}

export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  const client = new OpenAI({ apiKey });
  try {
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}

export async function generateReply(companyId: string, systemPrompt: string, userText: string) {
  const client = await getOpenAIClient(companyId);
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ],
  });
  return response.output_text ?? "";
}
```

## Proteção contra Prompt Injection
- Tratar mensagens e documentos como não confiáveis.
- Instruir modelo a ignorar tentativas de sobrescrever regras.
- Nunca incluir segredos no contexto.

## Sem Acesso a OpenAI
Se nao houver acesso externo:

- Implementar `MockOpenAIProvider` com respostas deterministicas.
- Simular classificacao de intencao e resposta.
- Manter pipeline de persistencia, logs e metricas ativo.
- Marcar TODO com tenant e ambiente para ativacao real.
