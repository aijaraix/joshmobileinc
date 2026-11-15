# Josh Mobile — R4 mobile requests, Back navigation and safe lead removal

## New Requests on a phone
1. Sign in to the private owner dashboard and select Open new requests from Overview or the side menu.
2. Select a request card. The dossier replaces the list on phones. VIN, address, private media, history and preparation are available.
3. Back to requests returns to the list in one tap. Android/browser Back also returns to the list. The visible Overview button returns to the dashboard with one tap.
4. If unsaved edits exist, confirm whether to discard changes before leaving.
5. Direct private /owner#request=JM- links remain supported; the reference is not an authentication credential.

## Lead deletion
- Josh can select **Delete** from a website request row or its detail view when
  the request is still requested or cancelled. The confirmation moves only that
  request to Trash; it does not delete its linked customer, vehicle, other jobs,
  media, or history.
- The request disappears from active requests and counts, but stays in Trash for
  restoration. An Undo toast appears immediately after a soft delete, and **Show
  deleted** opens the Trash filter.
- Restore is owner-only and returns the same record to active lists. The public
  booking API has no delete method. The older permanent-removal control remains
  separate in Trash and requires an exact reference plus server-side `DELETE`
  confirmation; it is not the normal Delete action.
- Confirmed and completed appointments cannot be deleted as leads. Cancel a confirmed job first. Other customer jobs are not automatically deleted even when contact information matches.
- An incomplete permanent deletion leaves a pending-purge record for retry, not restoration after files may have been removed.
- No bulk deletion or automatic synthetic-record deletion. Do not put customer details in public GitHub screenshots.

## Verification
- Node tests cover unauthorized deletion, cross-site denial, owner-only soft
  delete/restore, a public-delete-method denial, linked-record preservation,
  stale version, reference checks, and confirmed-appointment protection.
- Use the synthetic 390px browser harness before release to confirm the list
  Delete control, confirmation dialog, Undo, Trash filter, and Restore without
  touching a customer record.
- Production admin access must be separately verified with an authorized session; a synthetic browser test never replaces live customer-data readback.
