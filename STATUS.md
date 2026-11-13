# Status

## 2026-11-13 — booking form mobile polish

Ready for owner review on `codex/booking-form-mobile-polish`.

- Public booking: focused phone controls are brought into view; the Make field
  has local suggestions; and standalone Service location uses the full grid
  row.
- VIN: new public requests require a normalized 17-character VIN with no I, O,
  or Q. Existing requests and manual CRM vehicles without one remain valid.
- Owner requests: Josh alone can soft-delete eligible website requests from the
  list or detail, undo immediately, show deleted records, and restore them.
  Linked customers, vehicles, jobs, media, and history are preserved.
- Safety: no notification changes, customer contact, migration, merge, or
  deployment occurred.
- Verification: `npm test` passed (86 tests) and `npm run build` passed on
  2026-11-13.

The local browser sandbox prevented 390px screenshot capture because Chromium
cannot create its required socket. The checked-in synthetic browser harness is
ready to capture the before/after images in a normal browser-enabled runner.
