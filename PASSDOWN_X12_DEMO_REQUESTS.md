# X12 — Demo request capture on the landing page

**Repo:** `~/calcshore-landing` (NOT `~/calcshore`).
**Status: COMPLETE.** All three stages shipped and verified end to end in production on
2026-08-03. Nothing in this arc remains open.
**Rewritten:** 2026-08-03, superseding the version written against landing HEAD `8f52d47`
and the interim rewrite of 2026-08-02.

---

## §0 — What was broken, and what now works

Xiaodan submitted the landing page's "Book a Demo" form and nothing arrived. The cause was
worse than a misconfiguration: **the form had never sent anything.** `submitDemo` set
`window.location.href` to a `mailto:` and then, unconditionally on the next line, called
`setDemoOpen(false)`. A visitor whose browser has no registered `mailto:` handler — normal
for anyone on webmail — saw the modal close and believed the request was sent. Nothing was
composed, nothing left, nothing was recorded. **A failed submission was visually identical
to a successful one**, from 2026-04-19 to 2026-08-01. The number of lost demo requests is
unknowable by construction.

Today a submission:

1. writes a row to Supabase before anything else,
2. keeps the modal open until the server confirms that write, naming the address back,
3. notifies both founders by email,
4. confirms to the requester,
5. and records the delivery outcome — including bounces — back onto the row.

`CLAUDE.md` open decision 4 (of seven) is resolved.

---

## §1 — What shipped

| Commit | Stage |
|---|---|
| `e22ebce` | Stage 1 — server-side capture and honest UI |
| `8985c9c` | Stage 2 — notification to CalcShore |
| `81e7cb8` | Stage 3 — confirmation to requester + delivery/bounce capture |
| `7e9cd32` | Stage 3 fix — read `svix-*` signature headers (see §4) |

**Stage 1.** `supabase/schema.sql` creates `demo_requests` with RLS enabled and **zero
policies on purpose** — the endpoint uses the secret key and bypasses RLS, so anon access
is denied by default. Do not "fix" this by adding a policy. `app/api/demo-request/route.ts`
is POST-only, reads env inside the handler, honeypots silently, validates loosely (one `@`,
non-empty either side), caps lengths at 200/5000 by rejection not truncation, and captures
referrer, user-agent and UTMs. `app/page.tsx` was rebuilt around a single
`idle | submitting | sent | error` status; **success keeps the modal open**, failure keeps
it open with values intact. The only surviving `setDemoOpen(false)` is in `closeDemo`.
`.gitignore` was broadened to cover bare `.env`.

**Stage 2.** Plain-text notification via Resend, sent only after the insert commits.
`From: CalcShore <noreply@calcshore.ai>`, `To:` both founders, `Reply-To:` **the
requester**. Backgrounded with `waitUntil` from `@vercel/functions` so the success state
never waits on a Resend round-trip for a row already committed. Total failure isolation:
missing key, Resend error, network throw and malformed response all log with the row id and
still return 200.

**Stage 3.** Plain-text confirmation to the requester, `Reply-To: contact@calcshore.ai`,
echoing the submission back so a typo is visible, promising follow-up "shortly" with **no
time commitment**. Both sends are tagged `demo_request_id` and `email_kind`.
`app/api/resend-webhook/route.ts` verifies the Svix signature and writes
`delivery_status`, `delivery_detail`, `delivery_event_at` and `confirmation_email_id` onto
the row. Migration `supabase/002_delivery_tracking.sql`.

---

## §2 — Settled configuration

| Item | Value |
|---|---|
| Supabase | separate project `calcshore-landing`, ref `dkwidydjzuxtwffijwep`, `us-west-1` |
| Sending provider | Resend, region `us-east-1` (fixed per-domain) |
| Sending domain | `calcshore.ai` (root), verified 2026-08-01 |
| Notification `From` | `noreply@calcshore.ai` |
| Notification `To` | `contact@calcshore.ai` + `hqa669@gmail.com`, **hardcoded — see §3** |
| Confirmation `Reply-To` | `contact@calcshore.ai` |
| Webhook endpoint | `https://www.calcshore.ai/api/resend-webhook` |
| Webhook events | `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `email.delivery_delayed` |
| Landing deploy | Vercel, Next.js 14.2.35 App Router |
| Canonical host | `https://www.calcshore.ai`; apex 308-redirects to `www` |

**Environment variables** — Vercel, Production + Preview, none `NEXT_PUBLIC_`:
`RESEND_API_KEY` (sensitive), `RESEND_WEBHOOK_SECRET` (sensitive),
`SUPABASE_SECRET_KEY` (sensitive), `SUPABASE_URL` (readable).

Note the webhook route needs **both** `RESEND_WEBHOOK_SECRET` and `RESEND_API_KEY` —
`new Resend()` throws without a key, and `webhooks.verify()` is only reachable through a
constructed client, even though verification itself is offline.

**Vercel env vars only take effect on the next deploy.** Adding one and not redeploying
produces a system that looks correctly configured and fails at runtime.

**Why a separate Supabase project:** so the landing page never holds a key to the database
containing PE sign-offs. Blast radius, not convenience.

**Why Resend over Google Workspace SMTP:** SMTP provides no delivery logs. The entire
failure being fixed here is that nothing was recorded. Do not reopen without addressing
logging.

---

## §3 — `contact@` stays an alias. Do not make it a group.

The original passdown preferred converting `contact@calcshore.ai` to a Workspace group —
groups are free and make the recipient list a dashboard change rather than a code change.
That reasoning is sound in the abstract and is **overridden by a fact it did not know**:

Xiaodan has a verified Gmail send-as identity, `CalcShore <contact@calcshore.ai>`,
established *because* `contact@` is an alias on her account. The same address cannot be both
an alias and a group, so creating the group requires deleting the alias — which breaks her
verified sender. She uses that identity for Bret, Tyler, and DOT correspondence.

Recoverable, but it is unplanned configuration on a mail setup that currently passes SPF,
DKIM and DMARC cleanly. Not worth disturbing to save one line of code.

**Recipients are hardcoded in the endpoint as a deliberate stopgap, documented in the
source with this reason.** A later session reading the old §4 will want to "improve" this
into a group address. It should not, without first solving the send-as problem.

Qinang has no Workspace identity and cannot sign into `admin.google.com`. A seat
(`qinang.hu@calcshore.ai`, ~$20/yr) is worth buying for a CalcShore-branded address and
independent admin access. Not required for X12.

---

## §4 — Findings. Read this section before the next integration.

### The two that cost the most time

**1. Cloudflare silently truncated a 218-character TXT paste to 183.** No error, no visual
cue, and the dashboard list view truncates on display so it looked correct. Resend returned
an unhelpful verification failure. **Verify every long DNS value after saving:**

```
dig +short TXT <name> | tr -d '"' | wc -c
```

**2. Resend sends `svix-*` headers on the wire, not `webhook-*`.** Resend runs on Svix,
which sends `svix-id` / `svix-timestamp` / `svix-signature`; only Professional and
Enterprise accounts get them white-labeled to the `webhook-` prefix.

The error was in how the SDK was read. `node_modules/resend/dist/index.mjs` shows `verify`
mapping its `{ id, timestamp, signature }` argument onto `webhook-*` keys before handing
them to `standardwebhooks` — but that mapping happens *after* you supply the values. It is
the SDK's internal naming, not the wire format. The route read three headers that never
arrive, `verify()` threw on missing headers, and every event got a 400 with `{"ok":false}`.

**The general lesson is the important part: reading the package source looked more
authoritative than the vendor docs and was wrong.** The recon was rigorous, traced the
require graph, quoted line numbers — and still got this wrong, because the source answers a
different question than the one being asked. The answer was only in Resend's docs. Same
shape as the `PORT-NOTES.md §4.4` defect in §6 — an artifact that described something real,
just not the thing it was taken to describe.

The route now reads `svix-*` first with a `webhook-*` fallback, and logs missing headers by
name so a missing-header failure is distinguishable from a bad-signature failure.

### DNS, as corrected

The original §8 step 1 said Resend's SPF include gets *edited into* the existing Google
record. **It does not.** Resend scopes its SPF to the `send.` subdomain and never touches
the apex. The single-SPF trap is real but does not fire on this vendor — verify before
assuming it applies to the next one.

The orange-cloud trap does not fire either: **Resend issues DKIM as TXT, not CNAME.**
Nothing in this record set can be proxied. Keep the grey-cloud rule for vendors that do use
CNAMEs.

Records added, all DNS-only:

| Type | Name | Content |
|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqG…` (218 chars) |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com`, priority 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Apex `v=spf1` remains Google's alone, MX remains `smtp.google.com`, `_dmarc` remains
`p=none`, `google._domainkey` DKIM TXT is present and enabled. **Do not touch any of them.**

Also: Resend's "Not Started" is not a wait state — verification needs an explicit trigger.
Skip "Auto configure" (it wants a Cloudflare API token with DNS write access to the zone
carrying the live Workspace MX). Do not enable Cloudflare's DMARC Management. Cloudflare
Email Routing stays disabled. Leave Resend's "Enable Receiving" off and skip its
tracking-metrics subdomain — link rewriting is a mild spam signal and this is plain-text
mail.

### Bounce testing

**`.invalid` addresses never bounce.** It is an IANA-reserved TLD with no DNS, so no
receiving server ever answers and the message sits at "Sent" indefinitely. Two attempts
with `test@nonexistent-domain-xyz.invalid` produced no webhook event at all.

Use a real domain with a nonexistent mailbox — `bounce-test@calcshore.ai` worked, producing
`email.bounced` within a minute with detail text beginning *"The recipient's email provider
sent a hard bounce message, but didn't…"*.

**A hard bounce puts the address on Resend's suppression list, so it cannot be reused.** A
second send to the same test address returned a different message — *"The recipient's email
address is on the suppression list because it has a recent history of producing hard
bounces"* — blocked before it reached Google. For another bounce test, use a fresh mailbox
name.

**The real `bounce.type` and `subType` values remain unobserved.** The installed package
types both as bare `string`, and the truncated column display never revealed them.
`delivery_status` therefore has **no CHECK constraint**, deliberately — a CHECK would reject
values we have not seen and silently drop delivery signal. Record the values the first time
a real prospect's address bounces; that is what a future constraint gets built from.

---

## §5 — Working method

- This chat plans, decides, and writes prompts for Claude Code. It does not write
  application code. Passdowns and planning artifacts are this chat's work, not Claude
  Code's.
- Claude Code executes. Every prompt is read-only recon or a narrowly-scoped build stage
  ending in **STOP before committing, show me the diff.**
- Fresh session per stage. A session that just wrote code should not be the one to recon it
  — it will report what it remembers writing rather than what is on disk.
- Commits small and path-scoped, each recording *why*, including what was deliberately not
  done. **Never `git add -A`. Never a bare `git commit`** — it opens `pico`; use
  `git commit -F -` with a heredoc.
- **Claude Code must not start, kill, or restart servers.** Browser verification is the
  user's.
- Every recon must print `git status --porcelain` and flag any cited file that is modified
  or untracked.

### Repo hazard

**An X1 session also works in `~/calcshore-landing`.** Throughout X12 the only dirty entry
was `PASSDOWN_X1_LANDING.md`, untracked — X1 was parked, not mid-edit. Confirm before any
future work.

A Claude Code session run in a remote container will not find `~/calcshore-landing` and may
clone from GitHub instead. That clone cannot report working-tree state, and its silence on
dirt is an artifact of the environment, not evidence of a clean tree.

---

## §6 — Open items, none blocking

1. **`next@14.2.35` carries 2 high-severity advisories** (DoS, cache poisoning, SSRF, XSS).
   Pre-existing; neither Supabase nor Resend introduced any. The fix is `next@16`, a
   breaking major. **The risk profile changed on 2026-08-01:** this repo had no server
   surface at all until Stage 1 and now has two route handlers, one of them a publicly
   reachable webhook. SSRF and cache-poisoning advisories mean more against a route handler
   than against a static page. Deserves its own arc.
2. **`resend` declares `engines: node >=20`**, putting a floor under a project that had
   none. Vercel's default is fine today; a build pinned to Node 18 would fail with an error
   that does not obviously point at Resend.
3. **`pm.calcshore.ai` is a live, proxied Cloudflare Worker** named `calcshore`, appearing
   in no documentation — not `CLAUDE.md`, not `PORT-NOTES.md`, not Xiaodan's handoff. Find
   out what it is; delete it if dead, document it if live.
4. **`PORT-NOTES.md §4.4` is wrong** and has been since it was written. It claims the
   `<form>` was replaced with a `<div>` and the button made `type="button"`;
   `git show fb9e4bb:app/page.tsx` shows a real `<form onSubmit>` and `type="submit"` in the
   very commit it documents.
5. **`CLAUDE.md` has seven open decisions**, not four. Decision 4 is resolved by X12.
   Decisions 1 (CTA path), 3 (validation-claim framing) and 6 (brand casing) touch the same
   surface.
6. **Two browser checks never run:** the offline-submit failure path (devtools → Network →
   Offline; error state should show with values preserved) and the honeypot (set a value on
   the hidden `website` input; should show success and write no row). Cheap, and the
   honeypot gets harder to test cleanly once real leads are in the table.
7. **The endpoint is unthrottled.** No rate limiting on either route — deferred, not
   forgotten. The honeypot is the only bot mitigation, which is the right call at this
   volume.
8. **Supabase project access shows one member**, Qinang as Owner. Same single-point-of-
   failure pattern §3 raises about `contact@`.
9. **The ordering guard on webhook updates compares in JS, not as a filter on the UPDATE.**
   It prevents a stale `delivered` from overwriting a later `bounced` in the common case,
   but a true concurrent race remains. Documented in-file as the upgrade to make once a
   PostgREST filter can be tested against the real database.

---

## §7 — Not in scope

The main repo (`~/calcshore`) entirely. The X1 landing arc. Anything in the TCP product.

Two items from Xiaodan's original feedback remain open **in the main repo** and belong to
that arc: the certification paragraph rendering in full on an unsigned TCP export with the
PE's name beneath it, and PE attestation not surviving a page reload. Named here only so
they are not lost.
