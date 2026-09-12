/* Source-derived coding market scenarios. Areas grow by year and morph by scenario. */
(() => {
'use strict';
window.NativeAreas = (svg, scene, d, W, H, api) => {
  const {make,text,title,compact,frame,linePath,clamp,ease,addLegend}=api;
  const history=scene.id==='code-history',small=W<620;
  const palette=['#43a9ff','#39ffc1','#bda1ff'];
  const conservative=history?d:((d.variants||[]).find(v=>v.name==='Conservative')||d);
  const optimistic=(d.variants||[]).find(v=>v.name==='Optimistic')||d;
  addLegend(scene,d.series.map((s,i)=>({name:s.name,color:palette[i]})).concat([{name:'Bubble area · gross LOC / year',color:'#f1cf65'}]));
  const xs={...d.x,domain:[1980,history?2025:2040],ticks:history?[1980,2000,2025]:small?[1980,2000,2025,2040]:[1980,1990,2000,2010,2025,2040]};
  const ys={...d.y,domain:[0,history?4.5e12:13e12],ticks:history?[0,1e12,2e12,3e12,4e12]:[0,2e12,4e12,6e12,8e12,10e12,12e12],label:small?'Annual spend (2025 USD)':d.y.label};
  const a=frame(svg,W,H,xs,ys,{l:small?62:78,r:small?46:65,t:42,b:65});
  if(!history){
    make('rect',{x:a.x(2025),y:a.top,width:a.right-a.x(2025),height:a.height,fill:'#91a6b5','fill-opacity':'.045'},svg);
    make('line',{x1:a.x(2025),x2:a.x(2025),y1:a.top,y2:a.bottom,stroke:'#91a6b5','stroke-dasharray':'5 6'},svg);
  }
  const areas=make('g',{},svg),paths=d.series.map((s,i)=>{
    const p=make('path',{fill:palette[i],'fill-opacity':'.53',stroke:palette[i],'stroke-width':'1.3'},areas);
    title(p,s.name+' · modeled annual spending, real 2025 USD');return p;
  });
  const totalLine=make('path',{fill:'none',stroke:'#e6edf3','stroke-width':'1.2'},areas);
  const status=text(svg,a.right,a.top-17,'',{'text-anchor':'end',class:'annotation',fill:'#91a6b5','font-size':small?10:12});
  const bubbleGroup=make('g',{},svg);
  const bubbleYears=history?[1980,2000,2025]:[1980,2000,2025,2040];
  const bubbles=bubbleYears.map(year=>{
    const g=make('g',{},bubbleGroup);
    const circle=make('circle',{fill:'#f1cf65','fill-opacity':'.14',stroke:'#f1cf65','stroke-width':'1.3'},g);
    const label=text(g,0,0,'',{'text-anchor':'middle',class:'annotation',fill:'#f1cf65','font-size':small?11:14});
    const tt=make('title',{},g);
    return {year,g,circle,label,tt};
  });
  const mix=(a,b,t)=>a+(b-a)*t;
  function valueAt(points,year){
    if(year<=points[0][0])return points[0][1];
    for(let i=1;i<points.length;i++)if(year<=points[i][0]){
      const [x0,y0]=points[i-1],[x1,y1]=points[i];return mix(y0,y1,(year-x0)/(x1-x0));
    }
    return points[points.length-1][1];
  }
  function slice(points,cutoff){
    const result=points.filter(p=>p[0]<=cutoff);
    if(!result.length)return [[points[0][0],points[0][1]]];
    if(result[result.length-1][0]<cutoff)result.push([cutoff,valueAt(points,cutoff)]);
    return result;
  }
  return state=>{
    const stage=Math.max(0,state.stage||0),local=clamp(state.local||0);
    const blend=history?0:stage<3?0:stage>3?1:state.reduced?1:ease(local);
    const future=state.reduced?1:stage>=3?1:clamp((stage+local)/3);
    const cutoff=history?mix(1980,2025,state.reduced?1:ease(clamp((state.progress-.025)/.7))):mix(2025,2040,future);
    const values=conservative.series.map((s,i)=>s.points.map(([year,value])=>[year,mix(value,valueAt(optimistic.series[i].points,year),blend)]));
    let cumulative=[];
    values.forEach((points,i)=>{
      const part=slice(points,cutoff),lower=part.map(([year],j)=>[year,cumulative[j]||0]);
      const upper=part.map(([year,value],j)=>[year,(cumulative[j]||0)+value]);
      cumulative=upper.map(p=>p[1]);
      paths[i].setAttribute('d',linePath(upper,a.x,a.y)+' '+lower.slice().reverse().map(([x,y])=>`L${a.x(x)},${a.y(y)}`).join(' ')+' Z');
      if(i===values.length-1)totalLine.setAttribute('d',linePath(upper,a.x,a.y));
    });
    status.textContent=history?'HISTORICAL ESTIMATE':blend===0?'2040 · CONSERVATIVE SCENARIO':blend===1?'2040 · OPTIMISTIC SCENARIO':'2040 · EXPANDING SCENARIO';
    for(const b of bubbles){
      const visible=b.year<=cutoff+.001;
      b.g.setAttribute('visibility',visible?'visible':'hidden');
      if(!visible)continue;
      const cb=conservative.bubbles.find(v=>v.x===b.year),ob=optimistic.bubbles.find(v=>v.x===b.year)||cb;
      if(!cb){b.g.setAttribute('visibility','hidden');continue;}
      const value=mix(cb.value,ob.value,blend),total=values.reduce((sum,s)=>sum+valueAt(s,b.year),0);
      const maxValue=history?500e9:10e12;
      const radius=Math.max(2.3,Math.sqrt(value/maxValue)*Math.min(small?31:44,a.width*.095));
      const cx=a.x(b.year),cy=a.y(total);
      b.circle.setAttribute('cx',cx);b.circle.setAttribute('cy',cy);b.circle.setAttribute('r',radius);
      const anchor=b.year===1980?'start':b.year===(history?2025:2040)?'end':'middle';
      b.label.setAttribute('text-anchor',anchor);
      b.label.setAttribute('x',cx);b.label.setAttribute('y',Math.max(a.top+12,cy-radius-9));
      b.label.textContent=compact(value);
      b.tt.textContent=`${b.year}: ${compact(value)} gross lines of code per year; $${compact(total)} modeled annual spending`;
    }
  };
};
})();
