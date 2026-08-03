import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Demo request capture. Writes a row to Supabase `demo_requests`, then sends two
// emails: a notification to CalcShore and a confirmation to the requester. The
// row is the record of truth: the route returns success as soon as the insert is
// confirmed, so the UI can never show a false "sent". BOTH sends are strictly
// best-effort, run in the background via waitUntil, and cannot fail or delay the
// request — see `notifyCalcShore` and `confirmRequester` below.
//
// Both sends are tagged so Resend's delivery webhook can be joined back to the
// row (see app/api/resend-webhook/route.ts). The `email_kind` tag is what keeps a
// bounce on the internal notification from ever being mistaken for the prospect
// being unreachable.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SHORT = 200;
const MAX_MESSAGE = 5000;

// Shared envelope sender for both sends. Must stay on calcshore.ai so SPF/DKIM
// align; the requester's own address never goes in From.
const MAIL_FROM = "CalcShore <noreply@calcshore.ai>";

// Reply-To on the confirmation. Deliberately NOT noreply@: a reply to a demo
// confirmation is exactly the message worth receiving.
const CONFIRM_REPLY_TO = "contact@calcshore.ai";

// Hardcoded on purpose — do NOT replace this with a single group address.
// `contact@calcshore.ai` is an ALIAS on Xiaodan's mailbox, and her Gmail
// "send as" identity is verified against that alias. Converting it to a
// Workspace group would delete the alias and break her verified sender, so she
// would silently lose the ability to send as contact@. The second address is a
// personal backstop so a lead is never sitting in exactly one inbox.
// This is a recorded, deliberate stopgap, not an oversight.
const NOTIFY_TO = ["contact@calcshore.ai", "hqa669@gmail.com"];

const GENERIC_ERROR =
  "We couldn't save your request. Please try again, or email contact@calcshore.ai.";

/** Trim an incoming body field down to a string; anything non-string becomes "". */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Optional field: empty string becomes null so the column stays NULL, not ''. */
function orNull(v: string): string | null {
  return v.length > 0 ? v : null;
}

/**
 * Deliberately loose. Exactly one "@" with something on each side. Real typo
 * catching is bounce capture, not a regex — see the stage notes. Do not swap
 * this for an RFC 5322 pattern; it rejects valid addresses.
 */
function looksLikeEmail(email: string): boolean {
  const parts = email.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

function badRequest(field: string, message: string) {
  return NextResponse.json({ ok: false, field, error: message }, { status: 400 });
}

type Notification = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  message: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function line(label: string, value: string | null): string {
  return `${label}: ${value && value.length > 0 ? value : "—"}`;
}

/**
 * Resend tag values accept ASCII letters, digits, underscore and dash only, max
 * 256 chars. A bare UUID passes; anything with a dot or an "@" does not — which
 * is why we tag the row id and never the email address.
 */
const TAG_VALUE = /^[A-Za-z0-9_-]{1,256}$/;

type EmailKind = "notification" | "confirmation";

/**
 * Tags ride along with a send and come back on the delivery webhook under
 * `data.tags` — as a KEYED OBJECT there, not the array shape sent here.
 *
 * `email_kind` is load-bearing, not decoration. The notification goes to
 * contact@calcshore.ai and a personal Gmail address; a bounce on either of those
 * says nothing whatsoever about the prospect, and must NEVER mark them
 * unreachable. The webhook only writes the row's delivery columns when this tag
 * reads "confirmation".
 *
 * `demo_request_id` is omitted rather than sent malformed if the id somehow is
 * not tag-safe (the caller substitutes a placeholder when the insert returns no
 * id). An invalid tag would make Resend reject the entire send, trading a missing
 * join key for a missing email. Dropping it is LOUD, not silent: a lost tag
 * degrades the webhook join, and that must leave a trace naming the row.
 */
function tagsFor(rowId: string, kind: EmailKind): { name: string; value: string }[] {
  const tags: { name: string; value: string }[] = [];
  if (TAG_VALUE.test(rowId)) {
    tags.push({ name: "demo_request_id", value: rowId });
  } else {
    console.error(
      `[demo-request] Row id ${JSON.stringify(rowId)} is not a usable Resend tag value ` +
        "(ASCII letters, digits, underscore and dash only, 1-256 chars); sending the " +
        `${kind} email WITHOUT a demo_request_id tag. email_kind is still set, so a ` +
        "notification bounce still cannot touch the row; a confirmation event will have " +
        "to join on confirmation_email_id instead."
    );
  }
  tags.push({ name: "email_kind", value: kind });
  return tags;
}

/**
 * Notify CalcShore that a lead came in. Best-effort by design.
 *
 * This function NEVER throws and NEVER returns a failure the caller acts on:
 * the row is already committed by the time it runs, and a mail problem — no API
 * key, a Resend outage, a network error, a malformed response — must not turn a
 * captured lead into an error screen for the visitor. Every failure path logs
 * server-side with the row id so the record can be found and answered by hand.
 * That total try/catch is also what makes it safe to hand to waitUntil
 * unawaited: a rejection here is not possible, so there is nothing to leak.
 *
 * Reply-To is the requester, so hitting reply on the notification reaches the
 * prospect directly. The requester's address must NOT go in From: that would
 * break SPF/DKIM alignment for calcshore.ai.
 */
async function notifyCalcShore(n: Notification): Promise<void> {
  try {
    // Read inside the handler, never at module scope, so a missing key can
    // never break the build.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error(
        `[demo-request] RESEND_API_KEY missing; no notification sent for row ${n.id} (${n.email}). Row is saved.`
      );
      return;
    }

    const subject = `Demo request — ${n.company ?? n.name}`;
    const text = [
      "New demo request from the CalcShore landing page.",
      "",
      line("Name", n.name),
      line("Company", n.company),
      line("Email", n.email),
      "",
      "Message:",
      n.message ?? "—",
      "",
      line("Referrer", n.referrer),
      line("utm_source", n.utmSource),
      line("utm_medium", n.utmMedium),
      line("utm_campaign", n.utmCampaign),
      "",
      `Row id: ${n.id}`,
      "",
      "Reply to this email to reach the requester directly.",
    ].join("\n");

    const { data, error } = await new Resend(apiKey).emails.send({
      from: MAIL_FROM,
      to: NOTIFY_TO,
      replyTo: n.email,
      subject,
      text,
      // Tagged "notification" so the webhook can tell this send apart from the
      // requester's confirmation and skip it entirely. A bounce from contact@ or
      // the Gmail backstop must not touch the prospect's delivery columns.
      tags: tagsFor(n.id, "notification"),
    });

    if (error) {
      console.error(
        `[demo-request] Notification send failed for row ${n.id} (${n.email}):`,
        error
      );
      return;
    }

    console.log(
      `[demo-request] Notification sent for row ${n.id}; Resend message id ${data?.id ?? "(none returned)"}`
    );
  } catch (err) {
    console.error(
      `[demo-request] Notification threw for row ${n.id} (${n.email}):`,
      err
    );
  }
}

type Confirmation = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  message: string | null;
};

/**
 * Confirm to the requester that we got it. Best-effort by design, exactly like
 * `notifyCalcShore`: this function NEVER throws and NEVER returns a failure the
 * caller acts on. The row is already committed by the time it runs, so a mail
 * problem must not turn a captured lead into an error screen for the visitor.
 * Every failure path logs server-side with the row id.
 *
 * Deliberately dull. calcshore.ai has no sending reputation yet and early test
 * mail landed in spam, so: plain text only, no HTML alternative, no links, no
 * images, no tracking, no marketing voice. Nothing here should look like a
 * campaign, because it is not one.
 *
 * The submission is echoed back so a typo is VISIBLE to the person who made it.
 * Validation on this endpoint is deliberately loose — `adas@sda` is accepted and
 * stored — so this echo, plus the bounce webhook, is what actually catches a bad
 * address. No time commitment is made: "shortly", never a number of hours or
 * business days.
 *
 * On success the Resend id is written back to `confirmation_email_id` as a
 * secondary join path for delivery events that arrive without tags. That write is
 * non-critical and isolated: if it fails it logs and changes nothing else.
 */
async function confirmRequester(
  supabase: SupabaseClient,
  c: Confirmation
): Promise<void> {
  try {
    // Read inside the handler, never at module scope, so a missing key can
    // never break the build.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error(
        `[demo-request] RESEND_API_KEY missing; no confirmation sent for row ${c.id} (${c.email}). Row is saved.`
      );
      return;
    }

    const text = [
      `Hi ${c.name},`,
      "",
      "We received your demo request for CalcShore. Someone will be in touch",
      "shortly.",
      "",
      "Here is what you sent us:",
      "",
      line("Name", c.name),
      line("Company", c.company),
      line("Email", c.email),
      "",
      "Message:",
      c.message ?? "—",
      "",
      "If any of that is wrong, reply to this email and we will correct it.",
      "",
      "CalcShore",
    ].join("\n");

    const { data, error } = await new Resend(apiKey).emails.send({
      from: MAIL_FROM,
      to: c.email,
      replyTo: CONFIRM_REPLY_TO,
      subject: "We received your CalcShore demo request",
      text,
      // Tagged "confirmation": this is the ONLY send whose delivery events are
      // allowed to write the row's delivery columns.
      tags: tagsFor(c.id, "confirmation"),
    });

    if (error) {
      console.error(
        `[demo-request] Confirmation send failed for row ${c.id} (${c.email}):`,
        error
      );
      return;
    }

    const emailId = data?.id;
    if (!emailId) {
      console.error(
        `[demo-request] Confirmation sent for row ${c.id} but Resend returned no message id; delivery events will have to join on the tag alone.`
      );
      return;
    }

    console.log(
      `[demo-request] Confirmation sent for row ${c.id}; Resend message id ${emailId}`
    );

    // Non-critical. The tag on the send is the primary join key, so failing to
    // record this id costs us a fallback, not the feedback loop. Isolated in its
    // own try/catch so it cannot escape and cannot affect anything above.
    try {
      const { error: updateError } = await supabase
        .from("demo_requests")
        .update({ confirmation_email_id: emailId })
        .eq("id", c.id);

      if (updateError) {
        console.error(
          `[demo-request] Could not record confirmation_email_id ${emailId} on row ${c.id}:`,
          updateError
        );
      }
    } catch (updateErr) {
      console.error(
        `[demo-request] Recording confirmation_email_id ${emailId} on row ${c.id} threw:`,
        updateErr
      );
    }
  } catch (err) {
    console.error(
      `[demo-request] Confirmation threw for row ${c.id} (${c.email}):`,
      err
    );
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    // Specific cause stays server-side; the browser gets the generic message.
    console.error(
      "[demo-request] Missing env:" +
        (supabaseUrl ? "" : " SUPABASE_URL") +
        (supabaseSecretKey ? "" : " SUPABASE_SECRET_KEY")
    );
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("form", "We couldn't read that submission. Please try again.");
  }
  const payload = (body ?? {}) as Record<string, unknown>;

  // Honeypot. A non-empty `website` means a bot filled a field no human can
  // see. Return the exact success shape a real submission returns and write
  // nothing — the bot has no signal that it was caught.
  const honeypot = str(payload.website);
  if (honeypot.length > 0) {
    return NextResponse.json({ ok: true, email: str(payload.email) }, { status: 200 });
  }

  const name = str(payload.name);
  const company = str(payload.company);
  const email = str(payload.email);
  const message = str(payload.message);

  if (!name) return badRequest("name", "Please enter your name.");
  if (name.length > MAX_SHORT)
    return badRequest("name", `Name must be ${MAX_SHORT} characters or fewer.`);

  if (company.length > MAX_SHORT)
    return badRequest("company", `Company must be ${MAX_SHORT} characters or fewer.`);

  if (!email) return badRequest("email", "Please enter your work email.");
  if (email.length > MAX_SHORT)
    return badRequest("email", `Email must be ${MAX_SHORT} characters or fewer.`);
  if (!looksLikeEmail(email))
    return badRequest("email", "Please enter a valid email address.");

  if (message.length > MAX_MESSAGE)
    return badRequest("message", `Message must be ${MAX_MESSAGE} characters or fewer.`);

  // UTMs come from the client: the landing page is a single route, so it reads
  // them off window.location.search at submit time.
  const utmSource = str(payload.utm_source).slice(0, MAX_SHORT);
  const utmMedium = str(payload.utm_medium).slice(0, MAX_SHORT);
  const utmCampaign = str(payload.utm_campaign).slice(0, MAX_SHORT);

  const referrer = (request.headers.get("referer") ?? "").slice(0, MAX_SHORT * 5);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, MAX_SHORT * 5);

  // Client is constructed per-request, not at module scope, so a missing env
  // var can never break the build.
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // `.select("id")` makes this an INSERT ... RETURNING id — one statement, same
  // failure semantics as before. The id goes into the notification so a reply
  // can be matched back to the row.
  const { data, error } = await supabase
    .from("demo_requests")
    .insert({
      name,
      company: orNull(company),
      email,
      message: orNull(message),
      referrer: orNull(referrer),
      utm_source: orNull(utmSource),
      utm_medium: orNull(utmMedium),
      utm_campaign: orNull(utmCampaign),
      user_agent: orNull(userAgent),
    })
    .select("id")
    .single();

  if (error) {
    // Full detail server-side only. Never hand a DB error to the browser.
    console.error("[demo-request] Supabase insert failed:", error);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
  }

  const rowId = String(data?.id ?? "(unknown)");

  // Only after the row is committed, and deliberately NOT awaited: the visitor
  // should not wait on two Resend round-trips for a row that is already saved.
  // waitUntil keeps the serverless function alive until they settle, so
  // backgrounding them does not mean losing them.
  //
  // Both promises handed to waitUntil are already running and already
  // self-contained — notifyCalcShore and confirmRequester each swallow every
  // failure internally, so neither can reject (no unhandled rejection) nor affect
  // the response below. Off Vercel (local `next dev`) waitUntil is a no-op, but
  // the sends still complete: the promises were started by the calls, not by
  // waitUntil.
  //
  // Both calls are made BEFORE anything is awaited, so the two sends are in
  // flight concurrently and one failing cannot prevent the other from being
  // attempted. allSettled rather than all: neither promise can reject today, and
  // allSettled means that stays true even if a future edit to either helper
  // breaks that guarantee.
  waitUntil(
    Promise.allSettled([
      notifyCalcShore({
        id: rowId,
        name,
        company: orNull(company),
        email,
        message: orNull(message),
        referrer: orNull(referrer),
        utmSource: orNull(utmSource),
        utmMedium: orNull(utmMedium),
        utmCampaign: orNull(utmCampaign),
      }),
      confirmRequester(supabase, {
        id: rowId,
        name,
        company: orNull(company),
        email,
        message: orNull(message),
      }),
    ])
  );

  return NextResponse.json({ ok: true, email }, { status: 200 });
}
