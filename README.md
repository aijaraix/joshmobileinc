# Josh Mobile Inc. — public site and private appointment workspace

Production: https://joshmobileinc.com · Staff: /owner · North Broward County, Florida.

## Release scope

The blue-and-white photographic website includes six services, distinct service/work photos, Instagram, VIN and service-address collection, private online service requests, and direct text/WhatsApp/email options. Customers do not sign in. A request does not reserve a slot: staff confirms it.

The single-page staff dashboard supports customer search, requests/upcoming/completed jobs, private attachments, VIN/address, scheduling with conflict checks, notes, parts/tools, manually added jobs, and a conversation timeline. SMS opens the staff member's phone app; conversation summaries are recorded manually. No automatic two-way SMS ingestion, email notifications, Google sign-in, Google Calendar sync, or email reminders are claimed. Calendar exports include local device reminder instructions.

## Authentication and storage

Only two approved staff addresses are allowed server-side. Each receives an individual, one-use, time-limited activation invitation and creates a 16–128-character password. Passwords use scrypt with random salts; sessions use signed Secure/HttpOnly/SameSite=Strict cookies plus revocable private server records. A password change revokes prior sessions. Recovery is operator-assisted through the managing administrator; there is no public account registration.

All job records, account hashes, sessions and media are stored in the existing private Vercel Blob store, not GitHub or static files. Conditional writes protect concurrent edits; a scheduling lock and overlap checks protect appointments. Private media retrieval requires staff authentication. Upload capabilities are limited to a single request, declared type/size and 30-minute lifetime; file signatures are checked before attachments appear.

Production-only configuration: BLOB_READ_WRITE_TOKEN (managed store connection), JM_SESSION_SECRET, JM_OWNER_INVITE_HASH, JM_MANAGER_INVITE_HASH, JM_INVITE_EXPIRES, JM_BOOKING_ENABLED=true. Never commit raw invitation tokens, passwords, cookies, environment files, or customer records. The old integrations/google folder is an optional archived approach and is NOT the deployed runtime.

## Build and verification

Node 24; npm ci; npm test; npm run build. Dependencies are pinned in package-lock.json. Vercel uses public/ output and five API handlers. The production build runs an acceptance scenario against real private storage under an isolated smoke/<random>/ prefix, cleans up that prefix, and restores real environment values. It does not consume real staff invitations.

Tests cover request validation, VIN, upload limits, activation/login, wrong-user and cross-site denial, secure sessions, private persistence, media validation, stale edit rejection, appointment conflicts, conversation notes, manual jobs, completion, logout and password revocation.

## Operations

Requests are limited to six attachments, 15 MB each and 30 MB total. JPG/PNG/WebP and MP4/MOV/WebM are supported; HEIC can be sent directly through messaging instead. Staff lists are capped at 2,000 jobs to avoid unbounded scans. Monitor existing Vercel usage; private storage and function usage can incur charges beyond included allowances. No new VPS or paid database was provisioned for this release.

Use the staff footer link to sign in. Keep the public domain public, preview deployment protection enabled, and all private API responses no-store/noindex. Do not proxy this website to a ChatGPT preview.
