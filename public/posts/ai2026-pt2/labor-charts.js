/* Native charts for the RL labor-market chapter. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const colors=['#43a9ff','#ff914f','#39ffc1','#f1cf65','#bda1ff'];
const grid='#263744',muted='#91a6b5';
let sequence=0;
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
const make=(tag,attrs={},parent,value)=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(value!==undefined)el.textContent=value;parent?.append(el);return el};
const text=(parent,x,y,value,attrs={})=>make('text',{x,y,...attrs},parent,value);
const title=(parent,value)=>make('title',{},parent,value);
const api={make,text,title,grid,muted,colors,clamp,ease,progress:s=>s.reduced?1:ease((s.progress-.03)/.72),addLegend:(scene)=>scene.querySelector('.legend').replaceChildren()};
function knowledgeWork(svg,scene,d,W,H,a){
 const {make,text,title,grid,muted,colors,clamp}=a,small=W<620;
 a.addLegend(scene,[]);
 const left=small?40:55,right=W-(small?16:190),top=24,bottom=H-(small?58:64);
 const x=v=>left+(v-2022.92)/(2026.75-2022.92)*(right-left);
 const y=v=>bottom-v/180*(bottom-top);
 [0,30,60,90,120,150,180].forEach(v=>{
  make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);
  text(svg,left-8,y(v)+4,v?`${v}M`:'0',{'text-anchor':'end',class:'axis-tick'});
 });
 [2023,2024,2025,2026].forEach(v=>text(svg,x(v),bottom+23,String(v),{'text-anchor':'middle',class:'axis-tick'}));
 const references=d.references.map((r,i)=>{
  const group=make('g',{},svg),yy=y(r.value);
  make('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:muted,'stroke-dasharray':'5 5','stroke-opacity':'.65'},group);
  const short=['Top 34 · 34.5M','Knowledge workforce · 62M','US employment · 165M'][i];
  text(group,small?right-4:right+9,yy-6,small?`${r.value}M`:W<900?short:`${r.label} · ${r.value}M`,{'text-anchor':small?'end':'start',class:'knowledge-reference'});
  title(group,`${r.label}: ${r.value} million employees`);
  return group;
 });
 const points=d.points.map(([year,m])=>[x(year),y(m)]);
 const clipId=`knowledge-work-reveal-${++sequence}`,defs=make('defs',{},svg),clip=make('clipPath',{id:clipId},defs);
 const reveal=make('rect',{x:left,y:top,width:0,height:bottom-top},clip);
 const area=make('path',{d:`M${left},${bottom} ${points.map(([xx,yy])=>`L${xx},${yy}`).join(' ')} L${right},${bottom} Z`,fill:colors[1],'fill-opacity':'.11','clip-path':`url(#${clipId})`},svg);
 const curve=make('path',{d:points.map(([xx,yy],i)=>`${i?'L':'M'}${xx},${yy}`).join(' '),fill:'none',stroke:colors[1],'stroke-width':small?3:4,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
 const dot=make('circle',{cx:right,cy:y(57),r:small?4:5,fill:colors[1]},svg);
 const label=text(svg,small?right-5:right-5,y(57)-13,small?'57M FTE':'AI knowledge work · 57M FTE',{'text-anchor':'end',class:'knowledge-endpoint'});
 title(curve,'AI cognitive task-hours: 57 million full-time equivalents by September 2026');
 const length=curve.getTotalLength();curve.style.strokeDasharray=String(length);
 return state=>{
  const p=state.reduced?1:a.progress(state);
  curve.style.strokeDashoffset=String(length*(1-p));
  reveal.setAttribute('width',(right-left)*p);
  dot.style.opacity=label.style.opacity=p>.95?'1':'0';
  references.forEach((g,i)=>g.style.opacity=String(clamp((p-.1-i*.12)*4)));
 };
}
function machineTiers(svg,scene,d,W,H,a){
 const {make,text,title,grid,muted,clamp,ease}=a,small=W<620;
 a.addLegend(scene,[]);
 const left=small?42:60,right=W-(small?75:155),top=28,bottom=H-58;
 const x=v=>left+(v-2022.92)/(2026.75-2022.92)*(right-left);
 const y=v=>bottom-(Math.log10(v)-1)/7*(bottom-top);
 [10,100,1000,10000,100000,1000000,10000000,100000000].forEach(v=>{
  make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);
  text(svg,left-7,y(v)+4,v>=1000000?`${v/1000000}M`:v>=1000?`${v/1000}K`:String(v),{'text-anchor':'end',class:'axis-tick'});
 });
 [2023,2024,2025,2026].forEach(v=>text(svg,x(v),bottom+22,String(v),{'text-anchor':'middle',class:'axis-tick'}));
 const marks=d.series.map((s,i)=>{
  const points=s.points.map(([year,value])=>[x(year),y(value)]);
  const path=make('path',{d:points.map(([xx,yy],j)=>`${j?'L':'M'}${xx},${yy}`).join(' '),fill:'none',stroke:s.color,'stroke-width':small?2.6:3.2,'stroke-linejoin':'round','stroke-linecap':'round',...(s.dashed?{'stroke-dasharray':'6 5'}:{})},svg);
  const end=s.points.at(-1)[1],label=text(svg,right+7,y(end)+4,W<900?`${['Chat','Code','R&D','Drive','Robots'][i]} ${s.end}`:`${s.name} · ${s.end}`,{fill:s.color,class:'tier-endpoint'});
  label.style.fill=s.color;
  const dot=make('circle',{cx:right,cy:y(end),r:small?3:4,fill:s.color},svg);
  title(path,`${s.name}: ${s.points[0][1].toLocaleString('en-US')} FTE-equivalents in November 2022 to ${end.toLocaleString('en-US')} in September 2026`);
  // A clip reveals each path by date, so dashed robotics series keep their dash pattern.
  const clipId=`tier-reveal-${++sequence}`,defs=make('defs',{},svg),clip=make('clipPath',{id:clipId},defs),rect=make('rect',{x:left-3,y:top-4,width:0,height:bottom-top+8},clip);
  path.setAttribute('clip-path',`url(#${clipId})`);
  return {rect,label,dot};
 });
 return state=>marks.forEach((m,i)=>{
  const p=state.reduced?1:state.stage>i?1:state.stage<i?0:ease(clamp(state.local*1.25));
  m.rect.setAttribute('width',(right-left+6)*p);
  m.label.style.opacity=m.dot.style.opacity=p>.96?'1':'0';
 });
}
function computeModels(svg,scene,d,W,H,a){
 const {make,text,title,grid,muted,colors,clamp,ease}=a,small=W<620;
 a.addLegend(scene,[]);
 const left=small?42:57,right=W-(small?82:178),top=34,bottom=H-58;
 const x=v=>left+(v-2022.92)/(2026.75-2022.92)*(right-left);
 const y=v=>bottom-(Math.log10(v)-3)/6*(bottom-top);
 const label=v=>v>=1e9?'1B':v>=1e6?`${v/1e6}M`:v>=1e3?`${v/1e3}K`:String(v);
 [1e3,1e4,1e5,1e6,1e7,1e8,1e9].forEach(v=>{
  make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);
  text(svg,left-7,y(v)+4,label(v),{'text-anchor':'end',class:'axis-tick'});
 });
 [2023,2024,2025,2026].forEach(v=>text(svg,x(v),bottom+23,String(v),{'text-anchor':'middle',class:'axis-tick'}));
 d.references.forEach((r,i)=>{
  const yy=y(r.value);
  make('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:muted,'stroke-dasharray':'5 5','stroke-opacity':'.5'},svg);
  text(svg,right+7,yy+(i? -5:16),W<900?`${i?'US':'Top 34'} · ${label(r.value)}`:`${r.label} · ${label(r.value)}`,{class:'compute-reference'});
 });
 d.milestones.forEach((m,i)=>{
  const xx=x(m.year);
  make('line',{x1:xx,x2:xx,y1:top,y2:bottom,stroke:muted,'stroke-dasharray':'2 5','stroke-opacity':'.35'},svg);
  text(svg,Math.min(xx+4,right-30),top+14+(small&&i===2?13:0),m.label,{class:'compute-milestone'});
 });
 const actual=d.actual.map(([year,value])=>[x(year),y(value)]),chips=d.chipsOnly.map(([year,value])=>[x(year),y(value)]);
 const defs=make('defs',{},svg);
 const reveal=()=>{const id=`compute-reveal-${++sequence}`,clip=make('clipPath',{id},defs),rect=make('rect',{x:left-3,y:top-5,width:0,height:bottom-top+10},clip);return{id,rect};};
 const gapClip=reveal(),chipClip=reveal(),actualClip=reveal();
 const gapPath=`${actual.map(([xx,yy],i)=>`${i?'L':'M'}${xx},${yy}`).join(' ')} ${chips.slice().reverse().map(([xx,yy])=>`L${xx},${yy}`).join(' ')} Z`;
 make('path',{d:gapPath,fill:colors[1],'fill-opacity':'.12','clip-path':`url(#${gapClip.id})`},svg);
 const path=(points,color,clip,dashed)=>make('path',{d:points.map(([xx,yy],i)=>`${i?'L':'M'}${xx},${yy}`).join(' '),fill:'none',stroke:color,'stroke-width':small?2.7:3.4,'stroke-linejoin':'round','stroke-linecap':'round','clip-path':`url(#${clip.id})`,...(dashed?{'stroke-dasharray':'6 5'}:{})},svg);
 const chipPath=path(chips,colors[0],chipClip,true),actualPath=path(actual,colors[1],actualClip,false);
 title(chipPath,'Chips-only counterfactual: 13,000 to 834,000 human-years of work per year');
 title(actualPath,'Actual AI work: 13,000 to 57 million human-years of work per year');
 const chipLabel=text(svg,right+7,y(834000)+4,small?'Chips 834K':'Chips only · 834K',{class:'compute-endpoint'}),actualLabel=text(svg,right+7,y(57000000)+4,small?'Actual 57M':'Actual AI work · 57M',{class:'compute-endpoint'});
 chipLabel.style.fill=colors[0];actualLabel.style.fill=colors[1];
 const chipDot=make('circle',{cx:right,cy:y(834000),r:4,fill:colors[0]},svg),actualDot=make('circle',{cx:right,cy:y(57000000),r:4,fill:colors[1]},svg);
 const gapLabel=text(svg,right-8,(y(57000000)+y(834000))/2,'68×',{'text-anchor':'end',class:'compute-gap-label'});
 return state=>{
  const p=i=>state.reduced?1:state.stage>i?1:state.stage<i?0:ease(clamp(state.local*1.25));
  chipClip.rect.setAttribute('width',(right-left+6)*p(0));
  actualClip.rect.setAttribute('width',(right-left+6)*p(1));
  gapClip.rect.setAttribute('width',(right-left+6)*p(2));
  chipLabel.style.opacity=chipDot.style.opacity=p(0)>.96?'1':'0';
  actualLabel.style.opacity=actualDot.style.opacity=p(1)>.96?'1':'0';
  gapLabel.style.opacity=String(clamp((p(2)-.6)*2.5));
 };
}

const renderers={'knowledge-work':knowledgeWork,'machine-tiers':machineTiers,'compute-models':computeModels};
window.drawLaborChart=(scene,specs,reduced)=>{
 const spec=specs[scene.id],plot=scene.querySelector('.plot-wrap'),svg=plot.querySelector('svg');
 if(!spec)throw Error(`Missing labor chart: ${scene.id}`);
 const {width,height}=plot.getBoundingClientRect(),W=Math.max(300,width),H=Math.max(300,height);
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 title(svg,spec.title);make('desc',{},svg,spec.note);
 const render=renderers[scene.id](svg,scene,spec.data,W,H,api);
 return progress=>render({progress,stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:reduced()});
};
})();
