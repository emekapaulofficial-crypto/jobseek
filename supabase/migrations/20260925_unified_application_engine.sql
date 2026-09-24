-- Unified application workflow
alter table if exists public.candidate_profiles add column if not exists preferred_states text[] not null default '{}';
alter table if exists public.candidate_profiles add column if not exists experience text;
alter table if exists public.candidate_profiles add column if not exists linkedin_url text;
alter table if exists public.candidate_profiles add column if not exists portfolio_url text;
create table if not exists public.jobseek_application_workflows (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.jobseek_accounts(id) on delete cascade,
 external_job_id text,
 agency_job_id uuid references public.agency_jobs(id) on delete cascade,
 status text not null default 'preparing' check(status in ('saved','preparing','ready','applied','interview','follow_up','offer','rejected','closed')),
 match_score integer not null default 0 check(match_score between 0 and 100),
 analysis jsonb not null default '{}'::jsonb,
 tailored_cv text,
 cover_letter text,
 interview_plan jsonb not null default '[]'::jsonb,
 checklist jsonb not null default '[]'::jsonb,
 application_url text,
 confirmation_reference text,
 applied_at timestamptz,
 follow_up_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(user_id, external_job_id)
);
create index if not exists jobseek_application_workflows_user_idx on public.jobseek_application_workflows(user_id,updated_at desc);
alter table public.jobseek_application_workflows enable row level security;
drop policy if exists "user manages own unified application workflows" on public.jobseek_application_workflows;
create policy "user manages own unified application workflows" on public.jobseek_application_workflows for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());