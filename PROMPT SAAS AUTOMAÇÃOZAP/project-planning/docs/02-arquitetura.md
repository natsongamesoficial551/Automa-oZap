# Arquitetura Recomendada

## Objetivo Arquitetural
Equilibrar simplicidade para MVP, segurança para produção, compatibilidade com Netlify, escalabilidade futura e isolamento multiempresa.

## Visão em Camadas
```txt
Usuário Admin
  -> Frontend React/Vite no Netlify

Cliente WhatsApp
  -> Meta WhatsApp Cloud API
  -> Webhook de entrada (Netlify Function)
  -> Banco PostgreSQL
  -> Job assíncrono / Background Function
  -> Serviço de memória + RAG
  -> OpenAI API
  -> WhatsApp send API
  -> Banco + logs
```

## Frontend em TypeScript
- SPA administrativa com React + Vite.
- Autenticação, configuração, monitoramento e operação.
- Sem segredos no browser.

## Backend/API Compatível com Netlify
- Netlify Functions em TypeScript.
- Handler fino + camada de serviço + repositórios.
- Validação com Zod.
- Idempotência para webhooks.

## Banco de Dados Recomendado
- PostgreSQL (preferência: Supabase).
- `pgvector` para busca semântica.
- `jsonb` para configurações flexíveis.
- Índices por `company_id`.

## Sistema de Autenticação
- Supabase Auth.
- Tabela de memberships por empresa.
- Papéis: `owner`, `admin`, `operator`, `viewer`.

## Sistema de Memória
- Memória curta da conversa.
- Memória longa por cliente.
- Memória da empresa.
- Base de conhecimento com chunks.

## Integração OpenAI
- Sempre server-side.
- Chave por empresa, criptografada.
- Modelo configurável por agente.
- Registro de uso/tokens/custo.

## Integração WhatsApp
- WhatsApp Cloud API.
- Verificação do webhook (token + assinatura).
- Resposta rápida ao webhook.
- Processamento pesado assíncrono.

## Painel Admin
- Dashboard, empresa, IA, OpenAI, WhatsApp, base, conversas, clientes, logs e configurações.

## Webhooks
1. Receber evento
2. Validar assinatura
3. Persistir payload bruto
4. Deduplicar
5. Enfileirar processamento
6. Retornar `200` rápido

## Logs e Monitoramento
- Logs estruturados (Pino)
- Erros e traces (Sentry)
- Tabelas de auditoria
- Métricas por tenant e por integração

## Fallbacks Obrigatórios
- Sem OpenAI: modo mock + status de erro claro no painel.
- Sem WhatsApp: simulador de webhook + provider mock.
- Sem `pgvector`: busca textual no Postgres.
- Sem Netlify background: worker externo temporário.
