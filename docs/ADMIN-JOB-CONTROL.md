# JobSeek Admin Job Control

## Admin requirements

Admins can manually import a vacancy from the admin portal using the original job URL or by entering the vacancy details. Manual imports must retain source attribution and an `imported_by_admin` audit field.

### Manual import fields
- title
- company
- location
- category
- description
- posted_at
- closing_at (optional; never invent)
- salary/currency when supplied
- visa_sponsorship (`true` only when explicitly supported by the source/employer)
- source
- source_url
- apply_url
- verification_status
- notes

Manual jobs should enter the same verification pipeline as automated jobs. An admin may override the public verification state only with an audit note and the identity of the admin.

## Admin actions

The admin portal must provide:
- Add/import job
- Edit job
- Verify / mark not confirmed
- Close job
- Delete/remove job
- Restore an accidentally removed job when appropriate
- Search/filter by active, expired, verification state, source, country, category and visa sponsorship

## Expired-job cleanup

A scheduled cleanup should run every day and:
1. Identify vacancies whose closing date has passed.
2. Mark them closed/expired.
3. Remove them from public active search and alerts immediately.
4. Delete old expired records according to the configured retention period, while preserving a minimal audit record when legally/operationally required.

The public site must never show a vacancy as active when its known closing date has passed.

## Visa sponsorship

Visa-sponsored jobs are a first-class filter and alert preference. Only set sponsorship to true when the source explicitly states sponsorship/visa support or a configured trusted verification rule establishes it. Never infer sponsorship merely from a country or job title.
