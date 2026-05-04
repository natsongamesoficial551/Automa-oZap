create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  plan text not null default 'trial',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('openai', 'whatsapp')),
  status text not null default 'pending',
  encrypted_secret text,
  masked_secret text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null default 'whatsapp',
  provider_message_id text,
  body text not null,
  status text not null default 'received',
  token_input integer,
  token_output integer,
  model text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, provider_message_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  entity_type text not null,
  severity text not null default 'info',
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_members_user on public.company_members(user_id);
create index if not exists idx_conversations_company on public.conversations(company_id, last_message_at desc);
create index if not exists idx_messages_company_conv on public.messages(company_id, conversation_id, created_at desc);
create index if not exists idx_audit_logs_company on public.audit_logs(company_id, created_at desc);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at
before update on public.integrations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.integrations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.audit_logs enable row level security;

create policy "user_profiles_select_own" on public.user_profiles
for select
to authenticated
using (auth.uid() = id);

create policy "user_profiles_update_own" on public.user_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "company_members_select_by_user" on public.company_members
for select
to authenticated
using (user_id = auth.uid());

create policy "companies_select_if_member" on public.companies
for select
to authenticated
using (
  exists (
    select 1 from public.company_members m
    where m.company_id = companies.id
      and m.user_id = auth.uid()
  )
);

create policy "integrations_select_if_member" on public.integrations
for select
to authenticated
using (
  exists (
    select 1 from public.company_members m
    where m.company_id = integrations.company_id
      and m.user_id = auth.uid()
  )
);

create policy "conversations_select_if_member" on public.conversations
for select
to authenticated
using (
  exists (
    select 1 from public.company_members m
    where m.company_id = conversations.company_id
      and m.user_id = auth.uid()
  )
);

create policy "messages_select_if_member" on public.messages
for select
to authenticated
using (
  exists (
    select 1 from public.company_members m
    where m.company_id = messages.company_id
      and m.user_id = auth.uid()
  )
);

create policy "audit_logs_select_if_member" on public.audit_logs
for select
to authenticated
using (
  company_id is null
  or exists (
    select 1 from public.company_members m
    where m.company_id = audit_logs.company_id
      and m.user_id = auth.uid()
  )
);
