# Activate the private Google workspace

**Status at rebuild:** code is supplied, but no Google authorization, live calendar, saved records, reminder delivery or admin sign-in has been verified. The public site works independently through direct WhatsApp/text/email requests. Do not claim automatic booking until the activation tests below pass.

## Account and privacy

Business owner: `joshmobileinc@gmail.com`. Approved administrator: `sholom@aicreates.ai`.

Run the script as the business owner. A separate private spreadsheet, Drive folder and private Calendar are created. Files are never publicly shared. Admin access is enforced server-side by the allowlist and a six-digit email code (10-minute expiry, max five guesses, 90-second issuance cooldown). Admin sessions expire after one hour. No credentials are stored in GitHub.

## Setup

1. While signed in to the business owner Google account, create a standalone Apps Script at `https://script.google.com/home`.
2. Paste `Code.gs`. Add an HTML file named `Owner` and paste `Owner.html`. Set project timezone to **America/New_York**.
3. Run `install` from the editor and authorize Drive, Sheets, Calendar, email and scheduled triggers. These permissions are necessary for the described functions. Do not authorize under a different Google account.
4. Deploy as a Web app, executing as **Me**, accessible to **Anyone**. This exposes the sign-in page and the ingestion endpoint, not job records. Admin data methods validate an expiring session; ingestion requires an API secret.
5. Copy the deployment `/exec` URL to Vercel encrypted variable `JM_GOOGLE_WEBAPP_URL`. Copy `API_SECRET` from Apps Script Project Settings → Script properties directly into Vercel encrypted variable `JM_GOOGLE_API_SECRET`. Never share this secret in chat or commit it.
6. Keep `JM_ONLINE_INTAKE_ENABLED` absent/false until tests pass. The live public site uses direct messaging in this state.
7. First verify the script's owner login independently with each allowed administrator email. Verify a different email cannot sign in or read jobs.
8. Test the `/api/booking` route in a reviewed preview with a synthetic request and no private media; the production-origin allowlist may need a **specific reviewed preview origin** for this test, not a wildcard. Once enabled, the review step adds a “Submit privately to Josh” option. This posts the details and all selected files together, rejecting media over 2.5 MB total without dropping files. Direct-message options remain available. Complete end-to-end validation before directing customers to this new option.

## Functionality supplied in the Google backend

- Private request records and restricted Drive media storage.
- Idempotent request identifiers, a 30-request/day global cap and three requests/day per phone.
- Maximum six files and **2.5 MB combined** for proxied online intake (different from the direct-sharing flow, which supports 30 MB). Do not silently drop media.
- Email notification to Josh, with truthful notification state if email quota is reached.
- New, confirmed, completed, cancelled statuses; private notes and parts/tools list.
- Private Calendar events for confirmed jobs, one-hour planning blocks with conflict checks.
- Hourly reminder checks for upcoming confirmed jobs in the next 24 hours. This does not guarantee an email exactly 24 hours before.
- No automatic customer invitation or email; confirm with the customer directly.

## Activation acceptance checklist

- Public website and assets are accessible logged out.
- Synthetic request creates exactly one row, repeating its requestId creates no duplicate.
- Admin login works for each approved email; unauthorized email/session cannot view or update jobs.
- A synthetic attachment is private and visible to the owner, never exposed publicly.
- Share the private job folder with the approved administrator manually if that administrator needs Drive-file access. App permission does not grant Drive permission.
- Confirm a job, verify calendar event and reject an overlapping appointment.
- Edit job notes/parts and verify persistence after sign-out/in.
- Cancel a job and verify its calendar event is removed.
- Verify reminder delivery, one reminder per appointment, and updated times reset the reminder.
- Update the site's privacy text and intake UI only after the above checks pass.

Google storage and Apps Script quotas apply. No unlimited-storage or unlimited-email promise. Review access and remove stale customer media periodically.
