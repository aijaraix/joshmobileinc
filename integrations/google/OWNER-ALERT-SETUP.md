# Optional owner-email alert (not active until authorized)

The Vercel Blob job record remains the only system of record. This narrow Apps Script helper only accepts signed, expiring `new-request` events and emails a short reference, service, request time, and the normal authenticated staff link. It never receives a VIN, address, phone number, description, attachment, or browser request.

## Owner authorization step

While signed in as `joshmobileinc@gmail.com`, create a **new standalone Apps Script** from `OwnerAlert.gs`, set the project timezone to `America/New_York`, add a Script Property named `OWNER_ALERT_SECRET` with a newly generated high-entropy value, and deploy it as a Web App that executes as the owner. Authorize only the MailApp permission. If the manager should receive copies, set the optional `ALERT_MANAGER_EMAIL` Script Property exactly to `sholom@aicreates.ai`; leave it blank otherwise.

Give the resulting `/exec` URL and the same secret to a project administrator to enter as the Production **Secret** Vercel variables `JM_ALERT_WEBHOOK_URL` and `JM_ALERT_WEBHOOK_SECRET`. Do not put either value in source, browser code, a query string, or this document.

## Operational limits and evidence

Google documents daily recipient quotas per Apps Script user, currently 100 for consumer accounts and 1,500 for Google Workspace accounts. They reset 24 hours after the first request and can change. The helper checks `MailApp.getRemainingDailyQuota()` before it sends; it records a rejection as not accepted rather than pretending the inbox received it. Check the actual account type and its other MailApp usage before activation—100 requests per month does not guarantee a burst fits the daily quota.

The website records `not_configured`, `pending`, `accepted`, `failed`, or `uncertain` delivery state with one durable `new-request:<job-id>` event ID. `accepted` means the provider accepted the handoff, not that an inbox received or read it. A failed event can be retried from the private workspace after its 15-minute retry window; an `uncertain` result is deliberately held for owner review so a timeout cannot flood the inbox. The helper serializes events and deduplicates accepted event IDs for 35 days.

Before calling the alert active, submit one clearly labelled synthetic request, receive the email in the authorized owner inbox, verify the reference opens the authenticated `/owner` workspace, then document the quota result. Do not enable automatic appointment reminders: no approved scheduler is configured in this release.
