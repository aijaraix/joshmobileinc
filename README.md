# Josh Mobile Inc. — production website

Photographic public site for `joshmobileinc.com`. This is the complete rebuild, including the actual image files; there is no dependency on a ChatGPT preview or image hotlinks.

## Launch scope

**Works without Google authorization:** public pages, all six services, contact buttons, photo gallery, preferred-date/vehicle/job request builder, camera/file selection with local previews, WhatsApp/text/email handoff, native file sharing where supported, request text download, accessibility/mobile navigation, metadata/social JPEG, sitemap and robots.

**Not active until separately authorized and tested:** persisted online intake, private administrator sign-in, Google Drive uploads, calendar synchronization and reminder emails. The `/owner/` entrance labels this honestly. `/owner/preview` contains fictional sample data, clearly labeled. The request form never calls a message prepared or an app opened “submitted” or “confirmed.”

## Structure

- `public/`: deployable site, CSS, JS, images, privacy, owner entrance/preview.
- `lib/request.mjs`: tested validation, file limits, date handling and delivery links; identical copy in public.
- `api/`: optional configuration and Google intake bridge, fails closed until explicitly enabled.
- `integrations/google/`: private workspace source and activation instructions.
- `tests/`, `scripts/`: dependency-free checks and acceptance notes.
- `docs/`: operational handoff and test results.

## Local checks

Node 22 or 24, no dependencies or paid services required:

```sh
npm test
npm run build
python3 -m http.server 8080 --directory public
```

## Vercel

Existing AIcreatesAI team, existing `joshmobileinc` project. Framework: Other. Output: `public`. Build: `npm run build`. No install dependencies. Custom domain already configured, so DNS changes are not required.

Do not add an external rewrite to the ChatGPT preview. Do not deploy a text-only placeholder over this site. Deploy and verify the complete Git commit and local images together.

## Facts

Mobile service in Northern Broward County, Florida, by appointment only. Phone +1 646 796 7322. Email joshmobileinc@gmail.com. Instagram joshmobileinc. No invented reviews, credentials, prices, business address, hours, or guaranteed availability.

## Media

Work photographs were supplied for this business website. Original hero and avatar are design assets from the earlier project. All deployed image files are stripped of location metadata. Do not publish private chat screenshots, DNS screenshots, customer job records, or credentials.
