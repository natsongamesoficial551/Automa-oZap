# AutomacaoZap SaaS

Base inicial do SaaS de atendimento com IA no WhatsApp, seguindo o pacote em `PROMPT SAAS AUTOMAÇÃOZAP/project-planning`.

## Estrutura

```txt
apps/web               -> painel React + Vite
netlify/functions      -> backend serverless (health + webhook)
packages/core          -> contratos e providers mock
packages/db            -> repositorio em memoria (fallback sem banco)
```

## Comandos

```bash
npm install
npm run dev:web
npm run build
npm run typecheck
npm run dev:functions
```

Para auth no frontend, configure no `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Endpoints iniciais

- `GET /.netlify/functions/health`
- `GET /.netlify/functions/whatsapp-webhook` para `hub.challenge`
- `POST /.netlify/functions/whatsapp-webhook` para fluxo inbound mock

Observacao de tenant no webhook:
- envie `company_id` no body ou header `x-company-id`

Payload mock POST:

```json
{
  "company_id": "acme",
  "message_id": "wpp-123",
  "from": "+5511999990000",
  "text": "Oi, quero agendar"
}
```

## TODOs de acesso externo

- TODO[OPENAI-ACCESS-01]: cadastrar API key real por tenant.
- TODO[WPP-ACCESS-01]: configurar Meta Cloud API por tenant.
- TODO[DB-SETUP-01]: provisionar Supabase/Postgres e criar migrations.
- TODO[NETLIFY-SETUP-01]: criar site no Netlify e preencher env vars.
