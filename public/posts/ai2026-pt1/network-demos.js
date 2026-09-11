(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg',green='#63ff91',purple='#b985ff',cyan='#35e7ff',muted='#9aafbf',ink='#fff';
const motion=matchMedia('(prefers-reduced-motion: reduce)'),demos=[];
let frame=0,lastTime=0;
function el(tag,attrs,parent,text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
function text(parent,x,y,value,attrs={}){const n=el('text',{x,y,fill:muted,'font-family':'system-ui, sans-serif','font-size':13,...attrs},parent,value);n.style.fill=attrs.fill||muted;n.style.fontSize=`${attrs['font-size']||13}px`;return n;}
function create(host,index){
 const mode=host.dataset.networkDemo;if(!['training','inference','decode'].includes(mode))return;
 const svg=el('svg',{viewBox:'0 0 700 260',role:'img','aria-labelledby':`network-title-${index} network-desc-${index}`,preserveAspectRatio:'xMidYMid meet'},host);
 el('title',{id:`network-title-${index}`},svg,{training:'Training changes the network’s weights',inference:'Inference uses fixed network weights',decode:'Decode generates one token per forward pass'}[mode]);
 el('desc',{id:`network-desc-${index}`},svg,{training:'Signals pass forward, error signals pass backward, then connection weights change. The cycle repeats.',inference:'Signals move from inputs through the same network to the output. Connection weights stay fixed.',decode:'Each forward pass adds one token to the text. That text feeds back as context for the next pass: The sky is blue.'}[mode]);
 const drawing=el('g',{'aria-hidden':'true'},svg),layers=[3,4,4,3].map((count,l)=>Array.from({length:count},(_,i)=>({x:65+l*175,y:77+i*29+(4-count)*14.5}))),edges=[];
 for(let l=0;l<layers.length-1;l++)for(const a of layers[l])for(const b of layers[l+1]){
  const i=edges.length,line=el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#506273','stroke-width':1+(i%3)*.3,opacity:.5},drawing);edges.push({a,b,l,line,i});
 }
 const nodes=layers.flat().map(p=>el('circle',{cx:p.x,cy:p.y,r:8,fill:'#0b1015',stroke:muted,'stroke-width':1.5},drawing));
 const dots=edges.map(()=>el('circle',{r:3.5,fill:green,visibility:'hidden'},drawing));
 text(drawing,65,48,'Input',{'text-anchor':'middle'});text(drawing,327.5,48,'Same network',{'text-anchor':'middle'});text(drawing,590,48,'Output',{'text-anchor':'middle'});
 const status=text(drawing,350,22,'',{'text-anchor':'middle',fill:ink,'font-size':15});
 const feedback=el('path',{d:'M 602 135 H 653 V 193 H 65 V 151',fill:'none',stroke:purple,'stroke-width':1.5,'stroke-dasharray':'5 4',visibility:mode==='decode'?'visible':'hidden'},drawing);
 if(mode==='decode')el('path',{d:'M 61 157 L 65 151 L 69 157',fill:'none',stroke:purple,'stroke-width':1.5},drawing);
 const tokenNames=['The','sky','is','blue','.'],tokens=[];
 if(mode==='decode'){
  text(drawing,350,210,'Output becomes the next input',{'text-anchor':'middle','font-size':11});
  for(let i=0;i<tokenNames.length;i++){
   const g=el('g',{visibility:'hidden'},drawing),x=205+i*59;el('rect',{x,y:222,width:51,height:27,rx:3,fill:'#192b24',stroke:green,'stroke-width':1},g);text(g,x+25.5,241,tokenNames[i],{'text-anchor':'middle',fill:ink});tokens.push(g);
  }
 }else text(drawing,350,225,mode==='training'?'Forward → backward → update weights':'Forward only · weights stay fixed',{'text-anchor':'middle',fill:ink});
 const demo={host,mode,elapsed:0,visible:false,render};
 function render(staticFrame=false){
  const cycle=mode==='training'?4.8:mode==='decode'?1.7:2.4,t=demo.elapsed%cycle;
  let phase='forward',progress=t/1.45,tokenCount=0;
  if(mode==='training'){
   phase=t<1.4?'forward':t<2.8?'backward':'update';progress=phase==='forward'?t/1.4:phase==='backward'?(t-1.4)/1.4:(t-2.8)/1.4;
   if(staticFrame){phase='update';progress=1;}
   status.textContent=phase==='forward'?'Forward pass':phase==='backward'?'Backward pass':'Update weights';
  }else if(mode==='decode'){
   const pass=Math.floor(demo.elapsed/cycle)%6;tokenCount=pass===5?5:pass+(t>=1.2?1:0);progress=t/1.2;
   if(pass===5)progress=2;
   if(staticFrame){tokenCount=5;progress=2;}
   status.textContent='One forward pass → one token';feedback.setAttribute('opacity',staticFrame||t>1.2?1:.3);
  }else{status.textContent='Forward pass · fixed weights';if(staticFrame)progress=.82;}
  const backwards=phase==='backward',signalColor=backwards?purple:green;
  edges.forEach((edge,i)=>{
   const changed=mode==='training'&&(staticFrame||phase==='update'),round=Math.floor(demo.elapsed/cycle),weight=mode==='training'&&(changed||round>0)?1.1+((i*7+Math.max(0,round-(changed?0:1)))%5)*.45:1+(i%3)*.3;
   edge.line.setAttribute('stroke-width',weight);edge.line.setAttribute('stroke',changed?cyan:'#506273');edge.line.setAttribute('opacity',changed?.8:.5);
   const layerProgress=backwards?(1-progress)*3-edge.l:progress*3-edge.l,show=phase!=='update'&&layerProgress>=0&&layerProgress<=1&&progress<=1;
   const dot=dots[i];dot.setAttribute('visibility',show?'visible':'hidden');if(show){dot.setAttribute('cx',edge.a.x+(edge.b.x-edge.a.x)*layerProgress);dot.setAttribute('cy',edge.a.y+(edge.b.y-edge.a.y)*layerProgress);dot.setAttribute('fill',signalColor);}
  });
  nodes.forEach(n=>n.setAttribute('stroke',phase==='update'?cyan:muted));
  tokens.forEach((g,i)=>g.setAttribute('visibility',i<tokenCount?'visible':'hidden'));
 }
 render(motion.matches);demos.push(demo);return demo;
}
document.querySelectorAll('[data-network-demo]').forEach(create);
function runnable(){return !motion.matches&&!document.hidden&&demos.some(d=>d.visible);}
function tick(now){frame=0;if(!runnable()){lastTime=0;return;}const delta=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;for(const d of demos)if(d.visible){d.elapsed+=delta;d.render();}frame=requestAnimationFrame(tick);}
function sync(){if(!runnable()){if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;}else if(!frame)frame=requestAnimationFrame(tick);}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){const d=demos.find(item=>item.host===entry.target);if(d)d.visible=entry.isIntersecting;}sync();},{threshold:0});for(const d of demos)observer.observe(d.host);}else{for(const d of demos)d.visible=true;sync();}
motion.addEventListener('change',()=>{for(const d of demos)d.render(motion.matches);sync();});
document.addEventListener('visibilitychange',sync);
})();
