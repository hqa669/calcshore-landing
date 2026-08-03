import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Resend delivery webhook. Closes the loop opened by /api/demo-request: that
// route sends a confirmation to the requester, and this one records what
// actually happened to it, so a lead we CANNOT reach is distinguishable from one
// who simply has not replied.
//
// Two rules govern everything below.
//
// 1. Only CONFIRMATION events touch the row's delivery columns. The other send
//    from that route is an internal notification to contact@calcshore.ai and a
//    personal Gmail address; a bounce on either says nothing about the prospect.
//    The `email_kind` tag is how the two are told apart.
//
// 2. Anything that passed signature verification gets a 200 — including events we
//    do not handle and events we cannot join to a row. A non-200 makes Resend
//    retry, and a retry cannot fix an event that has nowhere to go. 400 is
//    reserved for verification failure; 500 for server misconfiguration and
//    database faults, where a retry genuinely is the right remedy.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivery outcomes we record. The event type string is stored VERBATIM in
 * `delivery_status` — no mapping, no normalization, no severity ranking. See
 * supabase/002_delivery_tracking.sql for why that column has no CHECK.
 *
 * Everything else Resend can emit — 'email.sent', 'email.opened',
 * 'email.clicked', 'contact.*', 'domain.*', 'suppression.*' — is ignored.
 *
 * 'email.received' is deliberately absent and must stay absent: it is INBOUND
 * mail with a different payload shape that carries both an `email_id` and a
 * separate `message_id`. Handling it here would risk crossing those two fields.
 */
const HANDLED_EVENTS = new Set([
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
  "email.delivery_delayed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Non-empty string, or null. Anything else in the payload is treated as absent. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Milliseconds since epoch, or null if the value is absent or unparseable. */
function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * The human-readable reason, assembled from whatever the event carries.
 *
 * The component strings are copied through UNMODIFIED — not interpreted, not
 * mapped, not normalized. In particular no attempt is made to classify a bounce
 * as hard or soft: the installed resend package types `bounce.type` and
 * `bounce.subType` as bare `string`, so the real value space is unknown, and
 * guessing at it here would bake a wrong assumption into the data. Only the
 * labels joining them are ours.
 */
function detailFor(type: string, data: Record<string, unknown>): string | null {
  if (type === "email.bounced" && isRecord(data.bounce)) {
    const parts = [
      str(data.bounce.message),
      str(data.bounce.type) && `type: ${str(data.bounce.type)}`,
      str(data.bounce.subType) && `subType: ${str(data.bounce.subType)}`,
    ].filter((part): part is string => typeof part === "string");
    return parts.length > 0 ? parts.join(" | ") : null;
  }

  if (type === "email.failed" && isRecord(data.failed)) {
    return str(data.failed.reason);
  }

  if (type === "email.suppressed" && isRecord(data.suppressed)) {
    return str(data.suppressed.message);
  }

  // 'email.delivered', 'email.complained' and 'email.delivery_delayed' carry no
  // extra payload field in the installed types — the event type is the whole
  // signal.
  return null;
}

export async function POST(request: Request) {
  // FIRST, before anything else touches the request. `webhooks.verify()`
  // JSON-parses internally and hands back the parsed object, and a Request body
  // can only be read once — so calling request.json() anywhere above this line
  // would leave verify() with nothing to verify.
  let raw: string;
  try {
    raw = await request.text();
  } catch (err) {
    console.error("[resend-webhook] Could not read request body:", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Never skip verification because the secret is absent — an unverified
    // webhook is an open write endpoint into the leads table. 500 so Resend
    // retries once the env var is actually set.
    console.error(
      "[resend-webhook] RESEND_WEBHOOK_SECRET missing; refusing to process an unverified webhook."
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Only needed to CONSTRUCT the client: `new Resend()` throws when it is given
  // no key and RESEND_API_KEY is unset. verify() itself is offline — it never
  // calls the API — but there is no way to reach it without a client.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[resend-webhook] RESEND_API_KEY missing; the Resend client cannot be constructed to verify the signature."
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Resend runs on Svix, which sends the three standard webhook headers under
  // their `svix-*` names and only white-labels them to the `webhook-*` prefix on
  // Professional and Enterprise accounts. So read `svix-*` first and fall back to
  // `webhook-*`, and the route keeps working if this account is ever white-labeled.
  // The { id, timestamp, signature } shape handed to verify() is unchanged — only
  // the headers those values are read from.
  const headerNames = {
    id: ["svix-id", "webhook-id"],
    timestamp: ["svix-timestamp", "webhook-timestamp"],
    signature: ["svix-signature", "webhook-signature"],
  } as const;

  function header(names: readonly string[]): string {
    for (const name of names) {
      const value = request.headers.get(name);
      if (value) return value;
    }
    return "";
  }

  const headers = {
    id: header(headerNames.id),
    timestamp: header(headerNames.timestamp),
    signature: header(headerNames.signature),
  };

  // A missing header and a bad signature both make verify() throw, which made the
  // two indistinguishable in the logs and cost a production round-trip to tell
  // apart. Name the absent ones explicitly before bailing out.
  const missing = (Object.keys(headerNames) as (keyof typeof headerNames)[])
    .filter((key) => !headers[key])
    .map((key) => headerNames[key].join(" / "));

  if (missing.length > 0) {
    console.error(
      `[resend-webhook] Signature headers absent: ${missing.join(", ")}; cannot verify.`
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // verify() is SYNCHRONOUS and signals failure by THROWING
  // (WebhookVerificationError) — it never returns false. It throws on missing
  // headers, on a timestamp outside a 300-second tolerance in either direction,
  // and on a signature mismatch.
  let payload: unknown;
  try {
    payload = new Resend(apiKey).webhooks.verify({
      payload: raw,
      headers,
      webhookSecret,
    });
  } catch (err) {
    console.error(
      // "message id", not a header name — the value may have come from either
      // `svix-id` or `webhook-id`, and the log should not assert which.
      `[resend-webhook] Signature verification failed (message id ${headers.id || "(none)"}):`,
      err
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Everything from here on returns 200. The request is authentic; whatever we
  // decide about its contents, Resend should not send it again.
  //
  // The package types the return of verify() as WebhookEventPayload, but that is
  // an unchecked assertion — standardwebhooks returns JSON.parse(payload) typed
  // `unknown`, and nothing validates the shape at runtime. So it is narrowed by
  // hand, and an unexpected shape is logged rather than thrown.
  if (!isRecord(payload)) {
    console.error("[resend-webhook] Verified payload is not an object; ignoring.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const type = str(payload.type);
  if (!type) {
    console.error("[resend-webhook] Verified payload has no `type`; ignoring.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!HANDLED_EVENTS.has(type)) {
    // Not an error. We subscribe to more than we act on.
    console.log(`[resend-webhook] Ignoring unhandled event type ${type}.`);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const data = payload.data;
  if (!isRecord(data)) {
    console.error(`[resend-webhook] Event ${type} has no \`data\` object; ignoring.`);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const emailId = str(data.email_id);

  // The EVENT's created_at, which is top-level — not data.created_at, which is
  // when the email itself was created. Mixing them up would corrupt the ordering
  // guard below.
  const eventAt = str(payload.created_at);
  const eventAtMs = ms(eventAt);
  if (!eventAt || eventAtMs === null) {
    // Without a usable event timestamp there is no safe way to order this event
    // against what is already on the row, so it is dropped rather than applied
    // out of turn.
    console.error(
      `[resend-webhook] Event ${type} (email_id ${emailId ?? "(none)"}) has no usable created_at; ignoring.`
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const tags = isRecord(data.tags) ? data.tags : null;
  const emailKind = tags ? str(tags.email_kind) : null;
  const taggedRowId = tags ? str(tags.demo_request_id) : null;

  // The load-bearing check. The notification send goes to contact@calcshore.ai
  // and a personal Gmail backstop; its delivery outcome says nothing at all about
  // the prospect. Bail out explicitly rather than relying on the join to miss —
  // this must never mark a prospect unreachable.
  if (emailKind === "notification") {
    console.log(
      `[resend-webhook] Ignoring ${type} for internal notification (email_id ${emailId ?? "(none)"}); delivery columns untouched.`
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    // Server misconfiguration, not a bad event: a retry after the env is fixed
    // will succeed, so this is one of the few non-200s.
    console.error(
      "[resend-webhook] Missing env:" +
        (supabaseUrl ? "" : " SUPABASE_URL") +
        (supabaseSecretKey ? "" : " SUPABASE_SECRET_KEY")
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Constructed per-request, not at module scope, so a missing env var can never
  // break the build.
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Join back to the row, in order of reliability:
  //   1. the `demo_request_id` tag, but ONLY on a send tagged "confirmation";
  //   2. `confirmation_email_id`, recorded when the confirmation was sent.
  let query = supabase.from("demo_requests").select("id, delivery_event_at");
  let joinedBy: string;

  if (emailKind === "confirmation" && taggedRowId) {
    query = query.eq("id", taggedRowId);
    joinedBy = `tag demo_request_id=${taggedRowId}`;
  } else if (emailId) {
    query = query.eq("confirmation_email_id", emailId);
    joinedBy = `confirmation_email_id=${emailId}`;
  } else {
    console.log(
      `[resend-webhook] Event ${type} carries neither a confirmation tag nor an email_id; nothing to join.`
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { data: row, error: selectError } = await query.maybeSingle();

  if (selectError) {
    // A database fault, not a bad event — let Resend retry.
    console.error(
      `[resend-webhook] Lookup failed for ${type} (${joinedBy}):`,
      selectError
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (!row) {
    // Expected in normal operation: every event for an email this app did not
    // send lands here. Not a failure, and retrying would not find it.
    console.log(
      `[resend-webhook] No demo_requests row for ${type} (${joinedBy}); ignoring.`
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Ordering guard. Webhooks retry and can arrive out of order, so a stale
  // 'email.delivered' must never overwrite a later 'email.bounced'. An
  // unparseable stored value is treated as absent, so the row self-heals rather
  // than freezing.
  //
  // Compared here rather than as a filter on the UPDATE, which leaves a narrow
  // race between two events for the same row arriving at once. At this volume
  // that is accepted, and the next event repairs it; the atomic version is a
  // filter that should only be added once it can be tested against the real
  // database.
  const existingAtMs = ms(str(row.delivery_event_at));
  if (existingAtMs !== null && eventAtMs < existingAtMs) {
    console.log(
      `[resend-webhook] Ignoring out-of-order ${type} for row ${row.id}: event ${eventAt} predates recorded ${row.delivery_event_at}.`
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const detail = detailFor(type, data);

  const { error: updateError } = await supabase
    .from("demo_requests")
    .update({
      // Stored verbatim. See supabase/002_delivery_tracking.sql.
      delivery_status: type,
      delivery_detail: detail,
      delivery_event_at: eventAt,
    })
    .eq("id", row.id);

  if (updateError) {
    console.error(
      `[resend-webhook] Update failed for ${type} on row ${row.id} (${joinedBy}):`,
      updateError
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  console.log(
    `[resend-webhook] Recorded ${type} on row ${row.id} (${joinedBy})${detail ? `: ${detail}` : ""}`
  );
  return NextResponse.json({ ok: true }, { status: 200 });
}
