create table if not exists public.generation_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'running' check(status in ('running','complete','failed')),
 website_id uuid references public.websites(id) on delete set null, message text,
 created_at timestamptz not null default now()
);
alter table public.generation_jobs enable row level security;
create unique index if not exists one_active_generation on public.generation_jobs(user_id) where status='running';
revoke all on public.generation_jobs from anon, authenticated;
grant all on public.generation_jobs to service_role;
