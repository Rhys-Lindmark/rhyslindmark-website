/* Native Vals RSI Index chart. Scores and dates are frozen in charts.json. */
window.drawRSIChart = function(scene, data, reduced) {
  const svg=scene.querySelector('svg'),box=scene.querySelector('.plot-wrap').getBoundingClientRect();
  const W=Math.max(280,box.width),H=Math.max(280,box.height),small=W<600;
  const left=small?44:80,right=small?14:40,top=38,bottom=H-48;
  const start=Date.parse('2025-10-01'),end=Date.parse('2028-12-01');
  const x=date=>left+(date-start)/(end-start)*(W-left-right),y=value=>bottom-value/65*(bottom-top);
  const clamp=v=>Math.max(0,Math.min(1,v));
  const node=(tag,attrs,parent=svg,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;parent.append(e);return e;};
  const label=(a,b,text,color='#9aafbf',anchor='middle')=>node('text',{x:a,y:b,fill:color,'text-anchor':anchor,style:`fill:${color};font-size:${small?10:13}px`},svg,text);
  const path=points=>points.map((p,i)=>`${i?'L':'M'}${x(p.time)},${y(p.score)}`).join(' ');
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  node('title',{},svg,'Vals RSI Index: Anthropic and OpenAI, with linear projections');
  label(left,16,'RSI INDEX SCORE','#9aafbf','start');
  [0,10,20,30,40,50,60].forEach(v=>{node('line',{x1:left,x2:W-right,y1:y(v),y2:y(v),stroke:'#2a3a47'});label(left-8,y(v)+4,`${v}%`,'#9aafbf','end');});
  [2026,2027,2028].forEach(year=>{const a=x(Date.parse(`${year}-01-01`));node('line',{x1:a,x2:a,y1:top,y2:bottom,stroke:'#182630'});label(a,bottom+24,String(year));});
  label((left+W-right)/2,H-3,'MODEL RELEASE DATE');
  const defs=node('defs',{}),clip=node('clipPath',{id:'rsi-measured-clip'},defs),reveal=node('rect',{x:left,y:top-10,width:0,height:bottom-top+20},clip);
  const measured=node('g',{'clip-path':'url(#rsi-measured-clip)'}),projection=node('g',{});
  const points=[],milestones=[];
  data.series.forEach(row=>{
    const p=row.points.map(p=>({...p,time:Date.parse(p.date),color:row.color,provider:row.name}));
    node('path',{d:path(p),fill:'none',stroke:row.color,'stroke-width':small?2:3},measured);
    p.forEach(p=>{node('circle',{cx:x(p.time),cy:y(p.score),r:small?3:4,fill:row.color},measured);points.push(p);});
    // Same least-squares fit as Vals, using release timestamps and overall scores.
    const mx=p.reduce((s,p)=>s+p.time,0)/p.length,my=p.reduce((s,p)=>s+p.score,0)/p.length;
    const slope=p.reduce((s,p)=>s+(p.time-mx)*(p.score-my),0)/p.reduce((s,p)=>s+(p.time-mx)**2,0);
    const fit=t=>my+slope*(t-mx),last=p.at(-1).time;
    const trend=node('path',{d:path([{time:p[0].time,score:fit(p[0].time)},{time:mx+(60-my)/slope,score:60}]),fill:'none',stroke:row.color,'stroke-width':2,'stroke-dasharray':'6 5'},projection);
    const latest=p.at(-1);const name=label(x(last)+6,y(latest.score)+(row.name==='Anthropic'?-10:18),small?row.name:`${row.name} ${latest.score.toFixed(2)}%`,row.color,'start');
    name.classList.add('rsi-latest');
    [50,60].forEach(score=>{
      const time=mx+(score-my)/slope,date=new Date(time).toLocaleDateString('en',{month:'short',year:'numeric',timeZone:'UTC'});
      node('circle',{cx:x(time),cy:y(score),r:4,fill:'#071018',stroke:row.color,'stroke-width':2},projection);
      const t=node('text',{x:x(time),y:y(score)-10,'text-anchor':'middle',style:`fill:${row.color};font-size:${small?9:12}px`},projection);
      node('tspan',{x:x(time)},t,`${score}%`);node('tspan',{x:x(time),dy:small?12:16},t,date);
      milestones.push({provider:row.name,color:row.color,time,score,model:`${row.name} linear projection`,date});
    });
    trend.dataset.provider=row.name;
  });
  const target=scene.querySelector('.legend');target.replaceChildren();
  data.series.forEach(row=>{const e=document.createElement('span'),i=document.createElement('i');e.style.setProperty('--color',row.color);e.append(i,document.createTextNode(row.name));target.append(e);});
  let stage=0,previous=-1;
  window.AIChartHover?.attach(svg,{bounds:{left,right:W-right,top,bottom},keyboard:points.map(p=>({x:x(p.time),y:y(p.score)})),get:point=>{
    const pool=stage===1?[...points,...milestones]:points;
    const p=pool.reduce((a,b)=>Math.hypot(x(a.time)-point.x,y(a.score)-point.y)<Math.hypot(x(b.time)-point.x,y(b.score)-point.y)?a:b);
    return {title:p.model,x:x(p.time),items:[{label:p.date,value:`${p.score.toFixed(2)}%`,color:p.color}]};
  }});
  svg.hidden=false;
  return progress=>{
    stage=Number(scene.dataset.stage||0);
    const a=reduced()?1:clamp(progress/.25),show=reduced()||stage===1;
    const state=`${a}:${show}`;if(state===previous)return;previous=state;
    reveal.setAttribute('width',(W-left-right)*a);projection.style.opacity=show?'1':'0';
    svg.querySelectorAll('.rsi-latest').forEach(e=>e.style.opacity=a===1?'1':'0');
  };
};
