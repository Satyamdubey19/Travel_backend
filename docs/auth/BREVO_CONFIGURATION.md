# Brevo transactional email configuration

This project sends verification, password recovery, email-change, booking, tour, and notification messages from the backend through Brevo's transactional email API. The browser never receives the API key and never sends mail directly.

## What to create in Brevo

1. Create or sign in to a Brevo account.
2. In **Transactional > Senders & IP**, add the address you want Travels Pro to use, or authenticate the whole sending domain. Complete the sender verification/domain DNS steps shown by Brevo.
3. In **SMTP & API > API Keys**, create a v3 API key. Copy it once into local secret storage; do not put it in source code, screenshots, browser variables, or chat.
4. Keep an isolated inbox for development verification and password-reset tests. Do not test by repeatedly sending to a personal production inbox.

Brevo's send endpoint is `POST https://api.brevo.com/v3/smtp/email`. It authenticates with the `api-key` request header and accepts a `sender`, `to`, `subject`, `htmlContent`, `textContent`, and optional `tags` payload. The active adapter in `lib/brevo.ts` uses that contract and sends each notification delivery UUID as the `headers.idempotencyKey` value so an outbox retry can be deduplicated within Brevo's idempotency window.

## Backend variables

Edit the real local file, not the example file:

`D:\GetHotelsNextjs\Travels_Pro\Travels_backend\.env`

Add these values (replace the examples locally; never commit them):

```dotenv
BREVO_API_KEY=xkeysib-your-real-v3-key
BREVO_FROM_EMAIL=Travels Pro <verified-sender@your-domain.com>
```

`BREVO_FROM_EMAIL` may be a bare verified address or the display-name form shown above. The address must match a sender/domain that Brevo has accepted. `BREVO_API_URL` is optional and should normally be omitted so the adapter uses the official endpoint. If it is set for a test double, it must still use `https://`.

The old `RESEND_API_KEY` and `RESEND_FROM_EMAIL` variables are no longer read by the application. Remove them from local secret storage after the migration so an operator cannot mistake them for active configuration. SMTP variables are also not used for the auth delivery path.

## Restart and verify

After saving `.env`, restart the backend development server. Run the checks from the backend folder:

```text
npm run env:check
npm test
npm run lint
```

`env:check` also validates the database, Redis, payment, Cloudinary, and encryption settings needed for a production release. For local development, Redis must be a TCP connection string such as `redis://127.0.0.1:6379` or a hosted TLS connection beginning with `rediss://`; an HTTPS REST URL is not compatible with the worker or shared rate limiter.

With Brevo configured, test these in order using a throwaway inbox:

1. Create a traveler account and confirm the verification message arrives.
2. Follow the link to `/api/auth/verify` and sign in.
3. Request forgot-password, use the reset link, and verify the old password is rejected.
4. Request an email change and confirm the new address before signing in again.
5. Create a host onboarding request and confirm its account messages.
6. Process one notification-outbox item and verify a retry does not send a duplicate.

Do not copy verification or reset tokens into logs or tickets. The application intentionally returns a generic 503 when Brevo is absent or rejects a required auth message, and it rolls back a newly created unverified account rather than claiming success without a usable verification path.

## Provider troubleshooting

- **401/403**: the API key is invalid, disabled, or lacks transactional email permission. Create a new v3 key and restart the backend.
- **400 sender error**: `BREVO_FROM_EMAIL` is not a sender/domain authenticated in Brevo, or the address is malformed.
- **429**: Brevo rate-limited the account; wait, then use the notification retry path rather than repeatedly submitting the form.
- **No message but a 201 response**: inspect Brevo's transactional activity/logs and sender/domain status. A 201 means Brevo accepted the request, not that the recipient opened it.

The active code logs only a bounded provider status/code and never logs the API key, recipient, provider message, or email body.
