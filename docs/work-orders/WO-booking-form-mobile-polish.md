# Work Order — Booking Form Mobile Polish

**Status:** Follow-up complete; ready for owner review
**Scope:** Public service-request form and authenticated owner request management only  
**Safety:** No production deployment, merge, notification changes, customer contact, or public delete API

## Goal

Make the public booking flow reliable and legible on phones, require a valid VIN
for new requests, and restore safe owner-only request deletion with recovery.

## Work items

1. **Keyboard visibility** — When a phone user focuses any `input`, `select`, or
   `textarea`, scroll the field into a visible position above the software
   keyboard. Use focus handling, appropriate scroll margin, and Visual Viewport
   resize handling where supported.
2. **Vehicle make suggestions** — Add local, accessible make suggestions (including
   Volkswagen and Volvo) to the Make field without restricting uncommon makes or
   calling an external API.
3. **Narrow-screen field rows** — At 360–414 px widths, a control that is alone in
   a row (for example, Service location) must use the full available row width;
   inspect every form row for clipping.
4. **Required VIN** — For new public requests, require a 17-character VIN made of
   letters and digits, excluding I/O/Q. Normalize it to uppercase and show the
   helper text: “Needed for an accurate quote — find it on your dashboard or
   registration.” Enforce the same rule in client and server validation. Existing
   requests without a VIN remain valid in the owner dashboard.
5. **Owner request deletion** — Restore phone-friendly Delete actions in both the
   owner request list and detail view. Require owner authentication and
   confirmation, soft-delete the request only, hide it from default lists, offer
   an Undo toast, and provide a Show deleted filter with restore. Deletion must
   not delete linked customers, vehicles, or jobs, and it must not be available
   through the public API.

## Investigation and acceptance

- Inspect the recent owner-dashboard upgrade and record why the Delete control
  disappeared; update this section with the evidenced cause before review.
- Use an additive storage migration only if the current persistence layer needs
  one for a deletion marker.
- Add automated tests for client/server VIN validation and owner-only
  delete/restore soft-delete behavior.
- Capture before-and-after public-form and owner-dashboard screenshots at 390 px.
- Update `STATUS.md`, `SERVER-STEPS.md`, and `LAUNCH-CHECKLIST.md` with the
  implementation, operator implications, and non-deployment status.
- Address any CodeRabbit review comments before reporting ready for owner review.

## Investigation: why Delete appeared to disappear

Git history shows the soft-delete feature was not removed by the recent V2
dashboard upgrade. Commit `47a94c9c` introduced the existing detail-only
control. On the current-main baseline, it was rendered only after opening a
request detail, only for `requested` or `cancelled` status, and was hidden for
all other records. There was no action on the request list. On a phone this
made it look as though the action had disappeared during the dashboard upgrade.

This change restores an explicit **Delete** button on eligible website-request
rows and in their detail view. Its confirmation dialog moves the request to
Trash, shows an Undo toast, and adds a Show deleted/Trash filter with Restore.
It does not replace or invoke the older separate permanent-removal control.

## Storage, safety, and verification

- No migration is needed: job records are additive documents, so `deletedAt`
  and `deletedBy` are new optional fields. A missing value is treated as active.
- Legacy jobs without a VIN are not changed or blocked in the owner dashboard;
  manually created CRM vehicles may still omit a VIN.
- The soft-delete endpoint is owner-only, same-origin protected, and accepts
  website-originated requests only. It leaves linked customer, vehicle, other
  job, media, and history records intact.
- `npm test` passed with 86 tests on 2026-11-13. Coverage includes client and
  server VIN validation, uppercase normalization, public delete-method denial,
  owner-only trash/restore, and linked-record preservation.
- `npm run build` passed on 2026-11-13.
- The synthetic phone harness now checks 360, 390, and 414 px widths and is
  prepared to write `mobile-390-before.png` and `mobile-390-after.png`. The
  managed sandbox blocks Chromium from creating its required local socket, so
  those local screenshots could not be captured in this workspace. No live site
  or customer record was accessed.

## Follow-up — owner-only trash UI and VIN whitespace (2026-11-13)

### Scope

- Hide every trash-management control from a signed-in manager: list/detail
  Delete, Show deleted, Trash navigation, Restore, Undo, and Purge. The browser
  must use the same fixed owner identity as the Telegram and push controls;
  server-side authorization remains the source of truth.
- Normalize public-booking VINs by removing all whitespace before uppercasing in
  both the browser copy and the server/shared copy. Do not alter legacy records.

### Acceptance and safety

- Add an executable owner-visibility test proving a manager receives no
  trash-management actions, plus retain the manager `403` API assertion.
- Add a test for a VIN containing interior whitespace in both client and server
  normalization paths.
- Do not change the already-correct server owner gate, production data, DNS,
  environment variables, notifications, billing, runners, workflows, or any
  deployment setting. Do not chase the known account-level GitHub Actions
  test-build failure. Grok Bot owns the SSO-preview screenshots.

### Completion

- Added a shared browser-only owner-visibility model mirroring `ADMINS[0]`.
  It hides Trash navigation, Show deleted, list/detail Delete, Restore, Undo,
  and Purge for a manager; the existing server gate was not changed.
- `normalizeVin` now removes interior whitespace before uppercasing in the
  shared/server module and browser module.
- `npm test` passed with 87 tests and `npm run build` passed on 2026-11-13.
- The known account-level GitHub Actions test-build failure was intentionally
  left untouched. Grok Bot owns SSO-preview screenshot capture.
