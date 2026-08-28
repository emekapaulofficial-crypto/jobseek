-- JobSeek AI recruitment intelligence layer
-- Adds persistent external-job records, candidate/job match scores and agent telemetry.
-- This migration is intentionally additive: existing agency recruitment tables remain intact.

create type public.jobseek_external_job_status as enum ('active','expired','closed','needs_review');

create table if not exists public.jobseek_external_jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  title text not null,
  company text,
  location text,
  country text,
  description text,
  source text not null,
  source_url text not null,
  apply_url text not null,
  category text,
  employment_type text,
  salary text,
  remote boolean not null default false,
  direct_employer boolean not null default false,
  source_trusted boolean not null default false,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  risk_flags text[] not null default '{}',
  verification_status text not null default 'needs_review',
  apply_url_checked boolean not null default false,
  apply_url_status text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  status public.jobseek_external_job_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, external_id)
);

create index if not exists jobseek_external_jobs_status_idx on public.jobseek_external_jobs(status);
create index if not exists jobseek_external_jobs_country_idx on public.jobseek_external_jobs(country);
create index if not exists jobseek_external_jobs_category_idx on public.jobseek_external_jobs(category);
create index if not exists jobseek_external_jobs_quality_idx on public.jobseek_external_jobs(quality_score desc);
create index if not exists jobseek_external_jobs_published_idx on public.jobseek_external_jobs(published_at desc);

create table if not exists public.jobseek_job_matches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  external_job_id uuid not null references public.jobseek_external_jobs(id) on delete cascade,
  match_score integer not null check (match_score between 0 and 100),
  skills_score integer not null default 0 check (skills_score between 0 and 100),
  experience_score integer not null default 0 check (experience_score between 0 and 100),
  location_score integer not null default 0 check (location_score between 0 and 100),
  preference_score integer not null default 0 check (preference_score between 0 and 100),
  visa_score integer not null default 0 check (visa_score between 0 and 100),
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(candidate_id, external_job_id)
);

create index if not exists jobseek_job_matches_candidate_idx on public.jobseek_job_matches(candidate_id, match_score desc);
create index if not exists jobseek_job_matches_job_idx on public.jobseek_job_matches(external_job_id);

create table if not exists public.jobseek_agent_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),
  jobs_discovered integer not null default 0,
  jobs_published integer not null default 0,
  jobs_needing_review integer not null default 0,
  duplicates_removed integer not null default 0,
  urls_checked integer not null default 0,
  errors_count integer not null default 0,
  source_summary jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '[]'::jsonb
);

create index if not exists jobseek_agent_runs_started_idx on public.jobseek_agent_runs(started_at desc);

-- Keep timestamps current when rows are updated.
create trigger jobseek_external_jobs_updated_at
before update on public.jobseek_external_jobs
for each row execute function public.jobseek_set_updated_at();

create trigger jobseek_job_matches_updated_at
before update on public.jobseek_job_matches
for each row execute function public.jobseek_set_updated_at();

alter table public.jobseek_external_jobs enable row level security;
alter table public.jobseek_job_matches enable row level security;
alter table public.jobseek_agent_runs enable row level security;

-- Public visitors can read only active, non-high-risk external jobs.
create policy "public can read safe active external jobs"
on public.jobseek_external_jobs for select
to anon, authenticated
using (status = 'active' and risk_level <> 'high');

-- Candidates can read their own matches.
create policy "candidates can read own job matches"
on public.jobseek_job_matches for select
to authenticated
using (exists (
  select 1 from public.candidate_profiles cp
  where cp.id = candidate_id and cp.user_id = auth.uid()
));

-- Staff can read operational telemetry.
create policy "staff can read agent runs"
on public.jobseek_agent_runs for select
to authenticated
using (jobseek_private.is_staff(auth.uid()));
