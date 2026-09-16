(()=>{
'use strict';

const NS='http://www.w3.org/2000/svg';
const COLORS={bg:'#0b1015',edge:'#35e7ff',forward:'#63ff91',backward:'#b985ff',muted:'#9aafbf',ink:'#fff'};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const demos=[];
let frame=0,lastTime=0;

function el(tag,attrs,parent,text){
 const node=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs||{}))node.setAttribute(key,value);
 if(text!==undefined)node.textContent=text;
 parent.appendChild(node);
 return node;
}
function label(parent,x,y,value,attrs={}){
 const node=el('text',{x,y,fill:COLORS.ink,'font-family':'system-ui, sans-serif','font-size':13,...attrs},parent,value);
 node.style.fill=attrs.fill||COLORS.ink;
 node.style.fontSize=`${attrs['font-size']||13}px`;
 return node;
}
function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function ease(value){const t=clamp(value);return t*t*(3-2*t);}
function initialWeight(index){return .08+(((index*37+17)%89)/100);}
function trainedWeight(base,index,round){
 return clamp(base+Math.sin((index+1)*1.73+round*1.37)*.24+Math.cos((index+3)*.71+round*.83)*.09,.04,1);
}
function lineWidth(weight){return .35+weight*5.65;}

function addToken(parent,x,y,value,color=COLORS.forward){
 const group=el('g',{visibility:'hidden'},parent);
 el('rect',{x,y,width:50,height:25,rx:4,fill:'#192b24',stroke:color,'stroke-width':1},group);
 label(group,x+25,y+18,value,{'text-anchor':'middle','font-size':12});
 return group;
}

function create(host,index){
 const mode=host.dataset.networkDemo;
 if(!['training','inference','decode'].includes(mode))return;
 const titles={training:'Training through a weighted neural network',inference:'Inference through a weighted neural network',decode:'Decode through a weighted neural network'};
 const descriptions={
  training:'Activations flow forward through weighted connections, gradients flow backward, and connection thickness changes as weights update between zero and one.',
  inference:'A forward pass through fixed weighted connections generates the next token.',
  decode:'A forward pass through fixed weighted connections generates the next token.'
 };
 const svg=el('svg',{viewBox:'0 0 700 250',role:'img','aria-labelledby':`network-title-${index} network-desc-${index}`,preserveAspectRatio:'xMidYMid meet'},host);
 el('title',{id:`network-title-${index}`},svg,titles[mode]);
 el('desc',{id:`network-desc-${index}`},svg,descriptions[mode]);

 const defs=el('defs',{},svg);
 const glow=el('filter',{id:`network-glow-${index}`,x:'-80%',y:'-80%',width:'260%',height:'260%'},defs);
 el('feGaussianBlur',{stdDeviation:'3',result:'blur'},glow);
 const merge=el('feMerge',{},glow);
 el('feMergeNode',{in:'blur'},merge);el('feMergeNode',{in:'SourceGraphic'},merge);

 const drawing=el('g',{'aria-hidden':'true'},svg);
 const counts=[3,5,4,3],xs=[54,250,450,646];
 const layers=counts.map((count,layer)=>Array.from({length:count},(_,node)=>({x:xs[layer],y:24+node*(144/(count-1)),layer,node})));
 const oldWeightLayer=el('g',{},drawing),edgeLayer=el('g',{},drawing);
 const edges=[];
 for(let layer=0;layer<layers.length-1;layer++)for(const from of layers[layer])for(const to of layers[layer+1]){
  const edgeIndex=edges.length,weight=initialWeight(edgeIndex);
  const oldLine=el('line',{x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:COLORS.muted,'stroke-width':lineWidth(weight),'stroke-linecap':'round','stroke-dasharray':'2 3',visibility:'hidden'},oldWeightLayer);
  const line=el('line',{x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:COLORS.edge,'stroke-width':lineWidth(weight),'stroke-linecap':'round',opacity:.14+weight*.62},edgeLayer);
  edges.push({from,to,layer,index:edgeIndex,baseWeight:weight,weight,line,oldLine});
 }
 const nodes=layers.map(layer=>layer.map(point=>el('circle',{cx:point.x,cy:point.y,r:9,fill:COLORS.bg,stroke:COLORS.muted,'stroke-width':1.5},drawing)));
 const pulses=edges.map(edge=>[el('circle',{
  r:2.3+edge.weight*2.2,fill:COLORS.forward,visibility:'hidden',
  ...(mode==='training'?{filter:`url(#network-glow-${index})`}:{})
 },drawing)]);

 const footer=label(drawing,350,238,'',{'text-anchor':'middle','font-size':14});
 const tokens=[];
 if(mode==='inference'||mode==='decode'){
  ['The','sky','is'].forEach((token,i)=>tokens.push(addToken(drawing,219+i*55,202,token)));
  tokens.push(addToken(drawing,384,202,'blue',COLORS.backward));
 }

 const demo={host,mode,elapsed:0,visible:false,render};

 function setNodes(activeLayer,color,amount=1){
  nodes.forEach((layerNodes,layerIndex)=>layerNodes.forEach(node=>{
   const active=layerIndex===activeLayer;
   node.setAttribute('stroke',active?color:COLORS.muted);
   node.setAttribute('stroke-width',active?2.6:1.5);
   node.setAttribute('fill',active?`${color}28`:COLORS.bg);
   node.setAttribute('opacity',active?.65+.35*amount:1);
   if(active)node.setAttribute('filter',`url(#network-glow-${index})`);else node.removeAttribute('filter');
  }));
 }

 function hidePulses(){pulses.flat().forEach(pulse=>pulse.setAttribute('visibility','hidden'));}
 function placePulse(edge,pulse,travel,color){
  pulse.setAttribute('visibility','visible');
  pulse.setAttribute('cx',edge.from.x+(edge.to.x-edge.from.x)*travel);
  pulse.setAttribute('cy',edge.from.y+(edge.to.y-edge.from.y)*travel);
  pulse.setAttribute('fill',color);
  pulse.setAttribute('r',2.3+edge.weight*2.2);
  pulse.setAttribute('opacity',.35+edge.weight*.65);
 }

 function render(staticFrame=false){
  const cycle=mode==='training'?6:3;
  const cycleTime=demo.elapsed%cycle,round=Math.floor(demo.elapsed/cycle);
  let phase='forward',progress=cycleTime/2,tokenCount=0;

  if(mode==='training'){
   if(cycleTime<2){phase='forward';progress=cycleTime/2;}
   else if(cycleTime<4){phase='backward';progress=(cycleTime-2)/2;}
   else{phase='update';progress=(cycleTime-4)/2;}
   if(staticFrame){phase='update';progress=1;}
   footer.textContent=phase==='forward'?'forward pass':phase==='backward'?'backpropagation':'weights update · thicker ↑  thinner ↓';
  }else{
   phase='forward';progress=cycleTime/2.25;tokenCount=progress>.86?4:3;
   if(staticFrame){progress=1;tokenCount=4;}
   footer.textContent='';
  }

  const backwards=phase==='backward',signalColor=backwards?COLORS.backward:COLORS.forward;
  const layerPosition=backwards?(1-clamp(progress))*3:clamp(progress)*3;
  setNodes(phase==='update'?-1:Math.round(layerPosition),signalColor,1-Math.abs(Math.round(layerPosition)-layerPosition));
  hidePulses();

  edges.forEach((edge,edgeIndex)=>{
   const before=round===0?edge.baseWeight:trainedWeight(edge.baseWeight,edgeIndex,round-1);
   const after=trainedWeight(edge.baseWeight,edgeIndex,round);
   const delta=after-before,updating=mode==='training'&&phase==='update';
   edge.weight=mode==='training'?(phase==='update'?before+(after-before)*ease(progress):before):edge.baseWeight;
   edge.oldLine.setAttribute('visibility',updating?'visible':'hidden');
   if(updating){
    edge.oldLine.setAttribute('stroke-width',lineWidth(before));
    edge.oldLine.setAttribute('opacity',.16+Math.abs(delta)*.7);
   }
   edge.line.setAttribute('stroke-width',lineWidth(edge.weight));
   edge.line.setAttribute('opacity',updating?.38+Math.abs(delta)*1.5:.14+edge.weight*.7);
   edge.line.setAttribute('stroke',updating?(delta>=0?COLORS.forward:COLORS.backward):COLORS.edge);

   if(phase!=='update'){
    const local=backwards?(1-clamp(progress))*3-edge.layer:clamp(progress)*3-edge.layer;
    if(local>=0&&local<=1&&progress<=1)placePulse(edge,pulses[edgeIndex][0],local,signalColor);
   }
  });

  if(phase==='update'){
   const shimmer=.45+.55*Math.sin(progress*Math.PI);
   nodes.flat().forEach(node=>{node.setAttribute('stroke',COLORS.forward);node.setAttribute('stroke-width',1.5+shimmer);});
  }
  tokens.forEach((group,tokenIndex)=>group.setAttribute('visibility',tokenIndex<tokenCount?'visible':'hidden'));
 }

 render(motion.matches);demos.push(demo);return demo;
}

document.querySelectorAll('[data-network-demo]').forEach(create);
function runnable(){return !motion.matches&&!document.hidden&&demos.some(demo=>demo.visible);}
function tick(now){
 frame=0;if(!runnable()){lastTime=0;return;}
 const delta=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;
 for(const demo of demos)if(demo.visible){demo.elapsed+=delta;demo.render();}
 frame=requestAnimationFrame(tick);
}
function sync(){if(!runnable()){if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;}else if(!frame)frame=requestAnimationFrame(tick);}
if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const demo=demos.find(item=>item.host===entry.target);if(demo)demo.visible=entry.isIntersecting;}sync();},{threshold:0});
 for(const demo of demos)observer.observe(demo.host);
}else{for(const demo of demos)demo.visible=true;sync();}
motion.addEventListener('change',()=>{for(const demo of demos)demo.render(motion.matches);sync();});
document.addEventListener('visibilitychange',sync);
})();
