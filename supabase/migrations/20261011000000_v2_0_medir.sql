-- NutcesLink v2.0 "Medir": sesiones de medición, resultados, grupos y ficha ampliada (no modifica la migración anterior).

-- Ficha ampliada
create table client_groups (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, name)
);
create index on client_groups (studio_id);

alter table clients
  add column biological_sex text check (biological_sex in ('M','F')),
  add column group_id uuid references client_groups(id) on delete set null,
  add column guardian_name text,
  add column guardian_relationship text,
  add column guardian_phone text,
  add column guardian_consent boolean not null default false,
  add column guardian_consent_at timestamptz,
  add column objectives text[] not null default '{}',
  add column medical_history jsonb not null default '{}',
  add column lifestyle jsonb not null default '{}';

create table measurement_sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  measured_by uuid references coaches(id),
  measured_on date not null,
  protocol text not null default 'ISAK',
  status text not null default 'draft' check (status in ('draft','final')),
  supersedes_id uuid references measurement_sessions(id),
  raw jsonb not null,
  patient_note text,
  next_checkup_date date,
  show_next_checkup_to_patient boolean not null default true,
  created_at timestamptz not null default now()
);
create index on measurement_sessions (studio_id, client_id, measured_on desc);

create table measurement_results (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  session_id uuid not null references measurement_sessions(id) on delete cascade,
  formula_id text not null,
  formula_version text not null,
  output jsonb not null,
  computed_at timestamptz not null default now(),
  unique (session_id, formula_id, formula_version)
);
create index on measurement_results (studio_id, session_id);

alter table nutrition_plans add column measurement_session_id uuid references measurement_sessions(id);

-- RLS
alter table client_groups enable row level security;
alter table measurement_sessions enable row level security;
alter table measurement_results enable row level security;

create policy groups_all on client_groups for all
  using (studio_id in (select private.my_studio_ids()))
  with check (studio_id in (select private.my_studio_ids()));
create policy sessions_all on measurement_sessions for all
  using (studio_id in (select private.my_studio_ids()))
  with check (studio_id in (select private.my_studio_ids()));
create policy results_all on measurement_results for all
  using (studio_id in (select private.my_studio_ids()))
  with check (studio_id in (select private.my_studio_ids()));

-- Coherencia de studio entre tablas relacionadas (v2)
create or replace function private.check_same_studio_v2() returns trigger
language plpgsql as $$
declare j jsonb := to_jsonb(new);
begin
  -- Se usa jsonb porque plpgsql no garantiza cortocircuito al referir columnas de otras tablas.
  if tg_table_name = 'clients' then
    if j->>'group_id' is not null and not exists (
      select 1 from client_groups where id = (j->>'group_id')::uuid and studio_id = (j->>'studio_id')::uuid) then
      raise exception 'group_id no pertenece al studio';
    end if;
  elsif tg_table_name = 'measurement_sessions' then
    if not exists (select 1 from clients where id = (j->>'client_id')::uuid and studio_id = (j->>'studio_id')::uuid) then
      raise exception 'client_id no pertenece al studio';
    end if;
    if j->>'measured_by' is not null and not exists (
      select 1 from coaches where id = (j->>'measured_by')::uuid and studio_id = (j->>'studio_id')::uuid) then
      raise exception 'measured_by no pertenece al studio';
    end if;
    if j->>'supersedes_id' is not null and not exists (
      select 1 from measurement_sessions where id = (j->>'supersedes_id')::uuid
        and studio_id = (j->>'studio_id')::uuid and client_id = (j->>'client_id')::uuid) then
      raise exception 'supersedes_id inválido';
    end if;
  elsif tg_table_name = 'measurement_results' then
    if not exists (select 1 from measurement_sessions where id = (j->>'session_id')::uuid and studio_id = (j->>'studio_id')::uuid) then
      raise exception 'session_id no pertenece al studio';
    end if;
  elsif tg_table_name = 'nutrition_plans' then
    if j->>'measurement_session_id' is not null and not exists (
      select 1 from measurement_sessions
      where id = (j->>'measurement_session_id')::uuid and studio_id = (j->>'studio_id')::uuid
        and client_id = (j->>'client_id')::uuid) then
      raise exception 'measurement_session_id inválido';
    end if;
  end if;
  return new;
end $$;

create trigger clients_same_studio_v2 before insert or update on clients
  for each row execute function private.check_same_studio_v2();
create trigger sessions_same_studio before insert or update on measurement_sessions
  for each row execute function private.check_same_studio_v2();
create trigger results_same_studio before insert or update on measurement_results
  for each row execute function private.check_same_studio_v2();
create trigger plans_same_studio_v2 before insert or update on nutrition_plans
  for each row execute function private.check_same_studio_v2();

-- Una sesión final no admite cambios en raw ni vuelve a borrador
-- (el borrado por cascade al eliminar un cliente sigue permitido)
create or replace function private.guard_final_session() returns trigger
language plpgsql as $$
begin
  if old.status = 'final' then
    if new.raw is distinct from old.raw
       or new.measured_on is distinct from old.measured_on
       or new.client_id is distinct from old.client_id
       or new.protocol is distinct from old.protocol
       or new.status is distinct from old.status then
      raise exception 'una sesión final es inmutable (cree una nueva con supersedes_id)';
    end if;
  end if;
  return new;
end $$;
create trigger sessions_guard_final before update on measurement_sessions
  for each row execute function private.guard_final_session();

-- Auditoría (sin contenido médico: solo acción, entidad, id)
create trigger sessions_audit after insert or update on measurement_sessions
  for each row execute function private.audit_row();

-- log_event: registra eventos permitidos, solo para miembros del studio
create or replace function public.log_event(p_studio uuid, p_action text, p_entity text, p_entity_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_studio not in (select private.my_studio_ids()) then raise exception 'sin acceso'; end if;
  if p_action not in ('minor.consent_missing_proceeded') then raise exception 'acción no permitida'; end if;
  insert into audit_log(studio_id, actor_user_id, action, entity, entity_id)
    values (p_studio, (select auth.uid()), p_action, p_entity, p_entity_id);
end $$;
revoke all on function public.log_event(uuid,text,text,uuid) from public, anon;
grant execute on function public.log_event(uuid,text,text,uuid) to authenticated;
