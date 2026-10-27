export const MODEL = 'jev-1.14.0';
export const RESERVATION_MICROS = 10000;
export const BUDGET_MICROS = 20000000;
// $0.042 / million input tokens, output free; default context <= 65,536.
// A one-cent reservation exceeds the maximum $0.002753 request charge.
// Never refund attempted calls: timeouts may already have been billed.
export const RATE_SQL = 'INSERT INTO jev_limits(bucket,uses,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET uses=uses+1 WHERE uses<? RETURNING uses';
export const BUDGET_SQL = 'UPDATE jev_budget SET reserved_micros=reserved_micros+? WHERE id=1 AND enabled=1 AND reserved_micros<=? RETURNING reserved_micros';

export async function reserve(db, client, now = Date.now()) {
  const hour = Math.floor(now / 3600000), day = Math.floor(now / 86400000);
  const perClient = await db.prepare(RATE_SQL).bind(`client:${client}:${hour}`, now + 7200000, 10).first();
  if (!perClient) return 'Hourly limit reached. Try again later.';
  const perDay = await db.prepare(RATE_SQL).bind(`day:${day}`, now + 172800000, 100).first();
  if (!perDay) return 'Today’s limit has been reached. Try again tomorrow.';
  const budget = await db.prepare(BUDGET_SQL).bind(RESERVATION_MICROS, BUDGET_MICROS - RESERVATION_MICROS).first();
  if (!budget) return 'Claim Check is paused: its usage allowance has been reached.';
  await db.prepare('DELETE FROM jev_limits WHERE expires<?').bind(now).run();
  return null;
}

export async function clientIdentity(ip, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`jev:${ip}`));
  return Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, '0')).join('');
}
