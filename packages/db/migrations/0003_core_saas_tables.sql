create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  phone_e164 text not null,
  name text,
  tags_json jsonb not null default '[]'::jsonb,
  consent_lgpd boolean not null default false,
  last_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, phone_e164)
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('openai', 'whatsapp', 'meta')),
  secret_type text not null,
  encrypted_value text not null,
  masked_value text not null,
  status text not null default 'valid' check (status in ('valid', 'invalid', 'revoked')),
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'meta_cloud',
  phone_number_e164 text,
  phone_number_id text not null,
  access_token_ref uuid references public.api_keys(id) on delete set null,
  app_secret_ref uuid references public.api_keys(id) on delete set null,
  webhook_verify_token_ref uuid references public.api_keys(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'revoked')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, phone_number_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  integration_id uuid references public.whatsapp_integrations(id) on delete set null,
  provider text not null default 'whatsapp',
  provider_event_id text,
  event_type text not null default 'message',
  raw_payload jsonb not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  error_message text,
  correlation_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.knowledge_base_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null check (source_type in ('text', 'file', 'url', 'faq')),
  title text not null,
  raw_content text,
  storage_path text,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'ready', 'error')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  scope_type text not null check (scope_type in ('customer', 'conversation', 'company')),
  memory_type text not null default 'short_term',
  content text not null,
  importance_score numeric not null default 0,
  sensitivity_level text not null default 'low' check (sensitivity_level in ('low', 'medium', 'high')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.conversations add column if not exists status text not null default 'open';
alter table public.conversations add column if not exists current_summary text;

alter table public.messages add column if not exists sender_type text not null default 'customer';
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists cost_usd numeric;

create index if not exists idx_customer_profiles_company_phone on public.customer_profiles(company_id, phone_e164);
create index if not exists idx_api_keys_company_provider on public.api_keys(company_id, provider, secret_type);
create index if not exists idx_whatsapp_integrations_company on public.whatsapp_integrations(company_id, status);
create index if not exists idx_webhook_events_status on public.webhook_events(processing_status, received_at desc);
create index if not exists idx_webhook_events_company on public.webhook_events(company_id, received_at desc);
create index if not exists idx_knowledge_company_status on public.knowledge_base_documents(company_id, processing_status);
create index if not exists idx_memories_company_customer on public.memories(company_id, customer_profile_id, memory_type);
create index if not exists idx_memories_company_conversation on public.memories(company_id, conversation_id, memory_type);

drop trigger if exists trg_customer_profiles_updated_at on public.customer_profiles;
create trigger trg_customer_profiles_updated_at
before update on public.customer_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_api_keys_updated_at on public.api_keys;
create trigger trg_api_keys_updated_at
before update on public.api_keys
for each row
execute function public.set_updated_at();

drop trigger if exists trg_whatsapp_integrations_updated_at on public.whatsapp_integrations;
create trigger trg_whatsapp_integrations_updated_at
before update on public.whatsapp_integrations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_knowledge_base_documents_updated_at on public.knowledge_base_documents;
create trigger trg_knowledge_base_documents_updated_at
before update on public.knowledge_base_documents
for each row
execute function public.set_updated_at();

drop trigger if exists trg_memories_updated_at on public.memories;
create trigger trg_memories_updated_at
before update on public.memories
for each row
execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.whatsapp_integrations enable row level security;
alter table public.webhook_events enable row level security;
alter table public.knowledge_base_documents enable row level security;
alter table public.memories enable row level security;

drop policy if exists "customer_profiles_select_if_member" on public.customer_profiles;
create policy "customer_profiles_select_if_member" on public.customer_profiles
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists "customer_profiles_write_if_operator" on public.customer_profiles;
create policy "customer_profiles_write_if_operator" on public.customer_profiles
for all to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'operator']))
with check (public.has_company_role(company_id, array['owner', 'admin', 'operator']));

drop policy if exists "api_keys_select_if_admin" on public.api_keys;
create policy "api_keys_select_if_admin" on public.api_keys
for select to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "api_keys_write_if_admin" on public.api_keys;
create policy "api_keys_write_if_admin" on public.api_keys
for all to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']))
with check (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "whatsapp_integrations_select_if_admin" on public.whatsapp_integrations;
create policy "whatsapp_integrations_select_if_admin" on public.whatsapp_integrations
for select to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "whatsapp_integrations_write_if_admin" on public.whatsapp_integrations;
create policy "whatsapp_integrations_write_if_admin" on public.whatsapp_integrations
for all to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']))
with check (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "webhook_events_select_if_admin" on public.webhook_events;
create policy "webhook_events_select_if_admin" on public.webhook_events
for select to authenticated
using (company_id is not null and public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "knowledge_select_if_member" on public.knowledge_base_documents;
create policy "knowledge_select_if_member" on public.knowledge_base_documents
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists "knowledge_write_if_admin" on public.knowledge_base_documents;
create policy "knowledge_write_if_admin" on public.knowledge_base_documents
for all to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']))
with check (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "memories_select_if_member" on public.memories;
create policy "memories_select_if_member" on public.memories
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists "memories_write_if_admin" on public.memories;
create policy "memories_write_if_admin" on public.memories
for all to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']))
with check (public.has_company_role(company_id, array['owner', 'admin']));
