-- Saved jobs and notification channels
create table if not exists public.jobseek_saved_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.jobseek_accounts(id) on delete cascade,
 job_id text not null,
 job_title text,
 company text,
 location text,
 apply_url text,
 created_at timestamptz not null default now(),
 unique(user_id,job_id)
);
create index if not exists jobseek_saved_jobs_user_idx on public.jobseek_saved_jobs(user_id,created_at desc);
alter table public.jobseek_saved_jobs enable row level security;
drop policy if exists "users manage own saved jobs" on public.jobseek_saved_jobs;
create policy "users manage own saved jobs" on public.jobseek_saved_jobs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table if exists public.jobseek_job_alert_preferences add column if not exists push_enabled boolean not null default false;
alter table if exists public.jobseek_job_alert_preferences add column if not exists sms_enabled boolean not null default false;
alter table if exists public.jobseek_job_alert_preferences add column if not exists whatsapp_enabled boolean not null default false;
alter table if exists public.jobseek_job_alert_preferences add column if not exists phone_number text;