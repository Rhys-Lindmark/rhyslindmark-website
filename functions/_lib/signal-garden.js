const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (data, status = 200) => Response.json(data, {status, headers});
const lenses = {
  research: 'Find original research, studies, and substantive technical explanations about ',
  practice: 'Find real-world projects, organizations, experiments, and implementations of ',
  counterpoints: 'Find thoughtful critiques, limitations, failures, and opposing arguments about '
};
export async function readBounded(request, max = 16384) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request');
  const parts = []; let size = 0;
  while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error('Request too large'); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/api/search') {
      if (request.method !== 'POST') return json({error:'Use POST.'},405);
      if (request.headers.get('origin') !== url.origin) return json({error:'Same-origin requests only.'},403);
      let body;
      try { body = await readBounded(request); } catch { return json({error:'Send a valid JSON request under 16 KB.'},400); }
      if (typeof body.query !== 'string' || body.query.trim().length < 3 || body.query.length > 600 || !Object.hasOwn(lenses, body.lens)) return json({error:'Enter a topic between 3 and 600 characters and choose a valid lens.'},400);
      const suppliedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const serverKey = request.headers.get('oai-authenticated-user-id') && typeof env.EXA_API_KEY === 'string' ? env.EXA_API_KEY.trim() : '';
      const apiKey = suppliedKey || serverKey;
      if (apiKey.length < 8 || apiKey.length > 256 || /[\r\n]/.test(apiKey)) return json({error:'Add your Exa API key in Connect Exa.'},400);
      const payload = {query:lenses[body.lens] + body.query.trim(), type:'auto', contents:{highlights:true}};
      if (['month','year'].includes(body.period)) payload.startPublishedDate = new Date(Date.now() - (body.period === 'month' ? 30 : 365) * 86400000).toISOString();
      try {
        const upstream = await fetch('https://api.exa.ai/search', {method:'POST', headers:{'content-type':'application/json','x-api-key':apiKey}, body:JSON.stringify(payload), signal:AbortSignal.timeout(30000)});
        if (!upstream.ok) { await upstream.body?.cancel(); const messages = {401:'Exa rejected this API key. Check it and try again.',403:'This key does not have access to Exa search.',402:'Your Exa account needs credits.',429:'Exa is rate limiting requests. Wait a moment and try again.'}; return json({error:messages[upstream.status] || 'Exa could not complete the search. Please try again.'}, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502); }
        const data = JSON.parse(await readResponseBounded(upstream));
        return json({results:(Array.isArray(data.results) ? data.results : []).slice(0,10).filter(r => {try{return ['https:','http:'].includes(new URL(r.url).protocol);}catch{return false;}}).map(r=>({title:String(r.title || r.url).slice(0,500),url:r.url,publishedDate:r.publishedDate || null,author:String(r.author || '').slice(0,200),highlights:Array.isArray(r.highlights)?r.highlights.slice(0,3).map(s=>String(s).slice(0,1800)):[]})),cost:data.costDollars?.total ?? null});
      } catch { return json({error:'Search timed out or the response could not be read. Please try again.'},502); }
    }
    if (url.pathname !== '/') return new Response('Not found',{status:404,headers});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers});
    const publicSearch = env.SIGNAL_GARDEN_PUBLIC === true;
    const sitekey = typeof env.SIGNAL_GARDEN_SITE_KEY === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(env.SIGNAL_GARDEN_SITE_KEY) ? env.SIGNAL_GARDEN_SITE_KEY : '';
    const publicAvailable = publicSearch && env.SIGNAL_GARDEN_AVAILABLE === true && Boolean(sitekey);
    const serverConfigured = publicAvailable || Boolean(request.headers.get('oai-authenticated-user-id') && typeof env.EXA_API_KEY === 'string' && env.EXA_API_KEY.trim());
    return new Response(request.method === 'HEAD' ? null : page.replace('const serverConfigured = false;', 'const serverConfigured = ' + serverConfigured + ';').replace('const publicSearch = false;', 'const publicSearch = ' + publicSearch + ';').replace('const turnstileSitekey = "";', 'const turnstileSitekey = ' + JSON.stringify(sitekey) + ';'), {headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'unsafe-inline' https://challenges.cloudflare.com; style-src 'unsafe-inline'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'"}});
  }
};
async function readResponseBounded(response) {
  const reader=response.body.getReader();const parts=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw new Error('Response too large');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return new TextDecoder().decode(bytes);
}
const page = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Explore topics with Exa search."><title>Signal Garden</title>
<style>
/* Minimalist preset: plain single-column document; no cards, colors, or badges. */
*{box-sizing:border-box}body{margin:0;background:white;color:#222;font:15px/1.6 Arial,Helvetica,sans-serif}.shell{max-width:680px;margin:48px auto;padding:0 22px}a{color:inherit;text-decoration:underline;text-underline-offset:2px}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}button:disabled,select:disabled{opacity:.5;cursor:default}button{background:none;border:0;padding:0;text-decoration:underline;text-underline-offset:2px}button:hover,a:hover{text-decoration-thickness:2px}:focus-visible{outline:2px solid currentColor;outline-offset:4px}header{display:flex;align-items:baseline;gap:16px;margin-bottom:26px}header h1{font-size:22px;font-weight:600;line-height:1.3;margin:0}.spacer{flex:1}header button{font-size:13px}.searchbox{display:flex;gap:14px;align-items:center;margin:0 0 16px}#topic{width:100%;min-width:0;flex:1;border:0;border-bottom:1px solid #aaa;padding:5px 0;background:white;border-radius:0}#explore{white-space:nowrap}.notice{margin:0 0 20px;font-size:13px}.error{font-weight:bold}.mainbar{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 25px}.tabs{display:flex;gap:17px}.tab{text-decoration:none}.tab.active{font-weight:bold;text-decoration:underline}.mainbar label,.mainbar select{font-size:12px}.mainbar select{border:0;background:white;padding:0;max-width:95px}.resultshead{display:flex;align-items:baseline;gap:16px}.resultshead h2{font-size:16px;font-weight:normal;margin:0}.sub{font-size:12px;color:#555}#resultsub{margin-top:3px}#resultcount{margin-left:auto;white-space:nowrap;font-size:12px}.cards{display:block}.card{position:relative;margin:26px 0;padding:0;border:0;background:none;box-shadow:none}.cardmeta{font-size:12px;color:#555;padding-right:60px}.siteicon{display:none}.card h3{font-size:16px;line-height:1.4;font-weight:normal;margin:3px 0 7px}.card p{font-size:14px;line-height:1.6;margin:0 0 5px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;color:#333}.cardfoot{font-size:12px;color:#555}.read{display:none}.save{position:absolute;right:0;top:0;font-size:12px}.save.saved{font-weight:bold}.workspace{display:block}aside{margin-top:38px}summary{cursor:pointer;text-decoration:underline;font-size:14px}.asideintro{font-size:12px;color:#555;margin:13px 0}.empty{font-size:13px;margin:15px 0}.saveditem{margin:14px 0}.saveditem a{font-size:14px}.saveditem small{display:block;font-size:12px;color:#555}.remove{float:right}.noteslabel{display:block;font-size:13px;margin:20px 0 5px}textarea{display:block;width:100%;min-height:80px;padding:7px;border:1px solid #aaa;border-radius:0;background:white;resize:vertical;font-size:14px}#export{font-size:13px;margin-top:10px}footer{margin-top:40px;font-size:12px;color:#555}dialog{background:white;color:#222;border:1px solid #aaa;border-radius:0;box-shadow:none;max-width:410px;width:calc(100% - 32px);padding:24px}dialog::backdrop{background:#0003}dialog h2{font-size:18px;margin:0 0 15px!important}dialog p{font-size:13px}dialog input{width:100%;margin:8px 0;padding:6px;border:1px solid #aaa;border-radius:0}dialog .actions{display:flex;justify-content:flex-end;gap:18px;margin-top:20px}.toast{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);font-size:13px;background:white;padding:4px 10px;color:#222}.hidden{display:none!important}#status{font-size:13px;color:#555}#status:empty{display:none}.loader{margin:25px 0;font-size:14px}@media(max-width:520px){.shell{margin:24px auto;padding:0 18px}.mainbar{gap:10px}.mainbar .spacer{display:none}.tabs{width:100%;margin-bottom:4px}.resultshead{gap:8px}header h1{font-size:20px}}
</style></head><body><div class="shell">
<header><h1>Signal Garden</h1><span class="spacer"></span><span id="mode" class="hidden"></span><button id="connect">Connect Exa</button></header>

<form id="searchform" class="searchbox"><input id="topic" aria-label="Topic to explore" placeholder="Enter a topic" maxlength="600" minlength="3" required value="Regenerative economics"><button class="btn primary" id="explore" type="submit">Explore </button></form>

<div id="humancheck"></div><div id="status" role="status" aria-live="polite"></div>
<div class="workspace"><main id="main"><div class="notice" id="notice"><span id="noticecopy">Sample results. Connect Exa to search.</span><button id="noticeaction" class="hidden">Connect for live search</button></div>
<div class="mainbar"><div class="tabs" role="tablist" aria-label="Discovery lens"><button class="tab active" role="tab" aria-selected="true" data-lens="research">Research</button><button class="tab" role="tab" aria-selected="false" data-lens="practice">In the wild</button><button class="tab" role="tab" aria-selected="false" data-lens="counterpoints">Counterpoints</button></div><span class="spacer"></span><label class="sub" for="period">Published</label><select id="period"><option value="all">Any time</option><option value="year">Past year</option><option value="month">Past 30 days</option></select></div>
<div class="resultshead"><div><h2 id="resulttitle">Regenerative economics</h2><div class="sub" id="resultsub">Curated sample sources.</div></div><span class="pill" id="resultcount">4 sources</span></div><div class="cards" id="cards" role="tabpanel" aria-label="Discovery results"></div></main>
<aside><details><summary>Saved sources (<span id="savedcount">0</span>)</summary><p class="asideintro">Stored in this browser.</p><div id="saved"></div><label class="noteslabel" for="notes">Notes</label><textarea id="notes" placeholder="Add notes"></textarea><button class="btn" id="export">Export reading list</button></details></aside></div>
<footer><a href="https://exa.ai" target="_blank" rel="noopener noreferrer">Search powered by Exa</a></footer></div>
<dialog id="keydialog" aria-labelledby="keytitle"><form id="keyform"><h2 id="keytitle" style="margin-top:16px">Connect Exa</h2><p>Use your Exa API key to search the live web. Your key stays in page memory until you reload or disconnect. It passes through this app's server to Exa and is never saved or logged by the app.</p><label for="apikey" class="sub">Exa API key</label><input id="apikey" type="password" autocomplete="off" placeholder="Paste your Exa API key" minlength="8" maxlength="256" required><p>Each lens search makes one Exa request and uses your account credits. <a class="smalllink" href="https://dashboard.exa.ai/api-keys" target="_blank" rel="noopener noreferrer">Get an API key</a></p><div class="actions"><button type="button" class="btn" id="cancelkey">Cancel</button><button class="btn primary" type="submit">Connect Exa</button></div></form></dialog><div id="toast" class="toast hidden" role="status"></div>
<script>
(function(){
'use strict';
const $=s=>document.querySelector(s);
const serverConfigured = false;
const publicSearch = false;
const turnstileSitekey = "";
let turnstileToken='', turnstileWidget;
const connected=()=>Boolean(apiKey || serverConfigured);
const demo={research:[
{title:'An economy designed to regenerate',url:'https://capitalinstitute.org/',author:'Capital Institute',highlights:['Sample guide: a starting point for exploring regenerative economics and its underlying principles.']},
{title:'What if the economy had a different goal?',url:'https://doughnuteconomics.org/',author:'Doughnut Economics Action Lab',highlights:['Sample guide: explore an economic framework organized around meeting human needs within planetary boundaries.']},
{title:'The rules behind shared resources',url:'https://www.nobelprize.org/prizes/economic-sciences/2009/ostrom/facts/',author:'Nobel Prize',highlights:['Sample guide: begin with Elinor Ostrom’s work on economic governance and the commons.']},
{title:'A library for systems thinkers',url:'https://donellameadows.org/',author:'Donella Meadows Project',highlights:['Sample guide: a collection of writing about systems, feedback loops, and changing how we understand the world.']}
],practice:[
{title:'Bringing the doughnut into the city',url:'https://doughnuteconomics.org/',author:'Doughnut Economics Action Lab',highlights:['Sample guide: look for examples of communities applying Doughnut Economics in practice.']},
{title:'What cooperative ownership can look like',url:'https://www.mondragon-corporation.com/en/',author:'MONDRAGON',highlights:['Sample guide: explore a long-running federation of cooperatives as a real-world ownership model.']},
{title:'A community building its own economy',url:'https://cwb.org.uk/',author:'Centre for Local Economic Strategies',highlights:['Sample guide: explore community wealth building and approaches to keeping more value in local places.']}
],counterpoints:[
{title:'Where does economic growth fit?',url:'https://ourworldindata.org/economic-growth',author:'Our World in Data',highlights:['Sample guide: use data on economic growth to frame questions and tradeoffs when evaluating alternative economic models.']},
{title:'What the evidence can—and cannot—tell us',url:'https://www.ipcc.ch/report/ar6/wg3/',author:'IPCC',highlights:['Sample guide: consult the mitigation assessment for evidence and uncertainties around development, demand, and climate responses.']}
]};
let apiKey='',lens='research',results=demo.research,cache=new Map(),busy=false,live=false,query='Regenerative economics',saved=[],notes='',toastTimer;
try{const stored=JSON.parse(localStorage.getItem('signal-garden-v1')||'{}');saved=Array.isArray(stored.saved)?stored.saved.filter(r=>r&&typeof r.title==='string'&&safeURL(r.url)).slice(0,100):[];notes=typeof stored.notes==='string'?stored.notes:'';}catch{}
$('#notes').value=notes;
function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function host(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return 'Source';}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),3000);}
function persist(){try{localStorage.setItem('signal-garden-v1',JSON.stringify({saved,notes:$('#notes').value}));}catch{toast('Browser storage is unavailable. Export to keep your collection.');}}
function toggleSave(r){const found=saved.some(x=>x.url===r.url);if(found)saved=saved.filter(x=>x.url!==r.url);else{if(saved.length>=100)return toast('Your collection is full. Export it before adding more.');saved.push({...r,sample:!live});}persist();render();renderSaved();toast(found?'Source removed':'Source saved.');}
function render(){
 const root=$('#cards');root.replaceChildren();
 $('#resulttitle').textContent=live?query:(lens==='research'?'Regenerative economics':lens==='practice'?'Projects':'Counterpoints');
 $('#resultsub').textContent=live?({research:'Research and explanations',practice:'Projects and implementations',counterpoints:'Critiques and alternative perspectives'}[lens])+' · Exa web results': 'Sample results';
 $('#resultcount').textContent=results.length+' source'+(results.length===1?'':'s');
 if(!results.length){root.append(el('div','loader','No sources found. Try a broader topic or a different publication window.'));return;}
 results.forEach((r,i)=>{const card=el('article','card');const meta=el('div','cardmeta');meta.append(el('span','siteicon',host(r.url).charAt(0).toUpperCase()),el('span','',host(r.url)));
 const save=el('button','save'+(saved.some(x=>x.url===r.url)?' saved':''),saved.some(x=>x.url===r.url)?'Saved':'Save');save.setAttribute('aria-label',(saved.some(x=>x.url===r.url)?'Remove ':'Save ')+r.title);save.setAttribute('aria-pressed',String(saved.some(x=>x.url===r.url)));save.onclick=()=>toggleSave(r);
 const heading=el('h3'),a=el('a','',r.title);a.href=safeURL(r.url);a.target='_blank';a.rel='noopener noreferrer';heading.append(a);
 const excerpt=el('p','',r.highlights?.join(' ')||'No excerpt returned. Open the source to read more.');const foot=el('div','cardfoot');let date='';if(r.publishedDate){const d=new Date(r.publishedDate);if(!isNaN(d))date=d.toLocaleDateString(undefined,{year:'numeric',month:'short'});}foot.append(el('span','',live?(date||'Date unavailable'):'Curated example'));const link=el('a','read','Read source');link.href=safeURL(r.url);link.target='_blank';link.rel='noopener noreferrer';foot.append(link);card.append(meta,save,heading,excerpt,foot);root.append(card);});
}
function renderSaved(){const root=$('#saved');root.replaceChildren();$('#savedcount').textContent=saved.length;if(!saved.length){const empty=el('div','empty');empty.append(document.createTextNode('No saved sources.'));root.append(empty);}saved.forEach(r=>{const row=el('div','saveditem'),remove=el('button','remove','×');remove.setAttribute('aria-label','Remove '+r.title);remove.onclick=()=>toggleSave(r);const a=el('a','',r.title);a.href=safeURL(r.url);a.target='_blank';a.rel='noopener noreferrer';row.append(remove,a,el('small','',host(r.url)+(r.sample?' · Sample':'')));root.append(row);});}
function setBusy(value){busy=value;$('#explore').disabled=value;$('#explore').textContent=value?'Searching…':'Explore';document.querySelectorAll('.tab,#period,.chip,#connect,#noticeaction').forEach(n=>n.disabled=value);$('#main').setAttribute('aria-busy',String(value));}
function mode(){const isConnected=connected();$('#connect').classList.toggle('hidden',publicSearch);$('#mode').textContent=apiKey?'Personal key connected':serverConfigured?'Server key configured':'Sample';$('#connect').textContent=apiKey?'Disconnect key':serverConfigured?'Use another key':'Connect Exa';$('#period').disabled=!isConnected;$('#noticecopy').textContent=live?'Results from Exa.':isConnected?'Explore a topic to search the web.':'Sample results. Connect Exa to search.';$('#noticeaction').textContent=isConnected?'Search this topic':'Connect Exa';if(publicSearch)$('#noticecopy').textContent=isConnected?'Human check required. 5 searches per IP daily; 100 sponsored searches total.':'Sponsored search is paused.';}
async function search(){if(busy)return;const value=$('#topic').value.trim();if(value.length<3)return toast('Give your topic at least three characters.');if(!connected()){if(publicSearch)return toast('Sponsored search is paused.');$('#keydialog').showModal();return;}
 query=value;const key=JSON.stringify([query,lens,$('#period').value]);$('#notice').classList.remove('error');
 if(cache.has(key)){results=cache.get(key);live=true;render();mode();$('#status').textContent='Showing results from this session.';return;}
 if(publicSearch && !turnstileToken)return toast('Complete the human check first.');
 setBusy(true);$('#status').textContent='Following the '+(lens==='practice'?'real-world':lens)+' thread…';
 try{const response=await fetch('/signal-garden/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,lens,period:$('#period').value,apiKey,requestId:crypto.randomUUID(),turnstileToken}),signal:AbortSignal.timeout(35000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Search could not complete.');results=data.results;cache.set(key,results);live=true;render();mode();$('#status').textContent='Found '+results.length+' sources.'+(typeof data.cost==='number'?' Reported Exa cost: $'+data.cost.toFixed(4)+'.':'');}
 catch(error){results=[];live=true;render();$('#notice').classList.add('error');$('#noticecopy').textContent=error.name==='TimeoutError'?'The search took too long. Try again.':error.message;$('#status').textContent='Search failed. Adjust your topic or connection and try again.';}
 finally{setBusy(false);$('#period').disabled=!connected();if(publicSearch){turnstileToken='';if(turnstileWidget!==undefined&&window.turnstile)window.turnstile.reset(turnstileWidget);}}
}
$('#searchform').onsubmit=e=>{e.preventDefault();search();};
$('#connect').onclick=()=>{if(apiKey){apiKey='';cache.clear();live=false;results=demo[lens];$('#status').textContent='Disconnected. Your key has been cleared from this page.';mode();render();}else $('#keydialog').showModal();};
$('#noticeaction').onclick=()=>connected()?search():$('#keydialog').showModal();$('#cancelkey').onclick=()=>$('#keydialog').close();$('#keydialog').addEventListener('close',()=>{$('#apikey').value='';});
$('#keyform').onsubmit=e=>{e.preventDefault();apiKey=$('#apikey').value.trim();$('#keydialog').close();mode();toast('Exa connected. Starting your first search.');search();};
document.querySelectorAll('[data-topic]').forEach(n=>n.onclick=()=>{$('#topic').value=n.dataset.topic;search();});
document.querySelectorAll('[data-lens]').forEach(n=>n.onclick=()=>{lens=n.dataset.lens;document.querySelectorAll('[data-lens]').forEach(t=>{t.classList.toggle('active',t===n);t.setAttribute('aria-selected',String(t===n));});if(publicSearch)showSelected();else if(connected())search();else{results=demo[lens];render();}});
function showSelected(){const key=JSON.stringify([$('#topic').value.trim(),lens,$('#period').value]);live=true;query=$('#topic').value.trim();results=cache.get(key)||[];render();$('#status').textContent=cache.has(key)?'Showing saved results from this session.':'Click Explore to search this view.';}
$('#period').onchange=()=>publicSearch?showSelected():search();$('#notes').oninput=persist;
function md(s){return String(s||'').replace(/[\\\[\]*_<>#]/g,'\\$&').replace(/[\r\n]+/g,' ');}
$('#export').onclick=()=>{if(!saved.length&&!$('#notes').value.trim())return toast('Save a source or add a thought first.');const text='# Signal Garden — Reading list\n\nExported '+new Date().toISOString().slice(0,10)+'\n\n'+($('#notes').value.trim()?'## Notes\n\n'+$('#notes').value.trim()+'\n\n':'')+'## Sources\n\n'+saved.map(r=>'- ['+md(r.title)+']('+r.url.replace(/\(/g,'%28').replace(/\)/g,'%29')+')'+(r.sample?' — curated sample':'')+'\n  '+md(r.highlights?.join(' ')||'')).join('\n\n')+'\n';const objectURL=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=el('a');a.href=objectURL;a.download='signal-garden-reading-list.md';a.click();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);toast('Your reading list is ready.');};
render();renderSaved();mode();
if(publicSearch&&serverConfigured){window.signalGardenTurnstileLoaded=()=>{turnstileWidget=window.turnstile.render('#humancheck',{sitekey:turnstileSitekey,action:'signal_garden_search',theme:'light',callback:token=>{turnstileToken=token;},'expired-callback':()=>{turnstileToken='';},'error-callback':()=>{turnstileToken='';$('#status').textContent='Human verification could not load. Reload to try again.';}});};const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=signalGardenTurnstileLoaded&render=explicit';script.async=true;script.defer=true;document.head.append(script);}
})();
</script></body></html>`;
