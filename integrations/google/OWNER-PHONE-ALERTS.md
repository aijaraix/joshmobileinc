# Josh Mobile owner phone alerts

Web Push is built into the existing private staff workspace. The feature is off unless the Vercel production environment contains the owner's VAPID keys and `JM_PUSH_ENABLED=true`; no customer or notification provider is involved.

## Owner setup

1. On a private computer, run `node scripts/generate-vapid.mjs` from a checked-out copy of the repository. Keep the output private; do not paste it into GitHub, chat, or source files. Generate a fresh pair if the output is lost.
2. In the existing Josh Mobile Vercel project's **Production** environment, set `JM_PUSH_PUBLIC_KEY` and `JM_PUSH_PRIVATE_KEY` to the generated values. Set `JM_PUSH_ENABLED=true` only when ready to opt in. These are secrets/settings and must be entered by Josh or an authorized Vercel owner.
3. Redeploy production, sign in to `/owner/` as `joshmobileinc@gmail.com`, open Settings, and choose **Enable phone alerts on this device**. Allow the browser prompt. The same account can repeat this from each personal device.
4. Tap **Send test notification** and confirm it arrives on the physical phone. A saved subscription or provider acceptance alone does not mean phone alerts are active.
5. On iPhone/iPad, first use Share → Add to Home Screen, open the installed Josh Mobile app, then enable notifications there (iOS/iPadOS 16.4 or newer). Android and desktop browsers can install from the browser's install menu.

The locked-screen message contains only `New service request · JM-XXXXXXXX`. Tapping it opens the authenticated `/owner/#request=JM-XXXXXXXX` page. Request details and media stay behind the existing sign-in. New-request delivery failures do not affect booking persistence; invalid/expired device endpoints are removed and failed sends can be retried by a later request. Test notifications are rate-limited. The owner can unsubscribe from Settings.

SMS and WhatsApp remain manual customer contact options. Telegram remains off unless Josh separately configures and enables it. The existing optional Apps Script email fallback is separate and is not active until Josh authorizes its account setup and verifies delivery on his phone.
