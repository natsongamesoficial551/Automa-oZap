# Deploy no Netlify

## Objetivo
Publicar frontend e backend serverless com estabilidade para webhook, integrações externas e escalabilidade progressiva.

## Variáveis de Ambiente
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY`
- `OPENAI_DEFAULT_MODEL`
- `SENTRY_DSN`
- `APP_BASE_URL`
- `APP_ENV`

Variaveis adicionais recomendadas:
- `ENABLE_MOCK_OPENAI`
- `ENABLE_MOCK_WHATSAPP`
- `LOG_LEVEL`
- `MAX_WEBHOOK_RETRY`

## Build e Publicação
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Para monorepo, ajuste para:
- Build: `npm run build --workspaces`
- Publish: `apps/web/dist`

## Exemplo de netlify.toml
```toml
[build]
command = "npm run build"
publish = "dist"

[functions]
directory = "netlify/functions"
node_bundler = "esbuild"

[functions."whatsapp-webhook"]
included_files = ["packages/**"]

[[redirects]]
from = "/api/*"
to = "/.netlify/functions/:splat"
status = 200
```

## Pipeline Recomendado de Deploy
1. Deploy preview por PR.
2. Smoke tests de API essenciais.
3. Validacao de env vars obrigatorias.
4. Deploy em staging.
5. Teste de webhook real ou simulado.
6. Deploy em producao.

## Webhooks
- URL pública HTTPS para função de webhook.
- Validar token e assinatura.
- Responder rápido e processar em background.

Timeout alvo do webhook:
- responder em menos de 2 segundos
- mover todo processamento pesado para job assíncrono

## Cuidados Serverless
- Sem persistência local.
- Evitar processamento pesado síncrono.
- Planejar cold starts e timeout.
- Usar banco e storage externos.

Padroes recomendados:
- handlers pequenos
- servicos reutilizaveis
- retry idempotente
- logs estruturados com `correlation_id`

## Limitações e Alternativas
- Se background function não suportar carga, mover workers para serviço externo.
- Se função exceder tempo, dividir pipeline em jobs.
- Se webhook instável, persistir evento primeiro e reprocessar depois.

## Solução de Erros no Deploy
| Erro | Sintoma | Solucao |
|---|---|---|
| Build fail por env | variavel nao definida | criar validacao de env no boot |
| Function crash | 500 no endpoint | revisar bundling e imports server-only |
| Timeout | webhook demora | responder cedo e enfileirar |
| CORS | frontend nao acessa API | configurar headers de origem |
| Missing module | erro em runtime | garantir dependencia no workspace correto |

## Playbook de Incidente Rapido
1. Identificar endpoint com falha.
2. Ver ultimo deploy com regressao.
3. Ver logs por `correlation_id`.
4. Ativar modo degradado com mock se necessario.
5. Corrigir e redeploy.
6. Validar fluxo ponta a ponta.

## Caso Algo Não Seja Suportado no Netlify
- Mover jobs para worker externo.
- Manter frontend no Netlify e backend em funcoes externas.
- Continuar com a mesma camada de servicos para nao reescrever dominio.
