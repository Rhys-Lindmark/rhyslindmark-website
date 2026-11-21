export const MODEL = 'jev-1.14.0';
export const RESERVATION_MICROS = 10000;
export const BUDGET_MICROS = 20000000;
// $0.042 / million input tokens, output free; default context <= 65,536.
// A one-cent reservation exceeds the maximum $0.002753 request charge.
// Never refund attempted calls: timeouts may already have been billed.
export const BUDGET_SQL = 'UPDATE jev_budget SET reserved_micros=reserved_micros+? WHERE id=1 AND enabled=1 AND reserved_micros<=? RETURNING reserved_micros';

export async function reserve(db, client, now = Date.now()) {
  // No hourly or daily caps (both removed 2026-11-20 at the owner's request).
  // The lifetime budget is now the only usage limit.
  const budget = await db.prepare(BUDGET_SQL).bind(RESERVATION_MICROS, BUDGET_MICROS - RESERVATION_MICROS).first();
  if (!budget) return 'Jev is paused: its usage allowance has been reached.';
  // Prune counters left over from the removed rate limits.
  await db.prepare('DELETE FROM jev_limits WHERE expires<?').bind(now).run();
  return null;
}

export async function clientIdentity(ip, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`jev:${ip}`));
  return Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, '0')).join('');
}

// Passing Turnstile once earns a signed, HttpOnly cookie, so the visitor
// isn't asked again until it expires. The signature uses a key derived from
// JEV_KEY_SECRET with its own purpose label.
export const HUMAN_COOKIE = 'jev_human';
export const HUMAN_TTL_MS = 7 * 86400000;
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const humanKey = secret => crypto.subtle.importKey('raw', enc.encode(`jev-human-cookie:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export async function issueHumanCookie(secret, now = Date.now()) {
  const expires = now + HUMAN_TTL_MS;
  const payload = `${expires}.${b64url(crypto.getRandomValues(new Uint8Array(12)))}`;
  const signature = b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await humanKey(secret), enc.encode(payload))));
  return { expires, header: `${HUMAN_COOKIE}=${payload}.${signature}; Max-Age=${HUMAN_TTL_MS / 1000}; Path=/api/jev; HttpOnly; Secure; SameSite=Strict` };
}
// Returns the cookie's expiry time when it is valid, otherwise 0.
export async function humanCookieExpiry(cookieHeader, secret, now = Date.now()) {
  const match = /(?:^|;\s*)jev_human=(\d{13})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})(?:;|$)/.exec(cookieHeader || '');
  if (!match) return 0;
  const expires = Number(match[1]);
  if (expires <= now || expires > now + HUMAN_TTL_MS) return 0;
  const signature = Uint8Array.from(atob(match[3].replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
  return await crypto.subtle.verify('HMAC', await humanKey(secret), signature, enc.encode(`${match[1]}.${match[2]}`)) ? expires : 0;
}
