# Owner-requested public site correction

`npm test` and `npm run build` prepare the versioned public assets and the public-page copy/metadata via `scripts/prepare-public-refresh.mjs` and `scripts/apply-public-refresh.py`. This leaves the booking/owner backend untouched. The transformation is idempotent and adds regression tests. Review the replacement rules before changing the original template. After preparation, `public/` is the complete static deployment output.

Fresh builds download three explicitly approved public images, check exact SHA-256 digests, and serve the results from the website's own `/assets` paths. A missing/changed transfer file fails the build rather than silently publishing the old hero. The current production deployment is not affected by a failed preview build. No AI generation runs in the build.

The source hero is the previously approved generated exterior-mechanic scene, not the seated image. The social card uses that scene in blue/white without a filter inset. The cabin-filter photograph is the genuine user upload and appears only in its service card.

GitHub Actions did not start the one-time vendoring job because the connected account is locked due to a billing issue. No billing settings were changed. The failed import workflow has been removed, rather than granting new credentials or changing permissions. Vercel's existing build runs the complete tests and build as an independent verification path; do not misreport Actions as passing.
