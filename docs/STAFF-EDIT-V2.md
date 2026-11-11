# Josh Mobile — staff editing and past-job records (V2)

Owner dashboard: https://joshmobileinc.com/owner/

## Add a customer or a past appointment
Open **Add customer** for a caller with no existing request, then add one or more vehicles. Use **Add appointment / job** to link that customer and vehicle, or enter the contact directly when needed. A VIN is optional; add it when known and verify fitment before quoting parts. A future confirmed/scheduled appointment still needs address, city, a future slot, and no overlap.

For a repair that already happened, choose **Past completed job (historical)**, enter the actual past date/time in Eastern Time and a duration, and optionally record staff-entered prices and payment status. This is historical bookkeeping information, **not a new booking**, so it never creates an outbound customer message.

## Edit any existing record
Open the customer dossier in Customers or Jobs. The **Edit customer & vehicle** section updates the job’s contact/vehicle snapshot, car, service description and original requested time; the customer profile controls shared contact preferences and extra vehicles. **Appointment & preparation** controls status, actual appointment date/time, duration, VIN, address, notes and parts. **Estimates and pricing** accepts manually entered parts/labor quotes and charges, fees, discounts, tax, final amount, amount paid, balance, and payment status. Click **Save job details**.

Quoted parts + labor is a simple **subtotal**, not an invoice. A quoted amount does not mean the customer has paid. Paid status is recorded by staff and never charges a card or sends a receipt. Taxes and fees are staff-entered values, not calculated or filed by the system. Keep the date/time accurate, especially for completed historical jobs.

Staff changes retain the job reference, private attachments and existing conversation timeline; the system adds a dated edit entry. Concurrent changes are rejected instead of silently overwriting. Previous values are not individually versioned for full audit replay, so take care with corrections.

## Parts lookup — V2.5 manual workflow

Each dossier displays year/make/model, trim, engine and VIN when available, with **Copy vehicle details**, **Create parts lookup task**, and links to PartsTech, O'Reilly Pro, NAPA PROLink and AutoZone Pro. Clicking a link opens the supplier portal; this website does **not** automatically send VINs or customer details to suppliers. Josh must use his own approved commercial account, choose a compatible part, check catalog fitment, confirm tax/core/return terms and manually enter the actual supplier, SKU, source URL, price, availability and part number in the CRM.

Parts tasks are linked privately to a customer, vehicle and job. A saved manual quote can produce a proposed estimate only when Josh has configured markup/default labor. Compatibility remains unverified until Josh marks it verified, and only the owner account can approve an estimate for manual customer discussion. Approval creates no message, order, payment or supplier API call. There are no live feeds, automatic orders or wholesale discount guarantees.

Future real VIN→part matching, inventory availability, live wholesale quotes and purchasing remain separate work under GitHub issue #10, to be scoped and approved before adding any paid provider, supplier credential, scraper, or legal/business registration work. See [Owner CRM V2 + V2.5](OWNER-CRM-V2-5.md) for the full release checklist.

## Release gates
Build/test pass for source and API; verify the production version matches main. Use an authorized manager/owner session for real visual acceptance; never put private customer data in public tests. No wholesale service or customer notifications are enabled by this release.
