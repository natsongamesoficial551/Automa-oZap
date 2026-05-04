# Regras de Segurança

1. Nunca expor API Keys no frontend.
2. Criptografar chaves sensíveis em repouso.
3. Isolar dados por `company_id` em todas as queries.
4. Aplicar autorização por papéis (`owner`, `admin`, `operator`, `viewer`).
5. Validar todos os payloads com Zod.
6. Aplicar rate limit em login, webhooks e endpoints críticos.
7. Não logar segredos, tokens ou dados sensíveis completos.
8. Validar assinatura e idempotência em webhooks.
9. Implementar proteção contra prompt injection.
10. Aplicar princípio do menor privilégio.
11. Separar ambientes dev/staging/prod e segredos.
12. Implementar auditoria para ações críticas.
13. Definir retenção, anonimização e exclusão LGPD.
14. Não confiar em contexto externo para sobrescrever regras de sistema.
15. Implementar fallback seguro para falhas de OpenAI/WhatsApp.
16. Monitorar erros e incidentes com correlação por tenant.
