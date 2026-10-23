alter table public.generation_jobs add column if not exists brief jsonb;
alter table public.generation_jobs add column if not exists stage text not null default 'designing';
alter table public.generation_jobs add column if not exists error_code text;
alter table public.generation_jobs add column if not exists attempts integer not null default 0;
alter table public.generation_jobs add column if not exists warnings jsonb not null default '[]'::jsonb;
alter table public.generation_jobs add column if not exists updated_at timestamptz not null default now();
create or replace function public.finish_generation(p_job uuid,p_model jsonb) returns public.websites
language plpgsql security definer set search_path=public as $$
declare job public.generation_jobs; result public.websites;
begin
 select * into job from public.generation_jobs where id=p_job for update;
 if not found then raise exception 'Generation not found'; end if;
 if job.status='complete' then select * into result from public.websites where id=job.website_id and user_id=job.user_id;return result;end if;
 if job.status<>'running' then return null;end if;
 perform public.check_clay_model(p_model);
 insert into public.websites(user_id,model) values(job.user_id,p_model) on conflict(user_id) do nothing;
 select * into result from public.websites where user_id=job.user_id;
 update public.generation_jobs set status='complete',stage='complete',website_id=result.id,message=null,error_code=null,updated_at=now() where id=job.id;
 return result;
end $$;
revoke all on function public.finish_generation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_generation(uuid,jsonb) to service_role;
