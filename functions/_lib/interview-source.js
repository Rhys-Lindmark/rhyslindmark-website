export const dynamic = 'force-dynamic';
function publicUrl(raw        ) {
  let u     ; try { u=new URL(raw); } catch { throw new Error('Enter a complete https:// URL.'); }
  const h=u.hostname.toLowerCase();
  if (!['https:','http:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port)) || !h.includes('.') || /[:\[\]]/.test(h) || /^\d/.test(h) || /(?:^|\.)(localhost|local|internal|test|invalid|example)$/.test(h) || h.endsWith('.') || /(?:^|\.)(localtest\.me|lvh\.me|nip\.io|sslip\.io)$/.test(h)) throw new Error('Use a public website URL. Private addresses and non-web links are not supported.');
  return u;
}
function decode(text        ) { return text.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const p=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return p>0&&p<=0x10ffff?String.fromCodePoint(p):' ';}).replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—'}[n]||' ')); }
export function extract(html        ) {
  const title=decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]*>/g,'').trim();
  let body=html.replace(/<(script|style|noscript|svg|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  body=body.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2]||body;
  const text=decode(body.replace(/<!--[^]*?-->/g,' ').replace(/<\/(?:p|div|h[1-6]|li|section)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim().slice(0,24000);
  return {title,text};
}
export async function POST(request         ) {
  try {
    const raw=await request.text(); if(raw.length>5000) return Response.json({error:'The URL is too long.'},{status:413});
    let data; try {data=JSON.parse(raw);} catch {throw new Error('Enter a valid URL.');}
    let url=publicUrl(typeof data.url==='string'?data.url:'');
    let response                      ;
    const signal=AbortSignal.timeout(12000);
    for(let i=0;i<5;i++) {
      response=await fetch(url,{redirect:'manual',signal,headers:{Accept:'text/html,text/plain','User-Agent':'InterviewPrep/1.0'}});
      if([301,302,303,307,308].includes(response.status)) {const location=response.headers.get('location');await response.body?.cancel();if(!location) throw new Error('The page redirected without a destination.');url=publicUrl(new URL(location,url).href);response=undefined;continue;} break;
    }
    if(!response) throw new Error('This page has too many redirects. Paste its text instead.');
    if(!response.ok) {await response.body?.cancel();throw new Error('This site could not be read. Paste its text instead.');}
    const type=response.headers.get('content-type')||'';
    if(!/text\/(html|plain)|application\/xhtml\+xml/i.test(type)) {await response.body?.cancel();throw new Error('Use a web page or paste the text. PDFs and other file types are not supported.');}
    const reader=response.body?.getReader(); if(!reader) throw new Error('This page has no readable text.');
    let size=0; const chunks              =[];
    while(true) {const {value,done}=await reader.read();if(done) break;size+=value.length;if(size>1500000){await reader.cancel();throw new Error('This page is too large. Paste the relevant text instead.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=new TextDecoder().decode(bytes); const result=type.includes('text/plain')?{title:url.hostname,text:body.slice(0,24000)}:extract(body);
    if(result.text.length<80) throw new Error('There is too little readable text. This page may need sign-in or JavaScript; paste its text instead.');
    return Response.json({...result,url:url.href},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { const message=error instanceof Error?error.message:'';return Response.json({error:/timeout|aborted|fetch failed/i.test(message)?'The site did not respond. Try again or paste its text.':message||'Could not read this page. Paste its text instead.'},{status:400,headers:{'Cache-Control':'no-store'}}); }
}
