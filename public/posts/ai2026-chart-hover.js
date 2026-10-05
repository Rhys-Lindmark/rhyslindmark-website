/* Shared OWID-style chart readout. Renderers provide chart coordinates and values;
   this module owns pointer/touch/keyboard input, guides, markers, bounds and a11y. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg',instances=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mobile=matchMedia('(max-width:760px)');
let dismissCurrent=null;
function svgNode(tag,attrs,parent){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
function localPoint(svg,event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function attach(svg,options){
 instances.get(svg)?.destroy();
 const wrap=svg.closest('.plot-wrap,.benchmark-figure,.native-plot,.usage-chart,.epoch-plot,.rd-plot');if(!wrap)return null;
 // SVG titles trigger a second, browser-native tooltip over our chart readout.
 // Keep the chart's accessible name before removing titles from the SVG and marks.
 const chartTitle=svg.querySelector(':scope > title')?.textContent?.trim();
 if(chartTitle&&!svg.hasAttribute('aria-label')&&!svg.hasAttribute('aria-labelledby'))svg.setAttribute('aria-label',chartTitle);
 svg.querySelectorAll('title').forEach(node=>node.remove());
 svg.querySelectorAll('[title]').forEach(node=>node.removeAttribute('title'));
 svg.removeAttribute('title');
 const bounds=options.bounds,overlay=svgNode('g',{'class':'owid-hover-overlay','aria-hidden':'true'},svg),guide=svgNode('line',{'class':'owid-hover-guide'},overlay),dots=svgNode('g',{},overlay);
 // A body-level panel stays outside the pinned scene's clipping and transforms.
 const tip=document.createElement('div');tip.className='owid-hover-tooltip';tip.hidden=true;document.body.append(tip);
 const live=document.createElement('span');live.className='owid-hover-live';live.id=`chart-hover-${Math.random().toString(36).slice(2)}`;wrap.append(live);
 svg.setAttribute('tabindex','0');svg.setAttribute('aria-describedby',live.id);svg.classList.add('owid-hover-surface');
 let active=false,index=0,last=null,pointerFocus=false,panelFocus=false;
 const keyboard=options.keyboard?.length?options.keyboard:Array.from({length:21},(_,i)=>({x:bounds.left+(bounds.right-bounds.left)*i/20,y:(bounds.top+bounds.bottom)/2}));
 function hide(){active=false;tip.hidden=true;overlay.style.display='none';live.textContent='';if(dismissCurrent===hide)dismissCurrent=null;}
 function available(){
  const scene=svg.closest('.scene'),sticky=scene?.querySelector('.sticky');
  if(!document.body.classList.contains('all-mode')&&sticky&&getComputedStyle(sticky).position==='sticky'&&Number(scene.dataset.progress||0)<.9999)return false;
  const matrix=svg.getScreenCTM();if(!matrix)return false;
  const corners=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.left,bounds.bottom],[bounds.right,bounds.bottom]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const viewport=window.visualViewport,top=viewport?.offsetTop||0,bottom=top+(viewport?.height||innerHeight);
  const headerBottom=Math.max(top,document.querySelector('header')?.getBoundingClientRect().bottom||0);
  return Math.min(...corners.map(p=>p.y))>=headerBottom-2&&Math.max(...corners.map(p=>p.y))<=bottom+2&&Math.min(...corners.map(p=>p.x))>=-2&&Math.max(...corners.map(p=>p.x))<=innerWidth+2;
 }
 function show(point){
  if(!available()){hide();return;}
  const datum=options.get(point);if(!datum||!datum.items?.length){hide();return;}
  if(dismissCurrent&&dismissCurrent!==hide)dismissCurrent();dismissCurrent=hide;
  active=true;last={point,datum};overlay.style.display='';dots.replaceChildren();
  const gx=datum.x??point.x,gy=datum.y??point.y;
  if(datum.guide==='y'){guide.setAttribute('x1',bounds.left);guide.setAttribute('x2',bounds.right);guide.setAttribute('y1',gy);guide.setAttribute('y2',gy);guide.style.display='';}
  else if(datum.guide===false)guide.style.display='none';
  else{guide.setAttribute('x1',gx);guide.setAttribute('x2',gx);guide.setAttribute('y1',bounds.top);guide.setAttribute('y2',bounds.bottom);guide.style.display='';}
  for(const item of datum.items){if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;svgNode('circle',{cx:item.x,cy:item.y,r:4.5,fill:item.color||'#fff','class':'owid-hover-dot'},dots);}
  tip.replaceChildren();const title=document.createElement('strong');title.textContent=datum.title;tip.append(title);
  const close=document.createElement('button');close.className='owid-hover-close';close.type='button';close.setAttribute('aria-label','Close chart values');close.textContent='×';close.addEventListener('click',hide);tip.append(close);
  const list=document.createElement('div');list.className='owid-hover-values';for(const item of datum.items){const row=document.createElement('div'),key=document.createElement('span'),value=document.createElement('b'),swatch=document.createElement('i');swatch.style.setProperty('--color',item.color||'#b8cad8');key.append(swatch,document.createTextNode(item.label));value.textContent=item.value;row.append(key,value);list.append(row);}tip.append(list);tip.hidden=false;
  live.textContent=`${datum.title}. ${datum.items.map(item=>`${item.label}: ${item.value}`).join('. ')}`;
  if(mobile.matches){
   tip.style.transform='none';
   const viewport=window.visualViewport;
   tip.style.setProperty('--hover-viewport-bottom',`${Math.max(0,innerHeight-(viewport?viewport.offsetTop+viewport.height:innerHeight))}px`);
  }else{
   const anchor=new DOMPoint(gx,gy).matrixTransform(svg.getScreenCTM());
   const rect=wrap.getBoundingClientRect();
   let left=anchor.x+12,top=anchor.y-tip.offsetHeight/2;
   if(left+tip.offsetWidth>Math.min(innerWidth,rect.right)-6)left=anchor.x-tip.offsetWidth-12;
   left=clamp(left,Math.max(6,rect.left+6),Math.max(6,Math.min(innerWidth,rect.right)-tip.offsetWidth-6));
   top=clamp(top,Math.max(6,rect.top+6),Math.max(6,Math.min(innerHeight,rect.bottom)-tip.offsetHeight-6));
   tip.style.transform=`translate(${left}px,${top}px)`;
  }
 }
 function pointer(event){const p=localPoint(svg,event);if(p.x<bounds.left-.001||p.x>bounds.right+.001||p.y<bounds.top-.001||p.y>bounds.bottom+.001){hide();return;}show({x:clamp(p.x,bounds.left,bounds.right),y:clamp(p.y,bounds.top,bounds.bottom)});}
 function key(event){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape'].includes(event.key))return;if(event.key==='Escape'){hide();return;}event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=keyboard.length-1;else index=clamp(index+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1),0,keyboard.length-1);show(keyboard[index]);}
 const enter=event=>pointer(event),move=event=>pointer(event),down=event=>{pointerFocus=true;pointer(event);},leave=()=>{if(!mobile.matches&&document.activeElement!==svg)hide();},focus=()=>{if(!pointerFocus)show(keyboard[index]);},blur=()=>{pointerFocus=false;if(!mobile.matches||!panelFocus)hide();},context=event=>event.preventDefault();
 svg.addEventListener('pointerenter',enter);svg.addEventListener('pointermove',move);svg.addEventListener('pointerdown',down);svg.addEventListener('pointerleave',leave);svg.addEventListener('keydown',key);svg.addEventListener('focus',focus);svg.addEventListener('blur',blur);svg.addEventListener('contextmenu',context);
 window.addEventListener('scroll',hide,{passive:true});
 const outside=event=>{panelFocus=tip.contains(event.target);if(!svg.contains(event.target)&&!panelFocus)hide();};
 document.addEventListener('pointerdown',outside);window.addEventListener('resize',hide);window.visualViewport?.addEventListener('resize',hide);window.visualViewport?.addEventListener('scroll',hide);
 const destroy=()=>{hide();svg.removeEventListener('pointerenter',enter);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointerleave',leave);svg.removeEventListener('keydown',key);svg.removeEventListener('focus',focus);svg.removeEventListener('blur',blur);svg.removeEventListener('contextmenu',context);window.removeEventListener('scroll',hide);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',hide);window.visualViewport?.removeEventListener('resize',hide);window.visualViewport?.removeEventListener('scroll',hide);tip.remove();live.remove();overlay.remove();};
 const api={destroy,hide,refresh(){if(active&&last)show(last.point);}};instances.set(svg,api);return api;
}
window.AIChartHover={attach};
})();
