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
function machineTiers(svg,scene,d,W,H,a){
 const {make,text,title,grid,muted,clamp,ease}=a,small=W<700;
 a.addLegend(scene,[]);
 const left=small?53:69,right=W-(small?93:186),top=25,bottom=H-41;
 const x=i=>left+i/(d.dates.length-1)*(right-left);
 const y=v=>bottom-(Math.log10(Math.max(.1,v))+1)/9*(bottom-top);
 // Major log ticks only: the physical series must fit on the same axis.
 [.1,1,10,100,1000,10000,100000,1000000,10000000,100000000].forEach(v=>{
  const yy=y(v);
  make('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:grid,'stroke-opacity':v===.1?0:.75},svg);
  text(svg,left-9,yy+4,v>=1e6?`${v/1e6}M`:v>=1000?`${v/1000}K`:String(v),{'text-anchor':'end',class:'axis-tick'});
 });
 [2,14,26,38].forEach((i,j)=>text(svg,x(i),bottom+23,String(2023+j),{'text-anchor':'middle',class:'axis-tick'}));
 const ylabel=text(svg,13,(top+bottom)/2,'Workers',{'text-anchor':'middle',class:'workforce-axis-label'});
 ylabel.setAttribute('transform',`rotate(-90 13 ${(top+bottom)/2})`);
 const referenceMarks=d.references.map((r,i)=>{
  const group=make('g',{},svg),yy=y(r.value);
  make('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:muted,'stroke-dasharray':'5 5','stroke-opacity':'.65'},group);
  const label=small?(i?'U.S. knowledge · 62M':'Developers · 40M'):`${r.name} · ${Math.round(r.value/1e6)}M`;
  text(group,right+7,yy+(i?-5:13),label,{class:'workforce-reference'});
  title(group,`${r.name}: ${Math.round(r.value/1e6)} million`);
  return group;
 });
 // Keep categories in the requested reveal order; direct labels avoid a legend.
 const offsets=[2,28,8,-8,3,3];
 const short=['Chatbots','Researchers','Knowledge','Coders','Drivers','Robots'];
 const marks=d.series.map((s,i)=>{
  const points=s.values.map((v,j)=>[x(j),y(v)]);
  const path=make('path',{d:points.map(([xx,yy],j)=>`${j?'L':'M'}${xx},${yy}`).join(' '),fill:'none',stroke:s.color,'stroke-width':small?2.5:3.1,'stroke-linejoin':'round','stroke-linecap':'round'},svg);
  const end=s.values.at(-1),lastY=y(end);
  const amount=end>=1e6?`${(end/1e6).toFixed(1)}M`:end>=1000?`${(end/1000).toFixed(0)}K`:`${Math.round(end)}`;
  const label=text(svg,right+7,lastY+offsets[i],`${small?short[i]:s.name} · ${amount}`,{class:'tier-endpoint',fill:s.color});
  label.style.fill=s.color;
  const dot=make('circle',{cx:right,cy:lastY,r:small?3:4,fill:s.color},svg);
  title(path,`${s.name}: ${Math.round(end).toLocaleString('en-US')} paid-work-equivalent task-years per year in September 2026`);
  const clipId=`tier-reveal-${++sequence}`,defs=make('defs',{},svg),clip=make('clipPath',{id:clipId},defs);
  const rect=make('rect',{x:left-3,y:top-4,width:0,height:bottom-top+8},clip);
  path.setAttribute('clip-path',`url(#${clipId})`);
  return {rect,label,dot};
 });
 return state=>{
  marks.forEach((m,i)=>{
   const step=i<4?i:i+2;
   const p=state.reduced?1:state.stage>step?1:state.stage<step?0:ease(clamp(state.local*1.15));
   m.rect.setAttribute('width',(right-left+6)*p);
   m.label.style.opacity=m.dot.style.opacity=p>.96?'1':'0';
  });
  referenceMarks.forEach((g,i)=>{
   const step=4+i,p=state.reduced?1:state.stage>step?1:state.stage<step?0:ease(clamp(state.local*1.5));
   g.style.opacity=String(p);
  });
 };
}
const renderers={'machine-tiers':machineTiers};
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
