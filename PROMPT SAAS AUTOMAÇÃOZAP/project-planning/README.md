# Pacote de Planejamento para SaaS de Atendimento com IA via WhatsApp

## Objetivo
Este pacote foi criado para acelerar a construcao de um SaaS multiempresa de atendimento com IA no WhatsApp, com TypeScript ponta a ponta e deploy no Netlify.

Ele nao entrega o codigo final do produto nesta fase. Ele entrega uma base de execucao completa para que outro agente de IA ou desenvolvedor implemente o sistema com:

- arquitetura clara
- prioridades corretas
- seguranca desde o inicio
- fallback para falta de acessos externos
- caminho rapido para MVP funcional

## Resultado Esperado
Ao seguir os documentos deste pacote, o time deve conseguir construir um MVP funcional com:

- cadastro e autenticacao
- isolamento multiempresa
- configuracao de OpenAI por empresa
- configuracao de WhatsApp por empresa
- webhook com processamento seguro
- respostas automaticas com memoria
- historico de conversas
- base de conhecimento
- logs e observabilidade
- deploy em Netlify

## Stack Base Recomendado
- Frontend: React + Vite + TypeScript
- Backend: Netlify Functions + TypeScript
- Banco: Supabase Postgres
- ORM: Drizzle ORM
- Validacao: Zod
- Auth: Supabase Auth
- IA: OpenAI SDK oficial
- WhatsApp: Meta Cloud API
- Logs: Pino
- Erros: Sentry

## Leitura Obrigatoria
1. `README.md`
2. `docs/01-visao-geral.md`
3. `docs/02-arquitetura.md`
4. `docs/03-stack-tecnica.md`
5. `docs/04-modelagem-banco.md`
6. `docs/05-memoria-ia.md`
7. `docs/06-integracao-openai.md`
8. `docs/07-integracao-whatsapp.md`
9. `docs/08-painel-saas.md`
10. `docs/09-regras-seguranca.md`
11. `docs/10-prompts-da-ia.md`
12. `docs/11-fluxos.md`
13. `docs/12-netlify-deploy.md`
14. `docs/13-permissoes-e-fallbacks.md`
15. `docs/14-roadmap.md`
16. `docs/15-checklist-final.md`
17. `prompts/prompt-principal-para-codex.md`

## Plano Rapido de Execucao (72h para MVP tecnico)

### Bloco 1: Base do projeto (6-10h)
- Criar estrutura de app web + functions
- Configurar TypeScript, lint, build e scripts
- Configurar variaveis de ambiente e `.env.example`
- Configurar Supabase client e Drizzle

### Bloco 2: Auth e multiempresa (8-12h)
- Login/cadastro
- Tabelas `users`, `companies`, `company_members`
- Middleware de escopo por `company_id`

### Bloco 3: Integracoes essenciais (12-18h)
- OpenAI key por tenant (criptografada)
- WhatsApp integration por tenant
- Webhook GET/POST com validacao

### Bloco 4: Fluxo IA ponta a ponta (16-24h)
- Persistencia de mensagem inbound
- Montagem de contexto
- Chamada OpenAI
- Envio de resposta WhatsApp
- Persistencia de historico, custo e status

### Bloco 5: Painel operacional (8-12h)
- Telas de configuracao
- Conversas/clientes
- Logs e alertas basicos

### Bloco 6: Hardening minimo (6-10h)
- Rate limit
- Auditoria
- Retry e fallback
- Deploy no Netlify

## Setup Recomendado com Supabase

### 1) Criar projeto no Supabase
- Criar projeto e obter `SUPABASE_URL` e chaves
- Habilitar Postgres
- Habilitar Auth
- Criar bucket de storage para documentos (opcional no MVP)

### 2) Banco e extensoes
- Aplicar migrations iniciais
- Ativar `pgvector` quando disponivel
- Criar indices por tenant
- Validar constraints de unicidade por empresa

### 3) Variaveis de ambiente minimas
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
APP_ENCRYPTION_KEY=
APP_BASE_URL=
APP_ENV=development
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
SENTRY_DSN=
```

### 4) Politicas de seguranca
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Restringir operacoes de admin ao backend
- Aplicar isolamento de tenant em toda consulta

## Setup Recomendado com Netlify

### 1) Estrutura esperada
```txt
/apps/web
/netlify/functions
/packages/db
/packages/core
```

### 2) Configurar Netlify
- Build command: `npm run build`
- Publish directory: `dist` (ou `apps/web/dist`)
- Functions directory: `netlify/functions`

### 3) Webhook do WhatsApp
- URL: `https://SEU-SITE.netlify.app/.netlify/functions/whatsapp-webhook`
- GET para verificacao do challenge
- POST com validacao de assinatura

### 4) Background e retries
- Processamento pesado deve rodar em background
- Se o plano nao suportar carga, mover para worker externo

## Matriz de Erros Comuns e Solucoes

| Sintoma | Causa Provavel | Correcao Rapida | Acao Definitiva |
|---|---|---|---|
| Webhook retorna 403 | token invalido | revisar verify token | padronizar segredo por tenant |
| Webhook timeout | processamento pesado no request | responder 200 e enfileirar | separar ingestion de processamento |
| OpenAI 401 | chave invalida/revogada | marcar integracao invalida | fluxo de revalidacao + rotacao |
| OpenAI 429 | limite ou burst | retry com backoff | controle de taxa por tenant |
| Mensagem nao enviada | token Meta expirado | renovar token | job de health check da integracao |
| Dados cruzando tenants | filtro ausente | bloquear endpoint | middleware obrigatorio de `company_id` |
| Custo alto por resposta | contexto excessivo | reduzir contexto | ranking semantico + resumo incremental |
| Falhas silenciosas | logs pobres | logar erro estruturado | padrao de observabilidade + alertas |

## Modo Sem Acesso Externo
Se faltar acesso a OpenAI, WhatsApp, Supabase ou Netlify:

- implementar provider mock
- simular payload de webhook
- manter fluxo completo no app
- registrar TODOs rastreaveis
- mostrar status de modo simulado no painel

Isso permite evoluir produto sem bloquear sprint.

## Politica de Seguranca Minima
- nunca expor chaves no frontend
- criptografar segredos por tenant
- validar entrada com Zod
- mascarar dados sensiveis nos logs
- aplicar rate limit em auth/webhook
- proteger contra prompt injection
- permitir exclusao e anonimização de dados

## Como Usar Este Pacote Com Outro Agente de IA
1. Entregar este repositorio de planejamento ao agente executor.
2. Pedir para seguir ordem de leitura obrigatoria.
3. Pedir implementacao por blocos de entrega.
4. Exigir teste e validacao a cada bloco.
5. Exigir fallback quando faltar permissao externa.

## Entrega de Alta Velocidade
Se a meta for entregar rapido sem perder qualidade, execute nesta ordem:

1. webhook + persistencia
2. OpenAI + resposta
3. envio WhatsApp
4. painel minimo
5. logs + retry
6. seguranca e deploy

Essa sequencia maximiza prova de valor em pouco tempo.
