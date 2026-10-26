# Josh Mobile Inc. — live website and private scheduling

Production: https://joshmobileinc.com — Vercel project `joshmobileinc` on the AIcreatesAI team.

Public site: six services, Josh's original photos, Instagram, phone/SMS/WhatsApp/email, VIN and service address required, preferred date and time, optional photo/video files and secure online request saving (small attachments, 2.5 MB total). The website is publicly accessible without a login.

Staff page: https://joshmobileinc.com/owner/ — private email/password sign-in for only the two approved accounts, with mandatory first-login password rotation. The dashboard is one page: new requests, upcoming appointments, customers, vehicle/VIN/address, job notes, parts/tools, saved photos/videos, manual entries, appointment confirmation, click-to-text, and a manually maintained conversation timeline.

Operational limits:
- Online booking is a **request**, not a confirmed slot. Only Josh can confirm date/time.
- Text links open the customer's or Josh's messaging app. They do **not** send automatically or import the phone's SMS history. Timeline entries are manually logged.
- Online attachment limit is 2.5 MB across six supported files. For larger media, use direct texting/sharing.
- Automatic email reminders, live two-way SMS inbox syncing, and Google Calendar/Drive integration are not yet connected. Never claim they are active.
- No separate paid database was provisioned; existing private Vercel Blob storage may incur metered charges beyond plan allowances.
- Admin password hashes and session key live in Vercel encrypted environment settings, never GitHub. Temporary credentials must be communicated privately to each account holder and changed on first login.

All customer records and media reside in a **private** Vercel Blob store, accessed by authenticated server functions only. Do not add local storage of customer records or expose a Blob token to browsers. Owner route is noindex. No public demo customer data.

Testing: `npm test`, `npm run build`; verify in production using unauthenticated and authenticated sessions, including one synthetic test request (remove or mark test data clearly), first-login rotation, notes and date changes, and protected media.
