create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;

drop policy if exists "companies_select_if_member" on public.companies;
create policy "companies_select_if_member" on public.companies
for select
to authenticated
using (public.is_company_member(id));

drop policy if exists "integrations_select_if_member" on public.integrations;
create policy "integrations_select_if_member" on public.integrations
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']));

drop policy if exists "conversations_select_if_member" on public.conversations;
create policy "conversations_select_if_member" on public.conversations
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "messages_select_if_member" on public.messages;
create policy "messages_select_if_member" on public.messages
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "audit_logs_select_if_member" on public.audit_logs;
create policy "audit_logs_select_if_member" on public.audit_logs
for select
to authenticated
using (company_id is null or public.has_company_role(company_id, array['owner', 'admin']));

create index if not exists idx_integrations_company_provider on public.integrations(company_id, provider);
create index if not exists idx_messages_provider_id on public.messages(company_id, provider_message_id)
where provider_message_id is not null;
