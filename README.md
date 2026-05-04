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

Auth atual: login via Google (Supabase OAuth).
No Supabase, habilite Google provider e adicione Redirect URLs:
- `http://localhost:5173`
- `https://SEU-SITE.netlify.app`

## Endpoints iniciais

- `GET /.netlify/functions/health`
- `GET /.netlify/functions/whatsapp-webhook` para `hub.challenge`
- `POST /.netlify/functions/whatsapp-webhook` para fluxo inbound mock
- `POST /.netlify/functions/onboarding-company` para criar empresa inicial do usuario
- `GET/POST /.netlify/functions/company-ai-settings?company_id=UUID` para configurar IA por empresa
- `POST /.netlify/functions/company-ai-preview` para testar resposta da IA com contexto da empresa

Observacao: o modelo da OpenAI e controlado apenas por `OPENAI_DEFAULT_MODEL` no ambiente (nao editavel no painel).

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

## Setup do banco no Supabase

1. Abra Supabase > SQL Editor.
2. Copie e rode `packages/db/migrations/0001_init.sql`.
3. Crie seu usuario via Auth (signup pelo app ou dashboard).
4. Rode o seed minimo abaixo trocando os valores:

```sql
insert into public.companies (name, slug)
values ('Minha Empresa', 'minha-empresa')
returning id;

insert into public.company_members (company_id, user_id, role)
values ('COMPANY_ID_AQUI', 'USER_ID_DO_AUTH_USERS', 'owner');
```
