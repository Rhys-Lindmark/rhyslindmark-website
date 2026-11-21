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
