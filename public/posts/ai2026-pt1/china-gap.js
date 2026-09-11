(async()=>{
'use strict';
const host=document.querySelector('.china-gap');if(!host)return;
const response=await fetch('/posts/ai2026-pt1/china-gap.json');if(!response.ok)return;
const data=await response.json(),svg=host.querySelector('svg'),figure=host.querySelector('figure'),reduce=matchMedia('(prefers-reduced-motion: reduce)');let bars=[],frame=0;
const clamp=v=>Math.max(0,Math.min(1,v));
function node(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.appendChild(n);return n;}
function draw(){const W=Math.max(280,svg.clientWidth),H=Math.max(240,svg.clientHeight),left=W<450?85:110,right=55,top=24,bottom=48,iw=W-left-right,rh=(H-top-bottom)/4,x=v=>left+v/24*iw;
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);node('title',{},'Estimated technology gap, 2026');
 const text=(a,b,t,attrs={})=>node('text',{x:a,y:b,fill:'#a4bbc9','text-anchor':'middle',...attrs},t);
 for(const v of[0,5,10,15,20]){node('line',{x1:x(v),x2:x(v),y1:top,y2:H-bottom,stroke:'#263640'});text(x(v),H-28,String(v));}text(left+iw/2,H-4,'ESTIMATED YEARS BEHIND');
 bars=data.rows.map((r,i)=>{const y=top+i*rh+rh*.18,h=rh*.5;text(left-10,y+h*.45,r.name,{'text-anchor':'end',fill:'#fff'});text(left-10,y+h*.45+16,`vs ${r.leader}`,{'text-anchor':'end'});
 const bar=node('rect',{x:left,y,width:0,height:h,fill:'#35e7ff','fill-opacity':.7});const value=text(left,y+h-5,'2026',{'text-anchor':'end',fill:'#fff'});
 const marker=node('line',{x1:x(r.prior),x2:x(r.prior),y1:y-5,y2:y+h+5,stroke:'#fff','stroke-width':2,'stroke-dasharray':'4 5'}),year=text(x(r.prior),y+h+20,String(r.year));return{bar,value,marker,year,width:r.gap/24*iw,left,markerTop:y-5,markerBottom:y+h+5};});update();}
 function update(){const all=reduce.matches||document.body.classList.contains('all-mode'),p=all?1:clamp((90-host.getBoundingClientRect().top)/Math.max(1,host.offsetHeight-figure.offsetHeight));bars.forEach((r,i)=>{const historical=all?1:clamp((p/.4*4-i)/.8),t=all?1:clamp(((p-.4)/.6*4-i)/.8);r.bar.setAttribute('width',r.width*t);r.value.setAttribute('x',r.left+r.width*t-4);r.value.style.visibility=t===1?'visible':'hidden';r.marker.style.visibility=historical>0?'visible':'hidden';r.marker.setAttribute('y2',r.markerTop+(r.markerBottom-r.markerTop)*historical);r.year.style.opacity=historical;});}
 function request(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});}
 new ResizeObserver(draw).observe(svg);draw();addEventListener('scroll',request,{passive:true});reduce.addEventListener('change',request);new MutationObserver(request).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
