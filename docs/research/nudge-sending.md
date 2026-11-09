# Research: scheduling and sending Nudges through Postmark

Resolves [#3](https://github.com/sanderaernouts/ai-hero-sw-factory-cohort-005/issues/3), part of map [#1](https://github.com/sanderaernouts/ai-hero-sw-factory-cohort-005/issues/1). Researched 2026-11-09.

**Question.** Nothing runs in the background today. How should Nudges be scheduled? What does Postmark offer for non-transactional email (streams, one-click unsubscribe, suppressions, webhooks, link tracking)? Which of those does `mailer.server.ts` need to support?

**Short answer.**
- Store every Nudge as a row in a SQLite table that acts as the plan, the outbox and the log. A pure `runDueNudges(now)` tick decides what is due from database state, then sends it.
- Run the tick from an unref'd in-process interval inside the one `react-router-serve` process. Also expose the same tick as a protected endpoint and as an npm script, so an external cron or a developer can trigger it.
- Send Nudges on a Postmark **Broadcast** message stream, never on `outbound`.
- Make the app the source of truth for the Student's opt-out, with its own RFC 8058 one-click endpoint. That needs Postmark to approve "Custom" unsubscribe handling. Until approval comes through, use Postmark-managed unsubscribes and sync them back over the Subscription Change webhook.

---

## 1. Local constraints

Read from commit `1e08ba3` (local branch `unify-refund-language`). Note that `origin/main` is still at the initial commit and has neither `mailer.server.ts` nor the ADRs.

- **One process, one SQLite file.** ADR 0006 says: *"There is one writer at a time, and the app cannot run on more than one machine against the same data."* (`docs/adr/0006-one-sqlite-file-through-drizzle.md`). Multi-instance deployment is already ruled out, so "the scheduler would run N times" isn't a live risk today. It does become one the day ADR 0006 is reversed.
- **How the server boots.** `react-router-serve` imports the server build once at startup (`await import(buildPath)`, `@react-router/serve@8.3.0` `dist/cli.js` line 90). Module-scope code in a server module therefore runs once per process in production.
- **What the server does on shutdown.** On `SIGTERM`/`SIGINT` it only calls `server.close()` (`cli.js` lines 128–129). It doesn't call `process.exit`. A ref'd `setInterval` would keep the process alive after a stop signal, so any in-process timer **must be `unref()`'d**. Node's docs on `unref()`: the timer *"will not require the Node.js event loop to remain active"* ([Node timers](https://nodejs.org/api/timers.html)).
- **The mailer today** (`app/lib/mailer.server.ts`):
  - `Email = { to, subject, body }`, sent as `TextBody` only.
  - Hard-coded `MessageStream: "outbound"`, with no `Headers`, `Tag`, `Metadata` or `TrackLinks`.
  - It throws on any non-2xx response without telling permanent errors apart from retryable ones, and it discards the Postmark `MessageID`.
  - With no `POSTMARK_SERVER_TOKEN`, it writes JSON to `.outbox/`.
- **The schema** (`app/db/schema.ts`):
  - There is no table for emails, consent or jobs.
  - `video_watch_events` (userId, lessonId, createdAt) is the raw material for "no Watched time for N days".
  - `lessons.createdAt` and `enrollments` are the raw material for "new lesson → enrolled Students".
- **better-sqlite3 transactions are synchronous.** The docs say *"Transaction functions do not work with async functions … the transaction will already be committed before any async code executes"*. They offer `.immediate()` to take the write lock up front. The default busy `timeout` is 5000 ms ([better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)). The consequence: you can't wrap "claim row → `await fetch` to Postmark → mark sent" in one transaction. It has to be split into claim, send and record steps.

## 2. Scheduling options

| | A. In-process scheduler | B. External cron → protected endpoint | C. SQLite job table + worker |
|---|---|---|---|
| **What it is** | `setInterval` or [croner](https://croner.56k.guru/usage/configuration/) started at module scope in the server | A platform cron (Fly/Render/systemd timer/GitHub Actions) does `POST /api/nudges/run` with a shared secret | A table of pending sends, drained by a loop, either in-process or as a second `tsx` process on the same file |
| **New infra** | None | A cron outside the repo (none exists today), plus a secret | Schema; optionally a second process |
| **Restart / downtime** | Timers don't persist. Croner's docs don't mention catch-up of missed runs, and no option provides it ([config](https://croner.56k.guru/usage/configuration/)). It's safe only if the tick computes "who is due *now*" from the DB, not "what fires at 09:00". | Same: missed calls are simply missed. GitHub Actions `schedule` *"can be delayed during periods of high loads"* and *"some queued jobs may be dropped"*, with a minimum of 5 minutes ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). | Durable. Pending rows survive a restart and get drained on the next tick. |
| **Multiple instances** | Each instance runs the tick, so it needs a DB claim to avoid double sends (moot under ADR 0006) | Exactly one caller, but overlapping calls are still possible if a run is slow | Claiming a row in a `BEGIN IMMEDIATE` transaction serialises workers on one file. Several *machines* aren't possible under ADR 0006. |
| **Local dev** | Vite HMR re-evaluates modules, so it starts duplicate timers unless you guard with a `globalThis` flag. Needs an env switch to turn it off in tests. | Nothing runs unless you `curl` it, which is explicit and predictable | Same as whichever trigger drives it |
| **Long runs** | Fine. An async tick can't block requests, but SQLite writes are synchronous, so batch them | HTTP timeouts at the proxy. The endpoint should do a bounded batch and report "more remaining". | Natural batching |
| **Overrun** | croner `protect` *"will block new triggers as long as an old trigger is in progress"*. With `setInterval`, use an in-flight flag. | Needs a DB lock or claim | Claim per row |

**What breaks with A or B alone.**
- Without a durable record you can't stop the same Nudge going out twice after a crash mid-batch.
- You can't enforce the map's frequency cap (at most one a week, stop after 2–3 unanswered) without a history table.
- You can't attribute success (a click, or Watched time within 7 days) to a specific Nudge.
- So a table is needed whatever the trigger. Option C is the storage model; A and B are just triggers for it.

## 3. Postmark for non-transactional email

### Message streams
- Stream types are `Transactional`, `Broadcasts` and `Inbound`. The example IDs are `outbound`, `broadcasts` and `inbound`. Default streams can't be deleted ([Message Streams API](https://postmarkapp.com/developer/api/message-streams-api)).
- `MessageStream` on `POST /email` *"will default to the outbound message stream ID"*. Batch is `POST /email/batch`, at most 500 messages and 50 MB per call. *"If you are sending Broadcast (bulk) messages with the batch call, use the MessageStream field"* ([Send email API](https://postmarkapp.com/developer/user-guide/send-email-with-api)).
- What Postmark lists as transactional: welcome, password reset, comment notifications, *"Weekly digest emails"*, receipts. What it lists as broadcast: *"Product update announcements", "Newsletters", "Promotions"*. It also says to keep spam complaints *"below 0.1%"* and to keep transactional and broadcast traffic separate ([Good fit for Postmark](https://postmarkapp.com/support/article/1082-what-types-of-messages-are-a-good-fit-for-postmark)). Separate streams *"automatically use different sending IPs"* ([Can I send bulk emails?](https://postmarkapp.com/support/article/can-i-send-bulk-emails)).
- **Verdict: Nudges go on a Broadcast stream.** Postmark doesn't name re-engagement mail explicitly. But a Nudge isn't triggered by the Student's own action, the "new lesson" Nudge fans out to everyone enrolled, and Gmail counts it as marketing or promotional (see below). Keeping Nudges off `outbound` protects the reputation of Refund and receipt mail.

### Unsubscribe handling
- **Broadcast streams require unsubscribe management.** `UnsubscribeHandlingType` is `None` (the default for transactional), `Postmark` (the default for broadcast) or `Custom`, which is *"allowed for broadcast streams only for approved accounts"* ([Message Streams API](https://postmarkapp.com/developer/api/message-streams-api)).
- **Postmark-managed (the default).**
  - Postmark *"automatically adds a one-click unsubscribe link to the bottom of every message"* and *"automatically add[s] the one-click List-Unsubscribe-Post and List-Unsubscribe headers"*.
  - *"There is **not** a way to edit the List-Unsubscribe headers when Postmark is managing your unsubscribes"* ([List-Unsubscribe header](https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header)).
  - The link can be placed with `{{{ pm:unsubscribe }}}`. Before unsubscribing, Postmark checks that a person clicked rather than a filter. The unsubscribe suppresses the address **only on that stream** ([Unsubscribe link](https://postmarkapp.com/support/article/1208-how-to-add-an-unsubscribe-link)).
- **Custom ("Manage unsubscribes on your own").**
  - Only available once *"our support team has approved your Postmark account"*.
  - You then add the visible link and both headers yourself, and remove unsubscribed recipients from your sends.
  - The `List-Unsubscribe-Post` value must be `List-Unsubscribe=One-Click`. mailto alone isn't compliant with the 2024 Gmail/Yahoo rules ([List-Unsubscribe header](https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header)).

### RFC 8058 one-click (if we own the endpoint)
From [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058):
- `List-Unsubscribe` *"MUST contain one HTTPS URI"*. `List-Unsubscribe-Post` *"MUST contain the single key/value pair … List-Unsubscribe=One-Click"*.
- The URI must identify the recipient and list on its own, and SHOULD carry a hard-to-forge token, because the POST carries *"no cookies, HTTP authorization, or any other context"*.
- The sender *"MUST NOT return an HTTPS redirect"*.
- Both headers *"MUST be covered by the [DKIM] signature"*.
- The receiver POSTs a form body (multipart or urlencoded).
- Anti-spam scanners GET links automatically, so the GET on the same URL should show a confirm page and **not** unsubscribe. Only the POST unsubscribes.

### Gmail and Yahoo bulk-sender rules
- **Gmail** ([guidelines](https://support.google.com/a/answer/81126), [FAQ](https://support.google.com/a/answer/14229414)):
  - Senders of 5,000+ a day need SPF, DKIM and DMARC (`p=none` is fine), with alignment.
  - Marketing mail needs one-click unsubscribe plus a visible link.
  - Spam rate below 0.30%, with 0.10% recommended.
  - *"One-click unsubscribe is required only for marketing and promotional messages. Transactional messages are excluded."*
  - Fulfil unsubscribes *"within 48 hours"*. Enforcement has been *"ramping up"* since November 2025.
- **Yahoo** ([best practices](https://senders.yahooinc.com/best-practices/)):
  - One-click for *"marketing and subscribed messages"*, with RFC 8058 POST *"highly recommend[ed]"*.
  - *"Honor unsubscribes within 2 days"*. Spam rate below 0.3%. SPF and DKIM, plus DMARC at `p=none` or stricter.
- Cadence may be under the 5,000-a-day threshold, but Postmark broadcast and GDPR (#2) require opt-out anyway. So build to the bulk-sender bar.

### Suppressions API
From the [Suppressions API docs](https://postmarkapp.com/developer/api/suppressions-api):
- All endpoints are per stream: `GET /message-streams/{stream}/suppressions/dump`, `POST …/suppressions` (create) and `POST …/suppressions/delete`, each taking at most 50 addresses.
- Reasons are `HardBounce`, `SpamComplaint` and `ManualSuppression`. Origins are `Recipient`, `Customer` and `Admin`.
- *"SpamComplaint suppressions cannot be deleted."* The docs don't say whether a `Recipient`-origin unsubscribe can be deleted through the API.
- Sending to a suppressed address fails with HTTP 422 and ErrorCode **406, "Inactive recipient"** ([API overview](https://postmarkapp.com/developer/api/overview)).

### Webhooks
- **Subscription Change** fires when an address is added to or removed from a stream's suppression list. That covers unsubscribes, bounces, complaints, manual suppressions and reactivations. It carries `Recipient`, `MessageStream`, `SuppressSending`, `SuppressionReason`, `Origin`, `Tag`, `Metadata` and `MessageID` ([Subscription Change](https://postmarkapp.com/developer/webhooks/subscription-change-webhook)).
- **Security and retries:**
  - *"Postmark does not currently support HMAC webhook signature verification"*. Use basic auth in the URL over HTTPS, optionally with an IP allowlist.
  - Only 5xx, 408, 429 and network failures are retried. Other 4xx responses are dropped.
  - There are 6 retries over about 51 minutes, after which the event is gone ([Webhooks overview](https://postmarkapp.com/developer/webhooks/webhooks-overview)).
  - Handlers must be idempotent and should return 5xx on transient failure.

### Link tracking
- **How it works** ([Tracking links](https://postmarkapp.com/developer/user-guide/tracking-links)):
  - `TrackLinks` is `None` (the default), `HtmlAndText`, `HtmlOnly` or `TextOnly`, set per server or per message.
  - Links are rewritten through `click.pstmrk.it`.
  - *"Until your account is approved, no links will be encoded/tracked"*.
  - `data-pm-no-track` opts a single link out.
- **Click webhook:** one event per *unique* click within the retention period (45 days by default, configurable from 7 to 365). It carries `OriginalLink`, `Recipient`, `Tag` and `Metadata` ([Click webhook](https://postmarkapp.com/developer/webhooks/click-webhook)).
- **Alternative:** a first-party redirect (`/n/:nudgeToken` → course) records the click in our DB directly. It works in dev with `.outbox/`, needs no webhook, and lets the spec count "a click on the tracked link" without depending on Postmark approval.

### Idempotency
- *"Postmark does **not currently** support an idempotency key feature"* ([support](https://postmarkapp.com/support/article/what-is-an-idempotency-key)).
- So de-duplication has to happen on our side: a unique key per Nudge, a claimed `sending` state before the `fetch`, and the returned `MessageID` stored afterwards.

## 4. Recommendation for the spec

1. **A `nudges` table is the spine.** One row per (Student, course, Nudge kind, trigger key), for example `inactive:2026-W45` or `new-lesson:<lessonId>`, with a **unique constraint** on that key.
   - Status runs `pending → sending → sent | failed | skipped`, plus `postmarkMessageId`, `sentAt`, `clickedAt` and an unsubscribe/click token.
   - That one table gives de-duplication, the frequency cap ("≤1 a week, stop after 2–3 unanswered" is a query over it) and success attribution.
2. **One pure tick, `runDueNudges(now)`.**
   - (a) Plan: insert scheduled Nudges whose condition holds *now*, such as "last `video_watch_events` row older than N days, not Lapsed, no Open Refund Request, not finished, opted in, under cap".
   - (b) Drain: claim pending rows in a short `.immediate()` transaction, send outside it, then record the result.
   - Because it decides from state rather than from timer fires, restarts and missed ticks simply catch up.
   - Event Nudges ("new lesson") **enqueue rows in the same transaction as the lesson insert**. They don't send inline.
3. **Triggers.**
   - An in-process `setInterval(…).unref()` every few minutes, started once from a server module. Guard it with `globalThis` against HMR duplicates, use an in-flight flag against overrun, and disable it with an env var such as `NUDGES_SCHEDULER=off` in tests.
   - The same tick behind `POST /api/nudges/run` (bearer secret), and as `npm run nudges:run` for local dev and as a future external-cron hook.
   - No new dependency is needed. croner's only gain is cron syntax and `protect`.
4. **At-most-once beats at-least-once for Nudges.**
   - If the process dies between `sending` and `sent`, leave the row as `sending` for manual review rather than resending.
   - Retry only on 429, 5xx or network errors, with backoff and capped attempts.
   - Treat 422/406 as `skipped` (the address is suppressed) and mirror it into the Student's opt-out.
   - For "new lesson" fan-out, drain in batches of up to 500 (`/email/batch`) or keep single sends at a modest rate.
5. **Unsubscribe: the app owns the setting.**
   - Request Postmark **Custom** unsubscribe handling on the Nudge broadcast stream.
   - The app serves `GET /unsubscribe/:token` (a confirm page with a button) and `POST /unsubscribe/:token`, which flips the Student's single on/off setting immediately, returns 200 with no redirect, and needs no session.
   - Set the `List-Unsubscribe: <https://…/unsubscribe/TOKEN>, <mailto:…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers ourselves.
   - Also add the opted-out address to the stream with `POST …/suppressions` as a belt-and-braces measure.
   - **Fallback** if Custom isn't approved: use Postmark-managed links and headers, add a `/api/postmark/webhooks` route (basic auth) that handles Subscription Change → flips the Student's setting, and push in-app opt-outs to the Suppressions API. Either way, the tick checks the app's setting before planning a send.
6. **Click tracking.** Put a first-party redirect link (`/n/:token`) in every Nudge as the success signal. Leave Postmark `TrackLinks` off at first, or turn it on only for analytics, with `data-pm-no-track` on the unsubscribe link.
7. **Deliverability prerequisites (ops, not code):** SPF, DKIM and DMARC aligned for the From domain on the broadcast stream, and spam rate below 0.1% (Postmark's bar).

## 5. Changes `mailer.server.ts` would need

- **`Email` gains optional fields:**
  - `stream: "transactional" | "nudges"`, mapped to Postmark stream IDs from config. Don't hard-code `"outbound"` for everything.
  - `htmlBody?`, since unsubscribe and tracking placement behave better with HTML.
  - `headers?: { name: string; value: string }[]` → Postmark `Headers`, for `List-Unsubscribe` and `List-Unsubscribe-Post`.
  - `tag?` (for example `nudge-inactive`), `metadata?: Record<string,string>` (for example `{ nudgeId }`) and `trackLinks?`.
- **`send` returns `{ messageId }`** from Postmark's response, so it can be stored on the Nudge row. The outbox transport returns a generated ID.
- **Typed errors:** parse the Postmark `ErrorCode` and separate `retryable` (429, 5xx, network) from `permanent` (422, with `inactiveRecipient` for code 406).
- **Optional `sendBatch(emails)`** → `/email/batch` (≤500, per-message results), only if fan-out volume needs it.
- **The outbox transport writes the full message** (stream, headers, tag, metadata, HTML). That lets a developer open the JSON and use the unsubscribe and click links locally. The existing test pattern (`outboxTransport(tmpdir)`) extends to cover this.
- **Possibly a separate From address or domain for Nudges** (for example `nudges@` or a subdomain), so their reputation stays apart from Refund mail.

## 6. Open questions for the spec

- **Custom unsubscribe approval:** will Postmark approve it for this account, and how long does approval take? That decides between the primary and fallback unsubscribe designs.
- **Unsubscribe scope:** should a Nudge unsubscribe also stop *transactional* mail? (No, by GDPR norms and Postmark's per-stream model, but say so explicitly.) And can a Student resubscribe in-app after a Postmark `Recipient`-origin suppression? The Suppressions API docs don't say whether that can be deleted.
- **DKIM coverage:** does Postmark's DKIM signature cover custom `List-Unsubscribe*` headers, as RFC 8058 requires? Confirm with Postmark before relying on Custom headers.
- **Send window and timezone:** should a Nudge go out at a sensible local hour? We store country, not timezone.
- **Time to quiet:** how quickly must an opt-out stop a Nudge already `pending`? (Recommendation: re-check the setting at claim time.)
- **Fan-out scale:** for a new lesson on a big course, is batching or rate-limiting needed in v1?
- **Rows stuck in `sending`:** who looks at them, with no admin UI for email today?
- **Domain decisions:** what are the inactivity threshold N and the tick interval? Does "new lesson" fire on create or on publish? There's no publish state on `lessons` today. These belong to trigger ticket #4.
