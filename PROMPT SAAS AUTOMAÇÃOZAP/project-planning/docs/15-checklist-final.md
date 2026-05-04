# Checklist Técnico Final

## Produto
- [ ] Escopo MVP definido
- [ ] Requisitos multiempresa definidos
- [ ] Fluxos críticos priorizados

## Arquitetura
- [ ] Frontend TypeScript definido
- [ ] Backend TypeScript em Netlify Functions
- [ ] Estratégia assíncrona para webhook definida

## Banco
- [ ] Modelagem validada
- [ ] Migrations planejadas
- [ ] Índices críticos definidos
- [ ] Estratégia de memória e RAG definida

## Segurança
- [ ] Segredos criptografados
- [ ] API keys fora do frontend
- [ ] Validação de entrada com Zod
- [ ] Rate limit em endpoints críticos
- [ ] Proteção contra prompt injection

## Integrações
- [ ] OpenAI por tenant
- [ ] WhatsApp por tenant
- [ ] Verificação de assinatura de webhook
- [ ] Retry para falhas transitórias

## Observabilidade
- [ ] Logs estruturados
- [ ] Auditoria de ações críticas
- [ ] Monitoramento de erros ativo

## Deploy
- [ ] Variáveis de ambiente documentadas
- [ ] `netlify.toml` preparado
- [ ] Ambientes dev/staging/prod definidos

## Fallbacks
- [ ] Mock OpenAI pronto
- [ ] Mock WhatsApp pronto
- [ ] TODOs de acesso externo registrados

## Qualidade
- [ ] Testes unitários essenciais
- [ ] Testes E2E de fluxos críticos
- [ ] Critérios de aceite do MVP definidos
