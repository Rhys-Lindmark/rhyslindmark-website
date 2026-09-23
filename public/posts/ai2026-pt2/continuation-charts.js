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
  if(scene.id==='anthropic-rd-automation'){
    const rows=data.rdAutomation.rows,cell=iw/rows.length,edge=i=>m.l+i*cell,y=v=>bottom-v/100*ih;
    const bands=[
      {index:4,name:'AL4 · AI leads',color:'#39ffc1'},
      {index:3,name:'AL3 · AI collaborates',color:'#2d9bc1'},
      {index:2,name:'AL2 · AI assists',color:'#345b72'},
      {index:1,name:'AL1 · Minimal AI',color:'#243b4d'},
      {index:0,name:'AL0 · No AI',color:'#152631'}
    ];
    [0,25,50,75,100].forEach(v=>{n('line',{x1:m.l,x2:right,y1:y(v),y2:y(v),stroke:'#2a3a47'});text(m.l-10,y(v)+4,`${v}%`,'end');});
    const clip=n('clipPath',{id:'anthropic-rd-reveal'}),reveal=n('rect',{x:m.l,y:m.t,width:0,height:ih},clip);
    const plot=n('g',{'clip-path':'url(#anthropic-rd-reveal)'});
    bands.forEach(({index,color,name})=>{
      const lower=row=>row.slice(index+2).reduce((sum,value)=>sum+value,0),upper=row=>lower(row)+row[index+1];
      let d=`M${edge(0)},${y(upper(rows[0]))}`;
      rows.forEach((row,i)=>{d+=`H${edge(i+1)}`;if(i<rows.length-1)d+=`V${y(upper(rows[i+1]))}`;});
      d+=`V${y(lower(rows.at(-1)))}`;
      for(let i=rows.length-1;i>=0;i--){d+=`H${edge(i)}`;if(i)d+=`V${y(lower(rows[i-1]))}`;}
      const area=n('path',{d:d+'Z',fill:color,stroke:'#0b1015','stroke-width':1},plot);
      n('title',{},area,name);
    });
    const ticks=small?[0,3,5,7,9,12]:[0,2,4,6,8,10,12];
    ticks.forEach(i=>{const x=edge(i)+cell/2;n('line',{x1:x,x2:x,y1:bottom,y2:bottom+6,stroke:'#607888'});const label=text(x,bottom+25,rows[i][0]);label.style.fontSize=small?'9px':'11px';});
    const last=rows.at(-1),x=edge(rows.length-1)+cell/2,cy=y(last[5]);
    n('circle',{cx:x,cy,r:small?4:5,fill:'#39ffc1',stroke:'#0b1015','stroke-width':2},plot);
    const value=text(x,cy-14,'26%','middle',plot);value.style.fill='#39ffc1';value.style.fontWeight='700';value.style.fontSize=small?'15px':'20px';
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    bands.slice().reverse().forEach(({name,color})=>{const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.setProperty('--color',color);swatch.style.borderTopWidth='8px';item.append(swatch,document.createTextNode(name));legend.append(item);});
    const render=()=>{
      const stage=Number(scene.dataset.stage||0),local=Number(scene.dataset.localProgress||0);
      const progress=reduced()?1:stage===1?clamp(local/.85):0;
      reveal.setAttribute('width',iw*progress);
      legend.style.opacity=progress;
    };
    render();
    return render;
  }
  if(scene.id==='openai-researcher-usage'){
    const {rows,annualizationDays}=data.openaiResearcherUsage;
    const start=Date.parse(rows[0][0]),end=Date.parse(rows.at(-1)[0]);
    const x=date=>m.l+(Date.parse(date)-start)/(end-start)*iw;
    const y=annual=>bottom-annual/250000*ih;
    axes([['2026-01-04','Jan'],['2026-03-01','Mar'],['2026-05-03','May'],['2026-07-12','Jul'],['2026-08-15','Aug']],
      [[0,'$0'],[50000,'$50k'],[100000,'$100k'],[150000,'$150k'],[200000,'$200k'],[250000,'$250k']],x,y,'2026','ANNUALIZED API-PRICE USD');
    const clip=n('clipPath',{id:'openai-usage-reveal'}),reveal=n('rect',{x:m.l,y:m.t,width:0,height:ih},clip);
    const plot=n('g',{'clip-path':'url(#openai-usage-reveal)'});
    const points=rows.map(([date,daily])=>[x(date),y(daily*annualizationDays)]);
    const line=points.map(([px,py],i)=>`${i?'L':'M'}${px},${py}`).join('');
    n('path',{d:`${line}L${right},${bottom}L${m.l},${bottom}Z`,fill:'#43a9ff','fill-opacity':.13},plot);
    const trace=n('path',{d:line,fill:'none',stroke:'#43a9ff','stroke-width':small?2.5:3.5,'stroke-linecap':'round','stroke-linejoin':'round'},plot);
    n('title',{},trace,'Median researcher coding-agent usage, annualized from OpenAI’s daily API-price estimates');
    const [endX,endY]=points.at(-1);
    n('circle',{cx:endX,cy:endY,r:small?5:6,fill:'#39ffc1',stroke:'#0b1015','stroke-width':2},plot);
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    const item=document.createElement('span'),swatch=document.createElement('i');
    swatch.style.setProperty('--color','#43a9ff');item.append(swatch,document.createTextNode('Median researcher · 365-day run rate'));legend.append(item);
    const render=()=>{
      const progress=reduced()?1:clamp(Number(scene.dataset.localProgress||0)/.85);
      reveal.setAttribute('width',iw*progress);
      legend.style.opacity=progress;
    };
    render();
    return render;
  }
  if(scene.id==='lab-workforce-growth'){
    const rows=data.labWorkforceGrowth.rows,start=Date.parse(rows[0][0]),end=Date.parse(rows.at(-1)[0]);
    const x=date=>m.l+(Date.parse(date)-start)/(end-start)*iw,y=value=>bottom-value/35000*ih;
    axes([2020,2021,2022,2023,2024,2025,2026].map(year=>[`${year}-01-01`,String(year)]),
      [[0,'0'],[10000,'10k'],[20000,'20k'],[30000,'30k']],x,y,'Year','People / agents');
    const series=[
      {index:1,name:'OpenAI people',color:'#43a9ff',dash:'7 5'},
      {index:2,name:'OpenAI agents',color:'#43a9ff'},
      {index:3,name:'Anthropic people',color:'#ffcc66',dash:'7 5'},
      {index:4,name:'Anthropic agents',color:'#ffcc66'}
    ];
    series.forEach(({index,name,color,dash})=>{
      const points=rows.map(row=>[x(row[0]),y(row[index])]);
      const d=points.map(([px,py],i)=>`${i?'L':'M'}${px},${py}`).join('');
      const line=n('path',{d,fill:'none',stroke:color,'stroke-width':small?2.5:3.5,'stroke-dasharray':dash||'','stroke-linecap':'round','stroke-linejoin':'round'});
      n('title',{},line,`${name} · illustrative`);
      const [endX,endY]=points.at(-1);
      n('circle',{cx:endX,cy:endY,r:small?5:6,fill:color,stroke:'#0b1015','stroke-width':2});
    });
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    series.forEach(({name,color,dash})=>{const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.setProperty('--color',color);if(dash)swatch.style.borderTopStyle='dashed';item.append(swatch,document.createTextNode(name));legend.append(item);});
    return ()=>{};
  }
  if(scene.id==='chinchilla'){
    const x=v=>m.l+(Math.log10(v)-17)/8*iw,y=v=>bottom-(Math.log10(v)-7)/5*ih;
    axes([[1e17,'10¹⁷'],[1e19,'10¹⁹'],[1e21,'10²¹'],[1e23,'10²³'],[1e25,'10²⁵']],[[1e7,'10M'],[1e8,'100M'],[1e9,'1B'],[1e10,'10B'],[1e11,'100B'],[1e12,'1T']],x,y,'TRAINING COMPUTE · FLOP','MODEL PARAMETERS');
    n('rect',{x:m.l,y:m.t,width:iw,height:ih,fill:'none',stroke:'#40515e','stroke-width':1});
    const defs=n('defs',{}),kaplanClip=n('clipPath',{id:'native-chinchilla-kaplan'},defs),approachClip=n('clipPath',{id:'native-chinchilla-approach'},defs);
    const kaplanReveal=n('rect',{x:m.l,y:0,width:0,height:H},kaplanClip),approachReveal=n('rect',{x:m.l,y:0,width:0,height:H},approachClip);
    const kaplan=n('path',{d:`M${x(2e17)},${y(1e7)} L${x(4e24)},${y(2e12)}`,fill:'none',stroke:'#d8e1e8','stroke-width':small?2.2:3,'stroke-dasharray':'9 8','stroke-linecap':'round','clip-path':'url(#native-chinchilla-kaplan)'});
    const approach=n('path',{d:`M${x(1e17)},${y(3e7)} L${x(1e25)},${y(2.4e11)}`,fill:'none',stroke:'#39ffc1','stroke-width':small?2.8:3.8,'stroke-linecap':'round','clip-path':'url(#native-chinchilla-approach)'});
    function starPath(cx,cy,outer=small?8:11){
      let d='';
      for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?outer*.44:outer;d+=`${i?'L':'M'}${cx+Math.cos(angle)*r},${cy+Math.sin(angle)*r}`;}
      return d+'Z';
    }
    const points=[
      {name:'GPT-3',flops:3.1e23,parameters:1.75e11,color:'#ff766e',side:'end'},
      {name:'Gopher',flops:5.8e23,parameters:2.8e11,color:'#ffb43c',side:'start'},
      {name:'Megatron-Turing NLG',flops:9e23,parameters:5.3e11,color:'#a66bea',side:'start'}
    ];
    const kaplanMarks=points.map((point,i)=>{
      const cx=x(point.flops),cy=y(point.parameters),mark=n('path',{d:starPath(cx,cy),fill:point.color,stroke:'#f2f6f8','stroke-width':1.2});
      n('title',{},mark,`${point.name}: ${Math.round(point.parameters/1e9)}B parameters`);
      const anchor=small?'end':point.side,offset=anchor==='end'?-14:14,dy=i===0?18:i===1?4:-12;
      const name=text(cx+offset,cy+dy,point.name,anchor);name.style.fill=point.color;name.style.fontSize=small?'10px':'12px';name.style.paintOrder='stroke';name.style.stroke='#0b1015';name.style.strokeWidth='4px';
      return {mark,name};
    });
    const chinchillaX=x(5.8e23),chinchillaY=y(7e10),chinchilla=n('path',{d:starPath(chinchillaX,chinchillaY,small?9:12),fill:'#39ffc1',stroke:'#f2f6f8','stroke-width':1.3});
    n('title',{},chinchilla,'Chinchilla: 70B parameters');
    const chinchillaLabel=text(chinchillaX+(small?-14:14),chinchillaY+5,'Chinchilla · 70B',small?'end':'start');chinchillaLabel.style.fill='#39ffc1';chinchillaLabel.style.fontSize=small?'10px':'12px';chinchillaLabel.style.paintOrder='stroke';chinchillaLabel.style.stroke='#0b1015';chinchillaLabel.style.strokeWidth='4px';
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    [['Kaplan et al. (2020)','#d8e1e8','dashed'],['Our Approach','#39ffc1','solid']].forEach(([name,color,style])=>{const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.setProperty('--color',color);swatch.style.borderTopStyle=style;item.append(swatch,document.createTextNode(name));legend.append(item);});
    return ()=>{
      const stage=Number(scene.dataset.stage||0),local=Number(scene.dataset.localProgress||0);
      const first=reduced()?1:stage===0?0:stage===1?clamp(local/.8):1;
      const second=reduced()?1:stage===2?clamp(local/.8):0;
      kaplanReveal.setAttribute('width',iw*first);approachReveal.setAttribute('width',iw*second);
      kaplanMarks.forEach(({mark,name},i)=>{const opacity=clamp((first-.5-i*.1)/.22);mark.style.opacity=opacity;name.style.opacity=opacity;});
      chinchilla.style.opacity=second;chinchillaLabel.style.opacity=second;approach.style.opacity=second>0?'1':'0';
      legend.children[0].style.opacity=first;legend.children[1].style.opacity=second;
      kaplan.style.opacity=stage&&second>.15?'.48':'1';
    };
  }
  const colors={OpenAI:'#43a9ff',Anthropic:'#ffcc66',China:'#52d6a0',xAI:'#e985cf',DeepMind:'#ff914f'};
  const bubble=scene.id==='rl-rollouts'||scene.id==='trajectory-depth';
  if(bubble){
    const x=v=>m.l+(Math.log10(v)-23)/(27-23)*iw,y=v=>bottom-(Math.log10(v)-10.6)/(12.7-10.6)*ih;
    axes([[1e23,'10²³'],[1e24,'10²⁴'],[1e25,'10²⁵'],[1e26,'10²⁶'],[1e27,'10²⁷']],[[1e11,'100B'],[3e11,'300B'],[1e12,'1T'],[3e12,'3T']],x,y,'TRAINING COMPUTE · FLOP','TOTAL PARAMETERS');
    const depth=scene.id==='trajectory-depth',max=depth?150:50e12,maxR=Math.min(small?28:42,ih*.12);
    const marks=[],labels=[];
    // Greedy placement keeps every model name readable without changing its data position.
    const occupied=[];
    [...data.models].filter(row=>!depth||!row.rolloutsOnly).sort((a,b)=>b.parameters-a.parameters).forEach((row,i)=>{
      const cx=x(row.flops),cy=y(row.parameters),v=depth?row.toolSteps:row.rolloutTokens,r=Math.max(3,Math.sqrt(v/max)*maxR);
      const dot=n('circle',{cx,cy,r,fill:colors[row.group],'fill-opacity':.32,stroke:colors[row.group],'stroke-width':1.5});
      n('title',{},dot,`${row.name}: ≈${(row.parameters/1e9).toFixed(0)}B parameters; ≈${row.flops.toExponential(1)} FLOP; ${depth?'≈'+Math.round(v)+' steps':'≈'+(v/1e12).toFixed(1)+'T rollout tokens'}`);
      marks.push({dot,r,cx,model:row.name});
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
      labels.push({name,lead,cx,model:row.name});
    });
    const legend=scene.querySelector('.legend');legend.replaceChildren();
    for(const [name,color] of Object.entries(colors)){const s=document.createElement('span');s.textContent=name;s.style.color=color;legend.append(s);}
    const key=document.createElement('span');key.textContent=depth?'Bubble area: rewarded tool steps':'Bubble area: RL rollout tokens';legend.append(key);
    // A numeric scale makes bubble sizes comparable across the two slides.
    const scaleMarks=[];
    [depth?10:1e12,depth?50:10e12,depth?150:50e12].forEach((v,i)=>{
      const r=Math.sqrt(v/max)*maxR,cx=right-(2-i)*(small?54:90)-maxR;
      scaleMarks.push(n('circle',{cx,cy:bottom-22-r,r,fill:'none',stroke:'#9aafbf','stroke-opacity':.6}));
      scaleMarks.push(text(cx,bottom-7,depth?`${v}`:`${v/1e12}T`));
    });
    return p=>{
      if(depth){const t=reduced()?1:clamp(p/.72);marks.forEach(({dot,r,cx})=>dot.setAttribute('r',r*clamp((t-(cx-m.l)/iw*.6)/.25)));labels.forEach(({name,lead,cx})=>{const a=clamp((t-(cx-m.l)/iw*.6)/.25);name.style.opacity=a;lead.style.opacity=a;});return;}
      const stage=Number(scene.dataset.stage||0),local=Number(scene.dataset.localProgress||0),reveal=reduced()?1:stage?1:clamp(local/.28),size=reduced()?1:stage>=2?1:stage?clamp(local/.42):0,focus=reduced()?0:stage>=2?clamp(local/.35):0;
      marks.forEach(({dot,r,model})=>{dot.setAttribute('r',reveal*(4+(r-4)*size));dot.style.opacity=1-(model==='GLM-5.2'||model==='GLM-5.3'?0:.86*focus);});
      labels.forEach(({name,lead,model})=>{const opacity=reveal*(1-(model==='GLM-5.2'||model==='GLM-5.3'?0:.86*focus));name.style.opacity=opacity;lead.style.opacity=opacity;});
      key.style.opacity=size*(1-.72*focus);scaleMarks.forEach(mark=>mark.style.opacity=size*(1-.72*focus));legend.style.opacity=1-.72*focus;
    };
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
