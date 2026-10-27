const $ = id => document.getElementById(id);
const cases = [
  ['The pilot reduced average response time by 20%.', 'In a four-week pilot with 30 support agents, average response time fell from 10 minutes to 8 minutes. Customer satisfaction was unchanged. The pilot did not measure longer-term effects.'],
  ['Working remotely causes people to be more productive.', 'A survey of 500 employees found that remote workers reported higher productivity than office workers. Participants chose their own work arrangement. The study did not randomly assign work locations or measure output independently.'],
  ['The program doubled participation in its first year.', 'The program enrolled 200 participants before launch and 240 participants at the end of its first year, an increase of 20%.']
];
const names = { supported: 'Supported', contradicted: 'Contradicted', insufficient: 'Insufficient evidence' };
let last = null;
const pct = n => `${Math.round(n * 100)}%`;
function counts() { for (const [id,max] of [['claim',1500],['evidence',10000]]) $(id+'-count').textContent = `${$(id).value.length.toLocaleString()} / ${max.toLocaleString()}`; }
function reset() { last=null; $('output').hidden=true; $('empty').hidden=false; $('status').textContent=''; $('error').hidden=true; }
for(const id of ['claim','evidence']) $(id).addEventListener('input',()=>{counts();reset();});
for(const button of document.querySelectorAll('[data-example]')) button.addEventListener('click',()=>{const c=cases[Number(button.dataset.example)];$('claim').value=c[0];$('evidence').value=c[1];counts();reset();$('claim').focus();});
$('clear').addEventListener('click',()=>{$('claim').value='';$('evidence').value='';counts();reset();$('claim').focus();});
let widgetId, verificationToken = '', busy = false;
window.jevTurnstileReady = () => {
  widgetId = window.turnstile.render('#human-check', {
    sitekey: '0x4AAAAAAFoxX_DwyD2--6xP', action: 'jev_check', theme: 'light',
    callback: token => { verificationToken = token; $('run').disabled = busy || !token; },
    'expired-callback': () => { verificationToken = ''; $('run').disabled = true; },
    'error-callback': () => { verificationToken = ''; $('run').disabled = true; $('error').textContent = 'Human verification unavailable. Reload to try again.'; $('error').hidden = false; }
  });
};
const verificationScript = document.createElement('script');
verificationScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=jevTurnstileReady&render=explicit';
verificationScript.async = true;
verificationScript.onerror = () => { $('error').textContent = 'Human verification unavailable. Reload to try again.'; $('error').hidden = false; };
document.head.append(verificationScript);
$('check-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!verificationToken){$('error').textContent='Complete the human verification.';$('error').hidden=false;return;}
  const claim=$('claim').value.trim(), evidence=$('evidence').value.trim();
  reset();busy=true;$('run').disabled=true;document.querySelector('.results').setAttribute('aria-busy','true');$('status').textContent='Checking…';
  for(const el of document.querySelectorAll('textarea, [data-example], #clear')) el.disabled=true;
  try{
    const response=await fetch('/api/jev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claim,evidence,verification_token:verificationToken}),signal:AbortSignal.timeout(45000)});
    let data;try{data=await response.json();}catch{throw new Error('The server returned an unreadable response. Please try again.');}
    if(!response.ok)throw new Error(data.error||'The check failed. Please try again.');
    last={claim,evidence,...data};$('empty').hidden=true;$('output').hidden=false;$('status').textContent='';$('verdict').textContent=names[data.verdict];
    $('bars').replaceChildren();
    for(const [id,label] of Object.entries(names)){
      const row=document.createElement('div');row.className='bar-row';const line=document.createElement('div');line.className='bar-label';const title=document.createElement('span');title.textContent=label;const amount=document.createElement('span');amount.textContent=pct(data.probabilities[id]);line.append(title,amount);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=pct(data.probabilities[id]);track.append(fill);row.append(line,track);$('bars').append(row);
    }
    $('direct').textContent=pct(data.direct);$('overreach').textContent=pct(data.overreach);$('confidence').textContent=data.confidence===null?'Not provided':pct(data.confidence);$('meta').textContent=`${data.model} · ${(data.elapsed_ms/1000).toFixed(2)}s`;
  }catch(error){$('error').textContent=error.name==='TimeoutError'?'The request timed out. Please try again.':error.message;$('error').hidden=false;$('status').textContent='';}
  finally{busy=false;verificationToken='';$('run').disabled=true;if(widgetId!==undefined)window.turnstile.reset(widgetId);document.querySelector('.results').setAttribute('aria-busy','false');for(const el of document.querySelectorAll('textarea, [data-example], #clear'))el.disabled=false;}
});
$('copy').addEventListener('click',async()=>{if(!last)return;try{await navigator.clipboard.writeText(JSON.stringify(last,null,2));$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy result',1800);}catch{$('error').textContent='Clipboard access is unavailable in this browser.';$('error').hidden=false;}});
counts();
