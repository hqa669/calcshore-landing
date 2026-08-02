import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Demo request capture. Writes a row to Supabase `demo_requests`, then notifies
// CalcShore by email. The row is the record of truth: the route returns success
// as soon as the insert is confirmed, so the UI can never show a false "sent".
// The notification is strictly best-effort, runs in the background via
// waitUntil, and cannot fail or delay the request — see `notifyCalcShore`
// below. No confirmation email is sent to the requester yet; that is a
// separate, later stage.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SHORT = 200;
const MAX_MESSAGE = 5000;

const NOTIFY_FROM = "CalcShore <noreply@calcshore.ai>";

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
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      replyTo: n.email,
      subject,
      text,
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

  // Only after the row is committed, and deliberately NOT awaited: the visitor
  // should not wait on a Resend round-trip for a row that is already saved.
  // waitUntil keeps the serverless function alive until the send settles, so
  // backgrounding it does not mean losing it.
  //
  // The promise handed to waitUntil is already running and already
  // self-contained — notifyCalcShore swallows every failure internally, so it
  // can neither reject (no unhandled rejection) nor affect the response below.
  // Off Vercel (local `next dev`) waitUntil is a no-op, but the send still
  // completes: the promise was started by the call, not by waitUntil.
  waitUntil(
    notifyCalcShore({
      id: String(data?.id ?? "(unknown)"),
      name,
      company: orNull(company),
      email,
      message: orNull(message),
      referrer: orNull(referrer),
      utmSource: orNull(utmSource),
      utmMedium: orNull(utmMedium),
      utmCampaign: orNull(utmCampaign),
    })
  );

  return NextResponse.json({ ok: true, email }, { status: 200 });
}
