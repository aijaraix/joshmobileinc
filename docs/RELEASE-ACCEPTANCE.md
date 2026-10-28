# Saved-request release acceptance

## Candidate checks completed locally

- `npm test`: 47 passing Node checks, including a 37-check private intake/staff lifecycle.
- `npm run build`: passed asset, six-service, social metadata, JSON-LD, direct-hosting, and browser-bundle checks.
- `node --check` passed for the customer/staff browser scripts and APIs.
- The browser harness has been updated for the save-first receipt. It needs an available Chromium runtime to execute; it is not evidence of real Blob storage or production headers.

## Required only after an approved deployment

1. Verify the production CSP contains `https://vercel.com/api/blob/` in `connect-src` and run a normal public-browser request with genuine JPEG, image, and short video files—no mocked APIs or altered browser security.
2. Confirm exactly one saved reference appears in the customer receipt, persisted private job, authenticated staff search, and optional short message. Cancel messaging and confirm the job remains.
3. With an authorized staff account, open the same production job, inspect private media and status, save a note, reload, and retrieve it again. Record this as **UNVERIFIED** until an authorized person completes it.
4. Test closed/blocked dates, a daylight-saving edge, overlapping confirmation, hours changes that preserve conflicts, canceled-calendar rejection, stale edits, and hidden/offline dashboard refresh behavior.
5. If owner email is authorized, verify one actual inbox receipt; otherwise leave the staff status at **Automatic owner email alerts are NOT ACTIVE**.

SMS and WhatsApp open the customer’s ordinary app only after saving. The website does not send, deliver, read, or synchronize those messages. ICS export is one-way, not calendar sync. Automatic SMS, WhatsApp API use, payment, and automatic reminders are deliberately excluded.
