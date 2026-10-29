# Launch and operating truth — October 29, 2026

## Public service

Customers complete one required form, including a 17-character VIN, service address, preferred contact channel, date/time preference, consent, and optional private media. The six named service categories remain available alongside a “Not sure / something else” fallback for customers who cannot identify the issue; the fallback is included in the pending production correction. The server saves the private job first and then displays its `JM-XXXXXXXX` receipt. SMS and WhatsApp are optional receipt actions only; a user can close either app and the saved request remains. A request is never an automatic reservation.

Files are capped at six, 15 MB each, 30 MB combined. Supported secure uploads are JPG, PNG, WebP, MP4, MOV, and WebM. HEIC receives conversion guidance. A reload cannot restore an old browser file selection; the receipt explains that files must be selected again to retry incomplete uploads.

## Josh’s operating steps

1. **Activate/sign in:** Open the private activation email, create a 12+ character password, then use the discreet **Staff sign in** footer link at `/owner`. If activation or the password is unavailable, contact the managing administrator; do not create a shared account or a fallback PIN.
2. **Set hours:** In the private workspace, open **Working hours & availability**, enter actual Eastern-time days/hours and days off, then enable public slots only when ready. Before that, customers request a preferred window. Review any preserved conflict warning before changing an existing appointment.
3. **Spot a new request:** Keep the authenticated dashboard open during the workday. Its status line checks a small change marker when active, visible, and online; the New requests count and badge update without replacing unsaved notes. Automatic owner email is NOT ACTIVE until the separate authorization below passes.
4. **Open and review:** Search the receipt reference, customer name, phone, vehicle, or VIN. Review the address, requested work, attachment count (`received of expected`), and failures. A missing attachment is distinct from no photos selected.
5. **Confirm and text:** Set the final Eastern date/time and duration, then change status to Confirmed. Use **Text customer** to open the phone’s ordinary SMS app, and save an honest dated conversation note after a call, SMS, or WhatsApp discussion. The site does not import either conversation automatically.

## Optional owner-email alert

Automatic owner email is deliberately disabled until authorized. The one setup path is in [Owner alert setup](../integrations/google/OWNER-ALERT-SETUP.md). After configuration, submit a clearly labelled synthetic request and confirm the actual owner inbox receives the reference before describing alerts as active. Google MailApp quotas are finite and account-dependent; confirm the active account type and other usage before relying on burst notifications. This project does not enable automatic appointment reminder email without a separately authorized scheduler.

## Required post-approval production proof

After an approved deployment, use an ordinary browser with normal security settings (no injected headers, mocked APIs, disabled web security, or test overrides) to submit one clearly labelled QA request with a genuine JPEG, a genuine short video, and a second genuine image. Verify the same reference and fields in the authenticated staff workspace, open each private attachment, save a note, reload, and retrieve it again. Exercise a canceled job’s calendar export (it must be rejected), a blocked/closed slot, a daylight-saving boundary, a stale staff edit, and a failed/renewed upload. Do not contact QA phone numbers or alter real jobs.

## Boundaries

Do not invent hours, prices, reviews, credentials, a public shop address, delivery confirmation, or WhatsApp operation. Confirm that Josh actually uses WhatsApp on `(646) 796-7322` before presenting it as an operational channel. ICS is a one-way calendar export with device alarms, not calendar synchronization. Preserve the photographic social card, public canonical domain, private API no-store/noindex responses, and existing Vercel usage limits; no DNS changes are needed.
