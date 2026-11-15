# Status

## 2026-11-14 — limited public vehicle intake

Ready for owner review on `codex/booking-form-mobile-polish` / PR #23, pending
the final CodeRabbit check.

- The public booking form now asks for vehicle Year, Make, Model, and required
  VIN only; Make suggestions remain local and VIN has an inline missing/invalid
  error.
- Browser payload construction and the public booking API use an allowlist, so
  stale Trim, Engine, and Mileage values cannot be fingerprinted, stored, or
  included in new-request notifications.
- Historic values remain intact and readable in the private dashboard. The
  retired input controls are hidden for a new website request and remain
  available only where a legacy request has stored data.
- Verification: `npm test` passed (87 tests) and `npm run build` passed on
  2026-11-14.
- Pending: final CodeRabbit review check only.

No production, database, DNS, environment, notification delivery, customer
contact, merge, or deployment action has occurred. Grok Bot owns the preview
screenshots.

## 2026-11-13 — booking form mobile polish follow-up

Ready for owner review on `codex/booking-form-mobile-polish`.

- Public booking: focused phone controls are brought into view; the Make field
  has local suggestions; and standalone Service location uses the full grid
  row.
- VIN: new public requests require a normalized 17-character VIN with no I, O,
  or Q. Interior whitespace is removed before uppercase validation in both the
  browser and server paths. Existing requests and manual CRM vehicles without
  one remain valid.
- Owner requests: trash navigation, Show deleted, Delete, Restore, Undo, and
  Purge are visible only to the owner. A manager cannot render those controls
  and remains rejected by the API. Linked customers, vehicles, jobs, media, and
  history are preserved.
- Safety: no production, DNS, environment, database, notification, billing,
  runner, workflow, customer-contact, or merge change occurred.
- Verification: `npm test` passed (87 tests) and `npm run build` passed on
  2026-11-13.

Grok Bot owns the SSO-preview 390px screenshots; they were intentionally not
run from this work order.
