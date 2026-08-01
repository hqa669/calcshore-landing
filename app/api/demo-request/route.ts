import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Demo request capture. Writes a row to Supabase `demo_requests` and nothing
// else — no email is sent from here (notification and confirmation mail are
// separate, later stages). The route returns success ONLY after the insert is
// confirmed, so the UI can never show a false "sent".

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SHORT = 200;
const MAX_MESSAGE = 5000;

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

  const { error } = await supabase.from("demo_requests").insert({
    name,
    company: orNull(company),
    email,
    message: orNull(message),
    referrer: orNull(referrer),
    utm_source: orNull(utmSource),
    utm_medium: orNull(utmMedium),
    utm_campaign: orNull(utmCampaign),
    user_agent: orNull(userAgent),
  });

  if (error) {
    // Full detail server-side only. Never hand a DB error to the browser.
    console.error("[demo-request] Supabase insert failed:", error);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email }, { status: 200 });
}
