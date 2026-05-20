# Production Readiness

The portal is deployed on the safe subdomain:

- Portal: `https://ask.beyondfreedomfinancial.com`
- Original site: `https://beyondfreedomfinancial.com`

The apex site must remain on the existing GoHighLevel website. Do not add Worker routes for `beyondfreedomfinancial.com` or `www.beyondfreedomfinancial.com`.

## Required Secrets

Set these before production login and GoHighLevel escalation tests can pass:

```bash
npx wrangler secret put GHL_API_KEY --env production
npx wrangler secret put GHL_LOCATION_ID --env production
npx wrangler secret put GHL_WEBHOOK_SECRET --env production
npx wrangler secret put ADMIN_MASTER_PASSWORD --env production
```

Login code delivery uses GoHighLevel conversations email. The portal first verifies that the email exists as a GoHighLevel contact, then sends the short-lived login code through the client's existing GHL email setup. Do not configure Resend for this client.

`GHL_API_KEY` should be a GoHighLevel v2 Private Integration token with contact lookup and conversation message permissions. Legacy location API keys can read some v1 contact data, but they cannot send login-code emails through the current LeadConnector conversations API.

The production readiness login probe defaults to `alex@example.com`, a reserved-domain test contact present in GHL, so readiness does not send test login codes to a real client. Override it with `READINESS_LOGIN_EMAIL=... npm run readiness` if the test contact changes.

Optional AI Gateway routing can be enabled with secrets or environment variables:

```bash
npx wrangler secret put AI_GATEWAY_URL --env production
npx wrangler secret put AI_GATEWAY_TOKEN --env production
npx wrangler secret put AI_GATEWAY_MODEL --env production
```

`AI_GATEWAY_URL` should be the full Cloudflare AI Gateway OpenAI-compatible chat completions endpoint. If these values are absent or the gateway returns an error, the Worker falls back to Workers AI/local source-grounded extraction without exposing uncited content.

Alternatively, export the values locally and push them without printing secret values:

```bash
export GHL_API_KEY='...'
export GHL_LOCATION_ID='2am3gMARFHJDi4NIZuR7'
export GHL_WEBHOOK_SECRET='...'
export ADMIN_MASTER_PASSWORD='...'

npm run secrets:check
npm run secrets:push
npm run readiness
```

## Readiness Check

Run:

```bash
npm run readiness
```

This verifies:

- required source files are present
- `https://ask.beyondfreedomfinancial.com/api/health` is healthy
- the portal subdomain serves the app
- the original website has not been replaced by the portal
- unauthenticated client APIs reject requests
- unauthenticated admin APIs are blocked by Cloudflare Access or the Worker app-level admin check
- spoofed Cloudflare Access headers are blocked by Cloudflare Access or rejected by the Worker and never grant app admin access by themselves
- unsigned GoHighLevel webhooks are rejected
- required Worker secrets are present
- production login code requests can send through GoHighLevel

The command intentionally fails while secrets are missing.

## Full Verification After Secrets

After secrets are configured, run:

```bash
npm run typecheck
npm run lint
npm test
npm run e2e:local
npm run build
npx wrangler types --check
npx wrangler deploy --dry-run --env production
npm run readiness
```

Then use Browser to verify:

1. Client can request a login code and enter the portal.
2. Client can ask a strategy question and receive an answer with citations, next steps, recommended trainings, confidence, and escalation state.
3. Client can open a recommended training.
4. Client can submit or trigger an escalation.
5. Admin can log in.
6. Admin can create a source, compile a draft, publish a wiki page, and run health checks.
7. GoHighLevel receives the escalation task/note.

## Admin Preview Access

Admin preview uses the app-level master password stored in the `ADMIN_MASTER_PASSWORD` Worker secret. Open:

```text
https://ask.beyondfreedomfinancial.com/admin
```

Enter the shared master password to create an admin session. Client login still uses GoHighLevel email codes at:

```text
https://ask.beyondfreedomfinancial.com/ask
```

The Worker rejects admin API calls without a valid app admin session even when Access-looking headers are supplied by the requester.
