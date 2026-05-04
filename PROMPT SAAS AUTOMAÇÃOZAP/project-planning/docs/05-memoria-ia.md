# Estratégia de Memória da IA

## Objetivo
Permitir continuidade de atendimento com contexto relevante, custo controlado e privacidade.

## Camadas de Memória
1. Memória curta da conversa
2. Memória longa por cliente
3. Memória da empresa
4. Base de conhecimento (RAG)

## Memória Curta
- Recuperar últimas 12 a 20 mensagens.
- Combinar com resumo incremental da conversa.
- Priorizar mensagens mais recentes e úteis.

## Memória Longa por Cliente
- Preferências recorrentes.
- Restrições e histórico operacional.
- Dados úteis para atendimento futuro.
- Evitar armazenar dados sensíveis desnecessários.

## Memória da Empresa
- Regras de atendimento.
- Horários, políticas e posicionamento.
- Informações institucionais e de catálogo.

## Base de Conhecimento
- Documentos em texto, FAQ, arquivo e URL.
- Chunking e embeddings com `pgvector`.
- Fallback para full-text quando vetor indisponível.

## Pipeline Passo a Passo
1. Persistir mensagem recebida.
2. Buscar cliente e conversa.
3. Recuperar contexto curto.
4. Recuperar memórias longas.
5. Recuperar chunks relevantes.
6. Montar prompt com orçamento de tokens.
7. Gerar resposta.
8. Persistir saída e custo.
9. Atualizar resumo e memória em job assíncrono.

## Limites de Tokens
- Prompt base: 500-1200
- Resumo: 200-500
- Histórico recente: 800-2000
- Memórias longas: 300-1000
- Conhecimento: 800-2000
- Saída: 200-700

## Privacidade e Exclusão
- Marcar sensibilidade por memória.
- Permitir exclusão por cliente.
- Permitir anonimização de conversa.
- Definir retenção com `expires_at` para memórias temporárias.

## Critério de Qualidade
- A IA evita repetição de perguntas.
- A IA respeita preferências do cliente.
- A IA não alucina regras da empresa.
- Custo por mensagem permanece previsível.
