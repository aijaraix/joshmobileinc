# Owner CRM V2 + V2.5 — operating guide and release checklist

Status: implemented in the `feat/owner-crm-v2-parts-readiness` review branch. It is not deployed until the pull request is reviewed, merged, and the hosting build is verified.

## What Josh can do after release

- Create a customer directly from **Add customer** without a website booking.
- Edit the customer’s contact information, address, private notes, preferences, and communication instructions. Archiving is reversible at the data level: it keeps vehicles, jobs, attachments, and historical service records.
- Add more than one vehicle to a customer. A vehicle may be saved with a VIN or with year/make/model; VIN decoding is not performed and no unknown vehicle details are invented.
- Create an appointment/job directly, associate it with a saved customer and vehicle, or record a historical completed repair using the real past service date and time.
- Use the compatible statuses: Requested, Confirmed, Scheduled, In progress, Completed, Cancelled, and No show. Older `requested`, `confirmed`, `completed`, and `cancelled` records remain valid.
- Edit a job’s date, time, status, customer/vehicle snapshot, service description, address, notes, and prices. Every job retains its own saved pricing snapshot even if the service catalog or customer profile later changes.
- Record quoted parts/labor, job parts/labor charges, extra fees, discounts, tax, final total, amount paid, payment state, and outstanding balance. Amounts are stored as integer cents; this is bookkeeping only and never charges a customer.
- Search the private workspace by customer/contact, vehicle, plate, VIN, service, receipt reference, or location. The phone layout uses the existing drawer and one-screen-at-a-time detail pattern.

## Parts and supplier workflow

1. Open the relevant job and choose **Create parts lookup task**.
2. The task records its customer, vehicle, service, requested part, part numbers, quantity, notes, compatibility status, and missing vehicle-detail warnings.
3. Use Josh’s own approved supplier site/account manually. The dashboard’s links only open supplier sites; it does not submit vehicle or customer data to a supplier.
4. Save the real supplier name/SKU/part number, price, retail price, availability, URL, and the server-recorded time it was checked.
5. Set the compatibility state only after Josh verifies fitment. Year/make/model alone is not treated as proof—brakes in particular may require trim, engine, brake package, or VIN confirmation.
6. Set optional markup/default labor in **Settings**. A proposed estimate is shown only after a real supplier price and both needed inputs exist.
7. Only the owner account can approve the estimate for manual discussion. Approval sends no customer message, creates no order, and does not charge anything.

There is no supplier API, scraping, login automation, inventory feed, purchase order, VIN decoder, or wholesale-price claim in this release. Future integrations must supply a named supplier identifier, authorized authentication configuration, supported vehicle/part-number search method, price, availability, product URL, timestamp, and error handling. Credentials stay in deployment settings, never source code.

Potential future categories—not integrations—are local professional wholesalers, professional-parts distributors, OEM catalogs, authorized supplier APIs, and authorized VIN-decoding services.

## Data and security

The existing private Vercel Blob job documents are preserved. This release adds private, additive records for customers, vehicles, parts requests, the service catalog, and parts-pricing defaults. There is **no SQL/database migration to run** and no existing job is bulk rewritten during deployment.

When a staff member edits or creates a job, it links to an exact phone/email customer match or creates a new private customer. It never merges customers by name alone. Historical jobs keep their own contact, vehicle, service, appointment, and pricing snapshot when the canonical customer or vehicle record changes.

All new reads and writes use the existing authenticated `/api/admin` session and server-side validation. The browser cannot grant itself an owner role. Supplier links, alerts, bookings, media, and public pages keep their existing access boundaries; no notification flag is enabled by this release.

## Production release checklist

1. Review the pull request and run `npm test` and `npm run build` on its exact head. The tests use isolated in-memory/synthetic fixtures only.
2. Merge through the normal `main` review path; do not run migrations because none are required.
3. Let the normal hosting deployment finish. Do not change environment variables, Vercel Blob data, VAPID settings, booking flags, notification flags, supplier credentials, or DNS for this release.
4. With an authorized owner/manager account in a non-production synthetic test context or a deliberately labeled production QA record, verify: add customer, add two vehicles, save a past completed job, edit its service date, change labor/parts price, mark payment received, find its history, create a parts task, and save a manual supplier quote. Do not contact a real customer or submit a real order.
5. Verify the public booking form still accepts a request with year/make/model and optional trim/engine/mileage/VIN, including a clearly synthetic attachment test only when an authorized session and cleanup path are available.
6. Confirm the owner dashboard at 360px, 390px, 768px, and desktop: no horizontal scrolling, drawer navigation works, dialogs are readable, and save/cancel feedback is visible.

If any validation fails, leave the prior production build in place and correct the review branch. A successful build is not proof of real supplier availability, compatibility, payment collection, notification receipt, or production release.
