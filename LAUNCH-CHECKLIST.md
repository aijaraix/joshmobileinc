# Launch checklist

## Limited public vehicle intake — 2026-11-14

- [x] Work-order follow-up committed before implementation.
- [x] Public form, browser payload, server fingerprint, and new job persistence
  exclude Trim, Engine, and Mileage while retaining historic records.
- [x] Year, Make, Model, and VIN remain required; VIN whitespace normalization
  and inline error behavior are covered.
- [x] `npm test` passed (87 tests) on the final branch.
- [x] `npm run build` passed on the final branch.
- [ ] CodeRabbit review check completed.
- [x] Preview screenshots intentionally remain with Grok Bot.
- [ ] Owner reviews and merges PR #23. No deployment is authorized.

## Booking form mobile polish — 2026-11-13

- [x] Work order committed before implementation.
- [x] Public VIN validation, including interior-whitespace normalization,
  covered in browser/shared validation and booking API.
- [x] Owner-only request soft-delete/restore and linked-record preservation
  covered by automated tests.
- [x] Non-owner UI hides Trash, Show deleted, Delete, Restore, Undo, and Purge;
  the manager API `403` remains covered.
- [x] `npm test` passed (87 tests).
- [x] `npm run build` passed on the final branch.
- [x] 390px screenshots intentionally skipped here; Grok Bot owns capture on
  the SSO-protected Preview.
- [ ] Owner reviews the list Delete action, detail Delete action, confirmation,
  Undo toast, Show deleted filter, and Restore using synthetic data only.
- [ ] Address any CodeRabbit review comments on the review branch.
- [ ] Owner merges. No deployment is authorized by this checklist.
