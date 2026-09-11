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
    if (kind === 'sourcegraph') {
      const reveal=svg.querySelector('.source-reveal');
      renderers.set(scene,p=>reveal.setAttribute('width',Number(reveal.dataset.width)*(reduce.matches?1:clamp(p/.7))));
      return;
    }
    const box = scene.querySelector('.plot-wrap').getBoundingClientRect();
    const W = Math.max(280, box.width), H = Math.max(220, box.height), small = W < 600;
    const m = {l: small ? 78 : 100, r: small ? 18 : 45, t: 28, b: 55};
    const iw = W-m.l-m.r, ih = H-m.t-m.b;
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    node('title', {}, svg, svg.getAttribute('aria-label'));
    if(kind==='metr') {
      const left=small?75:100,right=small?25:70,top=35,bottom=H-55;
      const x=v=>left+(Date.parse(v)-Date.parse('2019-01-01'))/(Date.parse('2026-09-01')-Date.parse('2019-01-01'))*(W-left-right);
      const y=v=>bottom-(Math.log10(v/.008)/Math.log10(600/.008))*(bottom-top);
      [.0166667,.1,1,10,60,240].forEach((v,i)=>{node('line',{x1:left,x2:W-right,y1:y(v),y2:y(v),stroke:'#2a3a47'},svg);label(svg,left-9,y(v)+4,['1 sec','6 sec','1 min','10 min','1 hour','4 hours'][i],'end');});
      [2019,2021,2023,2025,2026].forEach(v=>label(svg,x(v+'-01-01'),H-30,v));
      verticalTitle(svg,(top+bottom)/2,'HUMAN TASK DURATION · 80% SUCCESS');
      label(svg,(left+W-right)/2,H-7,'MODEL RELEASE DATE');
      const names={gpt2:'GPT-2',davinci_002:'GPT-3',gpt_3_5_turbo_instruct:'GPT-3.5',gpt_4:'GPT-4',o1_preview:'o1-preview',claude_3_7_sonnet_inspect:'Claude 3.7',o3_inspect:'o3',claude_mythos_preview_early_inspect:'Mythos (early)'};
      const marks=[];
      data.metr.rows.forEach((r,i)=>{
        const g=node('g',{},svg),xx=x(r.date),yy=y(r.estimate);
        node('title',{},g,`${r.name}: ${r.estimate.toFixed(2)} minutes, 80% success`);
        if(r.ci_low>0)node('line',{x1:xx,x2:xx,y1:y(Math.min(600,r.ci_high)),y2:y(Math.max(.008,r.ci_low)),stroke:'#39ffc1',opacity:'.22','stroke-width':2},g);
        node('circle',{cx:xx,cy:yy,r:r.sota?5:3,fill:r.sota?'#39ffc1':'#67887c'},g);
        if(names[r.name]&&(!small||[0,3,9,25].includes(i))){const end=i===data.metr.rows.length-1;label(g,xx+(end?-10:9),yy-10,names[r.name],end?'end':'start');}
        marks.push(g);
      });
      renderers.set(scene,p=>marks.forEach((g,i)=>g.style.opacity=reduce.matches||i/(marks.length-1)<=clamp(p/.7)?'1':'.06'));
    } else
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
      const paths=[], defs=node('defs',{},svg);
      data.expansion.forEach((row,i)=>{
        const g=node('g',{},svg), focus=['Amazon','Uber','Anthropic est.'].includes(row.name);
        const clip=node('clipPath',{id:`expansion-reveal-${i}`},defs);
        const reveal=node('rect',{x:left-6,y:0,width:width+12,height:H},clip);
        const path=node('path',{d:row.points.map((pt,j)=>`${j?'L':'M'}${x(pt[0])},${y(pt[1])}`).join(' '),fill:'none',stroke:row.color,'stroke-width':focus?3.5:2.5,'stroke-dasharray':row.estimated?'7 5':'none','clip-path':`url(#expansion-reveal-${i})`},g);
        const last=row.points.at(-1), marker=node('g',{},g);
        node('circle',{cx:x(last[0]),cy:y(last[1]),r:row.estimated?5:3,fill:row.estimated?'#0b1015':row.color,stroke:row.color,'stroke-width':2},marker);
        if(row.estimated){const t=label(marker,x(last[0])-9,y(last[1])+4,`${row.name.split(' ')[0]} ${last[1]}%`,'end');t.style.fill=row.color;}
        paths.push({g,row,path,reveal,marker,focus});
      });
      legend(scene,data.expansion);
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0), local=Number(scene.dataset.localProgress||0);
        const comparison=reduce.matches||stage>0, progress=reduce.matches?1:clamp((local-.08)/.72);
        paths.forEach(({g,row,path,reveal,marker,focus},i)=>{
          const visible=comparison||row.estimated;
          const opacity=comparison?(focus||row.name==='OpenAI est.'?1:.25):1;
          g.style.opacity=visible?String(opacity):'0';
          path.style.opacity=comparison?'1':'0';
          const first=row.points[0],last=row.points.at(-1);
          reveal.setAttribute('width',focus&&comparison?Math.max(0,x(first[0])-left+6+(x(last[0])-x(first[0])+6)*progress):width+12);
          marker.style.opacity=!comparison||row.estimated||!focus||progress===1?'1':'0';
          const item=scene.querySelectorAll('.legend span')[i];
          item.hidden=!visible;item.style.display=visible?'':'none';item.style.opacity=String(opacity);
        });
      });
    } else if (kind === 'compute') {
      const left=small?12:65,top=70,width=W-2*left,height=H-top-45,rdWidth=width*5/7,infWidth=width*2/7;
      const rd=node('g',{},svg),inf=node('g',{},svg);
      const rdMainHeight=height*.9,trainHeight=height*.1;
      node('rect',{x:left,y:top,width:rdWidth-4,height:rdMainHeight-4,fill:'#17bdb6'},rd);
      node('rect',{x:left,y:top+rdMainHeight,width:rdWidth*.4/.48-4,height:trainHeight,fill:'#39ffc1'},rd);
      node('rect',{x:left+rdWidth*.4/.48,y:top+rdMainHeight,width:rdWidth*.08/.48-4,height:trainHeight,fill:'#8aecbb'},rd);
      node('rect',{x:left+rdWidth,y:top,width:infWidth,height,fill:'#43a9ff'},inf);
      const text=(g,x,y,t,anchor='start')=>{const el=label(g,x,y,t,anchor);el.style.fill=y>=top?'#071018':'#e6edf3';return el;};
      text(rd,left,25,'R&D · $5B');text(inf,left+rdWidth,25,small?'Inference':'Inference · $2B');
      if(small)text(inf,left+rdWidth,43,'$2B');
      text(rd,left+12,top+28,'$4.5B');text(rd,left+12,top+48,'Other R&D');
      if(!small){text(rd,left+12,top+73,'Experiments, research, and unreleased models');text(inf,left+rdWidth+12,top+28,'$2B');text(inf,left+rdWidth+12,top+48,'Inference');}
      text(rd,left+8,top+rdMainHeight+trainHeight/2+4,small?'$400M':'$400M · GPT-4.5 final run');
      text(rd,left+rdWidth*.4/.48+3,top+rdMainHeight+trainHeight/2+4,'$80M');
      legend(scene,[{name:'Other R&D',color:'#17bdb6'},{name:'GPT-4.5 final run',color:'#39ffc1'},{name:'Other final runs',color:'#8aecbb'},{name:'Inference',color:'#43a9ff'}]);
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0);
        rd.style.opacity=!reduce.matches&&stage>=3?'.15':'1';
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
      const series=[];
      for(const row of data[kind]) {
        const group=node('g',{},g);
        const path=node('path',{d:row.points.map((p,i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join(' '),fill:'none',stroke:row.color,'stroke-width':small?2.5:3.5},group);
        const end=row.points.at(-1),tip=node('g',{},group);
        node('circle',{cx:x(end[0]),cy:y(end[1]),r:4,fill:row.color},tip);
        const ai=['Anthropic','OpenAI'].includes(row.name);
        if(!revenue && ai) {
          const t=label(tip,x(end[0])+9,y(end[1])-10,`${row.name} $${end[1]}B`,'start');t.style.fill=row.color;
        }
        series.push({group,path,tip,ai,length:path.getTotalLength()});
      }
      legend(scene,data[kind]);
      renderers.set(scene,p=>{
        if(revenue){rect.setAttribute('width',(iw+6)*(reduce.matches?1:clamp(p/.78)));return;}
        rect.setAttribute('width',iw+6);
        series.forEach(({group,path,tip,ai,length},i)=>{
          const progress=reduce.matches?1:clamp(ai?(p-.5)/.4:p/.4);
          group.style.opacity=progress>0?'1':'0';
          path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length*(1-progress));
          tip.style.opacity=progress>=1?'1':'0';
          const item=scene.querySelectorAll('.legend span')[i];item.style.visibility=ai&&!reduce.matches&&p<=.5?'hidden':'visible';
        });
      });
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
          bars.push({bar,t,value,metric,company:row.name});
        });
      });
      legend(scene,[{name:'Gross margin',color:'#43a9ff'},{name:'Operating margin, ex-SBC',color:'#ff914f'}]);
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0);
        const focus=stage===1?'gross':stage===2?'operating':null;
        const progress=reduce.matches||stage>0?1:clamp(Number(scene.dataset.localProgress||0)/.8);
        bars.forEach(({bar,t,metric,value,company})=>{
          const current=value*progress;
          bar.setAttribute('x',Math.min(x(0),x(current)));
          bar.setAttribute('width',Math.abs(x(current)-x(0)));
          t.setAttribute('x',x(current)+(value<0?5:6));
          const opacity=reduce.matches||!focus||(metric===focus&&company!=='NVIDIA')?'1':'.18';
          bar.style.opacity=opacity;t.style.opacity=progress>=1?opacity:'0';
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
  const slideEntries=[];
  let continuation=false,nextSlide=19,slideLinksReady=false;
  for(const el of document.querySelector('#article').children){
    if(el.id==='sources')break;
    if(el.classList.contains('scene')){
      const steps=(el.dataset.steps||el.id).split(',');
      steps.forEach((anchor,index)=>slideEntries.push({id:continuation?String(nextSlide++):anchor,anchor,el,index,count:steps.length}));
      if(el.id==='18')continuation=true;
    }else if(continuation&&el.matches('.body-copy,.article-visual,.article-embed,.article-heading')){
      slideEntries.push({id:String(nextSlide++),anchor:el.id,el,index:0,count:1});
    }
  }
  function setSlideAddress(id){
    const url=new URL(location.href);
    if(id)url.searchParams.set('slide',id);else url.searchParams.delete('slide');
    url.hash='';
    if(url.href!==location.href)history.replaceState(history.state,'',url.pathname+url.search);
  }
  function syncSlideAddress(){
    if(!slideLinksReady)return;
    let current;
    for(const entry of slideEntries){
      if(entry.el.getBoundingClientRect().top>innerHeight*.35)break;
      if(!entry.el.classList.contains('scene')||entry.index===Number(entry.el.dataset.stage||0))current=entry;
    }
    if(current)setSlideAddress(current.id);
    else if(scrollY<innerHeight)setSlideAddress(null);
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
    syncSlideAddress();
  }
  function request(){if(!frame)frame=requestAnimationFrame(update);}
  function followHash(){
    const hash=decodeURIComponent(location.hash.slice(1)),query=new URL(location.href).searchParams.get('slide');
    const entry=hash?slideEntries.find(e=>e.anchor===hash):slideEntries.find(e=>e.id===(query==='17'?'18':query));
    slideLinksReady=false;
    if(entry){
      const sticky=entry.el.querySelector('.sticky'),travel=sticky?Math.max(0,entry.el.offsetHeight-sticky.offsetHeight):0;
      const progress=reduce.matches?0:(entry.index+.4)/entry.count;
      window.scrollTo({top:scrollY+entry.el.getBoundingClientRect().top+travel*progress,behavior:'instant'});
      setSlideAddress(entry.id);
    }else if(hash){document.getElementById(hash)?.scrollIntoView({behavior:'instant'});}
    slideLinksReady=true;request();
  }
  try {
    const response=await fetch('/posts/ai2026-pt2/charts.json?v=axes-2');if(!response.ok)throw Error('Chart data unavailable');data=await response.json();
    const metrResponse=await fetch('/posts/ai2026-pt2/metr.json');if(!metrResponse.ok)throw Error('METR data unavailable');data.metr=await metrResponse.json();
    document.body.classList.toggle('all-mode',reduce.matches);
    for(const scene of scenes){draw(scene);const plot=scene.querySelector('.plot-wrap');if(plot)new ResizeObserver(()=>{draw(scene);request();}).observe(plot);}
    reduce.addEventListener('change',()=>{document.body.classList.toggle('all-mode',reduce.matches);scenes.forEach(draw);request();});
    window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});window.addEventListener('hashchange',followHash);window.addEventListener('popstate',followHash);
    let previous=scrollY;
    window.addEventListener('scroll',()=>{const delta=scrollY-previous;if(Math.abs(delta)>8){document.body.classList.toggle('header-hidden',delta>0&&scrollY>58);previous=scrollY;}},{passive:true});
    document.querySelector('header').addEventListener('focusin',()=>document.body.classList.remove('header-hidden'));
    const spin=document.querySelector('.spin-toggle');
    spin?.addEventListener('click',()=>{const paused=spin.getAttribute('aria-pressed')!=='true';spin.setAttribute('aria-pressed',String(paused));spin.textContent=paused?'Resume flow':'Pause flow';spin.closest('.spiral').classList.toggle('paused',paused);});
    requestAnimationFrame(followHash);update();
  } catch(error) {
    document.body.classList.add('all-mode');
    scenes.forEach(scene=>{const svg=scene.querySelector('svg'),fallback=scene.querySelector('.fallback');if(svg)svg.setAttribute('hidden','');if(fallback)fallback.hidden=false;});
    console.error(error);
  }
})();
