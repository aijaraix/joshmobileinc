# Josh Mobile owner operations

Use the private owner workspace at https://joshmobileinc.com/owner/. Requests submitted by customers remain requests until a staff member confirms an appointment.

## Sign in and install

- Sign in with the existing authorized staff account. Passwords and existing access are unchanged.
- On Android, open the owner page in a supported browser and choose **Install app** or **Add to Home screen** from the browser menu.
- On iPhone or iPad, open the page in Safari, choose **Share → Add to Home Screen**, open the installed app, and allow notifications only if Josh wants them.
- Use the sidebar menu on a phone. Open one module at a time; use **Back to list** to return from a selected record. The menu and detail actions have 44px minimum touch targets.

## Requests and appointments

- **New Requests** is the unreviewed lead queue. A preferred date is not a booking.
- **Appointments** contains only confirmed appointments with a future date and time.
- **Customers** groups records by the shared contact while keeping every JM request as a separate job.
- **Jobs** includes requested, confirmed, scheduled, in-progress, completed, cancelled, and no-show records.
- Search by customer, phone, email, JM reference, vehicle, or VIN to find the right record.

## Customer dossier

Open a customer or job to review the contact and service location, vehicle and VIN, original request, appointment preference, uploaded photos or video, parts and tools, private job notes, and chronological history. Check the reference before editing; one customer can have multiple distinct requests.

Use **Internal note** for private team notes. SMS and WhatsApp actions open a prepared message in the phone's messaging app; they do not send automatically. Messages and replies are not imported into the CRM. Record important calls or replies in the timeline.

## Customer records, historical work, and pricing

Use **Add customer** for a caller who never completed the public form. In the customer profile, save preferences, communication instructions, private notes, and as many vehicles as needed. A vehicle may be entered without a VIN; never treat year/make/model as proof that a replacement part fits.

Use **Add appointment / job** to link an existing customer and vehicle, create a new one by exact contact information, or record a historical repair. For a completed repair from the past, choose **Past completed job**, enter the actual historical service date/time, then save. The record keeps its own date, vehicle and prices even if the customer profile is later corrected.

In **Estimates and pricing**, enter staff-recorded amounts only. The dashboard stores quoted parts/labor, job charges, fees, discounts, tax, final total, amount paid, payment state, and outstanding balance as cents. It does not charge a card, issue an invoice, calculate a filing obligation, or send a receipt.

## Parts & Suppliers

Create a **parts lookup task** from a job only when replacement research is needed. Record the actual vehicle facts, part numbers, supplier, price, availability, source URL, and compatibility state. Use supplier sites manually through Josh's own authorized account. No supplier API, live inventory, automatic fitment result, scraper, purchase order, or price guarantee is active.

For a proposed estimate, save a real manual supplier quote and set optional markup/default labor in **Settings**. Mark compatibility verified only after Josh has checked it. Josh's owner account must approve an estimate before it is used in a manual customer discussion; the dashboard sends no message automatically.

To book work, set the status to **Confirmed**, add the agreed date, time, and duration, then save. Confirm the details with the customer first. Use **Completed** after the work is finished. Cancel a record only when the appointment or synthetic QA request should no longer be scheduled; preserve the history.

## Availability and settings

Use **Availability** to maintain the existing working hours and blocked dates. The public form uses these preferences; staff still confirm each appointment. Use **Settings** for account security and owner notification setup. Sign out with the button in the top bar when finished.

## Phone alerts and fallback

Notifications are default OFF. Josh must opt in on his own device and verify delivery there. The live production app currently shows that phone push and the email fallback are **not active**; VAPID/owner setup and an actual device test remain required. Do not call dashboard refresh an alert. Telegram remains disabled. Keep push content to the request reference; open the private CRM and sign in to see customer details.

If push or email setup is not complete, continue to review **New Requests** in the dashboard. Do not turn on a paid provider, change credentials, or contact a customer for testing.

## QA records and next scope

The synthetic records identified by issue #11 were marked **Cancelled** with a private cleanup note; their audit history remains. The two real leads stayed in **New Requests**. No customer message was sent.

Parts & Suppliers, wholesale accounts, and Parts & Follow-up Lite are outside this release and remain tracked in issue #10.
