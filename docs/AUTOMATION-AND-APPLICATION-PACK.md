# JobSeek Automation & Application Pack

## Vacancy ingestion
- Run the discovery worker at least 3 times daily (recommended every 4 hours; the existing workflow can run more frequently).
- Store `posted_at`, `closing_at`, `last_verified_at`, source, original URL and application URL for every vacancy.
- Never invent a closing date. If the source does not provide one, display `Not specified`.
- De-duplicate vacancies by stable source/job identifiers and canonical URLs.

## Verification robot
Each newly discovered vacancy passes through a verification pipeline:
1. Validate the source and canonical application URL.
2. Fetch the vacancy page when permitted and confirm that the job exists.
3. Confirm employer/company name, role, location, posting date and closing date when available.
4. Check freshness and whether the vacancy has disappeared or closed.
5. Assign one of three public states: `Verified`, `Not confirmed`, or `Removed`.
6. Only the verification service may move a listing to `Removed`; removals should be retained in an audit log rather than silently lost.

`Verified` means the vacancy could be corroborated by the configured checks; it is not a guarantee of hiring or employer legitimacy. `Not confirmed` means JobSeek could not establish enough evidence and should not represent the vacancy as verified.

## Application pack robot
For each saved/generated application, create a professional application pack containing:
- Job title and employer
- Application readiness score and explanation
- Tailored CV
- Tailored cover letter
- Public portfolio URL
- LinkedIn URL
- Indeed URL
- Candidate contact/professional details
- Relevant project links
- Source/original vacancy URL and direct application URL

The pack should be downloadable as a single PDF and, where supported, as a DOCX document. Never include private documents or sensitive identity documents unless the candidate explicitly selects them.

## Email alerts
Candidates control alerts themselves:
- instant
- daily digest
- weekly digest
- off

Alerts are sent only for fresh vacancies matching the candidate's saved preferences and minimum match score. Each alert must include the vacancy status, posted date, closing date when known, match score, source and a direct `Apply` action.

## Accuracy rules
- Never claim a 90% hiring probability.
- Use `Application Readiness` for the candidate's preparation score.
- Never fabricate skills, qualifications, employment history, salary, posting dates or closing dates.
- External jobs remain attributed to their original source.
