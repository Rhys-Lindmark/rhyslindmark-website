const enc = new TextEncoder();
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unbase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function wrappingKey(salt) {
  const bytes = await crypto.subtle.digest('SHA-256', enc.encode(`jev-api-key\0${salt}`));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function sealKey(value, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('JEV_API_KEY')}, await wrappingKey(salt), enc.encode(value));
  return {iv:base64(iv),ciphertext:base64(ciphertext)};
}
export async function loadKey(env) {
  if (env.JEV_API_KEY) return env.JEV_API_KEY;
  const row = await env.RHYSBOT_DB.prepare('SELECT iv,ciphertext FROM jev_credentials WHERE id=1').first();
  if (!row) return null;
  const value = await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(row.iv),additionalData:enc.encode('JEV_API_KEY')}, await wrappingKey(env.RHYSBOT_CLIENT_SALT), unbase64(row.ciphertext));
  return new TextDecoder().decode(value);
}
