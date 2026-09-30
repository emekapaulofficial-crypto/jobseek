-- JobSeek: publish a public job lead as a real agency vacancy
--
-- WHY THIS EXISTS
-- agency_jobs.employer_id is NOT NULL and must point at a real employers row,
-- and employers.user_id is itself NOT NULL and must point at a real signed-up
-- account. A quick "Post a Job" submission from employer.html has neither —
-- it is just a company name and an email typed by a visitor who never signed
-- up. So marking a lead "published" can only ever mean one thing safely:
-- attach it to an employer who DOES already have a verified JobSeek account.
--
-- This function does that attachment in one step, as an admin/agent action:
-- given a lead and an existing employer, it creates the agency_jobs row and
-- marks the lead published. If the company has no JobSeek account yet, run
-- this only after inviting them to sign up via employer-portal.html — there
-- is no safe way to auto-create an employer account from a lead.

create or replace function public.jobseek_publish_job_lead(
  p_lead_id uuid,
  p_employer_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, jobseek_private
as $$
declare
  v_lead public.public_job_leads;
  v_job_id uuid;
begin
  if not jobseek_private.is_staff(auth.uid()) then
    raise exception 'Only JobSeek admins/agents can publish a job lead.';
  end if;

  select * into v_lead from public.public_job_leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Job lead not found.';
  end if;

  if not exists (select 1 from public.employers e where e.id = p_employer_id) then
    raise exception 'That employer account does not exist yet. Ask the company to sign up at employer-portal.html first, then try again.';
  end if;

  insert into public.agency_jobs (
    employer_id, title, description, country, city, job_type, category,
    status, verification_status, approved_by, approved_at, published_at
  ) values (
    p_employer_id, v_lead.job_title, v_lead.description, v_lead.location, null,
    v_lead.job_type, v_lead.category,
    'published', 'verified', auth.uid(), now(), now()
  ) returning id into v_job_id;

  update public.public_job_leads
    set status = 'published', reviewed_by = auth.uid(), reviewed_at = now(), agency_job_id = v_job_id
    where id = p_lead_id;

  return v_job_id;
end;
$$;

revoke all on function public.jobseek_publish_job_lead(uuid, uuid) from public;
grant execute on function public.jobseek_publish_job_lead(uuid, uuid) to authenticated;
