# Task 8b Manual QA

- Sign in as `reviewer@soulbound.local` and confirm `/admin/applications` loads through bearer-authenticated API calls.
- Open a submitted application, start review, then exercise approve, reject, and request-more-info on separate applications.
- Confirm the applicant status page shows `applicantNotice` after a decision and never displays `reviewSummary`.
- Open an application with a Persona Clip, click `클립 재생`, and confirm playback starts only after the signed URL is requested.
- Sign in as a plain applicant and navigate directly to `/admin/applications`; confirm the UI redirects and the API returns 403 if called directly.
- Sign in as an active member and confirm `/member` shows the active membership; a non-member is returned to `/gate`.
