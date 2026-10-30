# Request-first public website refresh

Owner-requested changes are implemented in the checked-in public source: request-first calls to action, blue-and-white branding, a dedicated social card, the selected exterior-mechanic hero, the supplied cabin-filter photograph in its service section, and Josh's Coral Springs biography emphasizing transparent advice and community.

## Image provenance
- `hero-outside-v3.webp` is the previously approved generated exterior mechanic scene. It is a promotional visual, not evidence of a specific repair.
- `josh-mobile-share-blue-v3.jpg` is a 1200 × 630 blue-and-white sharing card using the same hero scene.
- `cabin-filters-real-v1.webp` is the supplied photograph of used and replacement cabin filters. It appears in the cabin-filter service card.

All three images are committed under `public/assets`, with SHA-256 regression checks. The static website and its build do not download or transform temporary image-transfer URLs. Request, booking, authentication, availability, upload, and private-dashboard code remain in their existing paths.

Messenger and other social platforms cache previews independently. The production HTML and same-origin image must be verified after release; a refreshed share may still require the platform debugger to clear an older cached preview.
