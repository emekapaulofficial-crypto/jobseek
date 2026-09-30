-- JobSeek: public employer job leads
--
-- WHY THIS EXISTS
-- employer.html has a "Post a Job" form that does not require an employer
-- account. Before this migration it posted only to Formspree (an external
-- email), so it never reached the JobSeek database and never appeared in
-- admin-dashboard.html for review. This table gives that quick form a real
-- home in Supabase so admin can see and act on every submission.
--
-- This does NOT touch employers, agency_jobs, or any existing table/policy.
-- Run this in the Supabase SQL editor, then check it against the admin-role
-- pattern your project already uses (jobseek_accounts.role) before relying
-- on it in production.

create table if not exists public.public_job_leads (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  company_name text not null,
  location text,
  category text,
  job_type text,
  sponsorship_note text,
  description text not null,
  apply_url text,
  contact_email text not null,
  status text not null default 'new' check (status in ('new','contacted','published','rejected')),
  reviewed_by uuid references public.jobseek_accounts(id),
  reviewed_at timestamptz,
  agency_job_id uuid references public.agency_jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists public_job_leads_status_idx on public.public_job_leads(status);
create index if not exists public_job_leads_created_at_idx on public.public_job_leads(created_at desc);

alter table public.public_job_leads enable row level security;

-- Anyone (including a visitor who has not signed in) can submit a lead.
-- This matches employer.html, which has no login requirement.
create policy "anyone can submit a job lead"
  on public.public_job_leads
  for insert
  to anon, authenticated
  with check (true);

-- Only admins/agents can read leads. Reuses the same jobseek_private.is_staff()
-- helper the rest of this schema already defines, instead of a one-off check.
create policy "admin can view job leads"
  on public.public_job_leads
  for select
  to authenticated
  using (jobseek_private.is_staff(auth.uid()));

-- Only admins/agents can update status (mark contacted/published/rejected).
create policy "admin can update job leads"
  on public.public_job_leads
  for update
  to authenticated
  using (jobseek_private.is_staff(auth.uid()))
  with check (jobseek_private.is_staff(auth.uid()));
