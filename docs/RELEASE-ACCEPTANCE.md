# Saved-request release acceptance

## Production release — October 29, 2026

- Original PR #2 merged as `d294c23f39f8341b0af734bb02a6dad84b35063b`.
- Production correction PR #3 restored “Not sure / something else”; merge commit: `92db981d16e65e125b3d91339159841ca49a390d`.
- Vercel production deployment: `dpl_E5w6pCeWso4X4R8kAgM5mFTLhugw`, READY for that exact SHA.
- The canonical production domain returned the updated blue-and-white photo site and showed all six named services plus the fallback. `www.joshmobileinc.com` redirected to `https://joshmobileinc.com/`. Social metadata, photographs, Instagram link, North Broward branding, and the exact Blob upload CSP source are present in the deployed source/config.
- `/owner` displays the private staff sign-in page. Unauthenticated `/api/admin` job-list and file requests returned “Sign in to view this private workspace.” No customer record was returned.
- The deployed build ran `npm test`, `npm run build`, and the private-storage acceptance scenario. Build logs show 44 passing TAP entries (including the added fallback coverage) and 37 passing private-storage workflow checks. No test failures. The successful Vercel build is not proof of a real browser Blob upload or authenticated staff retrieval.
- Runtime review found no application exception group. Vercel reported two Node `DEP0169` `url.parse()` deprecation warnings on `/api/admin` and `/api/availability`; this is recorded for follow-up.

## Live acceptance status: PENDING

No production QA request was submitted and no test record was created. The ordinary browser form was prepared with synthetic information, but the available browser-control interface could not open/select local files through the site's normal file chooser. The browser interface reported that the file control had no settable value; no browser-security or API bypass was attempted. Without an authenticated authorized staff session, the staff readback and cleanup could not be completed either.

Therefore there is no live request reference, no uploaded attachments, no staff note/parts entry, no confirmed/canceled QA appointment, and no real-device SMS/WhatsApp verification to report. Josh's personal login was not verified. The temporary test files were not transmitted. Production remains on the READY release above; it was not rolled back.

## Remaining proof required

1. In a normal browser that supports the visible operating-system file chooser, submit one clearly labeled synthetic request with two JPEGs and a small valid MP4. Confirm the one returned `JM-XXXXXXXX` reference and successful status for all three uploads. Do not contact or dispatch anyone.
2. Using an already-authorized staff or owner-assisted account, find that same reference, inspect all customer, vehicle, address, service, schedule, and private media fields, save a private note and parts entry, and verify persistence after reload and a legitimate sign-out/sign-in.
3. Confirm appointment overlap protection, then cancel the QA appointment while preserving existing bookings.
4. Test optional SMS/WhatsApp links on supported devices without sending the message. WhatsApp remains unverified as an operational business channel until Josh confirms support on the number.
5. Keep automatic owner-email alerts disabled. Do not enable paid messaging, change credentials, or invent working hours.

The automated suite covers request validation, idempotent retry, short reference generation, private persistence and media, upload-failure state, authentication, appointment conflicts, working-hours and blocked-date rules, cancellation/calendar behavior, password/session security, and SMS/WhatsApp message formatting. The production browser flow, real Blob transfer, dashboard note persistence, and device link opening remain unverified as stated above.
