# Josh Mobile — R4 mobile requests, Back navigation and safe lead removal

## New Requests on a phone
1. Sign in to the private owner dashboard and select Open new requests from Overview or the side menu.
2. Select a request card. The dossier replaces the list on phones. VIN, address, private media, history and preparation are available.
3. Back to requests returns to the list in one tap. Android/browser Back also returns to the list. The visible Overview button returns to the dashboard with one tap.
4. If unsaved edits exist, confirm whether to discard changes before leaving.
5. Direct private /owner#request=JM- links remain supported; the reference is not an authentication credential.

## Lead deletion
- From a requested or cancelled lead, select Move lead to Trash; confirm the name and reference.
- The lead disappears from active requests and counts, but stays in Trash for restoration.
- Trash provides Restore and Delete permanently. Permanent deletion requires typing the exact reference. The server additionally enforces authentication, staff-only access, status, version, same-origin, rate limiting and explicit confirmation. It removes that one job, associated private attachments and its reference index.
- Confirmed and completed appointments cannot be deleted as leads. Cancel a confirmed job first. Other customer jobs are not automatically deleted even when contact information matches.
- An incomplete permanent deletion leaves a pending-purge record for retry, not restoration after files may have been removed.
- No bulk deletion or automatic synthetic-record deletion. Do not put customer details in public GitHub screenshots.

## Verification
- Node tests cover unauthorized deletion, cross-site denial, stale version, reference checks, Trash/Restore, file removal and confirmed appointment protection.
- Isolated 390px browser verification confirmed New Requests navigation, dossier opening, Android/browser Back, Overview, Trash, Restore and no horizontal overflow, using synthetic data only.
- Production admin access must be separately verified with an authorized session; a synthetic browser test never replaces live customer-data readback.
