# Saved-request release acceptance

## Current production state — October 29, 2026

PR #2 merged as `d294c23f39f8341b0af734bb02a6dad84b35063b` and is serving in Vercel deployment `dpl_DfQaz7Uf67NDDh4NPgef5HFBvUiN` (READY). A normal-browser review found that the public form did not include the requested “Not sure / something else” option, although all six named service categories were present. The narrow correction is on branch `fix/unknown-service-option-production-acceptance`; it adds the fallback to the form and shared client/server validation and adds regression checks. Production acceptance remains **PENDING** until the correction passes CI and is deployed, and the live request/authorized staff readback below are completed.

## Candidate checks completed locally

- PR #2 reported `npm test`: 47 passing Node checks, including a 37-check private intake/staff lifecycle.
- PR #2 reported `npm run build`: passed asset, service, social metadata, JSON-LD, direct-hosting, and browser-bundle checks.
- Those checks apply to the merged PR #2 head, not the corrective branch. Exact-head correction CI is pending.
- The browser harness is not evidence of real Blob storage or production headers.

## Required production proof

1. Verify the production CSP contains `https://vercel.com/api/blob/` in `connect-src` and submit a synthetic request through an ordinary browser with two genuine images and a short valid video—no mocked APIs or altered browser security.
2. Confirm exactly one saved reference appears in the customer receipt, persisted private job, authenticated staff search, and optional short message. Close messaging without sending and confirm the job remains.
3. With an already-authorized staff account, open the same production job, inspect private media and attachment status, save a note and parts-preparation entry, reload, sign out/in, and retrieve it again. Mark this **UNVERIFIED** until an authorized account completes it.
4. Test future appointment confirmation, overlap rejection, cancellation, working hours/blocked dates, calendar export behavior, and public denial of private job/media endpoints.
5. Keep automatic owner-email alerts **NOT ACTIVE** unless Josh authorizes the connection and an actual authorized inbox receipt is proven.

SMS and WhatsApp open the customer's ordinary app only after saving. The website does not send, deliver, read, or synchronize those messages. WhatsApp should be described as operational only after Josh confirms that his business number supports it. Automatic SMS, WhatsApp API use, payment, and automatic reminders remain excluded.
