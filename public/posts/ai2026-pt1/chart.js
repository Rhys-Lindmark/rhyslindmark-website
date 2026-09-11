(async()=>{
'use strict';
const NS='http://www.w3.org/2000/svg',root=document.getElementById('article'),button=document.getElementById('overview'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),scenes=[...document.querySelectorAll('.scene')];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
let data,all=reduce.matches,raf=0;const renderers=new Map();
const colors={'AI supply chain':'#35e7ff','GAFA':'#ffe84a','Wintel':'#b985ff','IBM':'#ff70de','Model labs':'#63ff91','Apps':'#ffe84a','Foundation models':'#39ffc1','Hosting':'#b985ff','Chips':'#63ff91'};
function node(tag,attrs={},parent,text){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
function label(parent,x,y,text,anchor='start',cls=''){return node('text',{x,y,'text-anchor':anchor,class:cls},parent,text);}
function svgBase(scene){const svg=scene.querySelector('svg'),r=scene.querySelector('.plot-wrap').getBoundingClientRect(),W=Math.max(280,r.width),H=Math.max(250,r.height);svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);node('title',{},svg,scene.querySelector('h3').textContent);return {svg,W,H,small:W<600};}
function legend(scene,series){const l=scene.querySelector('.legend');l.replaceChildren();for(const s of series){const span=document.createElement('span'),i=document.createElement('i');i.style.setProperty('--color',s.color);span.style.setProperty('--color',s.color);if(s.forecast)i.style.borderTopStyle='dashed';span.append(i,document.createTextNode(s.name));l.appendChild(span);}}
function revealLegend(scene,visible){[...scene.querySelectorAll('.legend span')].forEach((el,i)=>{const show=all||visible(i);el.classList.toggle('pending',!show);el.setAttribute('aria-hidden',String(!show));});}
function verticalTitle(svg,x,y,text,right=false){const title=label(svg,x,y,text,'middle','axis-title');title.setAttribute('transform',`rotate(${right?90:-90} ${x} ${y})`);return title;}
function axes(svg,W,H,{xd,yd,xt,yt,yfmt=v=>v,xfmt=v=>v,log=false,right=false,yTitle='',xTitle='YEAR'}){const small=W<600,m={l:small?32:80,r:right?(small?32:74):(small?4:16),t:20,b:42},iw=W-m.l-m.r,ih=H-m.t-m.b,x=v=>m.l+(v-xd[0])/(xd[1]-xd[0])*iw,y=v=>m.t+ih*(1-(log?Math.log(v/yd[0])/Math.log(yd[1]/yd[0]):(v-yd[0])/(yd[1]-yd[0])));
 node('rect',{x:m.l,y:m.t,width:iw,height:ih,fill:'none',stroke:'#334351'},svg);
 yt.forEach(v=>{node('line',{x1:m.l,x2:m.l+iw,y1:y(v),y2:y(v),stroke:'#263744','stroke-width':.7},svg);label(svg,m.l-(small?3:7),y(v)+4,yfmt(v),'end','axis-tick');});
 xt.forEach((v,i)=>{node('line',{x1:x(v),x2:x(v),y1:m.t,y2:m.t+ih,stroke:'#263744','stroke-width':.6},svg);label(svg,x(v),m.t+ih+18,xfmt(v),i===0?'start':i===xt.length-1?'end':'middle');});
 verticalTitle(svg,small?5:12,m.t+ih/2,yTitle);label(svg,m.l+iw/2,H-3,xTitle,'middle','axis-title');return {m,iw,ih,x,y};}
function clipping(svg,id,m,ih){const defs=node('defs',{},svg),cp=node('clipPath',{id},defs),rect=node('rect',{x:m.l,y:m.t,width:0,height:ih},cp),g=node('g',{'clip-path':`url(#${id})`},svg);return {rect,g,defs};}
function linePath(points,x,y){return points.map((p,i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join(' ');}
function drawLines(scene){const {svg,W,H,small}=svgBase(scene),investment=scene.dataset.kind==='investment',series=investment?data.investment:data.construction,xd=investment?[1852,2030]:[2014,2026.5834],yd=investment?[0,6]:[0,80];
 const a=axes(svg,W,H,{xd,yd,xt:investment?(small?[1852,1900,1950,2000,2030]:[1852,1880,1910,1940,1970,2000,2030]):(small?[2014,2018,2022,2026.5834]:[2014,2016,2018,2020,2022,2024,2026.5834]),yt:investment?[0,1,2,3,4,5,6]:[0,20,40,60,80],yfmt:v=>investment?`${v}%`:`$${v}B`,xfmt:v=>v===2026.5834?'Aug 2026':String(Math.floor(v)),yTitle:investment?'CAPITAL EXPENDITURE / US GDP':'CONSTRUCTION SPENDING · $B'}),c=clipping(svg,`clip-${scene.dataset.step}`,a.m,a.ih);
 if(investment){node('rect',{x:a.x(1996),y:a.m.t,width:a.x(2002)-a.x(1996),height:a.ih,fill:'#b2a3d8',opacity:.07},c.g);}
 for(const s of series){node('path',{d:linePath(s.points,a.x,a.y),fill:'none',stroke:s.color,'stroke-width':2,'stroke-dasharray':s.forecast?(s.name.includes('bull')?'2 5':'7 4'):'none','stroke-linejoin':'round'},c.g);}
 if(!investment){for(const s of series){node('path',{d:linePath(s.projection,a.x,a.y),fill:'none',stroke:s.color,'stroke-width':2},c.g);}const x=a.x(2022+10/12);node('line',{x1:x,x2:x,y1:a.m.t,y2:a.m.t+a.ih,stroke:'#9db2c3','stroke-width':1,'stroke-dasharray':'3 5'},c.g);label(c.g,x-5,a.m.t+18,'ChatGPT','end','series-label');}
 const cursor=node('line',{y1:a.m.t,y2:a.m.t+a.ih,stroke:'#90abc0','stroke-dasharray':'2 5',opacity:.6},svg);legend(scene,series);
 return p=>{const t=clamp(.035+p/.84),year=lerp(...xd,t),x=a.x(year);c.rect.setAttribute('width',Math.min(a.iw,x-a.m.l+1));cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);cursor.style.opacity=t===1?0:.6;revealLegend(scene,i=>year>=(series[i]?.points[0][0]??series[0].projection[0][0]));scene.querySelector('.readout').textContent=String(Math.floor(year));};}
function drawChips(scene){const {svg,W,H,small}=svgBase(scene),q=data.chips.quarters,groups=data.chips.groups,a=axes(svg,W,H,{xd:[0,q.length],yd:[0,26],xt:small?[.5,4.5,8.5]:q.map((_,i)=>i+.5),yt:[0,5,10,15,20,25],xfmt:v=>q[Math.floor(v)].label,yfmt:v=>`${v}M`,yTitle:'CUMULATIVE COMPUTE · MILLION H100e',xTitle:'QUARTER'}),c=clipping(svg,'clip-chips',a.m,a.ih),pat=node('pattern',{id:'incomplete',width:6,height:6,patternUnits:'userSpaceOnUse',patternTransform:'rotate(35)'},c.defs);node('line',{x1:0,x2:0,y1:0,y2:6,stroke:'#cbdce8','stroke-width':2,opacity:.55},pat);
 q.forEach((quarter,j)=>{let bottom=0;quarter.values.forEach((v,i)=>{if(!v)return;const attrs={x:a.x(j)+2,y:a.y(bottom+v),width:a.iw/q.length-4,height:a.y(bottom)-a.y(bottom+v)},bar=node('rect',{...attrs,fill:groups[i].color,'fill-opacity':.9},c.g);node('title',{},bar,`${quarter.label} · ${groups[i].name}: ${v.toFixed(2)}M H100e`);if(quarter.incomplete.includes(groups[i].name)||(j===8&&['Trainium1','Trainium2','Ascend 910B','Ascend 910C','Siyuan 590'].includes(groups[i].name)))node('rect',{...attrs,fill:'url(#incomplete)'},c.g);bottom+=v;});});
 legend(scene,groups);return p=>{const t=clamp(.07+p/.84);c.rect.setAttribute('width',a.iw*t);const qi=Math.min(q.length-1,Math.floor(t*q.length));revealLegend(scene,i=>q.some((quarter,j)=>j<=qi&&quarter.values[i]>0));scene.querySelector('.readout').textContent=q[qi].label;};}
function drawRevenue(scene){const {svg,W,H,small}=svgBase(scene),left=small?78:110,right=small?8:25,gap=small?18:50,pw=(W-left-right-gap)/2,top=45,bottom=35,rh=(H-top-bottom)/data.revenue.length,max=320;
 const bars=[];for(let panel=0;panel<2;panel++){const x0=left+panel*(pw+gap);label(svg,x0+pw/2,16,panel?'Q1 2026':'Q1 2024','middle','series-label');[0,100,200,300].filter(v=>!small||v===0||v===300).forEach(v=>{const x=x0+v/max*pw;node('line',{x1:x,x2:x,y1:top-8,y2:H-bottom,stroke:'#2c3d4a','stroke-width':.7},svg);label(svg,x,H-bottom+18,`$${v}B`,v===0?'start':v===300?'end':'middle');});
 data.revenue.forEach((d,i)=>{const y=top+i*rh;if(panel===0){const nameLabel=label(svg,left-9,y+rh*.58,d.name,'end');if(d.name==='NVIDIA'){nameLabel.style.fill=colors.Chips;nameLabel.style.fontWeight='700';}}const value=d.values[panel];if(value===null){label(svg,x0+3,y+rh*.58,'·');return;}const bar=node('rect',{x:x0,y:y+rh*.15,width:0,height:rh*.66,fill:colors[d.category],'fill-opacity':.9,stroke:colors[d.category],'stroke-width':.5},svg);node('title',{},bar,`${d.name}, ${panel?'2026':'2024'}: approx. $${value}B`);const valueLabel=null;bars.push({bar,panel,value,name:d.name,valueLabel});});}
 label(svg,left+(W-left-right)/2,H-1,'ANNUALIZED GenAI REVENUE · $B','middle','axis-title');legend(scene,[]);
 return p=>{const second=p>=.66;scene.querySelector('[data-passage="5"]').hidden=!all&&second;scene.querySelector('[data-passage="6"]').hidden=!all&&!second;scene.dataset.currentStep=second?'6':'5';for(const b of bars){const t=all?1:b.panel===0?clamp(.1+p/.27):clamp((p-.2)/.4);b.bar.setAttribute('width',b.value/max*pw*t);if(b.valueLabel){b.valueLabel.style.opacity=1;b.valueLabel.style.fontWeight='700';}b.bar.setAttribute('fill-opacity',b.name==='NVIDIA'?1:.22);b.bar.setAttribute('stroke-opacity',b.name==='NVIDIA'?1:.3);}scene.querySelector('.readout').textContent=second?'NVIDIA':p<.2?'Q1 2024':'Q1 2024 → Q1 2026';};}
function drawProfit(scene){const {svg,W,H,small}=svgBase(scene),margin=scene.dataset.kind==='margin',metric=margin?'margin':'profit',rows=data.profit.filter(d=>d.name!=='IBM'),left=small?82:130,right=small?55:100,top=32,bottom=36,iw=W-left-right,rh=(H-top-bottom)/rows.length,domain=margin?[0,80]:[0,290],x=v=>left+(v-domain[0])/(domain[1]-domain[0])*iw;
 const ticks=margin?[0,20,40,60]:[0,100,200];for(const t of ticks){node('line',{x1:x(t),x2:x(t),y1:top,y2:H-bottom,stroke:t===0?'#8097a9':'#2b3d4b','stroke-width':t===0?1:.7},svg);label(svg,x(t),top-12,margin?`${t}%`:`${t<0?'−':''}$${Math.abs(t)}B`,'middle');}
 const bars=[];rows.forEach((d,i)=>{const y=top+i*rh,val=d[metric],color=d.name==='NVIDIA'?'#63ff91':'#7293a9';const nameLabel=label(svg,left-9,y+rh*.58,d.name,'end');if(d.name==='NVIDIA'){nameLabel.style.fill=color;nameLabel.style.fontWeight='700';}if(d.name==='OpenAI'||d.name==='Anthropic'){label(svg,x(0)+4,y+rh*.58,'(private co)','start');return;}
 const bar=node('rect',{x:x(0),y:y+rh*.15,width:0,height:rh*.68,fill:color,'fill-opacity':.9,stroke:color,'stroke-width':.7},svg);node('title',{},bar,`${d.name}: ${val}${margin?'%':' billion dollars'}`);const txt=label(svg,val<0?x(val)+4:x(val)+6,y+rh*.58,`${val<0?'−':''}${margin?'':'$'}${Math.abs(val).toFixed(1)}${margin?'%':'B'}`,'start','value');bars.push({bar,txt,val});});
 label(svg,left+iw/2,H-2,margin?'OPERATING MARGIN (%)':'ANNUALIZED OPERATING PROFIT ($B)','middle','axis-title');legend(scene,[]);
 return p=>{const t=clamp(.03+p/.84);bars.forEach(({bar,txt,val})=>{const v=val*t;bar.setAttribute('x',Math.min(x(0),x(v)));bar.setAttribute('width',Math.abs(x(v)-x(0)));txt.style.opacity=t>.94?1:0;});scene.querySelector('.readout').textContent=margin?'GAAP / LATEST QUARTER':'LATEST QUARTER × 4';};}
function drawEras(scene){
 const {svg,W,H,small}=svgBase(scene),a=axes(svg,W,H,{xd:[1970,2026],yd:[2,450],xt:small?[1970,1990,2010,2026]:[1970,1980,1990,2000,2010,2020,2026],yt:[3,10,30,100,300],yfmt:v=>`$${v}B`,log:true,right:true,yTitle:small?'NET PROFIT · LOG':'NET PROFIT · 2026 $B (LOG)',xTitle:'FISCAL YEAR'}),ym=v=>a.m.t+a.ih*(1-v/60);
 for(const t of [0,10,20,30,40,50,60])label(svg,a.m.l+a.iw+(small?3:7),ym(t)+4,`${t}%`,'start','axis-tick');verticalTitle(svg,W-(small?5:12),a.m.t+a.ih/2,small?'AVG. OP. MARGIN':'AVG. OPERATING MARGIN',true);
 const series=data.eras.map((s,i)=>{
  const profit=clipping(svg,`era-profit-${i}`,a.m,a.ih),margin=clipping(svg,`era-margin-${i}`,a.m,a.ih);
  node('path',{d:linePath(s.data.map(p=>[p.year,p.profit]),a.x,a.y),fill:'none',stroke:s.color,'stroke-width':2.3,'stroke-linejoin':'round'},profit.g);
  node('line',{x1:a.x(s.start),x2:a.x(s.end),y1:ym(s.avgOperatingMargin),y2:ym(s.avgOperatingMargin),stroke:s.color,'stroke-width':1.7,'stroke-dasharray':'6 5'},margin.g);
  const txt=label(svg,0,0,'','end','series-label');txt.style.fill=s.color;
  return {s,profit,margin,txt};
 });
 // Keep direct labels above every series, including those drawn later.
 series.forEach(({txt})=>svg.appendChild(txt));legend(scene,[]);
 return p=>{
  const phase=clamp(p/.96)*8,active=Math.min(7,Math.floor(phase)),current=series[Math.floor(active/2)].s;
  scene.querySelector('.readout').textContent=all?'':`${current.id} ${active%2?current.avgOperatingMargin+'% margin':'profit'}`;
  series.forEach(({s,profit,margin,txt},i)=>{
   const pt=clamp((phase-i*2)/.8),mt=clamp((phase-i*2-1)/.8),year=lerp(s.data[0].year,s.data.at(-1).year,pt);
   profit.rect.setAttribute('width',Math.max(0,a.x(year)-a.m.l+1));profit.g.style.opacity=pt>0?1:0;
   margin.rect.setAttribute('width',Math.max(0,a.x(lerp(s.start,s.end,mt))-a.m.l+1));margin.g.style.opacity=mt>0?1:0;
   txt.style.opacity=pt>0?1:0;
   const showMargin=phase>=i*2+1,words=showMargin?`${s.avgOperatingMargin}% margin`:'profit';
   txt.replaceChildren();if(small){node('tspan',{x:0},txt,s.id);node('tspan',{x:0,dy:14},txt,words);}else txt.textContent=`${s.id} ${words}`;
   let x,y,anchor;
   if(showMargin){x=s.id==='NVIDIA'?a.x(s.end)-4:(a.x(s.start)+a.x(s.end))/2;y=ym(s.avgOperatingMargin)+(s.id==='NVIDIA'?18:(small?-24:-9));anchor=s.id==='NVIDIA'?'end':'middle';}
   else{let j=0;while(j<s.data.length-2&&s.data[j+1].year<year)j++;const lo=s.data[j],hi=s.data[j+1],fraction=clamp((year-lo.year)/(hi.year-lo.year)),profitY=lerp(a.y(lo.profit),a.y(hi.profit),fraction);x=a.x(year)-4;y=Math.max(a.m.t+16,profitY-(small?27:12));anchor='end';if(x<a.m.l+(small?90:145)){x=a.x(year)+6;anchor='start';}}
   txt.setAttribute('x',x);txt.setAttribute('y',y);txt.setAttribute('text-anchor',anchor);txt.querySelectorAll('tspan').forEach(t=>t.setAttribute('x',x));
  });
 };
}

function drawMarketcap(scene){
 const {svg,W,H,small}=svgBase(scene),points=data.marketcap.points.map(p=>[Date.parse(p.date),p.usd/1e12]),xd=[points[0][0],points.at(-1)[0]],a=axes(svg,W,H,{xd,yd:[0,6],xt:small?[xd[0],Date.UTC(2010,0,1),Date.UTC(2020,0,1),xd[1]]:[xd[0],Date.UTC(2005,0,1),Date.UTC(2010,0,1),Date.UTC(2015,0,1),Date.UTC(2020,0,1),xd[1]],yt:[0,1,2,3,4,5,6],yfmt:v=>`$${v}T`,xfmt:v=>v===xd[0]?'1999':v===xd[1]?'Aug 2026':new Date(v).getUTCFullYear(),yTitle:'MARKET CAPITALIZATION · USD',xTitle:'DATE'}),c=clipping(svg,'clip-marketcap',a.m,a.ih);
 node('path',{d:linePath(points,a.x,a.y),fill:'none',stroke:'#63ff91','stroke-width':2.3,'stroke-linejoin':'round'},c.g);
 const cursor=node('line',{y1:a.m.t,y2:a.m.t+a.ih,stroke:'#90abc0','stroke-dasharray':'2 5'},svg),dot=node('circle',{r:4,fill:'#63ff91'},svg),value=label(svg,0,0,'','start','series-label');
 legend(scene,[]);
 return p=>{const t=clamp(.02+p/.86),date=lerp(...xd,t);let i=0;while(i<points.length-1&&points[i+1][0]<=date)i++;const point=points[i],x=a.x(date);c.rect.setAttribute('width',a.iw*t);cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);dot.setAttribute('cx',a.x(point[0]));dot.setAttribute('cy',a.y(point[1]));value.setAttribute('x',a.x(point[0])+(t>.65?-8:8));value.setAttribute('y',a.y(point[1])-12);value.setAttribute('text-anchor',t>.65?'end':'start');value.textContent=point[1]<.001?`$${Math.round(point[1]*1e6)}M`:point[1]<1?`$${Math.round(point[1]*1000)}B`:`$${point[1].toFixed(2)}T`;scene.querySelector('.readout').textContent=new Date(point[0]).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});};
}
function setupSideVideo(scene){
 const video=scene.querySelector('video');let inView=false;
 video.muted=true;video.defaultMuted=true;video.controls=false;
 const sync=()=>{if(!inView||document.hidden||reduce.matches){video.pause();return;}video.play().catch(()=>{});};
 new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);sync();},{threshold:.2}).observe(video);
 document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);
 return p=>passageStage(scene,p);
}
function setupMeme(scene){const img=scene.querySelector('img');return p=>{const show=all||p>=.45,t=all?1:clamp((p-.45)/.5);img.style.visibility=show?'visible':'hidden';img.setAttribute('aria-hidden',String(!show));img.style.transform=`scale(${lerp(.12,1,t*t)})`;};}

function setupVideo(scene){
 const video=scene.querySelector('video');let loaded=false,inView=false;
 video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.controls=false;
 const load=()=>{if(loaded)return;loaded=true;video.preload='auto';video.querySelector('source').src=video.querySelector('source').dataset.src;video.load();};
 const sync=()=>{if(!inView||document.hidden){video.pause();return;}load();if(!reduce.matches)video.play().catch(()=>{});};
 new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'500px'}).observe(scene);
 new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);sync();},{threshold:.2}).observe(video);
 document.addEventListener('visibilitychange',sync);
 reduce.addEventListener('change',()=>{if(reduce.matches)video.pause();else sync();});
 scene.querySelector('.readout').textContent='6s';return ()=>{};
}
function passageStage(scene,p){
 const steps=scene.dataset.steps.split(',').map(Number),scaled=clamp(p)*steps.length,index=Math.min(steps.length-1,Math.floor(scaled)),local=clamp(scaled-index);
 scene.querySelectorAll('[data-passage]').forEach(el=>el.hidden=!all&&Number(el.dataset.passage)!==steps[index]);
 scene.dataset.currentStep=String(steps[index]);scene.dataset.cardProgress=String(all?1:local);
 return {step:steps[index],index,local};
}
function setupPhoto(scene){
 const img=scene.querySelector('img'),frame=scene.querySelector('.photo-frame');
 img.addEventListener('load',request);new ResizeObserver(request).observe(frame);
 let strip;
 if(scene.dataset.kind==='panorama'){
  strip=document.createElement('div');strip.className='panorama-strip';frame.appendChild(strip);strip.appendChild(img);
  for(let i=1;i<10;i++){const copy=img.cloneNode(true);copy.alt='';copy.setAttribute('aria-hidden','true');strip.appendChild(copy);}
 }
 return p=>{passageStage(scene,p);if(!strip)return;
  const width=frame.clientWidth,height=frame.clientHeight,ratio=(img.naturalWidth||1920)/(img.naturalHeight||1080),tileWidth=Math.max(width,height*ratio)*1.25,total=tileWidth*10;
  strip.style.width=all?'100%':`${total}px`;
  strip.style.transform=all?'none':`translateX(${-clamp(p)*Math.max(0,total-width)}px)`;
  [...strip.children].forEach((tile,i)=>{tile.style.display=all&&i>0?'none':'block';tile.style.width=all?'100%':`${tileWidth}px`;});
 };
}
function drawCapacity(scene){
 const {svg,W,H,small}=svgBase(scene),d=data.opportunity,comparison=Number(scene.dataset.step)===21,a=axes(svg,W,H,{xd:[0,3],yd:[0,110],xt:[],yt:[0,20,40,60,80,100],yfmt:v=>`${v}`,yTitle:'CAPACITY ADDED SINCE 2020 · GW',xTitle:'YEAR'}),bw=Math.min(120,a.iw*(comparison?.13:.17)),x0=a.x(comparison?.35:.5),x1=a.x(comparison?1:1.5),x2=a.x(2.5),baseY=a.y(0);
 label(svg,x0,baseY+22,'2020','middle');label(svg,x1,baseY+22,'2025','middle');const futureYear=label(svg,x2,baseY+22,'','middle');
 node('line',{x1:x0-bw/2,x2:x0+bw/2,y1:baseY,y2:baseY,stroke:'#7b95a7','stroke-width':3},svg);label(svg,x0,baseY-12,'Baseline','middle','value');
 const nvidia=node('rect',{x:x1-bw/2,y:baseY,width:bw,height:0,fill:'#63ff91'},svg),other=node('rect',{x:x1-bw/2,y:baseY,width:bw,height:0,fill:'#7293a9'},svg),builtLabel=label(svg,x1,a.y(12)-12,'12 GW','middle','value'),future=node('rect',{x:x2-bw/2,y:baseY,width:bw,height:0,fill:'#b985ff','fill-opacity':.35,stroke:'#b985ff','stroke-width':2,'stroke-dasharray':'7 5'},svg),futureLabel=label(svg,x2,a.y(100)-12,'','middle','value');
 const epochX=a.x(1.75),epoch=node('rect',{x:epochX-bw/2,y:baseY,width:bw,height:0,fill:'#b985ff','fill-opacity':.65,stroke:'#b985ff','stroke-width':2},svg),epochLabel=label(svg,epochX,0,'','middle','value'),epochYear=label(svg,epochX,baseY+22,'','middle');epochLabel.style.fill='#b985ff';
 const permitGroup=node('g',{},svg),permitData=data.permits;
 const permitBase=node('rect',{x:epochX-bw/2,width:bw,fill:'#63ff91'},permitGroup),permitGap=node('rect',{x:epochX-bw/2,width:bw,fill:'#ff70de',opacity:.65},permitGroup);
 const plannedText=label(permitGroup,epochX,0,'44 GW planned','middle','value'),permittedText=label(permitGroup,epochX,0,'25 GW permitted','middle','value'),gapText=label(permitGroup,epochX,0,'19 GW shortfall','middle','value');
 for(const t of [plannedText,permittedText,gapText])if(small)t.style.fontSize='8px';

 legend(scene,[{name:'NVIDIA · 70%',color:'#63ff91'},{name:'Other · 30%',color:'#7293a9'}]);
 return p=>{const {step,local}=passageStage(scene,p),first=Number(scene.dataset.step)===14,t=first&&step===14&&!all?clamp(.08+local/.75):1,built=d.builtGW*t,n=built*d.nvidiaShare;
  nvidia.setAttribute('y',a.y(n));nvidia.setAttribute('height',baseY-a.y(n));other.setAttribute('y',a.y(built));other.setAttribute('height',a.y(n)-a.y(built));builtLabel.style.opacity=t>.1?1:0;
  const show=step!==14||all,unknown=false,target=d.targetGW,year=d.longTermYear,progress=all||comparison||step===16?1:clamp(local/.7),v=unknown?0:target*progress;
  future.style.visibility=show&&!unknown?'visible':'hidden';future.setAttribute('y',a.y(v));future.setAttribute('height',baseY-a.y(v));futureYear.textContent=show?String(year):'';futureLabel.textContent=!show?'':unknown?'?':`${target} GW`;futureLabel.setAttribute('y',unknown?a.y(55):a.y(target)-12);futureLabel.style.fill='#b985ff';
  const epochShow=comparison&&step!==25&&(step>=22||all),epochTarget=step===23?d.permittedGW:d.targetGW,epochProgress=all?1:clamp(local/.7),epochValue=step===23?lerp(d.targetGW,d.permittedGW,epochProgress):epochTarget*epochProgress;epoch.style.visibility=epochShow?'visible':'hidden';epoch.setAttribute('y',a.y(epochValue));epoch.setAttribute('height',baseY-a.y(epochValue));epochLabel.textContent=epochShow?`${Math.round(epochValue)} GW`:'';epochLabel.setAttribute('y',a.y(epochValue)-12);epochYear.textContent=epochShow?String(step===23?d.permittedYear:d.epochYear):'';
  const permitsActive=comparison&&step===25;permitGroup.style.visibility=permitsActive?'visible':'hidden';
  if(permitsActive){const t=all?1:clamp(local/.7),total=lerp(d.permittedGW,permitData.plannedGW,t),permitted=lerp(d.permittedGW,permitData.permittedGW,t);permitBase.setAttribute('y',a.y(permitted));permitBase.setAttribute('height',baseY-a.y(permitted));permitGap.setAttribute('y',a.y(total));permitGap.setAttribute('height',a.y(permitted)-a.y(total));plannedText.setAttribute('y',a.y(total)-12);permittedText.setAttribute('y',a.y(permitted/2));gapText.setAttribute('y',a.y(permitted+(total-permitted)/2));for(const label of [plannedText,permittedText,gapText])label.style.opacity=t>.9?1:0;epochYear.textContent='2028';}
  scene.querySelector('.readout').textContent=show?(unknown?'2040?':`${year} · ${target} GW`):'2025 · 12 GW';
 };
}
function drawPermits(scene){
 const {svg,W,H,small}=svgBase(scene),d=data.permits,o=data.opportunity,a=axes(svg,W,H,{xd:[0,3],yd:[0,110],xt:[],yt:[0,20,40,60,80,100],yTitle:'CAPACITY ADDED SINCE 2020 · GW',xTitle:'YEAR'}),bw=Math.min(120,a.iw*.13),base=a.y(0),x0=a.x(.35),x1=a.x(1),x2=a.x(1.75),x3=a.x(2.5);
 [2020,2025,2028,2040].forEach((year,i)=>label(svg,[x0,x1,x2,x3][i],base+22,String(year),'middle'));
 node('line',{x1:x0-bw/2,x2:x0+bw/2,y1:base,y2:base,stroke:'#7b95a7','stroke-width':3},svg);label(svg,x0,base-12,'Baseline','middle','value');
 const n=o.builtGW*o.nvidiaShare;
 node('rect',{x:x1-bw/2,y:a.y(n),width:bw,height:base-a.y(n),fill:'#63ff91'},svg);
 node('rect',{x:x1-bw/2,y:a.y(o.builtGW),width:bw,height:a.y(n)-a.y(o.builtGW),fill:'#7293a9'},svg);label(svg,x1,a.y(o.builtGW)-12,`${o.builtGW} GW`,'middle','value');
 node('rect',{x:x3-bw/2,y:a.y(o.targetGW),width:bw,height:base-a.y(o.targetGW),fill:'#b985ff','fill-opacity':.35,stroke:'#b985ff','stroke-width':2,'stroke-dasharray':'7 5'},svg);const futureLabel=label(svg,x3,a.y(o.targetGW)-12,`${o.targetGW} GW`,'middle','value');futureLabel.style.fill='#b985ff';
 const planned=node('rect',{x:x2-bw/2,y:a.y(d.plannedGW),width:bw,height:base-a.y(d.plannedGW),fill:'none',stroke:'#b985ff','stroke-width':2},svg),permitted=node('rect',{x:x2-bw/2,width:bw,fill:'#63ff91'},svg),shortfall=node('rect',{x:x2-bw/2,width:bw,fill:'#ff70de','fill-opacity':.65},svg);
 const annotation=(value,name,y)=>{const t=label(svg,x2,y,'','middle','value');if(small)t.style.fontSize='9px';node('tspan',{x:x2},t,`${value} GW`);node('tspan',{x:x2,dy:small?11:14},t,name);return t;};
 annotation(d.plannedGW,'planned',a.y(d.plannedGW)-(small?25:30));const permittedLabel=annotation(d.permittedGW,'permitted',a.y(d.permittedGW/2)-4),shortfallLabel=annotation(d.shortfallGW,'shortfall',a.y(d.permittedGW+d.shortfallGW/2)-4);
 legend(scene,[]);
 return p=>{const t=all?1:clamp(p/.75),v=d.permittedGW*t,gap=d.shortfallGW*t;permitted.setAttribute('y',a.y(v));permitted.setAttribute('height',base-a.y(v));shortfall.setAttribute('y',a.y(v+gap));shortfall.setAttribute('height',a.y(v)-a.y(v+gap));permittedLabel.style.opacity=t>.9?1:0;shortfallLabel.style.opacity=t>.9?1:0;scene.querySelector('.readout').textContent='44 − 25 = 19 GW';};
}
function drawElectricity(scene){
 const {svg,W,H,small}=svgBase(scene),a=axes(svg,W,H,{xd:[2014,2040],yd:[0,9],xt:small?[2014,2025,2040]:[2014,2020,2025,2030,2040],yt:[0,2,4,6,8],yTitle:'GENERATING CAPACITY · TW',xTitle:'YEAR'}),c=clipping(svg,'clip-electricity',a.m,a.ih),labels=[];
 for(const s of data.electricity.series){
  node('path',{d:linePath(s.points,a.x,a.y),fill:'none',stroke:s.color,'stroke-width':2.3},c.g);
  node('path',{d:linePath([s.points.at(-1),[2040,s.target]],a.x,a.y),fill:'none',stroke:s.color,'stroke-width':2.3,'stroke-dasharray':'7 5'},c.g);
  const txt=label(svg,0,0,'','start','series-label');txt.style.fill=s.color;labels.push({s,txt});
 }
 legend(scene,[{name:'US',color:'#35e7ff'},{name:'China',color:'#b985ff'}]);
 return p=>{const t=clamp(.025+p/.9),year=lerp(2014,2040,t);c.rect.setAttribute('width',a.iw*t);for(const {s,txt} of labels){const points=[...s.points,[2040,s.target]];let i=0;while(i<points.length-2&&points[i+1][0]<year)i++;const lo=points[i],hi=points[i+1],v=lerp(lo[1],hi[1],clamp((year-lo[0])/(hi[0]-lo[0])));txt.textContent=`${s.name} ${v.toFixed(year>=2040?0:2)} TW`;txt.setAttribute('x',a.x(year)+(t>.65?-7:7));txt.setAttribute('y',a.y(v)-12);txt.setAttribute('text-anchor',t>.65?'end':'start');}scene.querySelector('.readout').textContent=`${Math.floor(year)}${year>2025?' · estimates':''}`;};
}

function drawCenters(scene){
 const {svg,W,H,small}=svgBase(scene),left=small?136:250,right=small?40:70,top=35,bottom=32,iw=W-left-right,rh=(H-top-bottom)/10,start=Date.UTC(2023,0,1),end=Date.UTC(2030,0,1),grid=node('g',{},svg),rows=node('g',{},svg);
 label(svg,left,14,'IT POWER · GW','start','axis-title');const ticks=[0,1,2,3,4,5].map(()=>({line:node('line',{y1:top,y2:H-bottom,stroke:'#263744','stroke-width':.7},grid),txt:label(svg,0,H-bottom+20,'','middle')}));
 const items=data.centers.series.map(s=>{const g=node('g',{},rows),name=label(g,left-8,rh*.58,'','end'),bar=node('rect',{x:left,y:rh*.16,width:0,height:rh*.66,fill:'#35e7ff','fill-opacity':.65},g),txt=label(g,left+5,rh*.58,'','start','value');const title=node('title',{},g,s.name);if(small){const words=s.name.split(' '),mid=Math.ceil(words.length/2);node('tspan',{x:left-8,dy:-5},name,words.slice(0,mid).join(' '));node('tspan',{x:left-8,dy:12},name,words.slice(mid).join(' '));}else name.textContent=s.name;return {s,g,bar,txt,points:s.points.map(([d,v])=>[Date.parse(d),v/1000])};});
 const max=Math.ceil(Math.max(...items.flatMap(item=>item.points.map(point=>point[1])))*1.1*2)/2,x=v=>left+v/max*iw;
 legend(scene,[]);
 return p=>{const date=lerp(start,end,clamp(p/.94)),values=items.map(item=>{const pts=item.points;let value=0;if(date>=pts[0][0]){let i=0;while(i<pts.length-1&&pts[i+1][0]<=date)i++;if(i===pts.length-1)value=pts[i][1];else value=lerp(pts[i][1],pts[i+1][1],(date-pts[i][0])/(pts[i+1][0]-pts[i][0]));}return {item,value};}).sort((a,b)=>b.value-a.value||a.item.s.name.localeCompare(b.item.s.name));
  ticks.forEach(({line,txt},i)=>{const value=max*i/5,pos=x(value);line.setAttribute('x1',pos);line.setAttribute('x2',pos);txt.setAttribute('x',pos);txt.textContent=value<1?value.toFixed(2):value.toFixed(1);});
  values.forEach(({item,value},i)=>{const visible=i<10&&value>0;item.g.style.visibility=visible?'visible':'hidden';if(!visible)return;item.g.setAttribute('transform',`translate(0 ${top+i*rh})`);item.bar.setAttribute('width',x(value)-left);item.bar.setAttribute('fill','#35e7ff');item.txt.setAttribute('x',x(value)+5);item.txt.textContent=value.toFixed(2);});
  const dt=new Date(date);scene.querySelector('.readout').textContent=`Q${Math.floor(dt.getUTCMonth()/3)+1} ${dt.getUTCFullYear()}`;
 };
}

function drawShare(scene){
 const {svg,W,H,small}=svgBase(scene),d=data.powerShare,m={l:small?28:42,r:small?4:12,t:30,b:38},iw=W-m.l-m.r,ih=H-m.t-m.b,y=v=>m.t+ih*(1-v/100),bars=[],ticks=[];
 for(const v of [0,25,50,75,100]){node('line',{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:'#263744'},svg);label(svg,m.l-6,y(v)+4,`${v}%`,'end');}
 d.quarters.forEach((q,j)=>{let bottom=0;const g=node('g',{},svg);q.values.forEach((v,i)=>{const b=node('rect',{y:y(bottom+v),height:ih*v/100,fill:d.groups[i].color},g);node('title',{},b,`${q.label} · ${d.groups[i].name}: ${v.toFixed(1)}%`);bars.push({b,j});bottom+=v;});ticks.push(label(svg,0,H-12,small?q.label.replace('20',''):q.label,'middle'));});
 const future=node('rect',{y:m.t,height:ih,fill:'#b985ff','fill-opacity':.04,stroke:'#b985ff','stroke-dasharray':'5 6'},svg);const startYear=label(svg,m.l,H-12,'2024','start'),boundaryYear=label(svg,0,H-12,'2026','middle'),endYear=label(svg,W-m.r,H-12,'2040','end');legend(scene,d.groups);
 return p=>{const {index,local}=passageStage(scene,p),extend=all?1:index?clamp(local/.6):0,count=9+36*extend,bw=iw/count,reveal=all||index?9:Math.max(1,Math.ceil(local/.8*9));for(const {b,j} of bars){b.setAttribute('x',m.l+j*bw+1);b.setAttribute('width',Math.max(0,bw-2));b.style.visibility=j<reveal?'visible':'hidden';}ticks.forEach((t,j)=>{t.setAttribute('x',m.l+(j+.5)*bw);t.style.visibility=extend===0&&j<reveal&&(!small||j%4===0)?'visible':'hidden';});future.setAttribute('x',m.l+9*bw+4);future.setAttribute('width',Math.max(0,36*extend*bw-4));future.style.visibility=extend>0?'visible':'hidden';boundaryYear.setAttribute('x',m.l+9*bw);for(const t of [startYear,boundaryYear,endYear])t.style.visibility=extend>0?'visible':'hidden';revealLegend(scene,i=>d.quarters.some((q,j)=>j<reveal&&q.values[i]>0));scene.querySelector('.readout').textContent=index?'Future share is open':d.quarters[reveal-1].label;};
}
function drawUnits(scene){
 const {svg,W,H}=svgBase(scene),size=Math.min((W-30)/10,(H-95)/10),x=(W-size*10)/2,y=65,units=[];
 const total=label(svg,W/2,30,'$2T','middle','series-label');total.style.fontSize='28px';total.style.fill='#63ff91';
 for(let i=0;i<100;i++)units.push(node('rect',{x:x+(i%10)*size+2,y:y+(9-Math.floor(i/10))*size+2,width:Math.max(1,size-4),height:Math.max(1,size-4),fill:'#63ff91','fill-opacity':.15,stroke:'#63ff91'},svg));
 const firstValue=label(svg,x+size/2,y+9.5*size,'$4B','middle','series-label');firstValue.setAttribute('dominant-baseline','middle');firstValue.style.fontSize=`${Math.min(20,size*.3)}px`;firstValue.style.fill='#63ff91';legend(scene,[]);
 return p=>{const {index,local}=passageStage(scene,p),expanded=index||all,count=expanded?Math.max(1,Math.ceil(clamp(local/.8)*100)):1;units.forEach((u,i)=>{u.style.visibility=all||i<count?'visible':'hidden';});total.style.visibility=expanded?'visible':'hidden';firstValue.style.visibility=expanded?'hidden':'visible';scene.querySelector('.readout').textContent=expanded?'$20B / GW':'$4B / GW';};
}

function drawROI(scene){
 const {svg,W,H,small}=svgBase(scene),a=axes(svg,W,H,{xd:[1995,2040],yd:[0,4],xt:small?[1995,2010,2025,2040]:[1995,2000,2010,2020,2030,2040],yt:[0,1,2,3,4],yfmt:v=>`$${v}T`,yTitle:'ANNUAL SPENDING / REVENUE · $T'}),d=data.roi;
 const internet=clipping(svg,'roi-internet',a.m,a.ih),infra=clipping(svg,'roi-ai-infra',a.m,a.ih),revenue=clipping(svg,'roi-ai-revenue',a.m,a.ih);
 function value(points,year){let i=points.findIndex(p=>p[0]>=year);if(i===0)return points[0][1];if(i<0)return points.at(-1)[1];let l=points[i-1],r=points[i];return lerp(l[1],r[1],(year-l[0])/(r[0]-l[0]));}
 const bw=a.iw/46*.35;
 for(let year=1995;year<=2040;year++){const v=value(d.internetInfra,year);node('rect',{x:a.x(year)-bw,y:a.y(v),width:bw,height:a.y(0)-a.y(v),fill:'#35e7ff',opacity:.7},internet.g);if(year>=2020){const v=value(d.aiInfra,year);node('rect',{x:a.x(year),y:a.y(v),width:bw,height:a.y(0)-a.y(v),fill:'#b985ff',opacity:.8},infra.g);}}
 node('path',{d:linePath(d.internetRevenue.filter(p=>p[0]<=2025),a.x,a.y),fill:'none',stroke:'#35e7ff','stroke-width':3},internet.g);
 node('path',{d:linePath(d.internetRevenue.filter(p=>p[0]>=2025),a.x,a.y),fill:'none',stroke:'#35e7ff','stroke-width':3,'stroke-dasharray':'7 5'},internet.g);
 node('path',{d:linePath(d.aiRevenue,a.x,a.y),fill:'none',stroke:'#ff70de','stroke-width':3,'stroke-dasharray':'7 5'},revenue.g);
 const topLabel=label(svg,a.x(2035),a.y(4)+18,'$4T+','middle','series-label');topLabel.style.fill='#35e7ff';const aiLabel=label(svg,a.x(2040)-8,a.y(1)-12,'$1T','end','series-label');aiLabel.style.fill='#ff70de';
 legend(scene,[{name:'Internet infrastructure',color:'#35e7ff'},{name:'Internet revenue',color:'#35e7ff'},{name:'AI infrastructure',color:'#b985ff'},{name:'AI revenue',color:'#ff70de'}]);
 return p=>{const {index,local}=passageStage(scene,p),it=all||index>0?1:clamp(local/.8),at=all||index>1?1:index===1?clamp(local/.8):0,rt=all||index>2?1:index===2?clamp(local/.8):0;internet.rect.setAttribute('width',it*a.iw);infra.rect.setAttribute('width',at*a.iw);revenue.rect.setAttribute('width',rt*a.iw);topLabel.style.visibility=it>.8?'visible':'hidden';aiLabel.style.visibility=rt===1?'visible':'hidden';revealLegend(scene,i=>i<2||i===2&&at>0||i===3&&rt>0);};
}
function setupBuildingReturn(scene){
 const building=scene.querySelector('ai-building-intro');let overlay;
 customElements.whenDefined('ai-building-intro').then(()=>{const root=building.shadowRoot;if(!root)return;const style=document.createElement('style');style.textContent=':host,.pin,.controls{background:#070b10!important}.camera{max-width:100%!important}svg .bot,svg .cursor,svg .drop,svg .note,svg .paint-brush,svg .paint-stroke,svg .code-flow,svg .scanline,svg .lab-head,svg .pipette-drop,svg .water-stream,svg .splash,svg .music-note{animation:none!important;opacity:0!important}:host([data-floor="servers"]) .brain,:host([data-floor="servers"]) .brain-halo{opacity:0!important}:host([data-floor="brains"]) .server,:host([data-floor="brains"]) .rack{opacity:0!important}';root.appendChild(style);overlay=node('g',{},root.querySelector('svg'));node('rect',{x:0,y:0,width:1536,height:1024,fill:'#070b10',opacity:.45},overlay);const glow=node('rect',{x:145,y:690,width:1250,height:270,rx:18,fill:'#63ff91',opacity:.08},overlay);overlay.glow=glow;request();});
 return p=>{const {index,local}=passageStage(scene,p),t=all?1:index?clamp(local/.6):0;building.dataset.floor=t>.5?'brains':'servers';if(overlay)overlay.glow.setAttribute('y',lerp(690,410,t));};
}

function followSlideLink(){
 const match=window.location.hash.match(/^#(?:chart-)?(\d+)$/);if(!match)return;
 const id=match[1],passage=document.querySelector(`[data-passage="${id}"]`),scene=passage?.closest('.scene');if(!scene)return;
 if(window.location.hash!==`#${id}`)window.history.replaceState(null,'',`#${id}`);
 const steps=(scene.dataset.steps||scene.dataset.step).split(','),index=steps.indexOf(id),progress=scene.dataset.kind==='revenue'&&id==='6'?.66:index>0?index/steps.length:0;
 const travel=Math.max(0,scene.offsetHeight-scene.querySelector('.sticky').offsetHeight),top=window.scrollY+scene.getBoundingClientRect().top-document.querySelector('header').offsetHeight+(all?0:progress*travel);
 window.scrollTo({top,behavior:'instant'});request();
}
function sceneProgress(scene){if(all)return 1;const rect=scene.getBoundingClientRect(),sticky=scene.querySelector('.sticky'),headerH=document.querySelector('header').offsetHeight;return clamp((headerH-rect.top)/Math.max(1,scene.offsetHeight-sticky.offsetHeight));}
function update(){raf=0;let current=scenes[0];for(const scene of scenes){const p=sceneProgress(scene);renderers.get(scene)?.(p);const card=scene.querySelector('.passage'),cp=scene.dataset.cardProgress!==undefined?Number(scene.dataset.cardProgress):scene.dataset.kind==='meme'?clamp(p/.4):scene.dataset.kind==='revenue'?(p<.66?p/.66:(p-.66)/.34):p;const viewportHeight=Math.min(scene.querySelector('.sticky').offsetHeight,innerHeight-document.querySelector('header').offsetHeight);card.style.setProperty('--card-shift',`${all?0:lerp(viewportHeight,-card.offsetHeight,clamp(cp))}px`);card.style.setProperty('--card-opacity','1');scene.querySelector('.track span').style.width=`${p*100}%`;scene.dataset.progress=p.toFixed(4);if(scene.getBoundingClientRect().top<innerHeight*.4)current=scene;}document.getElementById('counter').textContent=`${String(Math.floor(Number(current.dataset.currentStep||current.dataset.step))).padStart(2,'0')} / 47`;}
function request(){if(!raf)raf=requestAnimationFrame(update);}
function toggle(){document.body.classList.toggle('all-mode',all);button.setAttribute('aria-pressed',String(all));button.textContent=all?'Follow scroll':'Show all';request();}
button.addEventListener('click',()=>{const active=scenes.find(s=>s.getBoundingClientRect().top<=100&&s.getBoundingClientRect().bottom>100)||scenes[0];all=!all;toggle();requestAnimationFrame(()=>{active.scrollIntoView();request();});});reduce.addEventListener('change',()=>{all=reduce.matches;toggle();});
try{const res=await fetch('/posts/ai2026-pt1/charts.json');if(!res.ok)throw new Error('Chart data unavailable');data=await res.json();
 const draw=scene=>{const kind=scene.dataset.kind;const fn=kind==='roi'?drawROI:kind==='investment'||kind==='construction'?drawLines:kind==='chips'?drawChips:kind==='revenue'?drawRevenue:kind==='margin'||kind==='profit'?drawProfit:kind==='marketcap'?drawMarketcap:kind==='capacity'?drawCapacity:kind==='centers'?drawCenters:kind==='permits'?drawPermits:kind==='electricity'?drawElectricity:kind==='share'?drawShare:kind==='units'?drawUnits:drawEras;renderers.set(scene,fn(scene));request();};
 for(const scene of scenes){if(['chapter','statement','fulltext','scrolltext'].includes(scene.dataset.kind))renderers.set(scene,()=>{});else if(['panorama','city'].includes(scene.dataset.kind))renderers.set(scene,setupPhoto(scene));else if(scene.dataset.kind==='buildingreturn')renderers.set(scene,setupBuildingReturn(scene));else if(scene.dataset.kind==='meme')renderers.set(scene,setupMeme(scene));else if(scene.dataset.kind==='video')renderers.set(scene,setupVideo(scene));else if(scene.dataset.kind==='sidevideo')renderers.set(scene,setupSideVideo(scene));else{draw(scene);new ResizeObserver(()=>draw(scene)).observe(scene.querySelector('.plot-wrap'));}}
 toggle();window.addEventListener('hashchange',followSlideLink);requestAnimationFrame(followSlideLink);window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});update();
}catch(error){console.error(error);button.disabled=true;const p=document.createElement('p');p.textContent='Chart data could not load. Please reload the page.';root.prepend(p);}
})();
