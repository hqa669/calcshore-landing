-- CalcShore landing — delivery / bounce tracking for the confirmation email
--
-- Migration 002. Apply by pasting this file into the Supabase SQL editor.
-- Idempotent: every add is guarded with "if not exists", so re-running is safe.
--
-- Context: schema.sql (already applied) captures the lead. Stage 2 notifies
-- CalcShore. Neither can distinguish a lead we CANNOT reach from one who simply
-- has not replied — validation on /api/demo-request is deliberately loose, and a
-- test submission of `adas@sda` was accepted and stored. These columns close that
-- gap by recording what Resend's webhook tells us about the CONFIRMATION email we
-- send to the requester.

alter table public.demo_requests
  -- Resend's id for the confirmation send, written back after a successful send.
  -- This is the SECONDARY join path for an incoming webhook: the primary path is
  -- the `demo_request_id` tag we stamp on the send, and this column covers events
  -- that arrive without tags.
  add column if not exists confirmation_email_id text,

  -- The Resend webhook event type, stored VERBATIM: 'email.delivered',
  -- 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed',
  -- 'email.delivery_delayed'.
  --
  -- DELIBERATELY NO CHECK CONSTRAINT. This is not an oversight.
  --
  -- The installed resend package (6.18.1) types the interesting bounce fields —
  -- `bounce.type` and `bounce.subType` — as bare `string`, not as a literal union
  -- (node_modules/resend/dist/index.d.mts, interface EmailBounce). The package
  -- therefore does not tell us the real value space, and neither does its readme,
  -- which contains no webhook documentation at all. A CHECK written from guesswork
  -- would reject values we have not seen yet, and because the webhook handler must
  -- return 200 to stop Resend retrying, a rejected write would SILENTLY DROP the
  -- delivery signal we added this whole migration to capture.
  --
  -- Revisit and add a constraint only once real events have been observed in this
  -- column. Until then, free text is the honest representation.
  add column if not exists delivery_status text,

  -- Raw bounce / failure text as received, unmodified: for 'email.bounced' the
  -- bounce message plus its type and subType; for 'email.failed' the reason; for
  -- 'email.suppressed' the message. NOT interpreted, mapped, or normalized —
  -- see the note above on why we do not yet pretend to know these values.
  add column if not exists delivery_detail text,

  -- `created_at` of the webhook EVENT that set the two columns above (not the
  -- email's own created_at). Doubles as the ordering guard: webhooks retry and can
  -- arrive out of order, so an update only applies when the incoming event is at
  -- least as new as this value. A stale 'delivered' must never overwrite a later
  -- 'bounced'.
  add column if not exists delivery_event_at timestamptz;

-- Supports the secondary (untagged) join path: webhook event -> row.
create index if not exists demo_requests_confirmation_email_id_idx
  on public.demo_requests (confirmation_email_id);

-- NOT TOUCHED, on purpose: the existing `status` column.
--
-- `status` is the SALES PIPELINE (new / contacted / scheduled / dead) and it
-- carries a CHECK constraint over exactly those four values. It is unrelated to
-- email delivery, and writing a delivery value into it would be rejected by that
-- CHECK. Delivery state lives in `delivery_status`, and the two must stay separate.
--
-- RLS also stays exactly as schema.sql left it: enabled, with zero policies. The
-- route handlers write with the Supabase secret key, which bypasses RLS; nothing
-- in the browser should ever read or write this table. Do not add a policy here.
