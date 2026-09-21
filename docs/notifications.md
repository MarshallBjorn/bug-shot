# Notifications

Email and webhook notifications for `TicketCreated`, `CommentAdded`, `StatusChanged`.

## Flow

```mermaid
flowchart LR
    event["Ticket event"] --> enqueuer["NotificationEnqueuer"]
    enqueuer --> resolve["Template resolution\n(project override > global)"]
    resolve --> renderer["NotificationRenderer"]
    renderer --> outbox[("NotificationDelivery\n(outbox, Pending)")]
    outbox --> dispatcher["NotificationDispatcherHostedService\n(in-process BackgroundService)"]
    dispatcher --> smtp["SMTP (MailKit)"]
    dispatcher --> webhook["Webhook (HTTPS, SSRF-safe)"]
```

The dispatcher runs **in-process** inside the API (`BugShot.Api`), not as a
separate container/process. There is nothing extra to deploy or start for it.

## Config

`SmtpOptions` accepts three equivalent naming schemes (checked in this
order of precedence): `Smtp:*` (appsettings section) → `SMTP_*`
(screaming-snake, incl. `SMTP_FROM_ADDRESS`) → `Smtp__*` (double-underscore,
what docker-compose/ASP.NET env-var binding produces). `SMTP_FROM` (no
`_ADDRESS`) is still accepted for backward compatibility, but
`SMTP_FROM_ADDRESS` takes precedence when both are set.

| Variable | Required | Default |
|---|---|---|
| `SMTP_HOST` / `Smtp__Host` | no | `localhost` |
| `SMTP_PORT` / `Smtp__Port` | no | `25` |
| `SMTP_USERNAME` / `Smtp__Username` | no | *(none)* |
| `SMTP_PASSWORD` / `Smtp__Password` | no | *(none)* |
| `SMTP_FROM_ADDRESS` / `Smtp__FromAddress` | no | `noreply@bug-shot.test` |
| `SMTP_FROM_NAME` / `Smtp__FromName` | no | `Bug-Shot` |
| `SMTP_USE_STARTTLS` / `Smtp__UseStartTls` | no | `false` |

Missing SMTP config does **not** stop the API from starting — email
delivery just fails at send time (retried per the normal retry policy,
eventually `Failed`). Webhook delivery has no dependency on SMTP config.

See `.env.example` / `.env.dev.example` / `.env.prod.example` for
copy-paste placeholders. Never commit real SMTP credentials — production
values live in `.env.prod` (gitignored) or your deployment's secret store.

## Webhook security

- HTTPS only (plain HTTP is rejected at channel create/update time).
- SSRF protection blocks loopback, link-local, and all RFC1918 ranges —
  this is enforced via a `SocketsHttpHandler.ConnectCallback` that checks
  the **actually-resolved IP** at connect time (`SsrfProtection.cs`), not
  just the URL string, so it is safe against DNS rebinding.
- 10s request timeout.
- Payload is signed with HMAC-SHA256 over the exact raw request bytes,
  sent as `X-Bugshot-Signature`.
- `WebhookSecret` never appears in any API response DTO.

Practical consequence: you **cannot** point a webhook channel at a
receiver running on `localhost` or inside the same Docker network — the
app will correctly reject it. Use a public HTTPS endpoint (e.g.
webhook.site) for manual live testing, or the automated Mailpit-based
E2E flow below for email.

## Retry & throttling

- 4 attempts total (initial + 3 retries), backoff `1m / 5m / 25m`.
- Claimed atomically via `FOR UPDATE SKIP LOCKED` — safe with multiple
  API replicas running the same background service.
- Webhook retries only on 5xx / network errors; 4xx is a permanent failure
  (no retry).
- Throttling is per project + channel, configured as a pair
  (`ThrottleWindowSeconds` + `ThrottleMaxEvents`, both set or both null).
  Throttled events are dropped, not retried.

See `backend/BugShot.Api.Tests/Notifications/NotificationDispatcherTests.cs`
for the exact attempt/backoff/throttle assertions — those tests force
retries by rewriting `NextAttemptAt` into the past instead of waiting
real time, which is the pattern to follow for any new retry test.

## Template placeholders

`{{project.id}}` `{{project.name}}` `{{project.key}}` `{{ticket.id}}`
`{{ticket.description}}` `{{ticket.pageUrl}}` `{{ticket.status}}`
`{{ticket.reportedAt}}` `{{comment.author}}` `{{comment.body}}`
`{{status.from}}` `{{status.to}}` `{{status.changedBy}}`

Unknown tokens render as an empty string (tracked in
`RenderResult.MissingTokens`, not sent to the recipient). `comment.*` /
`status.*` tokens are only resolved for their matching event type — used
for another event type, they render empty and count as missing.
Default templates are seeded by migration `20260916074237_AddNotifications`
(global, `project_id = null`); projects can override per event/channel via
`PUT /api/v1/projects/{projectId}/templates`.

## Local E2E (with real email)

`docker-compose.e2e.yml` is the isolated stack (Postgres `5435`, MinIO,
API `8085`, frontend `5175` — none of this touches the dev Postgres on
`5433`). It has no Mailpit by default. `docker-compose.notifications.e2e.yml`
is an **additive override** that adds a `mailpit-e2e` service and points
`backend-e2e` at it via `Smtp__*` env vars, without changing the base file.

```powershell
docker compose -f docker-compose.e2e.yml -f docker-compose.notifications.e2e.yml -p bugshot-e2e up -d --build
```

Mailpit UI: `http://localhost:8026`. This exact override is also wired
into `e2e/scripts/run-e2e.mjs` (the script `npm test` in `e2e/` runs, and
what CI's `e2e.yaml` workflow calls), so `npm test` in `e2e/` and CI both
get a working Mailpit automatically — no extra setup needed either place.
`tests/notifications-email.spec.ts` asserts a real `TicketCreated` email
arrives within 5s with correct From/To/Subject/Body via Mailpit's REST API.

Webhook delivery cannot use this local stack (see SSRF note above) — for
a live webhook proof use a public HTTPS endpoint and create the channel
against `demoProjectId` (`11111111-1111-1111-1111-111111111111`) via the
admin API or UI.

## Delivery lifecycle

`Pending` is the only status claimed by the dispatcher.

`Sending` means the delivery is currently being attempted.

`Sent` means successful delivery.

`Failed` is terminal for permanent failures, disabled channels, and deliveries that exhausted the retry budget.

`Throttled` is a terminal drop for the current event and is not requeued.

A stale `Sending` delivery older than 5 minutes is recovered after dispatcher restart. If attempts remain it returns to `Pending`; otherwise it becomes `Failed`.

## Retry policy

A retryable webhook failure uses a maximum of 4 total attempts:

1. initial attempt
2. retry after 1 minute
3. retry after 5 minutes
4. retry after 25 minutes

HTTP 429 and HTTP 5xx are retryable.
HTTP 4xx other than 429 are terminal.

## Database text limits

Rendered notification text is fitted before `NotificationDelivery` is persisted:

- `RenderedSubject`: 255 characters
- `RenderedBody`: 8000 characters
- `LastError`: 2000 characters

Truncation does not split UTF-16 surrogate pairs.

## SMTP

When `SMTP_USE_STARTTLS` is unset or blank, MailKit uses `StartTlsWhenAvailable`.
`SMTP_USE_STARTTLS=true` requires StartTLS.
`SMTP_USE_STARTTLS=false` explicitly disables TLS.
Blank SMTP values are treated as absent. Non-empty invalid SMTP values fail configuration parsing.
Development compose uses SMTP port `25` when `SMTP_PORT` is not set.

## Webhook payload

Webhook payloads preserve the existing fields and also expose:

- `text` for Slack-style consumers
- `content` for Discord-style consumers

Discord `content` is limited to 2000 characters.

## Test webhook endpoint

`POST /api/v1/projects/{projectId}/notifications/{channelId}/test` returns:

- `400` for invalid URL or webhook validation errors
- `502` when the receiver cannot be reached
- `504` when the receiver times out

Internal stack traces are not returned.
