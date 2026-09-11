(async()=>{
'use strict';
const response=await fetch('/posts/ai2026-pt1/jalapeno.json');if(!response.ok)return;
const data=await response.json(),NS='http://www.w3.org/2000/svg',reduce=matchMedia('(prefers-reduced-motion: reduce)'),charts=[];
const clamp=v=>Math.max(0,Math.min(1,v));
function el(parent,tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
for(const host of document.querySelectorAll('.benchmark-scroll')){
 const d=data.charts[Number(host.dataset.benchmark)],svg=host.querySelector('svg'),figure=host.querySelector('figure');let paths=[];
 function draw(){
  const W=Math.max(280,svg.clientWidth),H=Math.max(240,svg.clientHeight),m={l:64,r:18,t:26,b:50},iw=W-m.l-m.r,ih=H-m.t-m.b,x=v=>m.l+v/d.xMax*iw,y=v=>m.t+(1-v/d.yMax)*ih;
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);el(svg,'title',{},`${d.model}: throughput per MW versus interactivity`);
  const text=(px,py,t,attrs={})=>el(svg,'text',{x:px,y:py,fill:'#a4bbc9','text-anchor':'middle',...attrs},t);
  for(let i=0;i<=4;i++){let v=i*d.xMax/4;el(svg,'line',{x1:x(v),x2:x(v),y1:y(0),y2:y(d.yMax),stroke:'#263640'});text(x(v),H-30,String(v));}
  const ticks=d.yMax===13?[0,3,6,9,12]:[0,15,30,45,60];for(const v of ticks){el(svg,'line',{x1:x(0),x2:x(d.xMax),y1:y(v),y2:y(v),stroke:'#263640'});text(m.l-8,y(v)+4,`${v}M`,{'text-anchor':'end'});}
  text(m.l+iw/2,H-4,'INTERACTIVITY · TOK/S/USER');text(14,m.t+ih/2,'THROUGHPUT · TOK/S/MW',{transform:`rotate(-90 14 ${m.t+ih/2})`});
  paths=d.series.map(s=>{
   const g=el(svg,'g'),path=el(g,'path',{d:s.points.map(([a,b],i)=>`${i?'L':'M'}${x(a)},${y(b)}`).join(' '),fill:'none',stroke:s.color,'stroke-width':3,pathLength:1,'stroke-dasharray':1});
   const dots=s.points.map(([a,b])=>el(g,'circle',{cx:x(a),cy:y(b),r:3,fill:s.color}));
   const first=s.points[0],label=text(Math.min(W-8,x(first[0])+12),Math.max(16,y(first[1])-12),s.name,{fill:s.color,'text-anchor':'start','font-weight':700});
   return {path,dots,label};
  });update();
 }
 function update(){
  const all=reduce.matches||document.body.classList.contains('all-mode'),p=all?1:clamp((90-host.getBoundingClientRect().top)/Math.max(1,host.offsetHeight-figure.offsetHeight));
  paths.forEach(({path,dots,label},i)=>{const t=all?1:clamp((p-(i?.45:.04))/.38);path.style.visibility=t>0?'visible':'hidden';path.setAttribute('stroke-dashoffset',1-t);label.style.visibility=t>0?'visible':'hidden';dots.forEach((dot,j)=>dot.style.visibility=t>0&&j/(dots.length-1)<=t?'visible':'hidden');});
 }
 charts.push(update);new ResizeObserver(draw).observe(svg);draw();
}
let frame=0;function request(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;charts.forEach(fn=>fn());});}
addEventListener('scroll',request,{passive:true});reduce.addEventListener('change',request);new MutationObserver(request).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
