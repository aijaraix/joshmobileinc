# Launch truth — October 25, 2026

## Public service

Direct-message appointment requests are the active launch mode. Customers fill in vehicle, service, location and preferred time, review the message, and finish sending in WhatsApp/text/email. This is a human-confirmed appointment service, not an instant reservation engine.

Camera/library selection supports up to six files, 15 MB/file, 30 MB total. Files stay local until shared in the operating system or attached in the messaging app. Sharing support depends on browser/device. Message-link buttons cannot attach local files; the site says this explicitly.

## Google activation (last step)

The optional code is included, not yet authorized. Set up under the business owner's account, verify private admin access and storage, then enable the encrypted Vercel settings. An online submission option appears only when configured. That path caps media at 2.5 MB total to stay below the serverless request-size ceiling. It never drops files silently.

Only approved administrators may authenticate. The public owner design preview uses fictional records and does not save edits. No customer records, secrets, live calendar or real appointments are shipped in the public repository.

## Deployment verification required

Verify the exact Git commit exists in GitHub including local WebP assets; production build READY; public domain HTTP 200 without login; no redirect/proxy to chatgpt.site; every referenced image HTTP 200 with correct content type; social JPEG is 1200 × 630 and under 300 KB; request UI hands off complete details to the correct recipient. DNS is already configured and should not be changed.

## Known boundaries

No search ranking or WhatsApp cache-refresh guarantee. No invented prices, reviews, credentials, shop address or business hours. Google authorization and a real delivery test remain required before claiming saved appointments/reminders active.
