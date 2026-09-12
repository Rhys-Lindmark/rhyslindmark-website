/* Native SVG redraws of the supplied draft's digitized data. */
window.drawContinuationChart = function(scene, data, reduced) {
  const svg=scene.querySelector('svg'),box=scene.querySelector('.plot-wrap').getBoundingClientRect();
  const W=Math.max(300,box.width),H=Math.max(300,box.height),small=W<600;
  const m={l:small?66:94,r:small?25:65,t:42,b:75},right=W-m.r,bottom=H-m.b,iw=right-m.l,ih=bottom-m.t;
  const ns='http://www.w3.org/2000/svg',clamp=t=>Math.max(0,Math.min(1,t));
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  function n(tag,attrs,parent=svg,text){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;parent.append(el);return el;}
  function text(x,y,s,anchor='middle',parent=svg){return n('text',{x,y,'text-anchor':anchor},parent,s);}
  n('title',{},svg,svg.getAttribute('aria-label'));
  function axes(xs,ys,x,y,xlabel,ylabel){
    ys.forEach(([v,s])=>{n('line',{x1:m.l,x2:right,y1:y(v),y2:y(v),stroke:'#2a3a47'});text(m.l-10,y(v)+4,s,'end');});
    xs.forEach(([v,s])=>{n('line',{x1:x(v),x2:x(v),y1:m.t,y2:bottom,stroke:'#2a3a47','stroke-opacity':.55});text(x(v),bottom+26,s);});
    text((right+m.l)/2,H-12,xlabel);
    n('text',{x:17,y:(m.t+bottom)/2,transform:`rotate(-90 17 ${(m.t+bottom)/2})`,'text-anchor':'middle'},svg,ylabel);
  }
  const colors={OpenAI:'#43a9ff',Anthropic:'#ffcc66',China:'#52d6a0',xAI:'#e985cf',DeepMind:'#ff914f'};
  const bubble=scene.id==='rl-rollouts'||scene.id==='trajectory-depth';
  if(bubble){
    const x=v=>m.l+(Math.log10(v)-23.3)/(26.7-23.3)*iw,y=v=>bottom-(Math.log10(v)-10.6)/(12.7-10.6)*ih;
    axes([[3e23,'3×10²³'],[1e25,'10²⁵'],[3e26,'3×10²⁶']],[[1e11,'100B'],[3e11,'300B'],[1e12,'1T'],[3e12,'3T']],x,y,'TRAINING COMPUTE · FLOP','TOTAL PARAMETERS');
    const depth=scene.id==='trajectory-depth',max=depth?150:50e12,maxR=Math.min(small?28:42,ih*.12);
    const marks=[],labels=[];
    // Greedy placement keeps every model name readable without changing its data position.
    const occupied=[];
    [...data.models].sort((a,b)=>b.parameters-a.parameters).forEach((row,i)=>{
      const cx=x(row.flops),cy=y(row.parameters),v=depth?row.toolSteps:row.rolloutTokens,r=Math.max(3,Math.sqrt(v/max)*maxR);
      const dot=n('circle',{cx,cy,r,fill:colors[row.group],'fill-opacity':.32,stroke:colors[row.group],'stroke-width':1.5});
      n('title',{},dot,`${row.name}: ≈${(row.parameters/1e9).toFixed(0)}B parameters; ≈${row.flops.toExponential(1)} FLOP; ${depth?'≈'+Math.round(v)+' steps':'≈'+(v/1e12).toFixed(1)+'T rollout tokens'}`);
      marks.push({dot,r,cx});
      const width=row.name.length*(small?5.6:6.3),height=16;
      let best=null,bestScore=Infinity;
      for(let dy of [-r-12,r+20,-30,35,-50,55,-70,75])for(let dx of [0,-width*.55,width*.55]){
        const tx=Math.max(m.l+width/2,Math.min(right-width/2,cx+dx)),ty=Math.max(m.t+10,Math.min(bottom-10,cy+dy));
        const rect={l:tx-width/2,r:tx+width/2,t:ty-height,b:ty+3};
        const collisions=occupied.filter(q=>rect.l<q.r+5&&rect.r>q.l-5&&rect.t<q.b+3&&rect.b>q.t-3).length;
        const score=collisions*10000+Math.abs(dy)+Math.abs(dx)*.3;
        if(score<bestScore){best={tx,ty,rect};bestScore=score;}
      }
      occupied.push(best.rect);
      const lead=n('line',{x1:cx,y1:cy,x2:best.tx,y2:best.ty-5,stroke:colors[row.group],'stroke-opacity':.3});
      const name=text(best.tx,best.ty,row.name);name.classList.add('model-name');name.style.fontSize=small?'10px':'11px';
      labels.push({name,lead,cx});
    });
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    for(const [name,color] of Object.entries(colors)){const s=document.createElement('span');s.textContent=name;s.style.color=color;legend.append(s);}
    const key=document.createElement('span');key.textContent=depth?'Bubble area: rewarded tool steps':'Bubble area: RL rollout tokens';legend.append(key);
    // A numeric scale makes bubble sizes comparable across the two slides.
    [depth?10:1e12,depth?50:10e12,depth?150:50e12].forEach((v,i)=>{
      const r=Math.sqrt(v/max)*maxR,cx=right-(2-i)*(small?54:90)-maxR;
      n('circle',{cx,cy:bottom-22-r,r,fill:'none',stroke:'#9aafbf','stroke-opacity':.6});
      text(cx,bottom-7,depth?`${v}`:`${v/1e12}T`);
    });
    return p=>{const t=reduced()?1:clamp(p/.72);marks.forEach(({dot,r,cx})=>dot.setAttribute('r',r*clamp((t-(cx-m.l)/iw*.6)/.25)));labels.forEach(({name,lead,cx})=>{const a=clamp((t-(cx-m.l)/iw*.6)/.25);name.style.opacity=a;lead.style.opacity=a;});};
  }
  const isChina=scene.id==='china-frontier',start=Date.parse(isChina?'2023-01-01':'2025-01-06'),end=Date.parse(isChina?'2026-01-01':'2026-07-06');
  const x=d=>m.l+(Date.parse(d)-start)/(end-start)*iw,y=v=>bottom-(v-(isChina?95:0))/(isChina?65:60)*ih;
  axes(isChina?[['2023-01-01','2023'],['2024-01-01','2024'],['2025-01-01','2025'],['2026-01-01','2026']]:[['2025-01-06','Jan 2025'],['2025-07-07','Jul'],['2026-01-05','Jan 2026'],['2026-07-06','Jul']],isChina?[[100,'100'],[110,'110'],[120,'120'],[130,'130'],[140,'140'],[150,'150']]:[[0,'0%'],[20,'20%'],[40,'40%'],[60,'60%']],x,y,'DATE',isChina?'EPOCH CAPABILITIES INDEX':'CHINESE MODEL TOKEN SHARE');
  const defs=n('defs',{}),clip=n('clipPath',{id:`native-${scene.id}`},defs),rect=n('rect',{x:m.l-5,y:0,width:0,height:H},clip);
  const group=n('g',{'clip-path':`url(#native-${scene.id})`});
  const legend=scene.querySelector('.legend');legend.replaceChildren();
  const series=isChina?[['United States',data.frontier.US,'#43a9ff'],['China',data.frontier.China,'#ff914f']]:[['Chinese models',data.tokenShare,'#ff914f']];
  for(const [name,rows,color] of series){
    let d='';rows.forEach(([date,v],i)=>{d+=i?(isChina?`H${x(date)}V${y(v)}`:`L${x(date)},${y(v)}`):`M${x(date)},${y(v)}`;});
    if(!isChina)n('path',{d:d+`L${x(rows.at(-1)[0])},${bottom}L${x(rows[0][0])},${bottom}Z`,fill:color,'fill-opacity':.18},group);
    n('path',{d,fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'},group);
    if(isChina)rows.forEach(([date,v])=>{const dot=n('circle',{cx:x(date),cy:y(v),r:4,fill:color,stroke:'#0b1015','stroke-width':2},group);n('title',{},dot,`${name}: ≈${v} ECI, ${date}`);});
    const s=document.createElement('span');s.textContent=name;s.style.color=color;legend.append(s);
  }
  return p=>rect.setAttribute('width',(iw+10)*(reduced()?1:clamp(p/.75)));
};
