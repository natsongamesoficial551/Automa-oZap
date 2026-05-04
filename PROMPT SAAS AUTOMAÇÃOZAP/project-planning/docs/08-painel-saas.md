# Painel SaaS: Telas, Campos e Permissões

## Papéis
- `owner`: controle total
- `admin`: gestão operacional ampla
- `operator`: operação de conversas/clientes
- `viewer`: leitura

## Telas

### Login/Cadastro
- Campos: e-mail, senha, nome, recuperação de senha.
- Ações: cadastrar, entrar, recuperar acesso.
- Permissão: público.

### Dashboard
- Indicadores: conversas ativas, mensagens/dia, taxa de automação, erros, custo IA.
- Ações: filtrar período, abrir conversa, ver alertas.
- Permissão: todos os papéis autenticados.

### Configuração da Empresa
- Campos: nome, slug, fuso, idioma, descrição, horário.
- Ações: editar e salvar dados da empresa.
- Permissão: `owner`, `admin`.

### Configuração da IA
- Campos: nome do agente, prompt base, tom, regras, modelo, temperatura.
- Ações: criar/editar agente, ativar, testar prompt.
- Permissão: `owner`, `admin`.

### API Key OpenAI
- Campos: chave segura, máscara, status de validação.
- Ações: cadastrar, validar, rotacionar, revogar.
- Permissão: `owner`, `admin`.

### Integração WhatsApp
- Campos: `phone_number_id`, tokens, app secret, webhook URL, status.
- Ações: conectar, validar webhook, testar envio, desconectar.
- Permissão: `owner`, `admin`.

### Base de Conhecimento
- Campos: título, tipo de fonte, conteúdo, arquivo/URL, tags.
- Ações: criar, editar, reprocessar, excluir.
- Permissão: `owner`, `admin`.

### Conversas
- Campos: cliente, telefone, status, última mensagem, canal, responsável.
- Ações: abrir, responder manualmente, handoff, encerrar.
- Permissão: `owner`, `admin`, `operator`.

### Clientes
- Campos: nome, telefone, tags, resumo, consentimento LGPD.
- Ações: editar perfil, excluir memória, anonimizar dados.
- Permissão: `owner`, `admin`, `operator` (ações sensíveis restritas).

### Logs
- Campos: tipo, ação, status, erro, data, correlation ID.
- Ações: filtrar, exportar, abrir detalhe.
- Permissão: `owner`, `admin`.

### Configurações
- Campos: membros, papéis, retenção, notificações, preferências.
- Ações: convidar, alterar papel, revogar acesso.
- Permissão: `owner` e parcialmente `admin`.

## Boas Práticas de UX
- Mostrar status real de integrações.
- Nunca exibir segredo completo.
- Exibir erros acionáveis.
- Evidenciar modo mock quando ativo.
