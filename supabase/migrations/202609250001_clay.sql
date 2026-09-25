-- Clay: one website per account. All owner writes use transactional RPCs.
create extension if not exists pgcrypto;
create table public.websites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 model jsonb not null check (jsonb_typeof(model)='object' and octet_length(model::text)<500000),
 revision integer not null default 1, status text not null default 'draft' check(status in ('draft','published','changed','publishing','failed')),
 live_url text, published_revision integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.versions(id uuid primary key default gen_random_uuid(), website_id uuid not null references public.websites(id) on delete cascade, model jsonb not null, label text not null, created_at timestamptz not null default now());
create index on public.versions(website_id,created_at desc);
create table public.submissions(id uuid primary key default gen_random_uuid(),website_id uuid not null references public.websites(id) on delete cascade,name text not null,email text not null,message text not null,created_at timestamptz not null default now());
create index on public.submissions(website_id,created_at desc);
create table public.visits(id uuid primary key,website_id uuid not null references public.websites(id) on delete cascade,visitor uuid not null,path text not null,seconds integer not null default 0 check(seconds between 0 and 1800),country text,created_at timestamptz not null default now());
create index on public.visits(website_id,created_at desc);
create table public.publications(website_id uuid primary key references public.websites(id) on delete cascade,repo text not null,commit_sha text,pending_revision integer,pending_model jsonb,last_good_sha text,started_at timestamptz default now());
create table public.rate_limits(key text primary key,window_start timestamptz not null default now(),count integer not null default 1);
alter table public.websites enable row level security;
alter table public.versions enable row level security;
alter table public.submissions enable row level security;
alter table public.visits enable row level security;
alter table public.publications enable row level security;
alter table public.rate_limits enable row level security;
create policy own_websites on public.websites for select to authenticated using(user_id=(select auth.uid()));
create policy own_versions on public.versions for select to authenticated using(exists(select 1 from public.websites w where w.id=website_id and w.user_id=(select auth.uid())));
create policy own_submissions on public.submissions for select to authenticated using(exists(select 1 from public.websites w where w.id=website_id and w.user_id=(select auth.uid())));
create policy own_visits on public.visits for select to authenticated using(exists(select 1 from public.websites w where w.id=website_id and w.user_id=(select auth.uid())));
revoke all on public.websites,public.versions,public.submissions,public.visits,public.publications,public.rate_limits from anon,authenticated;
grant select on public.websites,public.versions,public.submissions,public.visits to authenticated;
grant all on public.websites,public.versions,public.submissions,public.visits,public.publications,public.rate_limits to service_role;
create or replace function public.check_clay_model(m jsonb) returns void language plpgsql set search_path=public as $$
begin
 if jsonb_typeof(m)<>'object' or octet_length(m::text)>500000 or coalesce(length(m->>'name'),0) not between 1 and 120 or jsonb_typeof(m->'pages') is distinct from 'array' or jsonb_array_length(m->'pages') not between 1 and 20 or jsonb_typeof(m->'theme') is distinct from 'object' or jsonb_typeof(m->'navigation') is distinct from 'array' or jsonb_typeof(m->'content') is distinct from 'array' then raise exception 'Invalid website'; end if;
end $$;
create or replace function public.create_website(p_model jsonb) returns public.websites language plpgsql security definer set search_path=public as $$
declare result public.websites;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform public.check_clay_model(p_model);
 insert into public.websites(user_id,model) values(auth.uid(),p_model) returning * into result;
 return result;
exception when unique_violation then raise exception 'Your account includes one website';
end $$;
create or replace function public.save_website(p_id uuid,p_model jsonb,p_revision integer,p_label text) returns public.websites language plpgsql security definer set search_path=public as $$
declare current_site public.websites;result public.websites;
begin
 select * into current_site from public.websites where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Website not found'; end if;
 if current_site.revision<>p_revision then raise exception 'Website changed in another window'; end if;
 perform public.check_clay_model(p_model);
 insert into public.versions(website_id,model,label) values(p_id,current_site.model,left(coalesce(p_label,'Edited website'),200));
 update public.websites set model=p_model,revision=revision+1,updated_at=now(),status=case when status='publishing' then 'publishing' when live_url is not null then 'changed' else 'draft' end where id=p_id returning * into result;
 delete from public.versions where website_id=p_id and id not in(select id from public.versions where website_id=p_id order by created_at desc limit 100);
 return result;
end $$;
create or replace function public.delete_website(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.websites where id=p_id and user_id=auth.uid() and (live_url is not null or status='publishing')) then raise exception 'Unpublish first';end if;
 delete from public.websites where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Website not found';end if;
end $$;
create or replace function public.consume_limit(p_key text,p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into public.rate_limits(key) values(p_key) on conflict(key) do update set count=case when rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else rate_limits.count+1 end,window_start=case when rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else rate_limits.window_start end returning count into n;
 if random()<0.01 then delete from public.rate_limits where window_start<now()-interval '2 days';end if;
 return n<=p_max;
end $$;
create or replace function public.finish_publish(p_id uuid,p_url text,p_revision integer) returns public.websites language plpgsql security definer set search_path=public as $$
declare result public.websites;
begin
 update public.websites set live_url=p_url,published_revision=p_revision,status=case when revision=p_revision then 'published' else 'changed' end where id=p_id returning * into result;return result;
end $$;
revoke all on function public.check_clay_model(jsonb),public.create_website(jsonb),public.save_website(uuid,jsonb,integer,text),public.delete_website(uuid),public.consume_limit(text,integer,integer),public.finish_publish(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.create_website(jsonb),public.save_website(uuid,jsonb,integer,text),public.delete_website(uuid) to authenticated;
grant execute on function public.consume_limit(text,integer,integer),public.finish_publish(uuid,text,integer) to service_role;
