# Archived Google workspace prototype — do not deploy

`Code.gs` and `Owner.html` are retained only as historical source. They describe a replaced Google-backed intake and must not be configured, deployed, or used for customer data. This release uses the Vercel private store and its password-protected `/owner` workspace as the only job system of record.

The only supported Google integration is the narrow optional owner-email helper described in [Owner alert setup](OWNER-ALERT-SETUP.md). It can send a signed minimal alert only after a ticket is durably saved; it does not store jobs, accept browser requests, provide staff sign-in, or replace the private workspace.
