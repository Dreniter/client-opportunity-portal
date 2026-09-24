create extension if not exists pgcrypto;

create table if not exists public.client_submissions (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 full_name text not null, phone_number text not null,
 current_age integer not null check(current_age between 1 and 120),
 life_insurance_death_benefit numeric(18,2) not null check(life_insurance_death_benefit>=0),
 current_net_worth numeric(18,2) not null check(current_net_worth>=0),
 growth_rate numeric(7,3) not null check(growth_rate between 0 and 100),
 projected_net_worth numeric(24,2) not null check(projected_net_worth>=0),
 high_net_worth boolean not null default false
);
create table if not exists public.app_devices(device_token text primary key,created_at timestamptz not null default now());
alter table public.client_submissions enable row level security;
alter table public.app_devices enable row level security;
revoke all on public.client_submissions from anon,authenticated;
revoke all on public.app_devices from anon,authenticated;

create or replace function public.register_device(p_device_token text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if p_device_token is null or length(p_device_token)<20 then return false; end if;
 insert into public.app_devices(device_token) values(p_device_token) on conflict do nothing;
 return true;
end;$$;

create or replace function public.save_client(
 p_device_token text,p_full_name text,p_phone_number text,p_current_age integer,
 p_life_insurance_death_benefit numeric,p_current_net_worth numeric,p_growth_rate numeric,
 p_projected_net_worth numeric,p_high_net_worth boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if not exists(select 1 from public.app_devices where device_token=p_device_token) then raise exception 'Device is not registered'; end if;
 insert into public.client_submissions(full_name,phone_number,current_age,life_insurance_death_benefit,current_net_worth,growth_rate,projected_net_worth,high_net_worth)
 values(trim(p_full_name),trim(p_phone_number),p_current_age,p_life_insurance_death_benefit,p_current_net_worth,p_growth_rate,p_projected_net_worth,p_high_net_worth)
 returning id into new_id;
 return new_id;
end;$$;

create or replace function public.get_clients(p_device_token text)
returns setof public.client_submissions
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.app_devices where device_token=p_device_token) then raise exception 'Device is not registered'; end if;
 return query select * from public.client_submissions order by created_at desc;
end;$$;

grant execute on function public.register_device(text) to anon;
grant execute on function public.save_client(text,text,text,integer,numeric,numeric,numeric,numeric,boolean) to anon;
grant execute on function public.get_clients(text) to anon;
create index if not exists client_submissions_created_at_idx on public.client_submissions(created_at desc);
create index if not exists client_submissions_high_net_worth_idx on public.client_submissions(high_net_worth);