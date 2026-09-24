(() => {
  'use strict';
  const scene = document.getElementById('experience-curves');
  const host = scene?.querySelector('.experience-reestimate');
  if (!host) return;

  // Endpoints use observed prices and output where available. The code series
  // uses this article's spending/LOC estimates, so it is a proxy, not a price.
  // Epoch's limitations motivate keeping benchmark inference prices out of it.
  const solar = {name:'Solar',color:'#ff914f',end:[452/20, .03]};
  const cars = {name:'Cars',color:'#43a9ff',end:[182000/10660, 550/850]};
  const code = {name:'Code estimate',color:'#39ffc1',end:[500/7, (3.5e12/500e9)/(300e9/7e9)]};
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Solar, cars, and code: annual output rose as unit price or spending per line fell');
  const description = document.createElementNS(ns,'desc');
  description.textContent = 'Re-estimated endpoint comparisons, normalized to one at each series start. Solar uses an upper bound of 20 GW in 2010 and 452 GW in 2024, and a 97% module price decline. Model T uses 10,660 cars at $850 and 182,000 cars at $550. Code uses article estimates of 7 billion lines and $300 billion in 1980, versus 500 billion lines and $3.5 trillion in 2025. The dashed 100-fold output and ten-fold unit-cost change is an illustrative scenario, not an observed estimate. Price-output slopes do not identify demand elasticity.';
  svg.append(description);
  const legend = document.createElement('div');
  legend.className = 'reestimate-legend';
  legend.innerHTML = '<span><i style="background:#ff914f"></i>Solar</span><span><i style="background:#43a9ff"></i>Cars</span><span><i style="background:#39ffc1"></i>Code estimate</span><span class="scenario-key"><i style="background:#f1cf65"></i>Code scenario</span>';
  const source = document.createElement('figcaption');
  source.innerHTML = 'Data: <a href="https://www.irena.org/Digital-Report/Renewable-Power-Generation-Costs-in-2024">IRENA</a> · <a href="https://www.iea.org/commentaries/is-exponential-growth-of-solar-pv-the-obvious-conclusion">IEA</a> · <a href="https://www.thehenryford.org/docs/default-source/default-document-library/default-document-library/henryfordandinnovation.pdf?sfvrsn=0">Ford</a> · <a href="#code-history">Article estimate</a> · Caveat: <a href="https://epoch.ai/publications/the-plunging-price-of-thought#limitations">Epoch AI</a>';
  host.append(svg,legend,source);
  const clamp = n => Math.max(0,Math.min(1,n));
  const element = (tag, attrs, parent=svg) => {
    const el=document.createElementNS(ns,tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
    parent.append(el);
    return el;
  };
  let chartStage = -1, chartWidth = -1, marks = [];
  function draw(stage) {
    const width=Math.max(320,host.getBoundingClientRect().width);
    const height=Math.max(350,svg.getBoundingClientRect().height);
    if (stage===chartStage && width===chartWidth) return;
    chartStage=stage; chartWidth=width;
    svg.replaceChildren(description);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const compact=width<620;
    const left=compact?63:88, right=width-(compact?20:40), top=24, bottom=height-(compact?68:82);
    const xMax=stage===3?10000:100;
    const x=v=>left+Math.log10(v)/Math.log10(xMax)*(right-left);
    const y=v=>top+(-Math.log10(v)/2)*(bottom-top);
    for (const [value,label] of [[1,'1×'],[.1,'10× lower'],[.01,'100× lower']]) {
      const yy=y(value);
      element('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'#2a3a47','stroke-width':1});
      const t=element('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'axis-tick'});t.textContent=label;
    }
    for (const value of [1,10,100,1000,10000].filter(n=>n<=xMax)) {
      const xx=x(value);
      element('line',{x1:xx,x2:xx,y1:top,y2:bottom,stroke:'#263744','stroke-dasharray':'3 6'});
      const t=element('text',{x:xx,y:bottom+25,'text-anchor':'middle',class:'axis-tick'});t.textContent=`${value.toLocaleString()}×`;
    }
    let t=element('text',{x:(left+right)/2,y:height-12,'text-anchor':'middle',class:'axis-label'});t.textContent='Annual output · multiple of starting output';
    t=element('text',{x:17,y:(top+bottom)/2,transform:`rotate(-90 17 ${(top+bottom)/2})`,'text-anchor':'middle',class:'axis-label'});t.textContent='Unit price / spend · relative to start';
    marks=[];
    for (const series of [solar,cars,code]) {
      const [xx,yy]=series.end;
      const path=element('path',{d:`M${x(1)} ${y(1)} L${x(xx)} ${y(yy)}`,fill:'none',stroke:series.color,'stroke-width':compact?3:4,'stroke-linecap':'round'});
      const length=path.getTotalLength();path.style.strokeDasharray=String(length);
      const dot=element('circle',{cx:x(xx),cy:y(yy),r:4,fill:series.color});
      const label=element('text',{x:x(xx)+7,y:y(yy)-10,class:'reestimate-label',fill:series.color});label.textContent=series.name;
      marks.push({path,length,dot,label});
    }
    if (stage===3) {
      const [codeX,codeY]=code.end;
      const clipId='experience-scenario-clip';
      const defs=element('defs',{}),clip=element('clipPath',{id:clipId},defs);
      const window=element('rect',{x:x(codeX),y:top-6,width:0,height:bottom-top+12},clip);
      const group=element('g',{'clip-path':`url(#${clipId})`});
      element('path',{d:`M${x(codeX)} ${y(codeY)} L${x(codeX*100)} ${y(codeY/10)}`,fill:'none',stroke:'#f1cf65','stroke-width':compact?3:4,'stroke-dasharray':'8 7','stroke-linecap':'round'},group);
      const label=element('text',{x:x(codeX*100)-6,y:y(codeY/10)-12,'text-anchor':'end',class:'reestimate-label',fill:'#f1cf65'});label.textContent='100× output · 10× lower';
      marks.push({window,span:x(codeX*100)-x(codeX),label,forecast:true});
    }
  }
  function update({stage=0,local=0,reduced=false}={}) {
    if (!reduced && stage!==2 && stage!==3) return;
    const active=reduced?3:stage;
    draw(active);
    marks.forEach((mark,i)=>{
      const progress=reduced?1:mark.forecast?clamp(local*1.3):active===3?1:clamp(local*1.55-i*.19);
      if (mark.forecast) mark.window.setAttribute('width',String(mark.span*progress));
      else mark.path.style.strokeDashoffset=String(mark.length*(1-progress));
      if (mark.dot) mark.dot.style.opacity=progress>.98?'1':'0';
      mark.label.style.opacity=progress>.98?'1':'0';
    });
    legend.querySelector('.scenario-key').hidden=active!==3;
  }
  scene.addEventListener('chart-progress',e=>update(e.detail));
  new ResizeObserver(()=>update({stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})).observe(host);
  update({stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
})();
