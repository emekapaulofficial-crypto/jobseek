-- JobSeek application-service backend
-- Stores candidate-approved requests for the self-build and paid administration flows.
-- No passwords, payment-card data, or identity-document contents belong in this table.

create table if not exists public.jobseek_application_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  job_id text,
  job_title text not null,
  employer_name text not null,
  candidate_name text not null,
  candidate_email text not null,
  service_type text not null check (service_type in ('complete_application', 'administration_paid')),
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'needs_candidate', 'ready_for_approval', 'approved', 'submitted_to_employer', 'completed', 'cancelled', 'rejected')),
  candidate_approved boolean not null default false,
  approved_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobseek_application_requests_user_idx
  on public.jobseek_application_requests(user_id);
create index if not exists jobseek_application_requests_job_idx
  on public.jobseek_application_requests(job_id);
create index if not exists jobseek_application_requests_status_idx
  on public.jobseek_application_requests(status);

alter table public.jobseek_application_requests enable row level security;

-- Candidates can see only their own requests.
drop policy if exists "candidates read own application requests" on public.jobseek_application_requests;
create policy "candidates read own application requests"
  on public.jobseek_application_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Candidates can create requests only for their own authenticated account.
drop policy if exists "candidates create own application requests" on public.jobseek_application_requests;
create policy "candidates create own application requests"
  on public.jobseek_application_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Candidates may update their own request only while it has not been approved/submitted.
drop policy if exists "candidates update pending application requests" on public.jobseek_application_requests;
create policy "candidates update pending application requests"
  on public.jobseek_application_requests
  for update
  to authenticated
  using (user_id = auth.uid() and candidate_approved = false and status in ('submitted', 'reviewing', 'needs_candidate'))
  with check (user_id = auth.uid());

-- Service-role/admin operations are intentionally left to the server-side Supabase role.
-- Do not expose the service-role key in browser JavaScript.

create or replace function public.jobseek_touch_application_request()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobseek_application_requests_touch on public.jobseek_application_requests;
create trigger jobseek_application_requests_touch
before update on public.jobseek_application_requests
for each row execute function public.jobseek_touch_application_request();
