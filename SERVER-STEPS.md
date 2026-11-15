# Server steps

## Limited public vehicle intake — 2026-11-14

No server, Vercel environment, DNS, database, or notification configuration
change is required. The public booking route now constructs an explicit
allowlisted vehicle/request payload and therefore discards submitted Trim,
Engine, and Mileage values. It continues to normalize VIN whitespace and case
before validating and storing a new request.

This is not a migration: legacy private job documents retain any existing Trim,
Engine, and Mileage values and remain readable in the owner dashboard. Do not
backfill, rewrite, or remove those fields. Do not deploy this branch; after
owner review and merge, use the normal synthetic booking check only.

Local verification completed on 2026-11-14: `npm test` (87 tests) and
`npm run build` both passed.

## Booking form mobile polish — 2026-11-13

No server, Vercel environment, DNS, database, or notification configuration
change is required for this branch.

`deletedAt` and `deletedBy` are optional fields on existing private job
documents. They are additive and require no migration; records without either
field remain active. The new VIN requirement applies only when a new public
booking is saved. It does not modify or invalidate existing requests or manual
CRM vehicle records.

The follow-up keeps the server owner gate unchanged. It only hides
trash-management controls for non-owners in the browser; the API continues to
return `403` for a manager. Public-booking VIN normalization now removes all
whitespace before uppercasing in the shared server path and the browser copy.

Do not deploy this branch from this work order. After owner review and merge,
run the normal build and a synthetic authenticated owner check. Do not use a
real customer record for the delete/restore check, and do not change any
notification flags.
