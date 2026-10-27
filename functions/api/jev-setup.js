// One-time provisioning bridge. Disabled without an owner-configured key digest;
// stores only AES-GCM ciphertext and cannot overwrite an existing credential.
import { readJSON } from './jev.js';
import { sealKey } from '../_lib/jev-key.js';
export async function onRequest({request,env}) {
  const reply = (body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  if (!/^[a-f0-9]{64}$/.test(env.JEV_SETUP_KEY_SHA256 || '')) return reply({error:'Not found'},404);
  if (request.method!=='POST' || request.headers.get('Origin')!=='https://ai.rhyslindmark.com' || new URL(request.url).hostname!=='ai.rhyslindmark.com') return reply({error:'Forbidden'},403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply({error:'Invalid request'},415);
  try {
    const body = await readJSON(request);
    if (!/^[\x21-\x7e]{8,512}$/.test(body?.key || '')) return reply({error:'Invalid request'},400);
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.key));
    const hex = Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    if (hex!==env.JEV_SETUP_KEY_SHA256) return reply({error:'Forbidden'},403);
    if (!env.RHYSBOT_DB || !env.RHYSBOT_CLIENT_SALT) return reply({error:'Unavailable'},503);
    const sealed = await sealKey(body.key,env.RHYSBOT_CLIENT_SALT);
    const row = await env.RHYSBOT_DB.prepare('INSERT OR IGNORE INTO jev_credentials(id,iv,ciphertext) VALUES(1,?,?) RETURNING id').bind(sealed.iv,sealed.ciphertext).first();
    return row ? reply({configured:true}) : reply({error:'Already configured'},409);
  } catch {return reply({error:'Setup failed'},503);}
}
