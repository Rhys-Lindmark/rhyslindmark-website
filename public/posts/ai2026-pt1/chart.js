(async()=>{
'use strict';
const story=document.getElementById('story'),chart=document.getElementById('chart'),svg=document.getElementById('plot'),button=document.getElementById('overview');
const ns='http://www.w3.org/2000/svg',reduce=matchMedia('(prefers-reduced-motion: reduce)');
let data,full=reduce.matches,raf=0,geometry,clip,cursor,dynamic=[];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function el(tag,attrs={},parent=svg,text){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;parent.appendChild(node);return node;}
function state(){const top=story.getBoundingClientRect().top;const span=story.offsetHeight-document.querySelector('.stage').offsetHeight;const p=clamp(-top/span,0,1);const knots=[[0,1971],[.29,1990],[.59,2007],[.84,2022],[1,2026]];let year=2026;for(let i=1;i<knots.length;i++){if(p<=knots[i][0]){const [a,ay]=knots[i-1],[b,by]=knots[i];year=ay+(by-ay)*(p-a)/(b-a);break;}}return {p,year:full?2026:year};}
function draw(){
 const W=chart.clientWidth,H=chart.clientHeight,small=W<540,m={l:small?44:62,r:small?37:52,t:32,b:small?43:48},iw=W-m.l-m.r,ih=H-m.t-m.b;
 if(iw<=0||ih<=0)return;
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.replaceChildren();
 el('title',{id:'chart-title'},svg,'Profit & Margins Across Tech Eras');el('desc',{id:'chart-desc'},svg,'Solid lines are net profits in billions of 2026 dollars, on the logarithmic left axis. Dashed lines are estimated average operating margins on the right axis.');
 const x=year=>m.l+(year-1970)/56*iw,yp=p=>m.t+ih*(1-Math.log(p/2)/Math.log(450/2)),ym=p=>m.t+ih*(1-p/60);geometry={x,yp,ym,m,iw,ih,W,H};
 const defs=el('defs');clip=el('rect',{x:m.l,y:m.t,width:0,height:ih},el('clipPath',{id:'timeline-clip'},defs));
 el('rect',{x:m.l,y:m.t,width:iw,height:ih,fill:'none',stroke:'#334351'});
 for(const y of [3,10,30,100,300]){el('line',{x1:m.l,x2:m.l+iw,y1:yp(y),y2:yp(y),stroke:'#22313d','stroke-width':.7});el('text',{x:m.l-8,y:yp(y)+4,'text-anchor':'end'},svg,`$${y}B`);}
 for(const y of [0,10,20,30,40,50,60])el('text',{x:m.l+iw+7,y:ym(y)+4},svg,`${y}%`);
 const years=small?[1970,1990,2010,2026]:[1970,1980,1990,2000,2010,2020,2026];
 for(const y of years){el('line',{x1:x(y),x2:x(y),y1:m.t,y2:m.t+ih,stroke:'#22313d','stroke-width':.6});el('text',{x:x(y),y:m.t+ih+19,'text-anchor':y===1970?'start':y===2026?'end':'middle'},svg,`${y}`);}
 el('text',{class:'axis-title',x:m.l,y:14},svg,small?'NET PROFIT · LOG':'NET PROFIT · 2026 $B (LOG)');el('text',{class:'axis-title',x:W-m.r,y:14,'text-anchor':'end'},svg,small?'AVG. OP. MARGIN':'AVG. OPERATING MARGIN');
 el('text',{class:'axis-title',x:m.l+iw/2,y:H-5,'text-anchor':'middle'},svg,'FISCAL YEAR');
 const marks=el('g',{'clip-path':'url(#timeline-clip)'});dynamic=[];
 for(const s of data.series){
  const d=s.data.map((p,i)=>`${i?'L':'M'}${x(p.year)},${yp(p.profit)}`).join(' ');
  el('path',{d,class:'profit',stroke:s.color,'data-series':s.id},marks);
  el('line',{x1:x(s.start),x2:x(s.end),y1:ym(s.avgOperatingMargin),y2:ym(s.avgOperatingMargin),stroke:s.color,class:'avg'},marks);
  const label=el('text',{class:'margin-label',x:s.id==='NVIDIA'?x(s.end)-3:(x(s.start)+x(s.end))/2,y:ym(s.avgOperatingMargin)+(s.id==='NVIDIA'?17:-8),'text-anchor':s.id==='NVIDIA'?'end':'middle'},svg,`${s.id} ${s.avgOperatingMargin}%`);
  const dot=el('circle',{r:3.4,fill:s.color,stroke:'#0b1015','stroke-width':1.5},svg);
  dynamic.push({s,label,dot});
 }
 cursor=el('line',{y1:m.t,y2:m.t+ih,stroke:'#8fb1c7','stroke-width':1,'stroke-dasharray':'2 5',opacity:.6},svg);
 update();
}
function update(){
 raf=0;if(!geometry)return;const {p,year}=state(),{x,yp,iw,m}=geometry;
 clip.setAttribute('width',clamp(x(year)-m.l+1,0,iw));cursor.setAttribute('x1',x(year));cursor.setAttribute('x2',x(year));cursor.style.display=full||p===1?'none':'';
 document.getElementById('year-readout').textContent=full?'FULL TIMELINE':`FY ${Math.floor(year)}`;
 document.getElementById('progress-fill').style.width=`${p*100}%`;svg.dataset.year=year.toFixed(3);
 for(const {s,label,dot} of dynamic){
  label.style.opacity=year>=s.start+Math.min(2,(s.end-s.start)*.25)?'1':'0';
  const exists=year>=s.start;dot.style.display=exists?'':'none';if(!exists)continue;
  const yr=Math.min(year,s.end);let value=s.data.at(-1).profit;
  for(let i=1;i<s.data.length;i++){const a=s.data[i-1],b=s.data[i];if(yr<=b.year){const f=clamp((yr-a.year)/(b.year-a.year),0,1);value=Math.exp(Math.log(a.profit)+(Math.log(b.profit)-Math.log(a.profit))*f);break;}}
  dot.setAttribute('cx',x(yr));dot.setAttribute('cy',yp(value));
 }
}
function requestUpdate(){if(!raf)raf=requestAnimationFrame(update);}
function syncButton(){button.setAttribute('aria-pressed',String(full));button.textContent=full?'Follow scrolling':'Show full chart';}
button.addEventListener('click',()=>{full=!full;syncButton();update();});
reduce.addEventListener('change',()=>{full=reduce.matches;syncButton();update();});
try{const response=await fetch('/posts/ai2026-pt1/data.json');if(!response.ok)throw new Error('Data unavailable');data=await response.json();
 const table=document.createElement('table');table.innerHTML='<thead><tr><th scope="col">Era</th><th scope="col">Fiscal year</th><th scope="col">Net profit (2026 $B)</th></tr></thead>';const tbody=document.createElement('tbody');
 for(const s of data.series)for(const p of s.data){const row=document.createElement('tr');for(const v of [s.id,p.year,p.profit.toFixed(3)]){const cell=document.createElement('td');cell.textContent=String(v);row.appendChild(cell);}tbody.appendChild(row);}table.appendChild(tbody);document.getElementById('data-table').appendChild(table);
 syncButton();new ResizeObserver(draw).observe(chart);window.addEventListener('scroll',requestUpdate,{passive:true});window.addEventListener('resize',requestUpdate,{passive:true});draw();
}catch(error){document.getElementById('load-error').hidden=false;button.disabled=true;console.error(error);}
})();
