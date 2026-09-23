/* Source-derived layouts whose structure is more specific than a line/bar chart. */
(()=>{
'use strict';
let sequence=0;
function table(svg,scene,d,W,H,a){
 const {make,text,title,wrapLabel,format,ink,muted,grid}=a,small=W<620;
 a.addLegend(scene,[]);
 const pad=small?8:18,header=small?62:54,bottom=26,rowH=small?66:56;
 const occupationW=W*(small?.45:.49),numericW=(W-pad-occupationW)/3;
 const colX=[pad,occupationW+numericW,occupationW+numericW*2,W-pad];
 const clipId=`occupation-table-${++sequence}`,defs=make('defs',{},svg),clip=make('clipPath',{id:clipId},defs);
 make('rect',{x:0,y:header,width:W,height:Math.max(0,H-header-bottom)},clip);
 const viewport=make('g',{'clip-path':`url(#${clipId})`},svg),body=make('g',{},viewport);
 const fs=small?11:13;
 const rowLabels=[],rowStarts=[];let contentHeight=0;
 const maxChars=Math.floor((occupationW-pad-12)/(fs*.62));
 d.rows.forEach((row,i)=>{
  const lines=[];let line='';
  for(const word of String(row[d.columns[0].key]).split(' ')){if((line+' '+word).trim().length>maxChars&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}
  if(line)lines.push(line);
  const height=Math.max(small?54:rowH,22+lines.length*fs*1.2),y=header+contentHeight;rowStarts.push(contentHeight);contentHeight+=height;
  make('line',{x1:pad,x2:W-pad,y1:y+height-1,y2:y+height-1,stroke:grid},body);
  const g=make('g',{},body);rowLabels.push(g);
  const label=text(g,pad,y+19,'',{fill:ink,'font-size':fs,class:'table-occupation'});
  lines.forEach((line,j)=>make('tspan',{x:pad,dy:j?'1.2em':0},label,line));
  d.columns.slice(1).forEach((col,j)=>{
   const val=row[col.key],label=format(val,col.format);
   const e=text(g,colX[j+1],y+19,label,{'text-anchor':'end',fill:j===2?a.colors[0]:ink,'font-size':fs});
   title(e,`${col.label}: ${typeof val==='number'?val.toLocaleString('en-US'):val}`);
  });
  title(g,d.columns.map(c=>`${c.label}: ${row[c.key]}`).join('; '));
 });
 // Opaque header remains fixed while the source table moves beneath it.
 make('rect',{x:0,y:0,width:W,height:header,fill:'#080d12'},svg);
 d.columns.forEach((col,j)=>{
  const label=small?['Occupation','Employees','Median wage','Wage pool'][j]:col.label;
  wrapLabel(svg,label,colX[j],small?20:25,small?(j===3?5:j===2?6:j?10:20):22,{'text-anchor':j?'end':'start',fill:muted,'font-size':small?10:12});
 });
 make('line',{x1:pad,x2:W-pad,y1:header-1,y2:header-1,stroke:grid},svg);
 const status=text(svg,W-pad,H-5,'',{'text-anchor':'end',fill:muted,'font-size':10});
 const available=H-header-bottom,total=contentHeight,travel=Math.max(0,total-available);
 return state=>{
  const all=state.reduced||document.body.classList.contains('all-mode')||scene.dataset.all==='true';
  const p=all?1:a.progress(state),offset=all&&travel===0?0:travel*p;
  body.setAttribute('transform',`translate(0 ${-offset})`);
  const first=Math.max(1,rowStarts.findIndex((start,i)=>start+(rowStarts[i+1]===undefined?total-start:rowStarts[i+1]-start)>offset)+1),end=rowStarts.findIndex(start=>start>=offset+available),last=end<0?d.rows.length:end;
  status.textContent=`${d.year||''} · ${first}–${last} of ${d.rows.length}`;
 };
}
function pairedDots(svg,scene,d,W,H,a){
 const {make,text,title,wrapLabel,colors,grid,ink,muted,scaler,format}=a,small=W<620;
 a.addLegend(scene,d.panels.map((p,i)=>({name:p.name,color:colors[i]})));
 const marks=[],rows=d.panels[0].rows,labelW=small?W*.34:W*.31;
 const panelGap=small?28:48,panelW=(W-labelW-panelGap-(small?15:24))/2;
 const top=small?62:50,bottom=H-70,rowH=(bottom-top)/rows.length;
 rows.forEach((r,i)=>{
  const yy=top+(i+.5)*rowH;
  wrapLabel(svg,r.label,small?5:12,yy-5,small?15:26,{fill:ink,'font-size':small?11:14});
  if(!small)text(svg,12,yy+24,r.detail||'',{fill:muted,'font-size':11});
  make('line',{x1:small?5:12,x2:W-10,y1:top+(i+1)*rowH,y2:top+(i+1)*rowH,stroke:grid},svg);
 });
 d.panels.forEach((panel,j)=>{
  const left=labelW+j*(panelW+panelGap),right=left+panelW,x=scaler(d.value,left,right),color=colors[j];
  wrapLabel(svg,panel.name,left,22,small?12:30,{fill:color,'font-size':small?11:14});
  d.value.ticks.forEach(v=>{
   make('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:grid},svg);
   text(svg,x(v),bottom+22,format(v,d.value.format),{'text-anchor':'middle',fill:muted,'font-size':small?9:11});
  });
  panel.rows.forEach((r,i)=>{
   const y=top+(i+.5)*rowH,g=make('g',{opacity:0},svg);marks.push({g,j,i});
   if(r.value>0){
    const xx=x(r.value);make('circle',{cx:xx,cy:y,r:small?4:6,fill:color},g);
    const anchor=xx>right-35?'end':xx<left+24?'start':'middle';
    text(g,xx,y-12,r.valueLabel||format(r.value,'compact'),{'text-anchor':anchor,fill:color,'font-size':small?11:14});
   }else{
    // A zero is a textual fact, not a point at an invented logarithmic coordinate.
    wrapLabel(g,r.valueLabel||'0',left,y-8,small?12:24,{fill:color,'font-size':small?10:13});
   }
   title(g,`${r.label}, ${r.detail}: ${panel.name}, ${r.valueLabel||r.value} hours`);
  });
 });
 text(svg,(labelW+W)/2,H-13,d.value.label,{'text-anchor':'middle',fill:muted,'font-size':small?10:12});
 return state=>{const p=a.progress(state);marks.forEach(({g,j,i})=>{g.setAttribute('opacity',state.reduced?1:a.clamp(p*2.65-j*1.05-i*.10));});};
}
function simulation(svg,scene,d,W,H,a){
 const {make,text,title,colors,grid,muted}=a,small=W<620;
 a.addLegend(scene,d.groups.map((g,i)=>({...g,name:`${g.name} ${g.shape==='square'?'□':'○'}`,color:colors[i]})));
 const pinnedMobile=small&&!document.body.classList.contains('all-mode')&&H<900;
 const renders=[],panelRoots=[],gap=small?25:28,mainW=small?W:W*.59;
 const mainH=pinnedMobile?H:small?Math.max(300,Math.min(430,H*.43)):H;
 const main=make('svg',{x:0,y:0,width:mainW,height:mainH,viewBox:`0 0 ${mainW} ${mainH}`,overflow:'visible'},svg);
 panelRoots.push(main);
 const b=a.frame(main,mainW,mainH,d.x,d.y,{l:small?54:68,r:20,t:25,b:64});
 make('line',{x1:b.x(0),y1:b.y(0),x2:b.x(1),y2:b.y(1),stroke:muted,'stroke-dasharray':'5 5'},main);
 const marks=[];
 d.points.forEach((p,i)=>{
  const gi=Math.max(0,d.groups.findIndex(g=>g.name===p.group)),group=d.groups[gi],r=small?4.5:6,g=make('g',{opacity:0},main);
  if(group.shape==='square')make('rect',{x:b.x(p.x)-r,y:b.y(p.y)-r,width:r*2,height:r*2,fill:colors[gi],stroke:'#080d12','stroke-width':1.3},g);
  else make('circle',{cx:b.x(p.x),cy:b.y(p.y),r,fill:colors[gi],stroke:'#080d12','stroke-width':1.3},g);
  title(g,`${p.group}: real-world ${p.x}, simulation ${p.y}`);marks.push(g);
 });
 renders.push(state=>marks.forEach((g,i)=>g.setAttribute('opacity',state.reduced?1:a.clamp(a.progress(state)*2.4-i/marks.length))));
 const panelW=small?W:W-mainW-gap,panelH=pinnedMobile?H:small?(H-mainH-gap*2)/2:(H-gap)/2;
 (d.panels||[]).forEach((panel,i)=>{
  const px=small?0:mainW+gap,py=pinnedMobile?0:small?mainH+gap+i*(panelH+gap):i*(panelH+gap);
  const child=make('svg',{x:px,y:py,width:panelW,height:panelH,viewBox:`0 0 ${panelW} ${panelH}`,overflow:'visible'},svg);
  panelRoots.push(child);
  text(child,small?54:52,15,panel.name,{fill:colors[i===0?2:0],'font-size':12});
  const f=a.frame(child,panelW,panelH,panel.x,panel.y,{l:small?54:52,r:16,t:32,b:60});
  const groups=[];
  panel.series.forEach((s,j)=>{
   const color=j===0?colors[1]:muted,g=make('g',{opacity:0},child);groups.push(g);
   make('path',{d:s.points.map(([x,y],k)=>`${k?'L':'M'}${f.x(x)},${f.y(y)}`).join(' '),fill:'none',stroke:color,'stroke-width':2,'stroke-dasharray':s.dashed?'4 4':''},g);
   s.points.forEach(([x,y])=>{
    const mark=j===0?make('circle',{cx:f.x(x),cy:f.y(y),r:3.5,fill:color},g):make('rect',{x:f.x(x)-3,y:f.y(y)-3,width:6,height:6,fill:color},g);
    title(mark,`${panel.name}, ${s.name}: ${a.compact(x)} iterations, ${y} success rate`);
   });
   // Keep simulation and real legends local to each supporting panel.
   const lx=panelW-(j===0?119:55);
   make('line',{x1:lx,x2:lx+12,y1:12,y2:12,stroke:color,'stroke-width':2,'stroke-dasharray':j?'3 2':''},child);
   text(child,lx+16,15,j?'Real':'Sim',{fill:color,'font-size':10});
  });
  renders.push(state=>groups.forEach((g,j)=>g.setAttribute('opacity',state.reduced?1:a.clamp(a.progress(state)*3-i*.6-j*.25-.8))));
 });
 return state=>{
  if(pinnedMobile){
   const p=a.progress(state),stage=p<.45?0:p<.73?1:2;
   panelRoots.forEach((root,i)=>{root.style.visibility=i===stage?'visible':'hidden';root.setAttribute('aria-hidden',i===stage?'false':'true');});
   // Complete each panel's marks while it occupies the mobile viewport.
   const start=[0,.45,.73][stage],span=[.45,.28,.27][stage];
   const local=a.clamp((p-start)/span);
   renders.forEach((render,i)=>render(i===stage?{...state,progress:.03+.72*Math.min(1,local*2),reduced:local>.65}:state));
  }else renders.forEach(render=>render(state));
 };
}
window.NativeSpecial={table,pairedDots,simulation};
})();
