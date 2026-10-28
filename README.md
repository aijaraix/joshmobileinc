# Josh Mobile Inc. — public site and private appointment workspace

Production: https://joshmobileinc.com · Staff: `/owner` · North Broward County, Florida.

## Customer request flow

There is one intake path: complete the form → save one private job → upload selected media → show a receipt → optionally open SMS or WhatsApp. A request is not an appointment reservation; Josh confirms the time, work, location, parts, and price.

Every saved request has a collision-checked `JM-XXXXXXXX` reference. The originating browser keeps only an opaque recovery proof in `sessionStorage`, never customer details. A repeated submit with the same details and proof returns the same job and a fresh short-lived upload capability; a UUID or reference alone cannot read, edit, or upload to a job. Changed data with the same idempotency key is rejected.

The receipt message contains only the reference. SMS and WhatsApp links open the customer's own messaging app after a fresh tap; they do not send, deliver, or sync a message. The public site has no email submission path, no customer login, no automatic two-way SMS/WhatsApp sync, and no paid messaging provider.

## Staff workspace

The private dashboard supports search by reference, name, phone, vehicle, or VIN; private media; attachment receipt/failure status; notes, parts/tools, conversation history with staff attribution; phone-only manual jobs; appointment confirmation/rescheduling/cancellation/completion; calendar export for confirmed jobs only; and an inexpensive active-dashboard change check. Refresh pauses while hidden or offline and does not overwrite dirty notes.

Only `joshmobileinc@gmail.com` and `sholom@aicreates.ai` can sign in. Each uses an individual activation/password account. Passwords use scrypt; sessions are signed, Secure, HttpOnly, SameSite=Strict cookies backed by revocable private records. Recovery is operator-assisted through the managing administrator; there is no public PIN or password-reset bypass.

## Storage, uploads, and scheduling

Jobs, account hashes, sessions, reference claims, notification state, and media are private Vercel Blob objects—not GitHub or static site files. Media is limited to six files, 15 MB each, 30 MB total. JPG/PNG/WebP and MP4/MOV/WebM are accepted; HEIC receives conversion guidance. Browser uploads have progress, a 90-second bound, partial-success handling, signature checks, and retry/recovery support. The CSP allows the precise Blob SDK upload endpoint `https://vercel.com/api/blob/`.

Hours remain staff-configured in America/New_York. Until enabled, the public form requests Morning/Afternoon/Flexible preferences. When enabled, both client and server reject closed, blocked, stale, or unavailable request times. Pending requests do not lock a slot. Confirmed appointments are overlap-checked, and later hour changes preserve conflicting existing appointments for staff review.

## Owner alerts

The optional Apps Script MailApp route is **not active** until Josh authorizes it, its two Vercel Production secrets are configured, and an authorized inbox receives a synthetic alert. See [Owner alert setup](integrations/google/OWNER-ALERT-SETUP.md). It emits a signed, expiring, idempotent event containing only a reference, service, request time, and normal authenticated workspace link. “Accepted” means the provider accepted the handoff—not inbox delivery. No automatic appointment reminders are enabled.

## Build and release checks

Node 24: `npm ci`, `npm test`, `npm run build`. The current suite has 47 Node checks covering validation, idempotency/recovery proof, short reference creation, attachment status, private media, owner-alert privacy/idempotency, auth, scheduling, stale edits, calendar access, manual jobs, conversation history, logout, and password revocation. `tests/browser_acceptance.mjs` is an optional synthetic browser UI harness; it must not be treated as storage or deployed-Blob evidence.

Production-only configuration: `BLOB_READ_WRITE_TOKEN`, `JM_SESSION_SECRET`, `JM_OWNER_INVITE_HASH`, `JM_MANAGER_INVITE_HASH`, `JM_INVITE_EXPIRES`, `JM_BOOKING_ENABLED=true`, and—only after owner authorization—`JM_ALERT_WEBHOOK_URL` plus `JM_ALERT_WEBHOOK_SECRET`. Never commit raw invitations, passwords, cookies, environment files, customer records, webhook URLs, or alert secrets.

Monitor existing Vercel Blob/function usage; included usage is finite and overages may apply. No new VPS, database, phone number, paid messaging plan, or subscription is required by this code.
