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
  function revenueAt(row, year) {
    const points=row.points;
    if(year<points[0][0]||year>points.at(-1)[0])return null;
    const right=points.findIndex(point=>point[0]>=year);
    if(right<=0)return points[0][1];
    const [x0,y0]=points[right-1],[x1,y1]=points[right],t=(year-x0)/(x1-x0);
    return 10**(Math.log10(y0)+(Math.log10(y1)-Math.log10(y0))*t);
  }
  function revenueDate(year) {
    const date=new Date(Date.UTC(Math.floor(year),Math.min(11,Math.round((year%1)*12)),1));
    return new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(date);
  }
  function revenueValue(value) {
    if(value<1)return `$${Math.round(value*1000)}M`;
    return `$${value<10?value.toFixed(1):Math.round(value)}B`;
  }
  function revenueHover(scene,svg,rows,{W,H,m,iw,ih,x,y}) {
    const wrap=scene.querySelector('.plot-wrap'),start=Math.min(...rows.map(row=>row.points[0][0])),end=Math.max(...rows.map(row=>row.points.at(-1)[0]));
    const hover=node('g',{class:'chart-hover-marks'},svg),rule=node('line',{class:'chart-hover-rule',y1:m.t,y2:m.t+ih},hover);
    const dots=rows.map(row=>node('circle',{r:5,fill:row.color,stroke:'#0b1015','stroke-width':2},hover));
    const hit=node('rect',{class:'chart-hover-hit',x:m.l,y:m.t,width:iw,height:ih,fill:'transparent',tabindex:0,role:'slider','aria-label':'Explore annualized revenue by date','aria-valuemin':String(start),'aria-valuemax':String(end)},svg);
    const tip=document.createElement('div'),date=document.createElement('div'),list=document.createElement('div');
    tip.className='chart-hover-tooltip';tip.hidden=true;tip.setAttribute('aria-live','polite');date.className='chart-hover-date';list.className='chart-hover-list';tip.append(date,list);wrap.append(tip);
    const tipRows=rows.map(row=>{
      const item=document.createElement('div'),swatch=document.createElement('i'),name=document.createElement('span'),value=document.createElement('strong');
      swatch.style.setProperty('--color',row.color);name.textContent=row.name;item.append(swatch,name,value);list.append(item);return {item,value};
    });
    let current=end,focused=false;
    function show(year) {
      current=Math.max(start,Math.min(end,year));
      const xx=x(current),visible=[];rule.setAttribute('x1',xx);rule.setAttribute('x2',xx);
      rows.forEach((row,i)=>{
        const value=revenueAt(row,current),shown=value!==null;
        dots[i].style.display=shown?'':'none';tipRows[i].item.hidden=!shown;
        if(shown){dots[i].setAttribute('cx',xx);dots[i].setAttribute('cy',y(value));tipRows[i].value.textContent=revenueValue(value);visible.push(`${row.name} ${revenueValue(value)}`);}
      });
      hover.style.display='';tip.hidden=false;date.textContent=revenueDate(current);
      const cssX=xx/W*wrap.clientWidth,flip=cssX+tip.offsetWidth+12>wrap.clientWidth;
      tip.style.left=`${cssX}px`;tip.classList.toggle('flip',flip);
      hit.setAttribute('aria-valuenow',current.toFixed(3));hit.setAttribute('aria-valuetext',`${revenueDate(current)}: ${visible.join(', ')}`);
    }
    function hide(){if(!focused){hover.style.display='none';tip.hidden=true;}}
    function point(event){const box=svg.getBoundingClientRect(),xx=(event.clientX-box.left)/box.width*W;show(2023+(xx-m.l)/iw*4);}
    function key(event){
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();show(event.key==='Home'?start:event.key==='End'?end:current+(event.key==='ArrowLeft'?-1:1)/12);
    }
    hover.style.display='none';hit.addEventListener('pointermove',point);hit.addEventListener('pointerdown',point);hit.addEventListener('pointerleave',hide);
    hit.addEventListener('focus',()=>{focused=true;show(current);});hit.addEventListener('blur',()=>{focused=false;hide();});hit.addEventListener('keydown',key);
    svg._hoverCleanup=()=>tip.remove();
  }
  function regimeLabel(svg, row, left, cy, bh, small) {
    // "GPT-4-era foundation" overruns any sane left gutter on a phone, so the
    // name and its qualifier stack above the bar at narrow widths instead.
    const x = small ? left : left - 14, anchor = small ? 'start' : 'end';
    const nameY = small ? cy - bh / 2 - 20 : cy - 1, detailY = small ? cy - bh / 2 - 7 : cy + 15;
    const name = label(svg, x, nameY, row.name, anchor); name.classList.add('value');
    label(svg, x, detailY, row.detail, anchor);
  }
  function draw(scene) {
    const kind = scene.dataset.kind, svg = scene.querySelector('svg');
    if (kind === 'model-code-loop') {
      renderers.set(scene, window.drawModelCodeLoop(scene, () => reduce.matches));
      return;
    }
    if (!svg) return;
    if (kind === 'native-continuation') {
      renderers.set(scene,window.drawContinuationChart(scene,data.continuation,()=>reduce.matches));return;
    }
    if (kind === 'native-labor') {
      renderers.set(scene,window.drawLaborChart(scene,data.labor,()=>reduce.matches));return;
    }
    if (kind === 'frontier') {
      const box=scene.querySelector('.plot-wrap').getBoundingClientRect();
      const W=Math.max(280,box.width),H=Math.max(300,box.height),cx=W/2,cy=H*.51;
      const radius=Math.min(W*.32,H*.29),small=W<600;
      svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
      node('title',{},svg,'AI capability grows through a field of human tasks');
      const defs=node('defs',{},svg);
      const grid=node('pattern',{id:'frontier-grid',width:44,height:44,patternUnits:'userSpaceOnUse'},defs);
      node('path',{d:'M 44 0 L 0 0 0 44',fill:'none',stroke:'#8f66db','stroke-opacity':.15,'stroke-width':.7},grid);
      const warp=node('filter',{id:'frontier-warp',x:'-20%',y:'-20%',width:'140%',height:'140%'},defs);
      node('feTurbulence',{type:'fractalNoise',baseFrequency:'.009 .021',numOctaves:2,seed:11,result:'noise'},warp);
      node('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:Math.max(7,radius*.065),xChannelSelector:'R',yChannelSelector:'B'},warp);
      node('rect',{width:W,height:H,fill:'#080a10'},svg);
      node('rect',{width:W,height:H,fill:'url(#frontier-grid)'},svg);
      const halo=node('circle',{cx,cy,r:radius,fill:'#91e9f2','fill-opacity':.035,stroke:'#94e7ef','stroke-width':1.5},svg);
      const shape=node('path',{fill:'#ed7966',stroke:'#ff8a78','stroke-width':1.5,'stroke-linejoin':'round',filter:'url(#frontier-warp)'},svg);
      const outline=node('circle',{cx,cy,r:radius,fill:'none',stroke:'#a4e8ef','stroke-width':1.5,'stroke-dasharray':'3 6'},svg);
      const ticks=node('g',{stroke:'#8ee8ed','stroke-opacity':.5},svg);
      for(let i=0;i<32;i++){const a=i*Math.PI/16;node('line',{x1:cx+Math.cos(a)*(radius+7),y1:cy+Math.sin(a)*(radius+7),x2:cx+Math.cos(a)*(radius+12),y2:cy+Math.sin(a)*(radius+12)},ticks);}
      const human=label(svg,cx,cy-radius-25,'Humans');
      const ai=label(svg,cx,cy+5,'AI');
      for(const el of [human,ai]){el.style.fontSize=small?'12px':'14px';el.style.letterSpacing='.12em';el.style.fill='#e6edf3';}
      ai.style.fontSize=small?'16px':'19px';ai.style.fontWeight='700';ai.style.paintOrder='stroke';ai.style.stroke='#941744';ai.style.strokeWidth='5px';
      renderers.set(scene,p=>{
        const t=reduce.matches?.58:clamp((p-.06)/.88);
        const ease=v=>v*v*(3-2*v);
        const late=clamp((t-.45)/.55);
        const coreGrowth=.16+.54*ease(clamp(t/.7))+Math.pow(late,3)*Math.hypot(W,H)/radius*4.5;
        let d='';
        for(let i=0;i<240;i++){
          const a=i/240*Math.PI*2;
          const texture=Math.max(.16,.72+.28*Math.sin(a*5+.9)+.18*Math.cos(a*11)+.1*Math.sin(a*23+1.4));
          const pulse=1+.09*Math.sin(a*3+t*7)+.06*Math.cos(a*17-t*5);
          const r=radius*coreGrowth*texture*pulse;
          d+=`${i?'L':'M'}${(cx+Math.cos(a)*r).toFixed(2)},${(cy+Math.sin(a)*r).toFixed(2)}`;
        }
        shape.setAttribute('d',d+'Z');
        const humanFade=1-clamp((t-.57)/.2),aiFade=1-clamp((t-.8)/.17);
        for(const el of [human,outline,ticks,halo])el.style.opacity=humanFade;
        ai.style.opacity=aiFade;
      });
      return;
    }
    if (kind === 'sourcegraph') {
      const reveal=svg.querySelector('.source-reveal');
      renderers.set(scene,p=>reveal.setAttribute('width',Number(reveal.dataset.width)*(reduce.matches?1:clamp(p/.7))));
      return;
    }
    const box = scene.querySelector('.plot-wrap').getBoundingClientRect();
    const W = Math.max(280, box.width), H = Math.max(220, box.height), small = W < 600;
    const m = {l: small ? 78 : 100, r: small ? 18 : 45, t: 28, b: 55};
    const iw = W-m.l-m.r, ih = H-m.t-m.b;
    svg._hoverCleanup?.(); svg._hoverCleanup=null; svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
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
      renderers.set(scene,()=>{
        const stage=Number(scene.dataset.stage||0), local=Number(scene.dataset.localProgress||0);
        const shown=reduce.matches?marks.length:stage===1?Math.floor(clamp(local/.9)*marks.length):0;
        marks.forEach((g,i)=>g.style.opacity=i<shown?'1':'0');
      });
      renderers.get(scene)();
    } else
    if (kind === 'business') {
      const rows=data.business, left=small?24:70, width=W-left*2;
      const sentences=[...scene.querySelectorAll('.business-sentence')];
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
        const sentenceCount=stage===0?0:stage===2?3:local<.25?1:local<.5?2:3;
        sentences.forEach((sentence,i)=>{
          const visible=reduce.matches||i<sentenceCount;
          sentence.classList.toggle('is-visible',visible);
          sentence.setAttribute('aria-hidden',String(!visible));
        });
        // Let the second passage enter before focusing its three expense segments.
        const focus=stage===2?3:stage===0||local<.25?-1:Math.min(2,Math.floor((local-.25)/.25));
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
      verticalTitle(svg,(28+bottom)/2,'OPERATING MARGIN · EX-SBC (%, LOG)');
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
      if(revenue)revenueHover(scene,svg,data.revenue,{W,H,m,iw,ih,x,y});
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
    } else if (kind === 'trainingdata') {
      // Native redraw of rest/3938.jpeg. The slide used to be that JPEG behind a
      // clip-path wipe, so the bars could never grow; these rects can.
      const cfg=data.trainingData, left=small?20:200, right=small?54:110, width=W-left-right;
      const x=v=>left+v/100*width, top=m.t+6, bottom=H-m.b;
      if(!small)verticalTitle(svg,(top+bottom)/2,'TRAINING REGIME');
      label(svg,left+width/2,H-10,cfg.axis);
      cfg.ticks.forEach(v=>{
        node('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:'#2a3a47'},svg);
        label(svg,x(v),bottom+22,String(v));
      });
      const bars=cfg.rows.map((row,i)=>{
        const band=(bottom-top)/cfg.rows.length, cy=top+band*(i+.5), bh=Math.min(small?30:46,band*.5);
        regimeLabel(svg,row,left,cy,bh,small);
        const bar=node('rect',{x:left,y:cy-bh/2,width:0,height:bh,fill:row.color},svg);
        // Keep every estimate to the right of its bar for a consistent scan.
        const inside=false;
        const est=label(svg,left,cy-3,'EST.',inside?'end':'start');
        const value=label(svg,left,cy+15,`${row.value} TB`,inside?'end':'start');value.classList.add('value');
        return {bar,est,value,row,inside};
      });
      renderers.set(scene,p=>{
        const t=reduce.matches?1:clamp(p/.7);
        bars.forEach(({bar,est,value,row,inside},i)=>{
          // A short stagger so the three regimes read as three separate measurements.
          const local=clamp((t-i*.12)/.64), eased=local*local*(3-2*local), end=x(row.value*eased);
          bar.setAttribute('width',Math.max(0,end-left));
          const tx=inside?end-12:end+10;
          est.setAttribute('x',tx);value.setAttribute('x',tx);
          const fade=reduce.matches?1:clamp((local-.55)/.45);
          est.style.opacity=fade;value.style.opacity=fade;
        });
      });
    } else if (kind === 'rlshare') {
      // Native redraw of rest/4002.jpeg, for the same reason as above.
      const cfg=data.rlShare, left=small?20:200, right=small?105:130, width=W-left-right;
      const x=v=>left+v/2000*width, top=m.t+6, bottom=H-m.b;
      if(!small)verticalTitle(svg,(top+bottom)/2,'TRAINING REGIME');
      label(svg,left+width/2,H-10,cfg.axis);
      cfg.ticks.forEach(([v,text])=>{
        node('line',{x1:x(v),x2:x(v),y1:top,y2:bottom,stroke:'#2a3a47'},svg);
        label(svg,x(v),bottom+22,text);
      });
      const bars=cfg.rows.map((row,i)=>{
        const band=(bottom-top)/cfg.rows.length, cy=top+band*(i+.5), bh=Math.min(small?40:64,band*.5);
        regimeLabel(svg,row,left,cy,bh,small);
        const base=node('rect',{x:left,y:cy-bh/2,width:0,height:bh,fill:'#5a5f66'},svg);
        const rl=node('rect',{x:left,y:cy-bh/2,width:0,height:bh,fill:'#ef8a5c'},svg);
        const share=label(svg,left,cy-3,row.share,'start');share.classList.add('value');
        const cost=label(svg,left,cy+15,row.cost,'start');
        return {base,rl,share,cost,row,bh,cy};
      });
      legend(scene,[{name:'Base / pretraining',color:'#5a5f66'},{name:'RL + trajectory post-training',color:'#ef8a5c'}]);
      renderers.set(scene,p=>{
        const t=reduce.matches?1:clamp(p/.7);
        bars.forEach(({base,rl,share,cost,row},i)=>{
          const local=clamp((t-i*.16)/.7), eased=local*local*(3-2*local);
          const split=x(row.base*eased), end=x((row.base+row.rl)*eased);
          base.setAttribute('width',Math.max(0,split-left));
          rl.setAttribute('x',split);rl.setAttribute('width',Math.max(0,end-split));
          const tx=end+10;
          share.setAttribute('x',tx);cost.setAttribute('x',tx);
          const fade=reduce.matches?1:clamp((local-.55)/.45);
          share.style.opacity=fade;cost.style.opacity=fade;
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
        const focus=stage===1||stage===2?'gross':stage>=3?'operating':null;
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
          el.style.opacity=reduce.matches||!focus||i===(stage<=2?0:1)?'1':'.25';
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
  let continuation=false,nextSlide=20,slideLinksReady=false;
  for(const el of document.querySelector('#article').children){
    if(el.id==='sources')break;
    if(el.classList.contains('scene')){
      const steps=(el.dataset.steps||el.id).split(',');
      steps.forEach((anchor,index)=>{
        const explicitId=el.dataset.slideId;
        const id=el.dataset.slideIds?.split(',')[index]||explicitId||(continuation?String(nextSlide++):anchor);
        if(explicitId&&continuation&&el.dataset.consumeSlide==='true')nextSlide++;
        slideEntries.push({id,anchor,el,index,count:steps.length});
      });
      if(el.id==='19')continuation=true;
    }else if(continuation&&!el.hasAttribute('data-no-slide')&&el.matches('.body-copy,.article-visual,.article-embed,.article-heading')){
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
      const forestLoop=scene.dataset.kind==='model-code-loop';
      const scaled=p*(forestLoop?6:steps.length);
      const stage=forestLoop?(scaled<1?0:scaled<2?1:2):Math.min(steps.length-1,Math.floor(scaled));
      const local=reduce.matches?1:Math.min(1,forestLoop&&stage===2?(scaled-2)/4:scaled-stage);
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
    const entry=hash?slideEntries.find(e=>e.anchor===hash):slideEntries.find(e=>e.id===query||e.anchor===query);
    slideLinksReady=false;
    if(entry){
      const sticky=entry.el.querySelector('.sticky'),travel=sticky?Math.max(0,entry.el.offsetHeight-sticky.offsetHeight):0;
      const progress=reduce.matches?0:entry.el.dataset.kind==='model-code-loop'?
        (entry.index===2?2+4*.28:entry.index+.4)/6:(entry.index+.4)/entry.count;
      window.scrollTo({top:scrollY+entry.el.getBoundingClientRect().top+travel*progress,behavior:'instant'});
      setSlideAddress(entry.id);
    }else if(hash){document.getElementById(hash)?.scrollIntoView({behavior:'instant'});}
    slideLinksReady=true;request();
  }
  try {
    const response=await fetch('/posts/ai2026-pt2/charts.json?v=native-bars');if(!response.ok)throw Error('Chart data unavailable');data=await response.json();
    const metrResponse=await fetch('/posts/ai2026-pt2/metr.json');if(!metrResponse.ok)throw Error('METR data unavailable');data.metr=await metrResponse.json();
    const continuationResponse=await fetch('/posts/ai2026-pt2/continuation-charts.json?v=company-workforce-2020');if(!continuationResponse.ok)throw Error('Continuation data unavailable');data.continuation=await continuationResponse.json();
    const laborResponse=await fetch('/posts/ai2026-pt2/labor-charts.json?v=1');if(!laborResponse.ok)throw Error('Labor chart data unavailable');data.labor=await laborResponse.json();
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
