-- JobSeek agency recruitment foundation
-- Supabase project: eavamfsbasjvngeqsyua
-- Applied to the connected Supabase project as migration: jobseek_agency_foundation

create schema if not exists jobseek_private;

create type public.jobseek_user_role as enum ('candidate','employer','agent','admin');
create type public.jobseek_verification_status as enum ('pending','under_review','verified','rejected','suspended');
create type public.jobseek_job_status as enum ('draft','submitted','under_review','approved','published','filled','closed','rejected');
create type public.jobseek_application_status as enum ('applied','shortlisted','interview','offer','visa','deployed','rejected','withdrawn');
create type public.jobseek_document_status as enum ('pending','verified','rejected');

create table public.jobseek_accounts (id uuid primary key references auth.users(id) on delete cascade, role public.jobseek_user_role not null default 'candidate', full_name text, phone text, country text, city text, avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.candidate_profiles (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.jobseek_accounts(id) on delete cascade, full_name text, date_of_birth date, nationality text, country_of_residence text, city text, phone text, profession text, target_job text, years_experience numeric(5,2), education text, skills text[] not null default '{}', languages text[] not null default '{}', preferred_countries text[] not null default '{}', preferred_job_types text[] not null default '{}', visa_status text, availability text, profile_completed boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.employers (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.jobseek_accounts(id) on delete cascade, company_name text not null, legal_name text, country text, address text, website text, contact_name text, contact_email text, contact_phone text, registration_number text, company_description text, verification_status public.jobseek_verification_status not null default 'pending', verified_at timestamptz, verified_by uuid references public.jobseek_accounts(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.employer_verification_requests (id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.employers(id) on delete cascade, submitted_by uuid not null references public.jobseek_accounts(id) on delete restrict, status public.jobseek_verification_status not null default 'pending', document_paths text[] not null default '{}', requested_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.jobseek_accounts(id) on delete set null, admin_notes text, rejection_reason text);
create table public.agency_jobs (id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.employers(id) on delete restrict, title text not null, description text not null, country text, city text, job_type text, category text, salary_min numeric(14,2), salary_max numeric(14,2), salary_currency text, visa_sponsorship boolean not null default false, positions_available integer not null default 1 check (positions_available > 0), requirements text[] not null default '{}', benefits text[] not null default '{}', application_deadline date, status public.jobseek_job_status not null default 'draft', verification_status public.jobseek_verification_status not null default 'pending', approved_by uuid references public.jobseek_accounts(id) on delete set null, approved_at timestamptz, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.applications (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidate_profiles(id) on delete cascade, agency_job_id uuid not null references public.agency_jobs(id) on delete cascade, status public.jobseek_application_status not null default 'applied', cover_message text, assigned_agent_id uuid references public.jobseek_accounts(id) on delete set null, admin_notes text, submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(candidate_id, agency_job_id));
create table public.application_status_history (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade, old_status public.jobseek_application_status, new_status public.jobseek_application_status not null, changed_by uuid references public.jobseek_accounts(id) on delete set null, note text, created_at timestamptz not null default now());
create table public.placements (id uuid primary key default gen_random_uuid(), application_id uuid not null unique references public.applications(id) on delete cascade, candidate_id uuid not null references public.candidate_profiles(id) on delete restrict, employer_id uuid not null references public.employers(id) on delete restrict, agency_job_id uuid not null references public.agency_jobs(id) on delete restrict, assigned_agent_id uuid references public.jobseek_accounts(id) on delete set null, placement_status public.jobseek_application_status not null default 'applied', offer_date date, visa_submitted_at timestamptz, visa_approved_at timestamptz, deployment_date date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.jobseek_documents (id uuid primary key default gen_random_uuid(), candidate_id uuid references public.candidate_profiles(id) on delete cascade, employer_id uuid references public.employers(id) on delete cascade, document_type text not null check (document_type in ('cv','passport','certificate','qualification','work_permit','other','employer_registration')), file_name text not null, storage_path text not null unique, mime_type text, file_size bigint, verification_status public.jobseek_document_status not null default 'pending', verified_by uuid references public.jobseek_accounts(id) on delete set null, verified_at timestamptz, created_at timestamptz not null default now(), check ((candidate_id is not null and employer_id is null) or (candidate_id is null and employer_id is not null)));
create table public.jobseek_messages (id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.jobseek_accounts(id) on delete cascade, recipient_id uuid not null references public.jobseek_accounts(id) on delete cascade, application_id uuid references public.applications(id) on delete set null, subject text, message text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.jobseek_admin_notes (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.jobseek_accounts(id) on delete cascade, candidate_id uuid references public.candidate_profiles(id) on delete cascade, employer_id uuid references public.employers(id) on delete cascade, application_id uuid references public.applications(id) on delete cascade, note text not null, created_at timestamptz not null default now(), check (candidate_id is not null or employer_id is not null or application_id is not null));

create index candidate_profiles_user_id_idx on public.candidate_profiles(user_id);
create index employers_user_id_idx on public.employers(user_id);
create index employers_verification_status_idx on public.employers(verification_status);
create index agency_jobs_employer_id_idx on public.agency_jobs(employer_id);
create index agency_jobs_status_idx on public.agency_jobs(status);
create index agency_jobs_country_idx on public.agency_jobs(country);
create index applications_candidate_id_idx on public.applications(candidate_id);
create index applications_job_id_idx on public.applications(agency_job_id);
create index applications_status_idx on public.applications(status);
create index placements_candidate_id_idx on public.placements(candidate_id);
create index placements_status_idx on public.placements(placement_status);
create index documents_candidate_id_idx on public.jobseek_documents(candidate_id);
create index documents_employer_id_idx on public.jobseek_documents(employer_id);
create index messages_recipient_id_idx on public.jobseek_messages(recipient_id);
create index messages_application_id_idx on public.jobseek_messages(application_id);

create or replace function jobseek_private.is_staff(uid uuid) returns boolean language sql stable security definer set search_path = public, jobseek_private as $$ select exists (select 1 from public.jobseek_accounts a where a.id = uid and a.role in ('agent','admin')); $$;
revoke all on function jobseek_private.is_staff(uuid) from public;
grant execute on function jobseek_private.is_staff(uuid) to authenticated;

create or replace function public.jobseek_set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

alter table public.jobseek_accounts enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.employers enable row level security;
alter table public.employer_verification_requests enable row level security;
alter table public.agency_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.placements enable row level security;
alter table public.jobseek_documents enable row level security;
alter table public.jobseek_messages enable row level security;
alter table public.jobseek_admin_notes enable row level security;

-- RLS policies are applied in the connected Supabase migration jobseek_agency_foundation.
-- The agency document bucket is private and named jobseek-documents.
