-- NutcesLink: kernel multi-tenant (studios, coaches, clientes, planes, auditoría)
create extension if not exists pgcrypto;
create schema if not exists private;

create type coach_role as enum ('owner','coach','assistant');

create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  country text default 'EC',
  timezone text default 'America/Guayaquil',
  settings jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table coaches (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role coach_role not null default 'coach',
  license_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, user_id)
);
create index on coaches (user_id);

create table clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  coach_id uuid references coaches(id),
  full_name text not null,
  phone text, email text,
  birth_date date, gender text,
  height_cm numeric, weight_kg numeric, body_fat_pct numeric,
  sport text, activity_level text, goal text,
  dietary_restrictions text[] default '{}',
  allergies text[] default '{}',
  medical_conditions text,
  data_consent boolean not null default false,
  consent_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index on clients (studio_id, status);

create table nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid references coaches(id),
  calories_target int, protein_g int, carbs_g int, fat_g int,
  plan_content jsonb not null,
  ai_generated boolean not null default true,
  ai_model text,
  coach_approved boolean not null default false,
  approved_by uuid references coaches(id),
  approved_at timestamptz,
  valid_from date, valid_until date,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index on nutrition_plans (studio_id, client_id);

create table audit_log (
  id bigint generated always as identity primary key,
  studio_id uuid not null,
  actor_user_id uuid,
  action text not null,
  entity text not null, entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (studio_id, created_at desc);

-- Aislamiento
create or replace function private.my_studio_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select studio_id from coaches where user_id = (select auth.uid()) and active
$$;

-- Rol del usuario en un studio (para aprobar)
create or replace function private.my_role(p_studio uuid) returns coach_role
language sql stable security definer set search_path = public as $$
  select role from coaches where user_id = (select auth.uid()) and studio_id = p_studio and active
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.my_studio_ids() from public;
revoke all on function private.my_role(uuid) from public;
grant execute on function private.my_studio_ids() to authenticated;
grant execute on function private.my_role(uuid) to authenticated;

alter table studios enable row level security;
alter table coaches enable row level security;
alter table clients enable row level security;
alter table nutrition_plans enable row level security;
alter table audit_log enable row level security;

create policy studios_select on studios for select using (id in (select private.my_studio_ids()));
create policy coaches_select on coaches for select using (studio_id in (select private.my_studio_ids()));
create policy clients_all on clients for all
  using (studio_id in (select private.my_studio_ids()))
  with check (studio_id in (select private.my_studio_ids()));
create policy plans_all on nutrition_plans for all
  using (studio_id in (select private.my_studio_ids()))
  with check (studio_id in (select private.my_studio_ids()));
create policy audit_select on audit_log for select using (studio_id in (select private.my_studio_ids()));
-- audit_log: sin policy de insert/update/delete; se escribe desde funciones security definer.

-- Los usuarios no pueden mutar tablas de identidad directamente
revoke insert, update, delete on studios, coaches, audit_log from authenticated, anon;

-- Coherencia: coach y cliente deben pertenecer al mismo studio que la fila
create or replace function private.check_same_studio() returns trigger
language plpgsql as $$
begin
  if new.coach_id is not null and not exists (
    select 1 from coaches where id = new.coach_id and studio_id = new.studio_id) then
    raise exception 'coach_id no pertenece al studio';
  end if;
  if tg_table_name = 'nutrition_plans' then
    if not exists (
      select 1 from clients where id = (to_jsonb(new)->>'client_id')::uuid and studio_id = new.studio_id) then
      raise exception 'client_id no pertenece al studio';
    end if;
  end if;
  return new;
end $$;
create trigger clients_same_studio before insert or update on clients
  for each row execute function private.check_same_studio();
create trigger plans_same_studio before insert or update on nutrition_plans
  for each row execute function private.check_same_studio();

-- Un plan no puede quedar aprobado sin pasar por approve_plan(); editar contenido invalida la aprobación
create or replace function private.guard_plan_approval() returns trigger
language plpgsql as $$
declare v_ok boolean := coalesce(current_setting('nutceslink.approving', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not v_ok and (new.coach_approved or new.status <> 'draft') then
      raise exception 'un plan nuevo debe ser borrador; use approve_plan()';
    end if;
  else
    if not v_ok then
      if new.coach_approved is distinct from old.coach_approved
         or new.approved_by is distinct from old.approved_by
         or new.approved_at is distinct from old.approved_at
         or (new.status = 'approved' and old.status <> 'approved') then
        raise exception 'use approve_plan() para aprobar';
      end if;
      if old.coach_approved and (new.plan_content is distinct from old.plan_content
         or new.calories_target is distinct from old.calories_target
         or new.protein_g is distinct from old.protein_g
         or new.carbs_g is distinct from old.carbs_g
         or new.fat_g is distinct from old.fat_g) then
        new.coach_approved := false;
        new.approved_by := null;
        new.approved_at := null;
        new.status := 'draft';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger plans_guard_approval before insert or update on nutrition_plans
  for each row execute function private.guard_plan_approval();

-- Auditoría de cambios (sin contenido médico en detail)
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record := coalesce(new, old);
begin
  insert into audit_log(studio_id, actor_user_id, action, entity, entity_id)
  values (r.studio_id, (select auth.uid()), tg_table_name || '.' || lower(tg_op), tg_table_name, r.id);
  return r;
end $$;
create trigger clients_audit after insert or update or delete on clients
  for each row execute function private.audit_row();
create trigger plans_audit after insert on nutrition_plans
  for each row execute function private.audit_row();

-- Onboarding atómico
create or replace function public.create_studio(p_name text, p_slug text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  insert into studios(name, slug) values (p_name, p_slug) returning id into v_id;
  insert into coaches(studio_id, user_id, full_name, role) values (v_id, (select auth.uid()), p_full_name, 'owner');
  insert into audit_log(studio_id, actor_user_id, action, entity, entity_id)
    values (v_id, (select auth.uid()), 'studio.created', 'studio', v_id);
  return v_id;
end $$;

-- Aprobación de plan: solo owner/coach del studio
create or replace function public.approve_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan nutrition_plans; v_coach coaches;
begin
  select * into v_plan from nutrition_plans
    where id = p_plan_id and studio_id in (select private.my_studio_ids());
  if not found then raise exception 'plan no encontrado'; end if;
  select * into v_coach from coaches
    where user_id = (select auth.uid()) and studio_id = v_plan.studio_id
      and active and role in ('owner','coach');
  if not found then raise exception 'sin permiso para aprobar'; end if;
  perform set_config('nutceslink.approving', 'on', true);
  update nutrition_plans set coach_approved = true, approved_by = v_coach.id,
    approved_at = now(), status = 'approved' where id = p_plan_id;
  perform set_config('nutceslink.approving', 'off', true);
  insert into audit_log(studio_id, actor_user_id, action, entity, entity_id)
    values (v_plan.studio_id, (select auth.uid()), 'plan.approved', 'nutrition_plans', p_plan_id);
end $$;

revoke all on function public.create_studio(text,text,text) from public, anon;
revoke all on function public.approve_plan(uuid) from public, anon;
grant execute on function public.create_studio(text,text,text) to authenticated;
grant execute on function public.approve_plan(uuid) to authenticated;
