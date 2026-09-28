/* Personal-assistant scenes, using the same native chart system as Part 3. */
(() => {
 'use strict';
 function growth(svg,scene,d,W,H,api){
  const {make,text,title,frame,linePath,ease,clamp,compact,addLegend}=api;
  addLegend(scene,[]);
  const a=frame(svg,W,H,d.x,d.y),marks=make('g',{},svg);
  const defs=make('defs',{},svg),clip=make('clipPath',{id:'assistant-growth-window'},defs);
  const window=make('rect',{x:a.left-6,y:a.top-10,width:0,height:a.height+20},clip);
  marks.setAttribute('clip-path','url(#assistant-growth-window)');
  d.series.forEach(series=>{
   make('path',{d:linePath(series.points,a.x,a.y),fill:'none',stroke:series.color,'stroke-width':W<620?2.5:3.5,'stroke-dasharray':series.dashed?'7 5':''},marks);
   (series.checkpoints||[]).forEach(([day,value])=>{
    const point=make('circle',{cx:a.x(day),cy:a.y(value),r:4,fill:series.color},marks);
    title(point,`${series.name}: day ${day.toFixed(1)}, ${compact(value)} ${series.dashed?'users (estimated)':'downloads'}`);
   });
   const [day,value]=series.points.at(-1),xx=a.x(day),edge=xx>a.right-120;
   const valueLabel=series.name==='Instinct'?`${Math.round(value/1000)}k`:compact(value);
   text(marks,xx+(edge?-8:8),a.y(value)+(series.name==='ChatGPT'?20:-12),`${series.name} ${valueLabel}`,{'text-anchor':edge?'end':'start',class:'value-label'});
  });
  return state=>{
   const amount=state.reduced?1:state.stage===0?0:ease(clamp(state.local/.45));
   window.setAttribute('width',(a.width+12)*amount);
   scene.dataset.assistantReveal=String(amount);
  };
 }
 function marketplaces(svg,scene,d,W,H,api){
  const {make,text,title,frame,addLegend,clamp,ease}=api;
  addLegend(scene,[]);
  const a=frame(svg,W,H,d.x,d.y),step=a.width/3,marks=[];
  d.rows.forEach((row,i)=>{
   const cx=a.left+step*(i+.5),width=step*.48,g=make('g',{},svg),barTop=a.y(row.value);
   make('rect',{x:cx-width/2,y:barTop,width,height:a.bottom-barTop,fill:row.color},g);
   // Keep the $1B benchmark legible on the shared $400B scale.
   make('circle',{cx,cy:barTop,r:3.5,fill:row.color},g);
   title(g,`${row.label}: ${row.valueLabel}. ${row.note}`);
   text(g,cx,barTop-12,row.valueLabel,{'text-anchor':'middle',class:'value-label'});
   text(g,cx,a.bottom+22,row.label,{'text-anchor':'middle',class:'row-label'});
   marks.push(g);
  });
  return state=>marks.forEach((g,i)=>{
   const stage=i?2:1,amount=state.reduced||state.stage>stage?1:state.stage===stage?ease(clamp(state.local/.35)):0;
   g.style.opacity=String(amount);g.style.visibility=amount?'visible':'hidden';
  });
 }
 function payments(svg,scene,d,W,H,api){
  const {make,text,compact,addLegend}=api;
  addLegend(scene,[]);
  const small=W<620,left=small?58:76,right=W-24,top=45,bottom=H-45,laneH=(bottom-top)/2;
  make('line',{x1:left,x2:right,y1:top+laneH,y2:top+laneH,stroke:api.grid,'stroke-dasharray':'3 5'},svg);
  const humans=text(svg,right,top-14,'Humans · 28,935 tx/s',{class:'value-label','text-anchor':'end'});
  const agents=text(svg,right,top+laneH+24,'',{class:'value-label','text-anchor':'end'});
  const sourceLabel=text(svg,right,bottom+25,'',{class:'axis-tick','text-anchor':'end'});
  const particles=make('g',{},svg);
  let agentRate=d.agentRate,asOf=d.sampledAt,raf=0,last=0,humanCredit=0,agentCredit=0,elapsed=0,active=false,disposed=false,inView=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),dots=[];
  let timer=0,request=null;
  const labels=()=>{
   agents.textContent=`x402 agents · ${agentRate.toFixed(2)} tx/s`;
   sourceLabel.textContent=`Daily avg. · ${new Date(asOf).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})} · particles scaled`;
  };
  labels();
  const spawn=lane=>{
   if(dots.length>=700)return;
   const node=make('circle',{cx:left,cy:top+laneH*lane+32+Math.random()*(laneH-52),r:lane?2.4:1.8,fill:lane?d.agentColor:d.humanColor,opacity:.7},particles);
   dots.push({node,x:left,speed:90+Math.random()*70});
  };
  function tick(time){
   if(!active||disposed)return;
   const dt=last?Math.min(.05,(time-last)/1000):0;last=time;elapsed+=dt;
   // The upstream race also caps human spawning and scales dots for visibility.
   humanCredit+=dt*70;agentCredit+=dt*Math.max(.2,Math.min(8,agentRate));
   while(humanCredit>=1){spawn(0);humanCredit--}while(agentCredit>=1){spawn(1);agentCredit--}
   for(let i=dots.length-1;i>=0;i--){const dot=dots[i];dot.x+=dt*dot.speed;if(dot.x>right){dot.node.remove();dots.splice(i,1)}else{dot.node.setAttribute('cx',dot.x);dot.node.setAttribute('opacity',String(.7*Math.min(1,(dot.x-left)/30,(right-dot.x)/40)))}}
   humans.textContent=`Humans · 28,935 tx/s · ${compact(28935*elapsed)} payments`;
   raf=requestAnimationFrame(tick);
  }
  async function refresh(){
   if(disposed||!inView||document.hidden)return;
   request=new AbortController();
   try{
    const response=await fetch('/api/agentic-payments',{signal:request.signal});
    if(!response.ok)throw Error('Payment data unavailable');
    const latest=await response.json();
    if(Number.isFinite(latest.agentRate)&&latest.agentRate>=0){agentRate=latest.agentRate;asOf=latest.sampledAt;labels();scene.dataset.paymentsSource='live-api'}
   }catch(error){if(error.name!=='AbortError')scene.dataset.paymentsSource='dated-snapshot'}
   finally{request=null;if(!disposed&&inView&&!document.hidden)timer=setTimeout(refresh,60000)}
  }
  function sync(){
   const animate=inView&&!document.hidden&&!reduced.matches;
   if(animate&&!active){active=true;last=0;raf=requestAnimationFrame(tick)}
   else if(!animate&&active){active=false;cancelAnimationFrame(raf)}
   clearTimeout(timer);request?.abort();
   if(inView&&!document.hidden)refresh();
  }
  const observer=new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);sync()},{threshold:.1});
  observer.observe(scene.querySelector('.native-plot'));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  if(reduced.matches){for(let i=0;i<70;i++){spawn(0);dots.at(-1).x=left+Math.random()*(right-left);dots.at(-1).node.setAttribute('cx',dots.at(-1).x)}for(let i=0;i<3;i++){spawn(1);dots.at(-1).x=left+Math.random()*(right-left);dots.at(-1).node.setAttribute('cx',dots.at(-1).x)}}
  const update=()=>{};
  update.destroy=()=>{disposed=true;active=false;cancelAnimationFrame(raf);clearTimeout(timer);request?.abort();observer.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)};
  return update;
 }
 window.NativeAssistants={growth,marketplaces,payments};
})();
