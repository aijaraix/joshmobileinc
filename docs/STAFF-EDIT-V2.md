# Josh Mobile — staff editing and past-job records (V2)

Owner dashboard: https://joshmobileinc.com/owner/

## Add a customer or a past appointment
Open **Add customer / job**. Only name and a valid phone number are required for a new contact/request. Add VIN, address, service, and preferred appointment when available; a future confirmed appointment still needs address, city, valid VIN and an open slot.

For a repair that already happened, choose **Past completed job (historical)**, enter the actual past date/time in Eastern Time and a duration, and optionally record staff-entered prices and payment status. This is historical bookkeeping information, **not a new booking**, so it never creates an outbound customer message.

## Edit any existing record
Open the customer dossier in Customers or Jobs. The **Edit customer & vehicle** section updates contact details, car, service description and original requested time. **Appointment & preparation** controls status, actual appointment date/time, duration, VIN, address, notes and parts. **Estimates and pricing** accepts manually entered parts quote, labor quote, supplier parts cost, final amount charged and payment status. Click **Save job details**.

Quoted parts + labor is a simple pre-tax **subtotal**, not an invoice. A quoted amount does not mean the customer has paid. Paid status is recorded by staff and never charges a card or sends a receipt. Taxes, service fees and supplier availability are not calculated. Keep the date/time accurate, especially for completed historical jobs.

Staff changes retain the job reference, private attachments and existing conversation timeline; the system adds a dated edit entry. Concurrent changes are rejected instead of silently overwriting. Previous values are not individually versioned for full audit replay, so take care with corrections.

## Parts lookup — V2.5 manual launchpad only
Each dossier displays year/make/model and VIN, with **Copy vehicle details** and links to PartsTech, O'Reilly Pro, NAPA PROLink and AutoZone Pro. Clicking a link opens the supplier portal; this website does **not** automatically send VINs or customer details to suppliers. Josh must use his own approved commercial account, choose a compatible part, check catalog fitment, confirm tax/core/return terms and manually enter real costs or quotes in the CRM. There are no live feeds, automatic orders or wholesale discount guarantees.

Future real VIN→part matching, inventory availability, live wholesale quotes and purchasing remain separate work under GitHub issue #10, to be scoped and approved before adding any paid provider or legal/business registration work.

## Release gates
Build/test pass for source and API; verify the production version matches main. Use an authorized manager/owner session for real visual acceptance; never put private customer data in public tests. No wholesale service or customer notifications are enabled by this release.
