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
- **Jobs** includes new, confirmed, completed, and cancelled records.
- Search by customer, phone, email, JM reference, vehicle, or VIN to find the right record.

## Customer dossier

Open a customer or job to review the contact and service location, vehicle and VIN, original request, appointment preference, uploaded photos or video, parts and tools, private job notes, and chronological history. Check the reference before editing; one customer can have multiple distinct requests.

Use **Internal note** for private team notes. SMS and WhatsApp actions open a prepared message in the phone's messaging app; they do not send automatically. Messages and replies are not imported into the CRM. Record important calls or replies in the timeline.

To book work, set the status to **Confirmed**, add the agreed date, time, and duration, then save. Confirm the details with the customer first. Use **Completed** after the work is finished. Cancel a record only when the appointment or synthetic QA request should no longer be scheduled; preserve the history.

## Availability and settings

Use **Availability** to maintain the existing working hours and blocked dates. The public form uses these preferences; staff still confirm each appointment. Use **Settings** for account security and owner notification setup. Sign out with the button in the top bar when finished.

## Phone alerts and fallback

Notifications are default OFF. Josh must opt in on his own device and verify delivery there. The live production app currently shows that phone push and the email fallback are **not active**; VAPID/owner setup and an actual device test remain required. Do not call dashboard refresh an alert. Telegram remains disabled. Keep push content to the request reference; open the private CRM and sign in to see customer details.

If push or email setup is not complete, continue to review **New Requests** in the dashboard. Do not turn on a paid provider, change credentials, or contact a customer for testing.

## QA records and next scope

The synthetic records identified by issue #11 were marked **Cancelled** with a private cleanup note; their audit history remains. The two real leads stayed in **New Requests**. No customer message was sent.

Parts & Suppliers, wholesale accounts, and Parts & Follow-up Lite are outside this release and remain tracked in issue #10.
