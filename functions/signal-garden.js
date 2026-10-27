import worker from './_lib/signal-garden.js';
export function onRequest({request,env}) {
  const url=new URL(request.url);
  if (url.hostname!=='ai.rhyslindmark.com') return new Response('Not found',{status:404});
  url.pathname='/';
  return worker.fetch(new Request(url,request), {
    SIGNAL_GARDEN_PUBLIC:true,
    SIGNAL_GARDEN_SITE_KEY:env.SIGNAL_GARDEN_SITE_KEY,
    SIGNAL_GARDEN_AVAILABLE:env.SIGNAL_GARDEN_ENABLED==='1' && Boolean(env.SIGNAL_GARDEN_EXA_API_KEY && env.SIGNAL_GARDEN_TURNSTILE_SECRET && env.RHYSBOT_DB)
  });
}
