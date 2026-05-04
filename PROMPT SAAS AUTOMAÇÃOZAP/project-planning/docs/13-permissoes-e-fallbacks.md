# Permissões e Fallbacks

## Objetivo
Permitir avanço do desenvolvimento mesmo sem acessos externos.

## Regra de Ouro
Falta de acesso nao bloqueia implementacao. Bloqueia somente a ativacao real do recurso.

Sempre implementar:
- interface do provider
- implementacao real
- implementacao mock
- TODO rastreavel
- indicador visual no painel

## Cenários

### Sem acesso à OpenAI API Key
- Implementar `MockOpenAIProvider`.
- Simular respostas determinísticas.
- Exibir status de integração pendente.
- TODO: cadastrar chave real por tenant.

Checklist:
- [ ] fluxo de resposta funciona com mock
- [ ] logs de custo ficam sinalizados como `estimated/mock`
- [ ] erro de chave ausente aparece no painel

### Sem acesso ao WhatsApp
- Implementar `MockWhatsAppProvider`.
- Simular webhook de entrada.
- Simular envio e status.
- TODO: configurar `phone_number_id` e tokens reais.

Checklist:
- [ ] inbound simulado persiste mensagem
- [ ] outbound simulado gera `provider_message_id` fake
- [ ] status de entrega simulado atualiza conversa

### Sem banco configurado
- Implementar repositórios mock temporários.
- Rodar fluxo local com fixtures.
- TODO: provisionar Postgres e aplicar migrations.

Observacao:
- modo sem banco e apenas para demonstração local
- para qualquer teste de multiempresa, banco real e obrigatorio

### Sem variáveis de ambiente
- Falhar com erro explícito.
- Permitir modo mock para desenvolvimento.
- TODO: preencher `.env` por ambiente.

Exemplo de falha clara:
```txt
ENV_MISSING: DATABASE_URL nao definida. Consulte README e docs/12-netlify-deploy.md.
```

### Sem permissão no Netlify
- Testar com `netlify dev` local.
- Preparar `netlify.toml` e estrutura de functions.
- TODO: criar site e configurar env vars no Netlify.

Plano B:
- rodar frontend local
- expor webhook com tunel temporario para homologacao
- manter contrato de endpoint identico ao deploy final

### Sem acesso ao domínio
- Usar subdomínio temporário da Netlify.
- Configurar webhook temporário.
- TODO: migrar para domínio final.

Risco comum:
- esquecer de atualizar URL no app Meta apos troca de dominio

Mitigacao:
- checklist de go-live com validacao de webhook real

## Matriz de Decisão de Fallback
| Condição | Modo | Impacto de Produto | Próxima ação |
|---|---|---|---|
| Sem OpenAI | mock IA | sem resposta real, mas fluxo validado | cadastrar chave e revalidar |
| Sem WhatsApp | mock canal | sem mensagem real no cliente | configurar Meta Cloud API |
| Sem Supabase | mock dados | sem persistencia confiavel | provisionar Postgres e migrar |
| Sem Netlify | local/staging alternativo | sem URL publica oficial | criar site e configurar deploy |
| Sem domínio | URL temporaria | risco de troca posterior | atualizar webhook na Meta |

## Padrão de TODO
```txt
TODO[OPENAI-ACCESS-01]: cadastrar API key real do tenant em staging.
TODO[WPP-ACCESS-01]: configurar credenciais Meta reais da empresa.
TODO[NETLIFY-SETUP-01]: criar site e aplicar variáveis de ambiente.
TODO[DB-SETUP-01]: provisionar Postgres e rodar migrations.
```

## Formato Recomendado para TODO Operacional
```txt
TODO[AREA-ID]: descricao objetiva
Ambiente: dev|staging|prod
Tenant: company_slug
Bloqueia go-live: sim|nao
Dono: nome-responsavel
Prazo: AAAA-MM-DD
```
