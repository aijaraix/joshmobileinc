# Work Order — Owner Pricing Workspace

**Status:** Implemented; verification passed
**Branch:** `codex/josh-admin-pricing-20261115` from `main`  
**Scope:** Authenticated owner workspace only (`/owner#view=pricing`)

## Goal

Make the existing private service catalog easy to find and use by adding a
first-class **Pricing** page. Each service or common part will show its cost,
customer price, and calculated dollar/percent margin without exposing prices on
the public website.

## Requirements

1. Add a Pricing navigation item and page in `/owner`, with a Settings link to
   it. Do not add a public pricing route or an `/admin` route.
2. Extend the existing private catalog record safely with an optional
   `costCents` field alongside its existing customer-price cents fields. Allow
   staff to add, edit, and archive catalog items using the existing
   `catalog-save` and `parts-settings` APIs and storage paths.
3. Display live margin in dollars and percent. Keep global parts markup as a
   helper, while allowing an item’s customer price to remain an independent
   value.
4. When staff select a catalog service for a new job or quote, prefill empty
   quoted parts, labor, and actual parts-cost fields from the catalog. Never
   overwrite a populated or historical job/quote snapshot.
5. Keep legacy catalog records with no cost field valid and saveable. Do not
   overwrite production Blob records with in-code defaults, delete Blob data,
   or add a data-rewriting migration.

## Boundaries

- Keep sign-in, authorization, sessions, customer data, existing per-job
  estimates, supplier quotes, and existing storage prefixes unchanged.
- No public price list, booking-form change, customer notification, supplier
  API, payment, invoice, tax-calculation, environment, secret, deployment, or
  production Blob write.
- The owner merges; this work opens a review PR only. Automatic preview builds
  are acceptable.

## Acceptance

- Tests cover cost/price/margin, archive behavior, legacy rows without cost,
  prefill-only-when-empty behavior, and preservation of existing job snapshots.
- `npm test` passes.
- `STATUS.md` and `docs/OWNER-OPERATIONS.md` document the Pricing page path
  and its cost/price fields.
- Address any CodeRabbit comments before reporting.

## Implementation notes

- Added the private `/owner#view=pricing` navigation and Settings link. The
  Pricing page uses the existing `catalog-save` and `parts-settings` APIs and
  their unchanged private storage paths.
- Catalog items now have optional `costCents` and a `kind` (`service` or
  `part`) while retaining `defaultPartsCents`, `defaultLaborCents`, and the
  existing `active` archive flag. Legacy items with no cost or kind normalize
  to a service with a null cost; no Blob migration or production write ran.
- The UI shows live price-minus-cost dollar/percent margin, an optional markup
  helper, and blank-field-only catalog defaults for jobs and supplier quotes.
  Catalog saves do not rewrite stored job or quote snapshots.
- Verification on 2026-11-15: `npm test` passed (88 tests); `npm run build`
  passed.
