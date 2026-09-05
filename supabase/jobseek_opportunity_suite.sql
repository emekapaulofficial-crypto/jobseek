-- JobSeek Opportunity Suite: portfolios, job-specific assets and alert preferences.
-- Run after jobseek_agency_schema.sql in Supabase.

create table if not exists public.jobseek_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.jobseek_accounts(id) on delete cascade,
  slug text not null unique,
  full_name text,
  professional_title text,
  about text,
  skills text[] not null default '{}',
  public_url text,
  photo_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobseek_portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.jobseek_portfolios(id) on delete cascade,
  title text not null,
  description text,
  role text,
  tools text[],
  media_urls text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.jobseek_job_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.jobseek_accounts(id) on delete cascade,
  enabled boolean not null default false,
  email text,
  keywords text[] not null default '{}',
  locations text[] not null default '{}',
  categories text[] not null default '{}',
  min_match_score integer not null default 70 check (min_match_score between 0 and 100),
  visa_filter text not null default 'all' check (visa_filter in ('all','explicit')),
  frequency text not null default 'instant' check (frequency in ('instant','daily','weekly')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobseek_application_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jobseek_accounts(id) on delete cascade,
  external_job_id text,
  agency_job_id uuid references public.agency_jobs(id) on delete cascade,
  tailored_cv text,
  cover_letter text,
  portfolio_url text,
  linkedin_url text,
  indeed_url text,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_job_id),
  unique(user_id, agency_job_id)
);

create index if not exists jobseek_alerts_enabled_idx on public.jobseek_job_alert_preferences(enabled);
create index if not exists jobseek_portfolios_slug_idx on public.jobseek_portfolios(slug);
create index if not exists jobseek_assets_user_idx on public.jobseek_application_assets(user_id);

alter table public.jobseek_portfolios enable row level security;
alter table public.jobseek_portfolio_projects enable row level security;
alter table public.jobseek_job_alert_preferences enable row level security;
alter table public.jobseek_application_assets enable row level security;

create policy "portfolio owner manages own portfolio" on public.jobseek_portfolios for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "public can view public portfolios" on public.jobseek_portfolios for select to anon, authenticated using (is_public = true);
create policy "portfolio owner manages projects" on public.jobseek_portfolio_projects for all to authenticated using (exists(select 1 from public.jobseek_portfolios p where p.id=portfolio_id and p.user_id=auth.uid())) with check (exists(select 1 from public.jobseek_portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "user manages own alerts" on public.jobseek_job_alert_preferences for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "user manages own application assets" on public.jobseek_application_assets for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create trigger jobseek_portfolios_updated_at before update on public.jobseek_portfolios for each row execute function public.jobseek_set_updated_at();
create trigger jobseek_alerts_updated_at before update on public.jobseek_job_alert_preferences for each row execute function public.jobseek_set_updated_at();
create trigger jobseek_assets_updated_at before update on public.jobseek_application_assets for each row execute function public.jobseek_set_updated_at();

-- Recommended external-job columns for freshness and auditability.
alter table if exists public.jobseek_external_jobs add column if not exists posted_at timestamptz;
alter table if exists public.jobseek_external_jobs add column if not exists closing_at timestamptz;
alter table if exists public.jobseek_external_jobs add column if not exists last_verified_at timestamptz;
alter table if exists public.jobseek_external_jobs add column if not exists job_status text default 'active';
alter table if exists public.jobseek_external_jobs add column if not exists source_url text;
alter table if exists public.jobseek_external_jobs add column if not exists direct_employer boolean default false;
create index if not exists jobseek_external_jobs_posted_at_idx on public.jobseek_external_jobs(posted_at desc);
create index if not exists jobseek_external_jobs_status_idx on public.jobseek_external_jobs(job_status);
