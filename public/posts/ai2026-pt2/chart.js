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
    const m = {l: small ? 46 : 85, r: small ? 18 : 45, t: 28, b: 55};
    const iw = W-m.l-m.r, ih = H-m.t-m.b;
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    node('title', {}, svg, svg.getAttribute('aria-label'));
    if (kind === 'revenue' || kind === 'growth') {
      const revenue = kind === 'revenue';
      const x = v => m.l + (revenue ? (v-2023)/4 : v/10) * iw;
      const y = v => m.t + ih * (1-(revenue ? Math.log10(v/.05)/Math.log10(200/.05) : v/180));
      (revenue ? [2023,2024,2025,2026,2027] : [0,2,4,6,8,10]).forEach(v => label(svg,x(v),H-30,v));
      (revenue ? [.1,1,10,100] : [0,50,100,150]).forEach(v => {
        node('line',{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:'#2a3a47'},svg);
        label(svg,m.l-9,y(v)+4,v<1?'$100M':`$${v}B`,'end');
      });
      label(svg,m.l+iw/2,H-7,revenue?'YEAR':'YEARS SINCE ≈$10B REVENUE');
      const defs=node('defs',{},svg), clip=node('clipPath',{id:`reveal-${kind}`},defs);
      const rect=node('rect',{x:m.l-3,y:0,width:iw+6,height:H},clip);
      const g=node('g',{'clip-path':`url(#reveal-${kind})`},svg);
      for(const row of data[kind]) {
        node('path',{d:row.points.map((p,i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join(' '),fill:'none',stroke:row.color,'stroke-width':small?2.5:3.5},g);
        const end=row.points.at(-1); node('circle',{cx:x(end[0]),cy:y(end[1]),r:4,fill:row.color},g);
        if(revenue && row.name==='Combined') label(g,x(end[0])-5,y(end[1])-13,'$105B','end');
        if(!revenue && ['Anthropic','OpenAI'].includes(row.name)) {
          const t=label(g,x(end[0])+9,y(end[1])-10,`${row.name} $${end[1]}B`,'start');t.style.fill=row.color;
        }
      }
      legend(scene,data[kind]);
      renderers.set(scene,p=>rect.setAttribute('width',(iw+6)*(reduce.matches?1:clamp(p/.78))));
    } else if (kind === 'margins') {
      const left=small?78:150, right=small?34:75, width=W-left-right;
      const x=v=>left+(v+140)/230*width;
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
          bars.push({bar,t,value});
        });
      });
      legend(scene,[{name:'Gross margin',color:'#43a9ff'},{name:'Operating margin, ex-SBC',color:'#ff914f'}]);
      renderers.set(scene,p=>bars.forEach(({bar,t,value})=>{
        const v=value*(reduce.matches?1:clamp(p/.78));bar.setAttribute('x',Math.min(x(0),x(v)));bar.setAttribute('width',Math.abs(x(v)-x(0)));t.style.opacity=p>.72||reduce.matches?'1':'0';
      }));
    } else if (kind === 'costs') {
      const left=small?70:130,right=small?18:50,width=W-left-right,x=v=>left+v/240*width;
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
      renderers.get(scene)?.(p);
      const card=scene.querySelector('.passage');
      if(card)card.style.setProperty('--card-shift',`${reduce.matches?0:sticky.offsetHeight-(sticky.offsetHeight+card.offsetHeight)*p}px`);
      scene.querySelector('.track span').style.width=`${p*100}%`;scene.dataset.progress=p.toFixed(3);
    }
  }
  function request(){if(!frame)frame=requestAnimationFrame(update);}
  function followHash(){const scene=scenes.find(s=>`#${s.id}`===location.hash);if(scene)window.scrollTo({top:window.scrollY+scene.getBoundingClientRect().top,behavior:'instant'});request();}
  try {
    const response=await fetch('/posts/ai2026-pt2/charts.json');if(!response.ok)throw Error('Chart data unavailable');data=await response.json();
    document.body.classList.toggle('all-mode',reduce.matches);
    for(const scene of scenes){draw(scene);const plot=scene.querySelector('.plot-wrap');if(plot)new ResizeObserver(()=>{draw(scene);request();}).observe(plot);}
    reduce.addEventListener('change',()=>{document.body.classList.toggle('all-mode',reduce.matches);scenes.forEach(draw);request();});
    window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});window.addEventListener('hashchange',followHash);
    let previous=scrollY;
    window.addEventListener('scroll',()=>{const delta=scrollY-previous;if(Math.abs(delta)>8){document.body.classList.toggle('header-hidden',delta>0&&scrollY>58);previous=scrollY;}},{passive:true});
    document.querySelector('header').addEventListener('focusin',()=>document.body.classList.remove('header-hidden'));
    requestAnimationFrame(followHash);update();
  } catch(error) {
    document.body.classList.add('all-mode');
    scenes.forEach(scene=>{const svg=scene.querySelector('svg'),fallback=scene.querySelector('.fallback');if(svg)svg.setAttribute('hidden','');if(fallback)fallback.hidden=false;});
    console.error(error);
  }
})();
