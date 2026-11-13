# Launch checklist

## Booking form mobile polish — 2026-11-13

- [x] Work order committed before implementation.
- [x] Public VIN validation covered in client/shared validation and booking API.
- [x] Owner-only request soft-delete/restore and linked-record preservation
  covered by automated tests.
- [x] `npm test` passed (86 tests).
- [x] `npm run build` passed on the final branch.
- [ ] In a browser-enabled runner, run `python3 tests/browser_acceptance.py` to
  capture the 390px before/after screenshots and check 360/390/414px widths.
- [ ] Owner reviews the list Delete action, detail Delete action, confirmation,
  Undo toast, Show deleted filter, and Restore using synthetic data only.
- [ ] Address any CodeRabbit review comments on the review branch.
- [ ] Owner merges. No deployment is authorized by this checklist.
