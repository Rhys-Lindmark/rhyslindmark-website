(async () => {
  'use strict';
  const scenes = [...document.querySelectorAll('.scene')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = v => Math.max(0, Math.min(1, v));
  const renderers = new Map();
  let data, frame = 0;
  function node(tag, attrs, parent, text) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    parent.append(el); return el;
  }
  const label = (svg, x, y, text, anchor = 'middle') => node('text', {x, y, 'text-anchor': anchor}, svg, text);
  function verticalTitle(svg, y, text) {
    return node('text', {x: 14, y, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 14 ${y})`}, svg, text);
  }
  function legend(scene, rows) {
    const target = scene.querySelector('.legend'); target.replaceChildren();
    rows.forEach(row => {
      const el = document.createElement('span'), marker = document.createElement('i');
      el.style.setProperty('--color', row.color); el.append(marker, document.createTextNode(row.name)); target.append(el);
    });
  }
  function draw(scene) {
    const kind = scene.dataset.kind, svg = scene.querySelector('svg');
    if (!svg) return;
    const box = scene.querySelector('.plot-wrap').getBoundingClientRect();
    const W = Math.max(280, box.width), H = Math.max(220, box.height), small = W < 600;
    const m = {l: small ? 78 : 100, r: small ? 18 : 45, t: 28, b: 55};
    const iw = W-m.l-m.r, ih = H-m.t-m.b;
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    node('title', {}, svg, svg.getAttribute('aria-label'));
    if (kind === 'business') {
      const rows=data.business, left=small?24:70, width=W-left*2;
      const top=H*.28, bh=Math.min(180,H*.32), segments=[];
      label(svg,left+width/2,top+bh+52,'REVENUE ALLOCATION · USD BILLIONS / GW');
      let total=0;
      rows.forEach((row,i)=>{
        const x=left+total/30*width,bw=row.value/30*width;
        const g=node('g',{},svg),rect=node('rect',{x,y:top,width:Math.max(0,bw-3),height:bh,fill:row.color},g);
        const t=label(g,x+bw/2,top+bh/2+5,`$${row.value}B`);t.style.fill='#071018';t.style.fontWeight='700';
        if(small&&row.value===1){t.setAttribute('y',top+bh+24);t.style.fill=row.color;}
        segments.push(g);total+=row.value;
      });
      legend(scene,rows);
      renderers.set(scene,p=>{
        const stage=Number(scene.dataset.stage||0), local=Number(scene.dataset.localProgress||0);
        // Let the second passage enter before focusing its three expense segments.
        const focus=stage===0||local<.25?-1:Math.min(2,Math.floor((local-.25)/.25));
        segments.forEach((g,i)=>g.style.opacity=reduce.matches||focus<0||i===focus?'1':'.45');
        scene.querySelectorAll('.legend span').forEach((el,i)=>{
          el.style.opacity=reduce.matches||focus<0||i===focus?'1':'.45';
        });
      });
    } else if (kind === 'expansion') {
      const left=small?80:100,right=small?16:40,bottom=H-44,width=W-left-right;
      const sy=v=>Math.sign(v)*Math.log1p(Math.abs(v)/10),lo=sy(-140),hi=sy(80);
      const x=v=>left+(v-1999)/28*width,y=v=>28+(bottom-28)*(1-(sy(v)-lo)/(hi-lo));
      [-100,-50,-20,0,20,50].forEach(v=>{node('line',{x1:left,x2:W-right,y1:y(v),y2:y(v),stroke:v===0?'#e6edf3':'#2a3a47'},svg);label(svg,left-8,y(v)+4,`${v}%`,'end');});
      [2000,2010,2020,2026].forEach(v=>label(svg,x(v),H-25,v));
      label(svg,left+width/2,H-5,'FISCAL YEAR');
      verticalTitle(svg,(28+bottom)/2,'OPERATING MARGIN · EX-SBC (%) · SYMLOG');
      const paths=[];
      data.expansion.forEach(row=>{
        const g=node('g',{},svg);
        node('path',{d:row.points.map((pt,i)=>`${i?'L':'M'}${x(pt[0])},${y(pt[1])}`).join(' '),fill:'none',stroke:row.color,'stroke-width':row.estimated?3:2.5,'stroke-dasharray':row.estimated?'7 5':'none'},g);
        const last=row.points.at(-1);node('circle',{cx:x(last[0]),cy:y(last[1]),r:row.estimated?5:3,fill:row.estimated?'#0b1015':row.color,stroke:row.color,'stroke-width':2},g);
        if(row.estimated){const t=label(g,x(last[0])-9,y(last[1])+4,`${row.name.split(' ')[0]} ${last[1]}%`,'end');t.style.fill=row.color;}
        paths.push({g,row});
      });
      legend(scene,data.expansion);
      renderers.set(scene,()=>paths.forEach(({g,row})=>g.style.opacity=reduce.matches||Number(scene.dataset.stage||0)>0||row.estimated?'1':'.25'));
    } else if (kind === 'compute') {
      const left=small?12:65,top=70,width=W-2*left,height=H-top-45,rdWidth=width*5/7,infWidth=width*2/7;
      const rd=node('g',{},svg),inf=node('g',{},svg);
      const rdMainHeight=height*.9,trainHeight=height*.1;
      node('rect',{x:left,y:top,width:rdWidth-4,height:rdMainHeight-4,fill:'#17bdb6'},rd);
      node('rect',{x:left,y:top+rdMainHeight,width:rdWidth*.4/.48-4,height:trainHeight,fill:'#39ffc1'},rd);
      node('rect',{x:left+rdWidth*.4/.48,y:top+rdMainHeight,width:rdWidth*.08/.48-4,height:trainHeight,fill:'#8aecbb'},rd);
      node('rect',{x:left+rdWidth,y:top,width:infWidth,height,fill:'#43a9ff'},inf);
      const text=(g,x,y,t,anchor='start')=>{const el=label(g,x,y,t,anchor);el.style.fill='#e6edf3';return el;};
      text(rd,left,25,'R&D · $5B');text(inf,left+rdWidth,25,small?'Inference':'Inference · $2B');
      if(small)text(inf,left+rdWidth,43,'$2B');
      text(rd,left+12,top+28,'$4.5B');text(rd,left+12,top+48,'Other R&D');
      if(!small){text(rd,left+12,top+73,'Experiments, research, and unreleased models');text(inf,left+rdWidth+12,top+28,'$2B');text(inf,left+rdWidth+12,top+48,'Inference');}
      text(rd,left+8,top+rdMainHeight+trainHeight/2+4,small?'$400M':'$400M · GPT-4.5 final run');
      text(rd,left+rdWidth*.4/.48+3,top+rdMainHeight+trainHeight/2+4,'$80M');
      legend(scene,[{name:'Other R&D',color:'#17bdb6'},{name:'GPT-4.5 final run',color:'#39ffc1'},{name:'Other final runs',color:'#8aecbb'},{name:'Inference',color:'#43a9ff'}]);
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0);
        rd.style.opacity=!reduce.matches&&stage===3?'.15':'1';
        inf.style.opacity=!reduce.matches&&stage===2?'.15':'1';
      });
    } else
    if (kind === 'revenue' || kind === 'growth') {
      const revenue = kind === 'revenue';
      const x = v => m.l + (revenue ? (v-2023)/4 : v/10) * iw;
      const y = v => m.t + ih * (1-(revenue ? Math.log10(v/.05)/Math.log10(200/.05) : v/180));
      (revenue ? [2023,2024,2025,2026,2027] : [0,2,4,6,8,10]).forEach(v => label(svg,x(v),H-30,v));
      (revenue ? [.1,1,10,100] : [0,50,100,150]).forEach(v => {
        node('line',{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:'#2a3a47'},svg);
        label(svg,m.l-9,y(v)+4,revenue&&v<1?'$100M':`$${v}B`,'end');
      });
      label(svg,m.l+iw/2,H-7,revenue?'YEAR':'YEARS SINCE ≈$10B REVENUE');
      verticalTitle(svg,m.t+ih/2,revenue?'ANNUALIZED REVENUE · USD (LOG SCALE)':'REVENUE · INFLATION-ADJUSTED USD');
      const defs=node('defs',{},svg), clip=node('clipPath',{id:`reveal-${kind}`},defs);
      const rect=node('rect',{x:m.l-3,y:0,width:iw+6,height:H},clip);
      const g=node('g',{'clip-path':`url(#reveal-${kind})`},svg);
      for(const row of data[kind]) {
        node('path',{d:row.points.map((p,i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join(' '),fill:'none',stroke:row.color,'stroke-width':small?2.5:3.5},g);
        const end=row.points.at(-1); node('circle',{cx:x(end[0]),cy:y(end[1]),r:4,fill:row.color},g);
        if(!revenue && ['Anthropic','OpenAI'].includes(row.name)) {
          const t=label(g,x(end[0])+9,y(end[1])-10,`${row.name} $${end[1]}B`,'start');t.style.fill=row.color;
        }
      }
      legend(scene,data[kind]);
      renderers.set(scene,p=>rect.setAttribute('width',(iw+6)*(reduce.matches?1:clamp(p/.78))));
    } else if (kind === 'margins') {
      const left=small?104:150, right=small?34:75, width=W-left-right;
      const x=v=>left+(v+140)/230*width;
      verticalTitle(svg,H/2,'COMPANY');
      label(svg,left+width/2,H-5,'MARGIN (%)');
      [-100,-50,0,50].forEach(v=>{
        node('line',{x1:x(v),x2:x(v),y1:28,y2:H-30,stroke:v===0?'#9aafbf':'#2a3a47'},svg);
        label(svg,x(v),17,`${v}%`);
      });
      const bars=[];
      data.margins.forEach((row,i)=>{
        const cy=65+i*(H-105)/3, bh=Math.min(45,(H-110)/8);
        label(svg,left-10,cy+bh,row.name,'end');
        ['gross','operating'].forEach((metric,j)=>{
          const value=row[metric],color=j?'#ff914f':'#43a9ff',yy=cy+j*(bh+7);
          const bar=node('rect',{x:Math.min(x(0),x(value)),y:yy,width:Math.abs(x(value)-x(0)),height:bh,fill:color},svg);
          const t=label(svg,value<0?x(value)+5:x(value)+6,yy+bh/2+4,`${value}%`,'start');t.style.fill='#fff';
          bars.push({bar,t,value,metric});
        });
      });
      legend(scene,[{name:'Gross margin',color:'#43a9ff'},{name:'Operating margin, ex-SBC',color:'#ff914f'}]);
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0);
        const focus=stage===1?'gross':stage===2?'operating':null;
        bars.forEach(({bar,t,metric})=>{
          const opacity=reduce.matches||!focus||metric===focus?'1':'.18';
          bar.style.opacity=opacity;t.style.opacity=opacity;
        });
        scene.querySelectorAll('.legend span').forEach((el,i)=>{
          el.style.opacity=reduce.matches||!focus||i===(stage===1?0:1)?'1':'.25';
        });
      });
    } else if (kind === 'costs') {
      const left=small?104:150,right=small?18:50,width=W-left-right,x=v=>left+v/240*width;
      verticalTitle(svg,H/2,'COMPANY');
      [0,100,200].forEach(v=>{node('line',{x1:x(v),x2:x(v),y1:25,y2:H-45,stroke:v===100?'#e6edf3':'#2a3a47','stroke-dasharray':v===100?'5 5':''},svg);label(svg,x(v),16,`$${v}`);});
      const bars=[];
      data.costs.forEach((row,i)=>{
        const yy=H*(.24+i*.35),bh=Math.min(70,H*.14);
        label(svg,left-10,yy+bh/2+4,row.name,'end');
        const a=node('rect',{x:x(0),y:yy,width:0,height:bh,fill:'#43a9ff'},svg);
        const b=node('rect',{x:x(60),y:yy,width:0,height:bh,fill:'#ff914f'},svg);
        const t=label(svg,x((60+row.training)/2),yy+bh+24,`$60 + $${row.training} = $${60+row.training}`);t.style.fill='#fff';
        bars.push({a,b,t,row});
      });
      label(svg,left+width/2,H-8,'SPENDING PER $100 OF REVENUE');
      legend(scene,[{name:'Inference · COGS',color:'#43a9ff'},{name:'Training R&D · opex',color:'#ff914f'}]);
      renderers.set(scene,p=>bars.forEach(({a,b,t,row})=>{const t1=reduce.matches?1:clamp(p/.35),t2=reduce.matches?1:clamp((p-.35)/.4);a.setAttribute('width',width*60/240*t1);b.setAttribute('width',width*row.training/240*t2);t.style.opacity=t2===1?'1':'0';}));
    }
    svg.hidden = false; svg.removeAttribute('hidden'); scene.querySelector('.fallback').hidden = true;
  }
  function update() {
    frame=0;
    for(const scene of scenes){
      const sticky=scene.querySelector('.sticky');
      const p=reduce.matches?1:clamp(-scene.getBoundingClientRect().top/Math.max(1,scene.offsetHeight-sticky.offsetHeight));
      const steps=(scene.dataset.steps||scene.id).split(',');
      const stage=Math.min(steps.length-1,Math.floor(p*steps.length));
      const local=reduce.matches?1:Math.min(1,p*steps.length-stage);
      scene.dataset.stage=stage;scene.dataset.localProgress=local;
      scene.querySelectorAll('[data-passage]').forEach(el=>el.hidden=!reduce.matches&&el.dataset.passage!==steps[stage]);
      renderers.get(scene)?.(p);
      const card=scene.querySelector('.passage');
      if(card&&scene.dataset.kind==='spiral')card.hidden=!reduce.matches&&stage===0;
      if(card)card.style.setProperty('--card-shift',`${reduce.matches?0:sticky.offsetHeight-(sticky.offsetHeight+card.offsetHeight)*local}px`);
      const track=scene.querySelector('.track span');if(track)track.style.width=`${p*100}%`;scene.dataset.progress=p.toFixed(3);
      if(scene.dataset.kind==='spiral'){
        const rect=scene.getBoundingClientRect();scene.classList.toggle('is-visible',rect.top<innerHeight&&rect.bottom>0);
      }
    }
  }
  function request(){if(!frame)frame=requestAnimationFrame(update);}
  function followHash(){
    const id=location.hash.slice(1),scene=scenes.find(s=>(s.dataset.steps||s.id).split(',').includes(id));
    if(scene){const steps=(scene.dataset.steps||scene.id).split(','),index=steps.indexOf(id),travel=Math.max(0,scene.offsetHeight-scene.querySelector('.sticky').offsetHeight);window.scrollTo({top:window.scrollY+scene.getBoundingClientRect().top+(reduce.matches?0:(index/steps.length)*travel+(index>0?1:0)),behavior:'instant'});}request();
  }
  try {
    const response=await fetch('/posts/ai2026-pt2/charts.json?v=axes-2');if(!response.ok)throw Error('Chart data unavailable');data=await response.json();
    document.body.classList.toggle('all-mode',reduce.matches);
    for(const scene of scenes){draw(scene);const plot=scene.querySelector('.plot-wrap');if(plot)new ResizeObserver(()=>{draw(scene);request();}).observe(plot);}
    reduce.addEventListener('change',()=>{document.body.classList.toggle('all-mode',reduce.matches);scenes.forEach(draw);request();});
    window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});window.addEventListener('hashchange',followHash);
    let previous=scrollY;
    window.addEventListener('scroll',()=>{const delta=scrollY-previous;if(Math.abs(delta)>8){document.body.classList.toggle('header-hidden',delta>0&&scrollY>58);previous=scrollY;}},{passive:true});
    document.querySelector('header').addEventListener('focusin',()=>document.body.classList.remove('header-hidden'));
    const spin=document.querySelector('.spin-toggle');
    spin.addEventListener('click',()=>{const paused=spin.getAttribute('aria-pressed')!=='true';spin.setAttribute('aria-pressed',String(paused));spin.textContent=paused?'Resume rotation':'Pause rotation';spin.closest('.spiral').classList.toggle('paused',paused);});
    requestAnimationFrame(followHash);update();
  } catch(error) {
    document.body.classList.add('all-mode');
    scenes.forEach(scene=>{const svg=scene.querySelector('svg'),fallback=scene.querySelector('.fallback');if(svg)svg.setAttribute('hidden','');if(fallback)fallback.hidden=false;});
    console.error(error);
  }
})();
