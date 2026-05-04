# Stack Técnica Recomendada

| Camada | Escolha Principal | Motivo | Alternativa |
|---|---|---|---|
| Linguagem | TypeScript | Tipagem forte e unificação frontend/backend | Obrigatória |
| Frontend | React + Vite | Ideal para painel SaaS no Netlify | Next.js quando SSR for necessário |
| Backend | Netlify Functions | Simples e nativo na plataforma | Hono sobre Functions |
| Banco | PostgreSQL | Confiável para multiempresa | MySQL |
| Provedor DB | Supabase | DB + Auth + Storage + pgvector | Neon + serviços separados |
| ORM | Drizzle ORM | Leve para serverless | Prisma |
| Auth | Supabase Auth | Integração rápida | Auth.js/Clerk |
| Validação | Zod | Schemas reutilizáveis e runtime-safe | Valibot |
| Estado remoto | TanStack Query | Cache e invalidação robustos | SWR |
| Formulários | React Hook Form | Performance e ergonomia | Formik |
| UI | Tailwind + shadcn/ui | Velocidade com flexibilidade | Chakra/Mantine |
| IA | OpenAI SDK | Oficial e atualizado | Adaptador próprio |
| WhatsApp | Cloud API Meta | API oficial | Twilio WhatsApp |
| Logs | Pino | Estruturado e rápido | Winston |
| Erros | Sentry | Alertas e rastreio | Bugsnag |
| Testes unitários | Vitest | Rápido com TypeScript | Jest |
| Testes E2E | Playwright | Fluxos de painel e integração | Cypress |

## Escolha de Frontend Mais Adequada para Netlify
Recomendação: **React + Vite**, pois o core é painel administrativo, com deploy estático simples, build rápido e baixo acoplamento com SSR.

## Organização de Projeto Sugerida
```txt
/apps
  /web
/netlify
  /functions
/packages
  /core
  /db
  /shared
  /integrations
  /prompts
```

## Observações de Escalabilidade
- Começar simples no Netlify Functions.
- Extrair workers pesados quando necessário.
- Manter integrações por adaptadores para trocar providers sem refatoração ampla.
