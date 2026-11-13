# Work Order — Booking Form Mobile Polish

**Status:** In progress  
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
