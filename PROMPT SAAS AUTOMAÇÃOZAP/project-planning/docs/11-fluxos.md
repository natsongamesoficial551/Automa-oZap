# Fluxos Operacionais

## 1) Novo usuário cria conta
1. Cadastro com e-mail e senha.
2. Criação de usuário no auth provider.
3. Criação de perfil em `users`.
4. Criação ou associação de empresa.
5. Criação de membership com papel inicial.

## 2) Usuário conecta OpenAI
1. Envia API key no painel.
2. Backend valida permissão e criptografa.
3. Salva em `api_keys`.
4. Testa chave e marca status.

## 3) Usuário conecta WhatsApp
1. Cadastra dados da integração.
2. Backend salva segredos criptografados.
3. Configura webhook na Meta.
4. SaaS valida desafio e ativa integração.

## 4) Cliente envia mensagem
1. Mensagem chega na Meta.
2. Meta dispara webhook ao SaaS.

## 5) SaaS recebe webhook
1. Valida assinatura.
2. Persiste evento bruto.
3. Deduplica evento.
4. Persiste mensagem inbound.
5. Enfileira processamento assíncrono.
6. Retorna `200`.

## 6) SaaS busca memória
1. Busca conversa e últimas mensagens.
2. Busca resumo atual.
3. Busca memória longa do cliente.
4. Busca chunks de conhecimento.

## 7) SaaS chama OpenAI
1. Busca chave válida da empresa.
2. Monta prompt + contexto.
3. Gera resposta.
4. Modera resposta.

## 8) SaaS envia resposta no WhatsApp
1. Monta payload de envio.
2. Chama API da Meta.
3. Salva status e IDs externos.
4. Agenda retry em falha transitória.

## 9) SaaS salva conversa e memória
1. Salva resposta em `messages`.
2. Atualiza `conversations`.
3. Atualiza resumo e memórias em background.
4. Registra auditoria e métricas.
