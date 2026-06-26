// functions/api/lead.js — Cloudflare Pages Function served at /api/lead. Proxy between the
// public lead form and the Power Automate flow that writes Ananta_Leads.xlsx.
//
// WHY THIS EXISTS: the old setup POSTed straight from client JS to the Power Automate
// webhook, so the sig token sat in view-source. Anyone could spam the flow, exhaust its
// quota, or inject third-party PII into the controller's records. This function keeps the
// token server-side (env, never in the repo) and adds an origin check, honeypot drop,
// per-IP rate limit, Turnstile verification, and Excel/CSV formula-injection sanitisation
// before forwarding. Server stamps the timestamp + consent version so neither is client-
// trusted. See council verdict on the Notion Bali page (update 26.6.2026).
//
// PLACEHOLDERS until David sets them in the Cloudflare Pages dashboard env:
//   PA_WEBHOOK_URL   — full Power Automate URL incl. the REGENERATED sig token (required)
//   TURNSTILE_SECRET — Cloudflare Turnstile secret key (falls back to the always-pass TEST
//                      secret below, i.e. NO bot protection, until set)
//   ADMIN_EMAIL      — optional override (defaults to kristyna.pauly@thepersonalresorts.com)
//   ALLOWED_ORIGINS  — optional extra comma-separated origins (same-origin always allowed)
//   LEAD_DEBUG       — set to "1" ONLY in local testing; makes the function echo the
//                      assembled payload instead of forwarding. NEVER set in production.

// Consent wording locked by Tyna (Notion Bali, 26.6). Stored verbatim with each lead so we
// can prove exactly what the subject agreed to. Bump CONSENT_VERSION if the wording changes.
const CONSENT_VERSION = "v1-2026-06-26";
const REQUIRED_TEXT =
  "I agree to the processing of my personal data for the purpose of receiving the requested investor materials and being contacted regarding my inquiry.";
const MARKETING_TEXT =
  "I would also like to receive occasional news, updates and investment opportunities from The Personal Resorts BALI s.r.o. I understand that I can unsubscribe at any time.";

// PLACEHOLDER: Cloudflare Turnstile TEST secret (always passes). Real secret goes in the
// dashboard env as TURNSTILE_SECRET. While this fallback is in use, bot protection is a no-op.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

const RL_WINDOW_SECONDS = 60;
const RL_MAX = 6; // submits per IP per window (best-effort, per edge colo)

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

// Excel/CSV formula-injection guard: Excel runs a cell starting with = + - @ (or tab/CR) as
// a formula when the xlsx is opened. Prefix a single quote so it stays plain text.
function sanitize(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
}

function sameOriginOk(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false; // a real browser fetch POST always sends Origin; curl/bots often don't
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  if (host === new URL(request.url).host) return true;
  const extra = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.some((o) => {
    try { return new URL(o).host === host; } catch { return o === host; }
  });
}

// Best-effort fixed-window per-IP limiter via the per-colo Cache API (no KV binding needed).
// Turnstile is the real bot gate; this just sheds obvious floods cheaply.
async function rateLimited(ip) {
  try {
    if (typeof caches === "undefined" || !caches.default) return false;
    const cache = caches.default;
    const key = new Request("https://rl.ananta.internal/" + encodeURIComponent(ip));
    const hit = await cache.match(key);
    let count = 0;
    if (hit) count = parseInt(await hit.text(), 10) || 0;
    if (count >= RL_MAX) return true;
    await cache.put(
      key,
      new Response(String(count + 1), { headers: { "Cache-Control": "max-age=" + RL_WINDOW_SECONDS } })
    );
    return false;
  } catch {
    return false; // never block a legit lead because the limiter errored
  }
}

async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await r.json();
    return !!(data && data.success);
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") || "";
  const ip = request.headers.get("CF-Connecting-IP") || "";

  // 1. Origin check (cheap reject)
  if (!sameOriginOk(request, env)) return json({ ok: false, error: "bad_origin" }, 403, origin);

  // 2. Parse JSON
  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400, origin); }

  // 3. Honeypot — bots fill the hidden field. Pretend success, drop silently.
  if (data.website && String(data.website).trim() !== "") return json({ ok: true }, 200, origin);

  // 4. Required consent must be a real true (defence behind the client `required` attribute)
  if (data.gdpr_consent !== true) return json({ ok: false, error: "consent_required" }, 422, origin);

  // 5. Per-IP rate limit (before the expensive Turnstile call)
  if (ip && (await rateLimited(ip))) return json({ ok: false, error: "rate_limited" }, 429, origin);

  // 6. Turnstile (server-side). PLACEHOLDER secret until TURNSTILE_SECRET is set in the dashboard.
  const secret = env.TURNSTILE_SECRET || TURNSTILE_TEST_SECRET;
  if (!(await verifyTurnstile(data.turnstile_token, secret, ip)))
    return json({ ok: false, error: "turnstile_failed" }, 403, origin);

  // 7. Assemble the server-authoritative record: sanitised fields, server timestamp + geo,
  //    consent booleans + verbatim wording + version. admin_email is set here, never by the client.
  const payload = {
    name: sanitize(data.name || ""),
    email: sanitize(data.email || ""),
    country: sanitize(data.country || ""),
    project: sanitize(data.project || ""),
    gdpr_consent: true,
    marketing_consent: data.marketing_consent === true,
    consent_version: CONSENT_VERSION,
    consent_text_required: REQUIRED_TEXT,
    consent_text_marketing: data.marketing_consent === true ? MARKETING_TEXT : "",
    admin_email: env.ADMIN_EMAIL || "kristyna.pauly@thepersonalresorts.com",
    geo_country: (request.cf && request.cf.country) || "",
    user_agent: sanitize(request.headers.get("User-Agent") || ""),
    page_url: sanitize(data.page_url || ""),
    timestamp: new Date().toISOString(), // server-side, not client-trusted
  };

  // Local-test echo only (LEAD_DEBUG=1). Never set in production.
  if (env.LEAD_DEBUG === "1") return json({ ok: true, _debug: payload }, 200, origin);

  // 8. Forward to Power Automate. The token lives ONLY in env.PA_WEBHOOK_URL, never in the repo.
  const paUrl = env.PA_WEBHOOK_URL;
  if (!paUrl) return json({ ok: false, error: "not_configured" }, 502, origin);
  try {
    const r = await fetch(paUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return json({ ok: false, error: "upstream_failed" }, 502, origin);
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502, origin);
  }

  return json({ ok: true }, 200, origin);
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: cors(context.request.headers.get("Origin") || "") });
}

// GET (and any other method without a handler above) → 405. Keeps view-source / crawlers
// from getting anything useful from the endpoint.
export async function onRequestGet(context) {
  return json({ ok: false, error: "method_not_allowed" }, 405, context.request.headers.get("Origin") || "");
}
