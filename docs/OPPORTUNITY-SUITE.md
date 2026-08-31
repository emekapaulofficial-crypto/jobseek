# JobSeek Opportunity Suite

This release adds the first application-preparation layer around the live job feed.

## Candidate flow
1. Search active vacancies.
2. See posted and closing dates when the source provides them; otherwise JobSeek shows `Not specified`.
3. Open **Build my application** for the exact vacancy.
4. Prepare a tailored CV, cover letter, portfolio URL, LinkedIn URL and Indeed URL.
5. Review an **Application Readiness** score. This is not a hiring/approval probability.
6. Apply through the original employer/source link.
7. Configure instant, daily or weekly job-alert preferences.

## Portfolio
`portfolio.html` provides a builder and `portfolio-view.html` provides a preview route. The production public portfolio should be backed by the Supabase `jobseek_portfolios` tables from `supabase/jobseek_opportunity_suite.sql` so an employer can open the candidate's portfolio from another device.

## Fresh-job alerts
`job-alerts.html` stores the candidate's preferences locally for the static-site experience. Production email delivery needs a server-side notification worker/provider (for example a Supabase Edge Function plus an email provider secret). Never place an email-provider secret or Supabase service-role key in browser JavaScript.

## Freshness rules
External jobs should carry `posted_at`, `closing_at`, `last_verified_at`, `job_status` and `source_url`. JobSeek should only label a vacancy active when its closing date has not passed and the source has not reported it closed.

## Trust
JobSeek must not promise a 90% hiring/approval probability. The product language should use **Application Readiness** (for example 90%) to describe how complete and job-aligned the candidate's materials are. Employment, interview, visa and approval outcomes remain controlled by the employer and relevant authorities.
