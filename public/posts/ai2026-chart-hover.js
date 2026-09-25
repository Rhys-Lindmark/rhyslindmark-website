/* Shared OWID-style chart readout. Renderers provide chart coordinates and values;
   this module owns pointer/touch/keyboard input, guides, markers, bounds and a11y. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg',instances=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
 const tip=document.createElement('div');tip.className='owid-hover-tooltip';tip.hidden=true;wrap.append(tip);
 const live=document.createElement('span');live.className='owid-hover-live';live.id=`chart-hover-${Math.random().toString(36).slice(2)}`;wrap.append(live);
 svg.setAttribute('tabindex','0');svg.setAttribute('aria-describedby',live.id);svg.classList.add('owid-hover-surface');
 let active=false,index=0,last=null,pointerFocus=false;
 const keyboard=options.keyboard?.length?options.keyboard:Array.from({length:21},(_,i)=>({x:bounds.left+(bounds.right-bounds.left)*i/20,y:(bounds.top+bounds.bottom)/2}));
 function hide(){active=false;tip.hidden=true;overlay.style.display='none';live.textContent='';}
 function show(point){
  const datum=options.get(point);if(!datum||!datum.items?.length){hide();return;}
  active=true;last={point,datum};overlay.style.display='';dots.replaceChildren();
  const gx=datum.x??point.x,gy=datum.y??point.y;
  if(datum.guide==='y'){guide.setAttribute('x1',bounds.left);guide.setAttribute('x2',bounds.right);guide.setAttribute('y1',gy);guide.setAttribute('y2',gy);guide.style.display='';}
  else if(datum.guide===false)guide.style.display='none';
  else{guide.setAttribute('x1',gx);guide.setAttribute('x2',gx);guide.setAttribute('y1',bounds.top);guide.setAttribute('y2',bounds.bottom);guide.style.display='';}
  for(const item of datum.items){if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;svgNode('circle',{cx:item.x,cy:item.y,r:4.5,fill:item.color||'#fff','class':'owid-hover-dot'},dots);}
  tip.replaceChildren();const title=document.createElement('strong');title.textContent=datum.title;tip.append(title);
  const list=document.createElement('div');list.className='owid-hover-values';for(const item of datum.items){const row=document.createElement('div'),key=document.createElement('span'),value=document.createElement('b'),swatch=document.createElement('i');swatch.style.setProperty('--color',item.color||'#b8cad8');key.append(swatch,document.createTextNode(item.label));value.textContent=item.value;row.append(key,value);list.append(row);}tip.append(list);tip.hidden=false;
  live.textContent=`${datum.title}. ${datum.items.map(item=>`${item.label}: ${item.value}`).join('. ')}`;
  const wrapRect=wrap.getBoundingClientRect(),svgRect=svg.getBoundingClientRect(),sx=svgRect.width/svg.viewBox.baseVal.width,sy=svgRect.height/svg.viewBox.baseVal.height;
  let left=(gx-svg.viewBox.baseVal.x)*sx+(svgRect.left-wrapRect.left)+12,top=(gy-svg.viewBox.baseVal.y)*sy+(svgRect.top-wrapRect.top)-tip.offsetHeight/2;
  if(left+tip.offsetWidth>wrap.clientWidth-6)left=(gx-svg.viewBox.baseVal.x)*sx+(svgRect.left-wrapRect.left)-tip.offsetWidth-12;
  left=clamp(left,6,Math.max(6,wrap.clientWidth-tip.offsetWidth-6));top=clamp(top,6,Math.max(6,wrap.clientHeight-tip.offsetHeight-6));tip.style.transform=`translate(${left}px,${top}px)`;
 }
 function pointer(event){const p=localPoint(svg,event);show({x:clamp(p.x,bounds.left,bounds.right),y:clamp(p.y,bounds.top,bounds.bottom)});}
 function key(event){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape'].includes(event.key))return;if(event.key==='Escape'){hide();return;}event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=keyboard.length-1;else index=clamp(index+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1),0,keyboard.length-1);show(keyboard[index]);}
 const enter=event=>pointer(event),move=event=>pointer(event),down=event=>{pointerFocus=true;pointer(event);},leave=()=>{if(document.activeElement!==svg)hide();},focus=()=>{if(!pointerFocus)show(keyboard[index]);},blur=()=>{pointerFocus=false;hide();},context=event=>event.preventDefault();
 svg.addEventListener('pointerenter',enter);svg.addEventListener('pointermove',move);svg.addEventListener('pointerdown',down);svg.addEventListener('pointerleave',leave);svg.addEventListener('keydown',key);svg.addEventListener('focus',focus);svg.addEventListener('blur',blur);svg.addEventListener('contextmenu',context);
 window.addEventListener('scroll',hide,{passive:true});
 const destroy=()=>{svg.removeEventListener('pointerenter',enter);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointerleave',leave);svg.removeEventListener('keydown',key);svg.removeEventListener('focus',focus);svg.removeEventListener('blur',blur);svg.removeEventListener('contextmenu',context);window.removeEventListener('scroll',hide);tip.remove();live.remove();overlay.remove();};
 const api={destroy,hide,refresh(){if(active&&last)show(last.point);}};instances.set(svg,api);return api;
}
window.AIChartHover={attach};
})();
