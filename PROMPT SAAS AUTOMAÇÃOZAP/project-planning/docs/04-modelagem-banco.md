# Modelagem de Banco de Dados

## Convenções Gerais
- Chaves primárias `uuid`.
- Auditoria com `created_at` e `updated_at`.
- Isolamento multiempresa via `company_id`.
- Segredos criptografados.

## Tabelas Principais

### users
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | ID de usuário |
| email | text unique | Login |
| full_name | text | Nome |
| status | text | `active`, `suspended` |
| created_at | timestamptz | Auditoria |
| updated_at | timestamptz | Auditoria |

### companies
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Tenant |
| name | text | Nome empresa |
| slug | text unique | Identificador |
| timezone | text | Fuso horário |
| plan | text | `trial`, `pro`, etc |
| settings_json | jsonb | Configurações |
| created_at | timestamptz | Auditoria |
| updated_at | timestamptz | Auditoria |

### ai_agents
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Agente |
| company_id | uuid fk | Tenant |
| name | text | Nome do agente |
| system_prompt_base | text | Prompt base |
| response_style_json | jsonb | Estilo |
| service_rules_json | jsonb | Regras |
| model_name | text | Modelo OpenAI |
| temperature | numeric | Criatividade |
| max_output_tokens | int | Limite |
| status | text | `active`, `inactive` |

### whatsapp_integrations
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Integração |
| company_id | uuid fk | Tenant |
| provider | text | `meta_cloud` |
| phone_number_e164 | text | Número |
| phone_number_id | text | ID Meta |
| access_token_ref | uuid fk api_keys | Token criptografado |
| app_secret_ref | uuid fk api_keys | Segredo app |
| webhook_verify_token_ref | uuid fk api_keys | Verify token |
| status | text | `pending`, `active`, `error` |

### customer_profiles
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Cliente |
| company_id | uuid fk | Tenant |
| phone_e164 | text | Chave principal |
| name | text nullable | Nome |
| tags_json | jsonb | Tags |
| consent_lgpd | boolean | Consentimento |
| last_summary | text nullable | Último resumo |

### conversations
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Conversa |
| company_id | uuid fk | Tenant |
| customer_profile_id | uuid fk | Cliente |
| whatsapp_integration_id | uuid fk | Canal |
| status | text | `open`, `closed`, `manual`, `error` |
| current_summary | text nullable | Resumo corrente |
| last_message_at | timestamptz | Ordenação |

### messages
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Mensagem |
| company_id | uuid fk | Tenant |
| conversation_id | uuid fk | Conversa |
| direction | text | `inbound`, `outbound` |
| sender_type | text | `customer`, `ai`, `user` |
| provider_message_id | text nullable | ID externo |
| message_type | text | `text`, `image`, etc |
| content_text | text nullable | Texto |
| status | text | `received`, `sent`, `failed` |
| token_input | int nullable | Custo IA |
| token_output | int nullable | Custo IA |
| cost_usd | numeric nullable | Custo estimado |
| created_at | timestamptz | Data |

### memories
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Memória |
| company_id | uuid fk | Tenant |
| customer_profile_id | uuid fk nullable | Cliente |
| conversation_id | uuid fk nullable | Conversa |
| scope_type | text | `customer`, `conversation`, `company` |
| memory_type | text | `short_term`, `long_term`, etc |
| content | text | Conteúdo |
| importance_score | numeric | Relevância |
| sensitivity_level | text | `low`, `medium`, `high` |
| embedding | vector nullable | Vetor |
| expires_at | timestamptz nullable | Expiração |

### knowledge_base_documents
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Documento |
| company_id | uuid fk | Tenant |
| source_type | text | `text`, `file`, `url`, `faq` |
| title | text | Título |
| raw_content | text nullable | Conteúdo |
| storage_path | text nullable | Arquivo |
| processing_status | text | `pending`, `ready`, `error` |

### api_keys
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Segredo |
| company_id | uuid fk | Tenant |
| provider | text | `openai`, `whatsapp`, `meta` |
| secret_type | text | `api_key`, `access_token`, etc |
| encrypted_value | text | Criptografado |
| masked_value | text | Exibição parcial |
| status | text | `valid`, `invalid`, `revoked` |
| last_validated_at | timestamptz nullable | Validação |

### audit_logs
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid pk | Evento |
| company_id | uuid fk nullable | Tenant |
| actor_type | text | `user`, `system`, `ai` |
| action | text | Ação executada |
| entity_type | text | Entidade |
| severity | text | `info`, `warn`, `error`, `security` |
| details_json | jsonb | Metadados |
| created_at | timestamptz | Data |

## Relações e Índices Críticos
- `unique(company_id, phone_e164)` em `customer_profiles`.
- Índice em `messages(company_id, conversation_id, created_at)`.
- Índice em `conversations(company_id, last_message_at)`.
- Índice em `memories(company_id, customer_profile_id, memory_type)`.

## Segurança
- Nunca armazenar segredos em texto puro.
- Isolar acesso por tenant em toda query.
- Aplicar políticas de retenção e exclusão LGPD.
