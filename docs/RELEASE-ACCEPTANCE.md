# Blue/white appointment workspace release

Validated before publishing: 41 Node tests pass, including a 29-check account/request/appointment lifecycle. Desktop 1440px and mobile 390px browser checks cover public form review, VIN/address requirements, submit UI, unique service photos, no horizontal overflow, real staff sign-in controls, and no JavaScript exceptions. Browser request delivery was mocked for this predeployment UI test. Real private storage is separately gated during the production build via scripts/smoke.mjs.

Production build must pass private account activation/login, unauthorized-denial, request persistence/retry, private media attachment, conflict/stale-write protection, conversation notes, completion, logout and password-revocation checks. Synthetic records exist only in a temporary smoke prefix and are removed in finally. This never activates actual staff accounts.

Customer message delivery is not automatic: secure requests are saved in the inbox; optional SMS/WhatsApp/email links open the customer's chosen app. Staff confirms by text. ICS download adds calendar events with display alarms. Automatic SMS sync, email notifications and Google synchronization are not included in this release.
