/* Native, source-derived charts for AI 2026 Part 3. */
(async()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const colors=['#43a9ff','#ff914f','#39ffc1','#f1cf65','#bda1ff','#8ca5b5'];
const muted='#91a6b5',grid='#263744',ink='#e6edf3';
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
const make=(tag,attrs={},parent,text)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;parent?.append(e);return e};
const text=(parent,x,y,value,attrs={})=>make('text',{x,y,...attrs},parent,value);
const compact=n=>Math.abs(n)>=1e12?`${+(n/1e12).toFixed(1)}T`:Math.abs(n)>=1e9?`${+(n/1e9).toFixed(1)}B`:Math.abs(n)>=1e6?`${+(n/1e6).toFixed(1)}M`:Math.abs(n)>=1000?`${+(n/1000).toFixed(1)}k`:String(+n.toFixed(2));
function format(n,kind){if(kind==='year')return Number.isInteger(n)?String(n):n.toFixed(1);if(kind==='percent')return `${+n.toFixed(2)}%`;if(kind==='dollars')return '$'+compact(n);if(kind==='compact')return compact(n);return String(+n.toFixed(2))}
function scaler(spec,lo,hi){const[d0,d1]=spec.domain;const fn=spec.scale==='log'?Math.log10:v=>v;return v=>lo+(fn(v)-fn(d0))/(fn(d1)-fn(d0))*(hi-lo)}
function ticks(spec){if(spec.ticks)return spec.ticks;const[a,b]=spec.domain;return Array.from({length:5},(_,i)=>a+(b-a)*i/4)}
function title(parent,value){make('title',{},parent,value)}
function wrapLabel(parent,value,x,y,max=25,attrs={}){const words=String(value).split(' '),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);const e=text(parent,x,y,'',attrs);lines.forEach((v,i)=>make('tspan',{x,dy:i?'1.15em':0},e,v));return e}
function linePath(points,x,y){return points.map(([a,b],i)=>`${i?'L':'M'}${x(a)},${y(b)}`).join(' ')}
function addLegend(scene,series){const l=scene.querySelector('.native-legend');l.replaceChildren();series.forEach((s,i)=>{const span=document.createElement('span'),marker=document.createElement('i');marker.style.background=s.color||colors[i%colors.length];if(scene.id==='tfp')span.dataset.series=s.name;span.append(marker,document.createTextNode(s.name||s.label));l.append(span)});l.hidden=!series.length}
function frame(svg,W,H,xs,ys,opts={}){const small=W<620,m={l:small?58:76,r:small?20:28,t:20,b:small?65:65,...opts};const left=m.l,right=W-m.r,top=m.t,bottom=H-m.b,x=scaler(xs,left,right),y=scaler(ys,bottom,top);for(const v of ticks(ys)){make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);text(svg,left-9,y(v)+4,format(v,ys.format),{'text-anchor':'end',class:'axis-tick'})}for(const v of ticks(xs)){make('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:grid,'stroke-dasharray':'2 5'},svg);text(svg,x(v),bottom+21,format(v,xs.format),{'text-anchor':'middle',class:'axis-tick'})}text(svg,(left+right)/2,H-8,xs.label||'',{'text-anchor':'middle',class:'axis-label'});text(svg,14,(top+bottom)/2,ys.label||'',{transform:`rotate(-90 14 ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});return{x,y,left,right,top,bottom,width:right-left,height:bottom-top}}
const stateOf=scene=>({progress:Number(scene.dataset.progress||0),stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
const progress=s=>s.reduced?1:ease((s.progress-.03)/.72);
function revealGroup(svg,id,box){const defs=make('defs',{},svg),clip=make('clipPath',{id},defs),rect=make('rect',{x:box.left-6,y:box.top-12,width:0,height:box.height+24},clip),group=make('g',{'clip-path':`url(#${id})`},svg);return{group,set:p=>rect.setAttribute('width',(box.width+18)*p)}}
function cartesian(svg,scene,d,W,H,kind){const series=d.series||[];addLegend(scene,series);const a=frame(svg,W,H,d.x,d.y),reveal=revealGroup(svg,`reveal-${scene.id}`,a);const g=reveal.group;
if(d.scenarioStart!==undefined){const xx=a.x(d.scenarioStart);make('rect',{x:xx,y:a.top,width:a.right-xx,height:a.height,fill:'#91a6b5',opacity:'.06'},svg);text(svg,xx+7,a.top+14,'SCENARIO',{class:'annotation'})}
let cumulative=[];
series.forEach((s,i)=>{const color=s.color||colors[i%colors.length],points=s.points||[];let path;
if(kind==='area'){
const lower=points.map(([xx],j)=>[xx,cumulative[j]||0]);const upper=points.map(([xx,yy],j)=>[xx,(cumulative[j]||0)+yy]);cumulative=upper.map(p=>p[1]);path=linePath(upper,a.x,a.y)+' '+lower.reverse().map(([xx,yy])=>`L${a.x(xx)},${a.y(yy)}`).join(' ')+' Z';make('path',{d:path,fill:color,opacity:'.65',stroke:color,'stroke-width':W<620?1.8:2.5},g);
}else{make('path',{d:linePath(points,a.x,a.y),fill:'none',stroke:color,'stroke-width':W<620?2.5:3.5,'stroke-dasharray':s.dashed?'6 5':''},g);points.forEach(([xx,yy])=>{const dot=make('circle',{cx:a.x(xx),cy:a.y(yy),r:2.5,fill:color},g);title(dot,`${s.name}: ${format(xx,d.x.format)}, ${format(yy,d.y.format)}`)})}
});
for(const b of d.bubbles||[]){const r=Math.max(5,Math.min(W*.065,Math.sqrt(b.value/(d.bubbleMax||Math.max(...d.bubbles.map(q=>q.value))))*W*.065));make('circle',{cx:a.x(b.x),cy:a.y(b.y),r,fill:'#f1cf65','fill-opacity':'.2',stroke:'#f1cf65'},g);text(g,a.x(b.x),a.y(b.y)-r-7,b.label||compact(b.value),{'text-anchor':'middle',class:'annotation'})}
for(const q of d.annotations||[]){text(g,a.x(q.x)+5,a.y(q.y)-9,q.label,{class:'annotation'})}
return s=>reveal.set(progress(s))}
function experienceCurves(svg,scene,d,W,H){
 const order=[1,0,2],firstStage=[1,0,2,2];
 addLegend(scene,order.map(i=>({...d.series[i],color:d.series[i].color||colors[i%colors.length]})));
 const legend=[...scene.querySelectorAll('.native-legend span')],a=frame(svg,W,H,d.x,d.y);
 const defs=make('defs',{},svg);
 const groups=d.series.map((series,i)=>{
  const color=series.color||colors[i%colors.length],clipId=`${scene.id}-reveal-${i}`;
  const startX=a.x(i===3?d.series[2].points[0][0]:series.points[0][0])-4;
  const endPoints=i===2?d.series[3].points:series.points;
  const span=a.x(endPoints[endPoints.length-1][0])+4-startX;
  const clip=make('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'},defs);
  const window=make('rect',{x:startX,y:a.top-4,width:0,height:a.height+8},clip);
  const g=make('g',{'clip-path':`url(#${clipId})`},svg);
  make('path',{d:linePath(series.points,a.x,a.y),fill:'none',stroke:color,'stroke-width':W<620?2.5:3.5,'stroke-dasharray':series.dashed?'6 5':''},g);
  series.points.forEach(([x,y])=>{const dot=make('circle',{cx:a.x(x),cy:a.y(y),r:2.5,fill:color},g);title(dot,`${series.name}: ${format(x,d.x.format)}, ${format(y,d.y.format)}`)});
  return {g,window,span};
 });
 const notes=(d.annotations||[]).map(note=>{
  const g=make('g',{},svg),index=note.label.startsWith('Solar')?1:note.label.startsWith('Cars')?0:2;
  g.style.transition='opacity .4s ease';
  text(g,a.x(note.x)+5,a.y(note.y)-9,note.label,{class:'annotation'});
  return {g,index};
 });
 return state=>{
  const stage=state.reduced?Infinity:state.stage;
  const reveal=i=>state.reduced||stage>firstStage[i]?1:stage===firstStage[i]?clamp(state.local*(i>=2?3:1)):0;
  groups.forEach(({g,window,span},i)=>{const amount=reveal(i);window.setAttribute('width',span*amount);g.style.pointerEvents=amount?'auto':'none'});
  notes.forEach(({g,index})=>{g.style.opacity=reveal(index)>.85?'1':'0'});
  legend.forEach((item,j)=>{item.style.visibility=stage>=firstStage[order[j]]?'visible':'hidden'});
 };
}
function bars(svg,scene,d,W,H){const series=d.series||[{name:''}],rows=d.rows;addLegend(scene,series.filter(s=>s.name));const horizontal=d.orientation!=='vertical';const val=d.value||{domain:[0,Math.max(...rows.map(r=>d.stacked?r.values.reduce((a,b)=>a+b,0):Math.max(...r.values)))],label:'',format:'compact'};const small=W<620,marks=[];
if(horizontal){const left=small?Math.min(142,W*.39):Math.min(245,W*.31),right=W-(small?44:60),top=18,bottom=H-60;const x=scaler(val,left,right),zero=val.scale==='log'?val.domain[0]:Math.max(0,val.domain[0]);for(const v of ticks(val)){make('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:grid},svg);text(svg,x(v),bottom+22,format(v,val.format),{'text-anchor':'middle',class:'axis-tick'})}text(svg,(left+right)/2,H-8,val.label||'',{'text-anchor':'middle',class:'axis-label'});const step=(bottom-top)/rows.length;rows.forEach((r,i)=>{const cy=scene.id==='waymo-data'&&rows.length===3?top+(bottom-top)*[.19,.36,.94][i]:top+step*(i+.5),h=Math.min(step*.62,50);const label=wrapLabel(svg,r.label,left-10,cy+(r.label.length>(small?18:28)?-4:4),small?18:28,{'text-anchor':'end',class:'row-label'});title(label,r.label);let total=0;r.values.forEach((v,j)=>{if(v===null)return;const base=d.stacked?total:zero;const yy=d.stacked?cy-h/2:cy-h/2+j*h/r.values.length;const bh=d.stacked?h:h/r.values.length-2;const rect=make('rect',{x:x(base),y:yy,width:0,height:Math.max(2,bh),rx:1,fill:series[j]?.color||colors[j%colors.length]},svg);title(rect,`${r.label} · ${series[j]?.name||''}: ${format(v,val.format)}`);const end=d.stacked?base+v:v;marks.push({el:rect,attr:'width',value:Math.max(0,x(end)-x(base)),i,j});total+=v;});const end=d.stacked?total:Math.max(...r.values.filter(v=>v!==null));const labelValue=r.valueLabel||r.totalLabel||(d.stacked?format(total,val.format):r.values.length===1?format(end,val.format):'');if(labelValue){const t=text(svg,x(end)+7,cy+4,labelValue,{class:'value-label'});marks.push({el:t,attr:'opacity',value:1,i,j:0})}})
}else{const left=small?54:70,right=W-20,top=20,bottom=H-(scene.id==='app-revenue'?128:75),y=scaler(val,bottom,top);for(const v of ticks(val)){make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);text(svg,left-8,y(v)+4,format(v,val.format),{'text-anchor':'end',class:'axis-tick'})}text(svg,13,(top+bottom)/2,val.label||'',{transform:`rotate(-90 13 ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});const step=(right-left)/rows.length;rows.forEach((r,i)=>{const cx=left+(i+.5)*step,w=step*.7;wrapLabel(svg,r.label.replace('–',' – '),cx,bottom+20,rows.length<=2?18:small?5:7,{'text-anchor':'middle',class:'row-label'});if(r.detail){wrapLabel(svg,r.detail,cx,top+Math.min(220,H*.4),small?18:28,{'text-anchor':'middle',class:'labor-detail'});}let total=0;r.values.forEach((v,j)=>{if(v===null)return;const base=d.stacked?total:0;const xx=d.stacked?cx-w/2:cx-w/2+j*w/r.values.length;const bw=d.stacked?w:w/r.values.length-3;const end=base+v;const rect=make('rect',{x:xx,y:y(base),width:Math.max(2,bw),height:0,fill:series[j]?.color||colors[j%colors.length]},svg);if(scene.id==='tfp')rect.dataset.series=series[j]?.name||'';title(rect,`${r.label} · ${series[j]?.name||''}: ${format(v,val.format)}`);marks.push({el:rect,attr:'height',value:y(base)-y(end),baseline:y(base),i,j});if(!d.stacked){const t=text(svg,xx+bw/2,y(end)-7,r.valueLabels?.[j]||format(v,val.format),{'text-anchor':'middle',class:'value-label'});marks.push({el:t,attr:'opacity',value:1,i,j})}total+=v});if(d.stacked){const t=text(svg,cx,y(total)-8,r.totalLabel||format(total,val.format),{'text-anchor':'middle',class:'value-label'});marks.push({el:t,attr:'opacity',value:1,i,j:0})}})}
svg.querySelectorAll('.labor-detail').forEach(e=>svg.append(e));
if(scene.id==='tfp'){
 const top=20,bottom=H-75,left=small?54:70,right=W-20,clipId='tfp-drop-window';
 const defs=make('defs',{},svg),clip=make('clipPath',{id:clipId},defs);
 make('path',{d:`M${left-2},${top} H${right+2} V${bottom} H${left-2} Z`},clip);
 const bars=marks.filter(m=>m.attr==='height'),layer=make('g',{'clip-path':`url(#${clipId})`},svg);
 svg.insertBefore(layer,bars[0].el);
 bars.forEach(m=>{m.el.setAttribute('height',m.value);m.el.setAttribute('y',m.baseline-m.value);layer.append(m.el)});
 return s=>{scene.dataset.focus=s.reduced||s.stage!==2?'':(['Electricity','Cars','Computers'][Math.min(2,Math.floor(s.local*3))]);marks.forEach(m=>{
  const amount=s.reduced||s.stage>1?1:ease(clamp((s.stage<1?0:s.local-m.i*.025)/.19));
  if(m.attr==='opacity'){m.el.style.opacity=amount>=.95?'1':'0';m.el.style.visibility=amount>=.95?'visible':'hidden'}
  else m.el.setAttribute('transform',`translate(0 ${(top-12-bottom)*(1-amount)})`);
 });};
}
return s=>{
 const waymo=scene.id==='waymo-data';
 const p=waymo?(s.reduced?1:ease(s.progress/.3)):progress(s);
 marks.forEach(m=>{
  const amount=waymo?p:s.reduced?1:clamp(p*(1+.2*rows.length)-m.i*.2);
  if(m.attr==='opacity')m.el.style.opacity=amount>=.99?'1':'0';
  else{m.el.setAttribute(m.attr,m.value*amount);if(m.baseline!==undefined)m.el.setAttribute('y',m.baseline-m.value*amount)}
 });
}
}
function laborMarketBars(svg,scene,d,W,H){
 addLegend(scene,[]);
 const small=W<620,rows=d.rows,val=d.value,left=small?54:70,right=W-20,top=20,bottom=H-75;
 const y=scaler(val,bottom,top),step=(right-left)/rows.length,marks=[];
 for(const v of ticks(val)){
  make('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:grid},svg);
  text(svg,left-8,y(v)+4,format(v,val.format),{'text-anchor':'end',class:'axis-tick'});
 }
 text(svg,13,(top+bottom)/2,val.label||'',{transform:`rotate(-90 13 ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});
 rows.forEach((row,i)=>{
  const cx=left+(i+.5)*step,w=step*.7,value=row.values[0],barTop=y(value);
  text(svg,cx,bottom+20,row.label,{'text-anchor':'middle',class:'row-label'});
  const rect=make('rect',{x:cx-w/2,y:bottom,width:w,height:0,fill:row.color||colors[i]},svg);
  title(rect,`${row.label}: ${format(value,val.format)} average annual wage`);
  marks.push({el:rect,height:bottom-barTop,baseline:bottom,i});
  const label=text(svg,cx,Math.max(top+11,barTop-(small?50:58)),'',{'text-anchor':'middle',class:'labor-detail'});
  (row.detailLines||[]).forEach((line,j)=>make('tspan',{x:cx,dy:j?'1.15em':0},label,line));
  marks.push({el:label,i});
 });
 return state=>{
  const p=state.reduced?1:ease(state.progress/.3);
  marks.forEach(mark=>{
   const amount=p;
   if(mark.height===undefined)mark.el.style.opacity=amount>=.99?'1':'0';
   else{mark.el.setAttribute('height',mark.height*amount);mark.el.setAttribute('y',mark.baseline-mark.height*amount)}
  });
 };
}
function whiteCollarBars(svg,scene,d,W,H){
 const series=d.series,rows=d.rows,val=d.value,small=W<620;
 addLegend(scene,series);
 const legend=[...scene.querySelectorAll('.native-legend span')];
 const left=small?Math.min(142,W*.39):Math.min(245,W*.31),right=W-(small?44:60),top=18,bottom=H-60;
 const x=scaler(val,left,right),step=(bottom-top)/rows.length;
 for(const v of ticks(val)){
  make('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:grid},svg);
  text(svg,x(v),bottom+22,format(v,val.format),{'text-anchor':'middle',class:'axis-tick'});
 }
 text(svg,(left+right)/2,H-8,val.label||'',{'text-anchor':'middle',class:'axis-label'});
 const rowMarks=rows.map((row,i)=>{
  const group=make('g',{'data-row':row.label},svg),cy=top+step*(i+.5),h=Math.min(step*.62,50);
  const label=wrapLabel(group,row.label,left-10,cy+(row.label.length>(small?18:28)?-4:4),small?18:28,{'text-anchor':'end',class:'row-label'});
  title(label,row.label);
  let total=0;
  const bars=row.values.map((value,j)=>{
   const start=total;
   total+=value||0;
   const rect=make('rect',{x:x(start),y:cy-h/2,width:0,height:h,rx:1,fill:series[j]?.color||colors[j%colors.length]},group);
   title(rect,`${row.label} · ${series[j]?.name||''}: ${format(value||0,val.format)}`);
   return {rect,width:Math.max(0,x(total)-x(start))};
  });
  text(group,x(total)+7,cy+4,row.totalLabel||format(total,val.format),{class:'value-label'});
  return {group,bars,software:row.label==='Software developers'};
 });
 return state=>{
  const showAll=state.reduced||document.body.classList.contains('all-mode');
  rowMarks.forEach(({group,bars,software},i)=>{
   const amount=showAll||software?1:state.stage===0?0:ease(clamp((state.local-i*.006)/.22));
   group.style.opacity=String(amount);
   group.style.visibility=amount>.001?'visible':'hidden';
   bars.forEach(({rect,width})=>rect.setAttribute('width',width*amount));
  });
  if(legend[1])legend[1].style.visibility=showAll||state.stage>0&&state.local>.1?'visible':'hidden';
 };
}
function scatter(svg,scene,d,W,H){addLegend(scene,d.groups||[]);const a=frame(svg,W,H,d.x,d.y);if(d.identityLine){make('path',{d:`M${a.x(d.x.domain[0])},${a.y(d.y.domain[0])} L${a.x(d.x.domain[1])},${a.y(d.y.domain[1])}`,stroke:'#8194a3','stroke-dasharray':'5 5',fill:'none'},svg)}const marks=[],labelBoxes=[];(d.points||[]).forEach((p,i)=>{const group=(d.groups||[]).findIndex(g=>(g.name||g.id)===p.group||g.id===p.group);const color=p.color||colors[Math.max(0,group)%colors.length],g=make('g',{opacity:0},svg);if(scene.id==='productivity')g.setAttribute('data-point',p.label);make('circle',{cx:a.x(p.x),cy:a.y(p.y),r:W<600?3.5:5,fill:color,'fill-opacity':'.8'},g);title(g,`${p.label||p.group||'Observation'}: ${p.x}, ${p.y}`);if(p.label&&(d.points.length<=20||p.labelImportant)){const label=text(g,0,0,p.label,{class:'point-label'}),box=label.getBBox(),px=a.x(p.x),py=a.y(p.y);let placed=false;for(const dy of [-10,16,-24,30,-38,44]){for(const side of [1,-1]){const xx=Math.max(a.left,Math.min(a.right-box.width,side===1?px+7:px-box.width-7)),yy=py+dy,b={x:xx,y:yy-box.height,w:box.width,h:box.height+3};if(b.y<a.top||yy>a.bottom||labelBoxes.some(q=>b.x<q.x+q.w+3&&b.x+b.w+3>q.x&&b.y<q.y+q.h&&b.y+b.h>q.y))continue;label.setAttribute('x',xx);label.setAttribute('y',yy);labelBoxes.push(b);placed=true;break}if(placed)break}if(!placed)label.remove();}marks.push(g)});for(const series of d.fit?[d.fit]:(d.trend||d.trends||[])){make('path',{d:linePath(series.points,a.x,a.y),fill:'none',stroke:series.color||'#f1cf65','stroke-dasharray':'4 5','stroke-width':2},svg)}if(d.fit?.label)text(svg,a.right-5,a.top+17,d.fit.label,{'text-anchor':'end',class:'annotation'});svg.querySelectorAll('.labor-detail').forEach(e=>svg.append(e));return s=>{const p=progress(s);marks.forEach((g,i)=>g.style.opacity=s.reduced||i/Math.max(1,marks.length-1)<=p?'1':'.06')}
}
function network(svg,scene,d,W,H){addLegend(scene,[]);const mobile=W<600,panels=['Graph','Knowledge graph','Context graph'];const groups=[];for(let k=0;k<3;k++){const g=make('g',{},svg);groups.push(g);const cx=mobile?W/2:W*(k+.5)/3,cy=mobile?H*(k+.5)/3:H*.48,r=mobile?Math.min(W*.2,H*.11):W*.11;const pts=Array.from({length:7},(_,i)=>[cx+Math.cos(i/7*2*Math.PI)*r,cy+Math.sin(i/7*2*Math.PI)*r]);pts.forEach(([x,y],i)=>{make('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:colors[k],'stroke-opacity':'.55','stroke-width':1.5},g);if(i<6)make('line',{x1:x,y1:y,x2:pts[i+1][0],y2:pts[i+1][1],stroke:grid},g);make('circle',{cx:x,cy:y,r:k===0?4:7,fill:colors[k]},g)});make('circle',{cx,cy,r:k===2?19:13,fill:colors[k]},g);text(g,cx,cy+4,k===0?'':k===1?'?':'why',{'text-anchor':'middle',fill:'#0b1015',class:'network-core'});text(g,cx,cy+r+34,panels[k],{'text-anchor':'middle',class:'network-label'});if(k===2){['decision','evidence','reason'].forEach((v,i)=>text(g,pts[i*2][0],pts[i*2][1]-14,v,{'text-anchor':'middle',class:'annotation'}))}}
return s=>groups.forEach((g,i)=>g.style.opacity=s.reduced?'1':String(clamp(progress(s)*3-i)))}
// Specialized source layouts are added below. All use the same typography and palette.
function rectangles(svg,scene,d,W,H){addLegend(scene,d.rectangles.map((r,i)=>({name:r.label,color:colors[i]})));const a=frame(svg,W,H,d.x,d.y),marks=[];d.rectangles.forEach((r,i)=>{const g=make('g',{},svg),rect=make('rect',{x:a.x(0),y:a.y(r.monthlyCost),width:0,height:a.y(0)-a.y(r.monthlyCost),fill:colors[i],'fill-opacity':i?'.8':'.22',stroke:colors[i],'stroke-width':2},g);title(rect,`${r.label}: ${r.duration} months × ${format(r.monthlyCost,'dollars')}/month = ${format(r.total,'dollars')}`);let label,leader;if(i===0){label=text(g,a.x(r.duration*.5),a.y(r.monthlyCost*.65),`${format(r.total,'dollars')} · ${r.duration} months`,{'text-anchor':'middle',class:'large-value'})}else{label=text(g,a.x(r.duration)+12,a.y(r.monthlyCost)-14,`${format(r.total,'dollars')} · ${r.duration} months`,{class:'large-value'});leader=make('line',{x1:a.x(r.duration),x2:a.x(r.duration)+10,y1:a.y(r.monthlyCost),y2:a.y(r.monthlyCost)-10,stroke:colors[i],opacity:0},g)}marks.push({rect,label,leader,r,i})});return s=>marks.forEach(({rect,label,leader,r,i})=>{const p=s.reduced?1:ease((s.progress-i*.33)/.4);rect.setAttribute('width',(a.x(r.duration)-a.x(0))*p);label.style.opacity=p===1?'1':'0';if(leader)leader.style.opacity=label.style.opacity})}
function pipeline(svg,scene,d,W,H){addLegend(scene,[{name:'Human time remaining',color:colors[0]},{name:'Time saved by AI',color:colors[2]}]);const small=W<620,left=small?38:84,right=W-16,width=right-left,top=H*.18;let total=0;const cols=d.stages.map(s=>{const start=total;total+=s.original;return{...s,start,x:left+width*start/100,w:width*s.original/100}});cols.forEach((c,i)=>{wrapLabel(svg,c.label,c.x+c.w/2,top-28,small?11:18,{'text-anchor':'middle',class:'row-label'});text(svg,c.x+c.w/2,top+22,`${c.original}%`,{'text-anchor':'middle',class:'axis-tick'});make('line',{x1:c.x,x2:c.x,y1:top+40,y2:H-75,stroke:grid},svg)});const marks=[];d.scenarios.forEach((r,i)=>{const g=make('g',{},svg),cy=H*(.43+i*.3),bh=Math.min(70,H*.12);text(g,left,cy-bh/2-18,`${r.label} · ${r.speedup}×`,{class:'large-value'});cols.forEach((c,j)=>{const remaining=make('rect',{x:c.x+1,y:cy-bh/2,width:c.w-3,height:bh,fill:colors[0]},g),saved=make('rect',{x:c.x+c.w-2,y:cy-bh/2,width:0,height:bh,fill:colors[2],'fill-opacity':'.22'},g);const label=text(g,c.x+c.w/2,cy+bh/2+18,`${r.remaining[j]}%`,{'text-anchor':'middle',class:'value-label'});title(remaining,`${r.label} · ${c.label}: ${r.remaining[j]}% of original workload remains`);marks.push({g,remaining,saved,label,c,target:r.remaining[j],i})})});text(svg,(left+right)/2,H-12,'SHARE OF ORIGINAL WORKLOAD (%)',{'text-anchor':'middle',class:'axis-label'});return s=>marks.forEach(m=>{const amount=s.reduced||s.stage>m.i+2?1:s.stage===m.i+2?ease(s.local/.45):0;const v=m.c.original+(m.target-m.c.original)*amount,w=width*v/100;m.remaining.setAttribute('width',Math.max(0,w-2));m.saved.setAttribute('x',m.c.x+w);m.saved.setAttribute('width',Math.max(0,m.c.w-w-2));m.g.style.opacity=s.reduced||s.stage<2||s.stage===m.i+2||(s.stage===4&&m.i===1)?'1':'.35';m.label.style.opacity=amount===1?'1':'0'})}
function farmMechanization(svg,scene,d,W,H){
 const small=W<620,left=small?52:72,right=W-(small?48:68),top=24,bottom=H-58;
 const x=scaler({domain:[1867,2012]},left,right),horseY=scaler({domain:[0,30]},bottom,top),machineY=scaler({domain:[0,6]},bottom,top);
 addLegend(scene,d.series);
 for(let i=0;i<=6;i++){
  const y=horseY(i*5);
  make('line',{x1:left,x2:right,y1:y,y2:y,stroke:grid},svg);
  text(svg,left-9,y+4,String(i*5),{'text-anchor':'end',class:'axis-tick'});
  text(svg,right+9,y+4,String(i),{class:'axis-tick'});
 }
 for(const year of [1867,1900,1930,1960,1990,2012]){
  text(svg,x(year),bottom+21,String(year),{'text-anchor':'middle',class:'axis-tick'});
 }
 text(svg,(left+right)/2,H-9,'YEAR',{'text-anchor':'middle',class:'axis-label'});
 text(svg,13,(top+bottom)/2,'HORSES · MILLIONS',{transform:`rotate(-90 13 ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});
 text(svg,W-12,(top+bottom)/2,'TRACTORS · MILLIONS',{transform:`rotate(90 ${W-12} ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});
 const reveal=revealGroup(svg,`reveal-${scene.id}`,{left,right,top,bottom,width:right-left,height:bottom-top});
 d.series.forEach((series,i)=>{
  const y=i===0?horseY:machineY;
  const path=make('path',{d:linePath(series.points,x,y),fill:'none',stroke:series.color,'stroke-width':small?2.5:3.5,'stroke-dasharray':i?'8 6':''},reveal.group);
  title(path,`${series.name}: approximate values in millions`);
 });
 return s=>reveal.set(progress(s));
}
function cards(svg,scene,d,W,H){addLegend(scene,[]);const small=W<620,cols=2,gap=small?10:18,pad=small?12:20,cw=(W-gap)/2,rh=(H-gap*2)/3,groups=[];d.cards.forEach((c,i)=>{const col=i<2?i:i%2===0?0:1;const row=i<2?0:Math.floor((i-2)/2)+1;const xx=col*(cw+gap),yy=row*(rh+gap),g=make('g',{},svg);groups.push(g);make('rect',{x:xx,y:yy,width:cw,height:rh,rx:4,fill:col?'#18212b':'#10242b',stroke:grid},g);wrapLabel(g,c.label,xx+pad,yy+pad+10,small?20:35,{class:'card-label'});const body=c.description;wrapLabel(g,body,xx+pad,yy+pad+(small?42:42),Math.floor((cw-pad*2)/(small?5.5:6.7)),{class:'card-body'});if(c.value)text(g,xx+pad,yy+rh-35,c.value,{class:'large-value',fill:colors[col]});wrapLabel(g,c.measurement,xx+pad,yy+rh-17,small?26:45,{class:'card-caption'});title(g,[c.label,c.description,c.examples?.join('; '),c.period,c.value,c.measurement,c.citation].filter(Boolean).join(' · '))});return s=>groups.forEach((g,i)=>g.style.opacity=s.reduced?'1':String(clamp(progress(s)*6-i)))}
function surplus(svg,scene,d,W,H){
 const small=W<620,left=small?52:78,right=W-(small?26:48),top=small?26:36,bottom=H-(small?66:70),width=right-left,height=bottom-top;
 const X=u=>left+width*u,Y=v=>top+height*v;
 const demand=u=>.12+.72*u,low=u=>.89-.11*u,high=u=>.95-.85*u;
 const scenarios=[{supply:low,q:.77/.83,color:'#39ffc1',name:'Consumer surplus',caption:'LOW PRICE'},{supply:high,q:.83/1.57,color:'#ff914f',name:'Producer surplus',caption:'HIGHER PRICE'}];
 addLegend(scene,[{name:'Consumer surplus',color:'#39ffc1'},{name:'Producer surplus',color:'#ff914f'}]);
 for(const v of [.25,.5,.75])make('line',{x1:left,x2:right,y1:Y(v),y2:Y(v),stroke:grid},svg);
 make('path',{d:`M${left} ${top}V${bottom}H${right}`,fill:'none',stroke:'#91a6b5','stroke-width':2},svg);
 text(svg,left-14,top+10,'Price',{'text-anchor':'end',class:'axis-label'});
 text(svg,right,bottom+28,'Quantity',{'text-anchor':'end',class:'axis-label'});
 const reveal=revealGroup(svg,`reveal-${scene.id}`,{left,right,top,bottom,width,height});
 const chart=reveal.group;
 make('path',{d:`M${X(0)} ${Y(demand(0))}L${X(1)} ${Y(demand(1))}`,fill:'none',stroke:'#7dcfff','stroke-width':small?3:4},chart);
 text(chart,X(.18),Y(demand(.18))-13,'Demand',{'text-anchor':'middle',class:'annotation'});
 const groups=scenarios.map(({supply,q,color,name,caption},i)=>{
  const group=make('g',{},chart),p=demand(q),shade=make('g',{},group);
  make('path',{d:`M${X(0)} ${Y(demand(0))} L${X(q)} ${Y(p)} L${X(0)} ${Y(p)} Z`,fill:'#39ffc1','fill-opacity':i===0?.46:.13},shade);
  make('path',{d:`M${X(0)} ${Y(supply(0))} L${X(q)} ${Y(p)} L${X(0)} ${Y(p)} Z`,fill:'#ff914f','fill-opacity':i===1?.62:.13},shade);
  make('path',{d:`M${X(0)} ${Y(supply(0))}L${X(1)} ${Y(supply(1))}`,fill:'none',stroke:'#f1cf65','stroke-width':small?3:4},group);
  const supplyLabelX=i===0?.28:.78;
  text(group,X(supplyLabelX),Y(supply(supplyLabelX))-12,'Supply',{'text-anchor':'middle',class:'annotation'});
  make('line',{x1:left,x2:X(q),y1:Y(p),y2:Y(p),stroke:'#e6edf3','stroke-dasharray':'6 6','stroke-opacity':'.75'},group);
  make('line',{x1:X(q),x2:X(q),y1:Y(p),y2:bottom,stroke:'#e6edf3','stroke-dasharray':'6 6','stroke-opacity':'.55'},group);
  make('circle',{cx:X(q),cy:Y(p),r:small?5:7,fill:'#e6edf3'},group);
  text(group,left+8,Y(p)-10,caption,{class:'annotation',fill:'#e6edf3'});
  const labelU=q*(i===0?.68:.85);
  const upper=i===0?demand(labelU):p;
  const lower=i===0?p:supply(labelU);
  text(group,X(labelU),Y((upper+lower)/2),name,{'text-anchor':'middle',class:'surplus-label',fill:color});
  title(group,`${name}: illustrative supply and demand equilibrium, not measured data`);
  return group;
 });
 return s=>{const stage=s.reduced?1:s.stage;groups.forEach((g,i)=>{g.style.opacity=stage===i?'1':'0';g.style.visibility=stage===i?'visible':'hidden'});reveal.set(s.reduced?1:ease(clamp(s.local/.45)));scene.dataset.surplus=stage===0?'consumer':stage===1?'producer':''};
}
function valueAt(points,key){if(key<points[0][0]||key>points.at(-1)[0])return null;const i=points.findIndex(point=>point[0]>=key);if(i<=0)return points[0][1];const [x0,y0]=points[i-1],[x1,y1]=points[i],t=(key-x0)/(x1-x0);return y0+(y1-y0)*t}
function attachHover(svg,scene,d,W,H,kind){
 const attach=(bounds,keyboard,get)=>window.AIChartHover?.attach(svg,{bounds,keyboard,get}),state=()=>stateOf(scene),small=W<620;
 const nearest=(rows,point,x,y)=>rows.reduce((best,row)=>{const score=(x(row)-point.x)**2+(y(row)-point.y)**2;return !best||score<best.score?{row,score}:best},null)?.row;
 if(['coding-spend','employment','waymo-share'].includes(scene.id)){
  const a={left:small?58:76,right:W-(small?20:28),top:20,bottom:H-65},x=scaler(d.x,a.left,a.right),y=scaler(d.y,a.bottom,a.top),domain=d.x.domain;
  attach(a,[...new Set(d.series.flatMap(s=>s.points.map(p=>p[0])))].map(key=>({x:x(key),y:(a.top+a.bottom)/2})),point=>{const p=progress(state());if(p<=0)return null;const cap=domain[0]+(domain[1]-domain[0])*p,key=Math.min(cap,domain[0]+(point.x-a.left)/(a.right-a.left)*(domain[1]-domain[0])),items=d.series.map((s,i)=>{const v=valueAt(s.points,key);return v===null?null:{label:s.name,value:format(v,d.y.format),color:s.color||colors[i],x:x(key),y:y(v)}}).filter(Boolean);return items.length?{title:format(key,d.x.format),x:x(key),items}:null});return;
 }
 if(scene.id==='experience-curves'){
  const a={left:small?58:76,right:W-(small?20:28),top:20,bottom:H-65},x=scaler(d.x,a.left,a.right),y=scaler(d.y,a.bottom,a.top),first=[1,0,2,2];
  attach(a,d.series.flatMap(s=>s.points.map(p=>({x:x(p[0]),y:y(p[1])}))),point=>{const s=state();if(!s.reduced&&s.stage>3)return null;const available=d.series.flatMap((series,i)=>{const amount=s.reduced||s.stage>first[i]?1:s.stage===first[i]?clamp(s.local*(i>=2?3:1)):0;if(!amount)return[];const max=Math.max(1,Math.ceil(series.points.length*amount));return series.points.slice(0,max).map(p=>({series,i,p}))});if(!available.length)return null;const hit=nearest(available,point,e=>x(e.p[0]),e=>y(e.p[1]));return{title:format(hit.p[0],d.x.format),guide:false,items:[{label:hit.series.name,value:format(hit.p[1],d.y.format),color:hit.series.color||colors[hit.i],x:x(hit.p[0]),y:y(hit.p[1])}]}});return;
 }
 if(scene.id==='horse-tractor'){
  const a={left:small?52:72,right:W-(small?48:68),top:24,bottom:H-58},x=scaler({domain:[1867,2012]},a.left,a.right),ys=[scaler({domain:[0,30]},a.bottom,a.top),scaler({domain:[0,6]},a.bottom,a.top)];
  attach(a,[1867,1900,1930,1960,1990,2012].map(v=>({x:x(v),y:(a.top+a.bottom)/2})),point=>{const p=progress(state());if(!p)return null;const key=Math.min(1867+(2012-1867)*p,1867+(point.x-a.left)/(a.right-a.left)*(2012-1867)),items=d.series.map((series,i)=>{const v=valueAt(series.points,key);return v===null?null:{label:series.name,value:`${v.toFixed(1)}M`,color:series.color||colors[i],x:x(key),y:ys[i](v)}}).filter(Boolean);return items.length?{title:String(Math.round(key)),x:x(key),items}:null});return;
 }
 if(scene.id==='code-history'||scene.id==='code-future'){
  const history=scene.id==='code-history',a={left:small?62:78,right:W-(small?46:65),top:42,bottom:H-65},x=scaler({domain:[1980,history?2025:2040]},a.left,a.right),y=scaler({domain:[0,history?4.5e12:13e12]},a.bottom,a.top),conservative=history?d:(d.variants||[]).find(v=>v.name==='Conservative')||d,optimistic=(d.variants||[]).find(v=>v.name==='Optimistic')||d;
  attach(a,[1980,1990,2000,2010,2025,2030,2040].filter(v=>v<=(history?2025:2040)).map(v=>({x:x(v),y:(a.top+a.bottom)/2})),point=>{const s=state(),stage=Math.max(0,s.stage),blend=history?0:stage<3?0:stage>3?1:s.reduced?1:ease(s.local),future=s.reduced?1:stage>=2?1:clamp((stage+s.local)/2),cutoff=history?1980+(2025-1980)*(s.reduced?1:ease(clamp((s.progress-.025)/.7))):2025+(2040-2025)*future;if(cutoff<1980+.01)return null;const key=Math.min(cutoff,1980+(point.x-a.left)/(a.right-a.left)*((history?2025:2040)-1980));let total=0;const items=conservative.series.map((series,i)=>{const cv=valueAt(series.points,key),ov=valueAt(optimistic.series[i].points,key),v=cv===null?null:cv+(ov-cv)*blend;if(v===null)return null;total+=v;return{label:series.name,value:format(v,'dollars'),color:colors[i],x:x(key),y:y(total)}}).filter(Boolean);return items.length?{title:`${Math.round(key)}${history?'':' · '+(blend?blend===1?'optimistic':'expanding':'conservative')}`,x:x(key),items}:null});return;
 }
 if(scene.id==='software-pipeline'){
  const left=small?38:84,right=W-16,top=H*.18,width=right-left;let total=0;const cols=d.stages.map(col=>{const start=total;total+=col.original;return{...col,start,x:left+width*(start+col.original/2)/100}}),rows=d.scenarios.map((r,i)=>({r,i,y:H*(.43+i*.3)}));
  attach({left,right,top,bottom:H-75},rows.map(row=>({x:(left+right)/2,y:row.y})),point=>{const hit=nearest(rows,point,e=>(left+right)/2,e=>e.y),s=state(),amount=s.reduced||s.stage>hit.i+2?1:s.stage===hit.i+2?ease(s.local/.45):0;if(!amount&&s.stage>=2)return null;const items=cols.map((col,j)=>{const remaining=col.original+(hit.r.remaining[j]-col.original)*amount;return{label:col.label,value:`${remaining.toFixed(1)}% remains`,color:colors[0],x:left+width*(col.start+remaining)/100,y:hit.y}});return{title:`${hit.r.label} · ${hit.r.speedup}×`,items}});return;
 }
 if(['tfp','white-collar','app-revenue','labor-markets','blue-collar','waymo-data'].includes(scene.id)){
  const horizontal=d.orientation!=='vertical',rows=d.rows,val=d.value,series=d.series||[{name:''}],left=horizontal?(small?Math.min(142,W*.39):Math.min(245,W*.31)):(small?54:70),right=W-(horizontal?(small?44:60):20),top=horizontal?18:20,bottom=H-(horizontal?60:scene.id==='app-revenue'?128:75),scale=scaler(val,horizontal?left:bottom,horizontal?right:top),step=(horizontal?bottom-top:right-left)/rows.length;
  const rowPos=(row,i)=>horizontal?{x:(left+right)/2,y:scene.id==='waymo-data'&&rows.length===3?top+(bottom-top)*[.19,.36,.94][i]:top+step*(i+.5)}:{x:left+step*(i+.5),y:(top+bottom)/2};
  const mapped=rows.map((row,i)=>({row,i,...rowPos(row,i)}));
  if(horizontal){
   // Match the visible SVG bar, not the nearest row: bars can share a row and leave empty plot space.
   const rectangles=[...svg.querySelectorAll('rect')];
   const barEntries=rows.flatMap((row,i)=>row.values.flatMap((value,j)=>value===null?[]:[{row,i,j,value}]))
    .map((entry,index)=>({...entry,rect:rectangles[index]}))
    .filter(entry=>entry.rect&&entry.value>0);
   const keyboard=barEntries.map(({rect})=>({x:Number(rect.getAttribute('x'))+1,y:Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))/2}));
   attach({left,right,top,bottom},keyboard,point=>{
    const hit=barEntries.find(({rect})=>{
     const x=Number(rect.getAttribute('x')),y=Number(rect.getAttribute('y'));
     const width=Number(rect.getAttribute('width')),height=Number(rect.getAttribute('height'));
     return width>0&&height>0&&point.x>=x&&point.x<=x+width&&point.y>=y&&point.y<=y+height&&getComputedStyle(rect).visibility!=='hidden';
    });
    if(!hit)return null;
    const rect=hit.rect,x=Number(rect.getAttribute('x'))+Number(rect.getAttribute('width'));
    const y=Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))/2;
    return{title:hit.row.label,guide:false,items:[{label:series[hit.j]?.name||'Value',value:hit.row.valueLabels?.[hit.j]||hit.row.valueLabel||format(hit.value,val.format),color:series[hit.j]?.color||hit.row.color||colors[hit.j],x,y}]};
   });
   return;
  }
  attach({left,right,top,bottom},mapped,point=>{const hit=nearest(mapped,point,e=>e.x,e=>e.y),s=state();let amount;if(scene.id==='waymo-data')amount=s.reduced?1:ease(s.progress/.3);else if(scene.id==='labor-markets')amount=s.reduced?1:ease(s.progress/.3);else if(scene.id==='tfp')amount=s.reduced||s.stage>1?1:ease(clamp((s.stage<1?0:s.local-hit.i*.025)/.19));else if(scene.id==='white-collar'){const show=s.reduced||document.body.classList.contains('all-mode'),software=hit.row.label==='Software developers';amount=show||software?1:s.stage===0?0:ease(clamp((s.local-hit.i*.006)/.22))}else{const p=progress(s);amount=s.reduced?1:clamp(p*(1+.2*rows.length)-hit.i*.2)}if(amount<=0)return null;let total=0;const items=hit.row.values.map((value,j)=>{if(value===null||value===0)return null;const start=total;total+=value;const shown=value*amount,focus=scene.id==='tfp'&&scene.dataset.focus;if(focus&&series[j]?.name!==focus)return null;return{label:series[j]?.name||'Value',value:hit.row.valueLabels?.[j]||hit.row.valueLabel||format(shown,val.format),color:series[j]?.color||hit.row.color||colors[j],x:horizontal?scale((d.stacked?start:val.scale==='log'?val.domain[0]:0)+shown):hit.x,y:horizontal?hit.y:scale(shown+(d.stacked?start:0))}}).filter(Boolean);return items.length?{title:hit.row.label,guide:horizontal?'y':false,y:hit.y,items}:null});return;
 }
 if(scene.id==='productivity'||scene.id==='sim-to-real'){
  const a=scene.id==='sim-to-real'?{left:74,right:1070,top:35,bottom:543.33}:{left:small?58:76,right:W-(small?20:28),top:20,bottom:H-65},x=scaler(d.x,a.left,a.right),y=scaler(d.y,a.bottom,a.top),mapped=d.points.map((row,i)=>({row,i,x:x(row.x),y:y(row.y)}));
  attach(a,mapped,point=>{const p=progress(state()),visible=mapped.filter(entry=>state().reduced||entry.i/Math.max(1,mapped.length-1)<=p*(scene.id==='sim-to-real'?2.4:1));if(!visible.length)return null;const hit=nearest(visible,point,e=>e.x,e=>e.y),row=hit.row,gi=Math.max(0,(d.groups||[]).findIndex(g=>g.name===row.group));return{title:row.label||row.group||'Observation',guide:false,items:[{label:d.x.label,value:format(row.x,d.x.format),color:colors[gi],x:hit.x,y:hit.y},{label:d.y.label,value:format(row.y,d.y.format),color:colors[gi]}]}});return;
 }
 if(scene.id==='robot-data'){
  const labelW=small?W*.34:W*.31,gap=small?28:48,panelW=(W-labelW-gap-(small?15:24))/2,top=small?62:50,bottom=H-70,rowH=(bottom-top)/d.panels[0].rows.length,mapped=d.panels[0].rows.map((row,i)=>({row,i,x:labelW+panelW/2,y:top+(i+.5)*rowH}));
  attach({left:labelW,right:W-10,top,bottom},mapped,point=>{const hit=nearest(mapped,point,e=>e.x,e=>e.y),s=state(),real=progress(s),sim=s.reduced?1:s.stage>0?ease(clamp(s.local/.24)):0,items=[];if(clamp(real*2.65-hit.i*.1)>0){const r=d.panels[0].rows[hit.i];items.push({label:d.panels[0].name,value:r.valueLabel||format(r.value,'compact'),color:colors[0]})}if(sim>0&&clamp((s.local-.04-hit.i*.07)/.22)>0){const r=d.panels[1].rows[hit.i];items.push({label:d.panels[1].name,value:r.valueLabel||format(r.value,'compact'),color:colors[1]})}return items.length?{title:`${hit.row.label} · ${hit.row.detail}`,guide:'y',y:hit.y,items}:null});return;
 }
 if(scene.id==='ai-economy'){
  const s=state(),stage=s.reduced?1:s.stage;attach({left:small?52:78,right:W-(small?26:48),top:small?26:36,bottom:H-(small?66:70)},null,()=>{const now=state(),which=(now.reduced?1:now.stage)===0;return{title:'Illustrative equilibrium',guide:false,items:[{label:which?'Consumer surplus':'Producer surplus',value:which?'Low-price scenario':'Higher-price scenario',color:which?'#39ffc1':'#ff914f'}]}});return;
 }
}
const api={make,text,title,wrapLabel,colors,grid,ink,muted,compact,format,scaler,progress,clamp,ease,addLegend,frame,cartesian,scatter,linePath};
const renderers={line:(svg,scene,d,W,H)=>scene.id==='experience-curves'?experienceCurves(svg,scene,d,W,H):cartesian(svg,scene,d,W,H,'line'),area:(svg,scene,d,W,H)=>window.NativeAreas(svg,scene,d,W,H,api),bars:(svg,scene,d,W,H)=>scene.id==='labor-markets'?laborMarketBars(svg,scene,d,W,H):scene.id==='white-collar'?whiteCollarBars(svg,scene,d,W,H):bars(svg,scene,d,W,H),scatter,rectangles,pipeline,farmMechanization,cards,surplus,network,table:(svg,scene,d,W,H)=>window.NativeSpecial.table(svg,scene,d,W,H,api),pairedDots:(svg,scene,d,W,H)=>window.NativeSpecial.pairedDots(svg,scene,d,W,H,api),simulation:(svg,scene,d,W,H)=>window.NativeSpecial.simulation(svg,scene,d,W,H,api)};
try{
const response=await fetch('/posts/ai2026-pt3/native-data.json?v=waymo-miles-1');if(!response.ok)throw Error('Chart data unavailable');const data=await response.json();
for(const scene of document.querySelectorAll('.scene[data-native]')){
 const spec=data[scene.id];if(!spec)throw Error(`Missing chart specification: ${scene.id}`);
 const plot=scene.querySelector('.native-plot'),svg=plot.querySelector('svg');let render;
 const draw=()=>{const {width,height}=plot.getBoundingClientRect();if(!width||!height)return;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);title(svg,spec.title||scene.getAttribute('aria-label'));make('desc',{},svg,spec.note||'');const kind=scene.id==='sim-to-real'?'simulation':spec.kind;const chartData=spec.dataRef?data[spec.dataRef]?.data:spec.data;if(!chartData)throw Error(`Missing chart data: ${scene.id}`);render=renderers[kind](svg,scene,chartData,width,height);attachHover(svg,scene,chartData,width,height,kind);scene.dataset.nativeReady='true';render(stateOf(scene));};
 draw();new ResizeObserver(draw).observe(plot);scene.addEventListener('chart-progress',event=>render?.({...stateOf(scene),...event.detail}));
}
const staticSim=document.getElementById('sim-to-real'),staticSvg=staticSim?.querySelector('.native-plot>svg'),simSpec=data['sim-to-real'];
if(staticSim&&staticSvg&&simSpec&&!staticSvg.classList.contains('owid-hover-surface'))attachHover(staticSvg,staticSim,simSpec.data,1120,600,'scatter');
document.documentElement.dataset.chartsReady='true';
}catch(error){console.error(error);document.documentElement.dataset.chartError=error.message}
})();
