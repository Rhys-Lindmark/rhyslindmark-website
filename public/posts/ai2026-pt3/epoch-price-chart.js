(() => {
  const scene = document.getElementById('experience-curves');
  const container = scene?.querySelector('.epoch-plot');
  if (!container) return;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const compact = matchMedia('(max-width:760px)').matches;
  svg.setAttribute('viewBox', compact ? '0 0 1100 720' : '0 0 1320 720');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'epoch-title epoch-desc');
  const add = (parent, name, attrs = {}, value) => {
    const el = document.createElementNS(ns, name);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    if (value !== undefined) el.textContent = value;
    parent.append(el);
    return el;
  };
  add(svg, 'title', {id:'epoch-title'}, 'Relative cost by years since the start of each price decline');
  add(svg, 'desc', {id:'epoch-desc'}, 'Relative cost curves for electricity, lithium batteries, compute, and DNA sequencing, redrawn from Epoch AI’s comparison chart. Their historical paths appear first; an estimated AI cost curve appears on the next scroll.');

  const left = compact ? 125 : 90, right = compact ? 1020 : 1270, top = 42, bottom = 620;
  const x = year => left + year / 90 * (right - left);
  const y = logDecline => top + logDecline / 12 * (bottom - top);
  const line = points => points.map(([year, logDecline], i) => `${i ? 'L' : 'M'}${x(year).toFixed(1)},${y(logDecline).toFixed(1)}`).join(' ');
  const label = (year, logDecline, name, dates, color, dx = 12, dy = 0) => {
    const group=add(svg,'g',{class:'epoch-label'});
    const xx=x(year)+dx, yy=y(logDecline)+dy;
    add(group,'text',{x:xx,y:yy,class:'epoch-series-label',style:`fill:${color}`},name);
    add(group,'text',{x:xx,y:yy+19,class:'epoch-series-dates',style:`fill:${color}`},dates);
    return group;
  };

  for (const [logDecline,text] of [[0,'Starting price'],[1,'10× cheaper'],[2,'100×'],[3,'1,000×'],[6,'1 million×'],[9,'1 billion×'],[12,'1 trillion×']]) {
    const yy=y(logDecline);
    add(svg,'line',{x1:left,x2:right,y1:yy,y2:yy,class:'epoch-grid'});
    add(svg,'text',{x:left-13,y:yy+5,'text-anchor':'end',class:'epoch-tick'},text);
  }
  for (let year=0;year<=90;year+=10) {
    const xx=x(year);
    add(svg,'line',{x1:xx,x2:xx,y1:top,y2:bottom,class:'epoch-grid epoch-grid-vertical'});
    add(svg,'text',{x:xx,y:bottom+25,'text-anchor':'middle',class:'epoch-tick'},String(year));
  }
  add(svg,'text',{x:(left+right)/2,y:bottom+61,'text-anchor':'middle',class:'epoch-axis-title'},'Years since start of price decline');

  // Approximate log10 price-decline traces digitized from Epoch AI's published Figure 1.
  // They retain each technology's own start and end, unlike the former three-year projection.
  const historical = [
    {name:'Electricity',dates:'1892–1973',color:'#b18af4',end:81,points:[[0,0],[2,0],[4,0],[6,0],[8,0],[10,.06],[12,.13],[14,.2],[16,.28],[18,.32],[20,.33],[22,.43],[24,.5],[26,.56],[28,.61],[30,.65],[32,.67],[34,.69],[36,.73],[38,.75],[40,.69],[42,.71],[44,.78],[46,.84],[48,.84],[50,.95],[52,1.01],[54,1.1],[56,1.2],[58,1.21],[60,1.27],[62,1.29],[64,1.31],[66,1.34],[68,1.36],[70,1.39],[72,1.41],[74,1.45],[76,1.49],[78,1.53],[80,1.53],[81,1.54]]},
    {name:'Lithium batteries',dates:'1991–2024',color:'#2667d8',end:33,points:[[0,0],[1,.02],[2,.11],[3,.07],[4,.07],[5,.15],[6,.22],[7,.33],[8,.45],[9,.47],[10,.58],[11,.73],[12,.86],[13,.89],[14,.99],[15,1.06],[16,1.06],[17,1.06],[18,1.1],[19,1.17],[20,1.17],[21,1.17],[22,1.19],[23,1.25],[24,1.36],[25,1.47],[26,1.58],[27,1.67],[28,1.73],[29,1.79],[30,1.8],[31,1.77],[32,1.81],[33,1.97]]},
    {name:'Compute',dates:'1940–2001',color:'#ff714b',end:61,points:[[0,0],[1,.09],[2,.4],[3,.97],[4,1.05],[5,1.06],[6,1.26],[7,1.27],[8,1.36],[9,2.07],[10,2.2],[11,2.2],[12,2.27],[13,2.77],[14,2.9],[15,3.31],[16,3.35],[17,3.35],[18,3.35],[19,3.41],[20,3.76],[21,3.83],[22,3.83],[23,3.88],[24,4.25],[25,4.32],[26,4.32],[27,4.32],[28,4.45],[29,4.59],[30,4.6],[31,4.6],[32,4.6],[33,4.6],[34,4.6],[35,4.65],[36,5.3],[37,6],[38,6.14],[39,6.14],[40,6.16],[41,6.51],[42,6.87],[43,6.9],[44,6.9],[45,6.98],[46,7.53],[47,7.67],[48,8.24],[49,8.33],[50,8.38],[51,8.82],[52,8.91],[53,9.29],[54,9.6],[55,9.62],[56,9.62],[57,9.69],[58,10.2],[59,10.44],[60,10.53],[61,10.94]]},
    {name:'DNA sequencing',dates:'2001–2022',color:'#e24a97',end:21,points:[[0,0],[1,.13],[2,.32],[3,.67],[4,.78],[5,.97],[6,1.17],[7,2.3],[8,3.15],[9,3.65],[10,4.11],[11,4.3],[12,4.39],[13,4.39],[14,4.89],[15,4.99],[16,5],[17,5],[18,5.25],[19,5.36],[20,5.45],[21,5.47]]}
  ];
  const historicalPaths=historical.map(series=>add(svg,'path',{d:line(series.points),fill:'none',stroke:series.color,'stroke-width':3.4,'stroke-linejoin':'round'}));

  const annual=(1/(1-.47))**4;
  const aiLog=year=>year*Math.log10(annual);
  const aiPath=add(svg,'path',{d:line([[0,0],[5,aiLog(5)]]),fill:'none',stroke:'#009da3','stroke-width':4.5,'stroke-linecap':'round'});
  const aiDot=add(svg,'circle',{cx:x(5),cy:y(aiLog(5)),r:4,fill:'#009da3'});

  const historicalLabels=[
    label(81,1.54,'Electricity','1892–1973','#b18af4',-185,45),
    label(33,1.97,'Lithium batteries','1991–2024','#2667d8',15,4),
    label(61,10.94,'Compute','1940–2001','#ff714b',13,-9),
    label(21,5.47,'DNA sequencing','2001–2022','#e24a97',20,-10)
  ];
  const aiLabel=label(5,aiLog(5),'AI','2021–26 · estimate','#009da3',18,-20);
  container.append(svg);
  const caption=document.createElement('div');
  caption.className='epoch-caption';
  caption.innerHTML='Source: <a href="https://epoch.ai/publications/the-plunging-price-of-thought">Epoch AI</a>';
  container.append(caption);

  const clamp=value=>Math.max(0,Math.min(1,value));
  const historicalLengths=historicalPaths.map(path=>{
    const length=path.getTotalLength();
    path.style.strokeDasharray=String(length);
    return length;
  });
  const aiLength=aiPath.getTotalLength();
  aiPath.style.strokeDasharray=String(aiLength);
  const historicalProgress=(local,i)=>clamp((local-.12-i*.07)/.58);
  const aiProgress=local=>clamp((local-.12)/.72);
  const update=({stage=0,local=0,reduced=false}={})=>{
    historicalPaths.forEach((path,i)=>{
      const amount=reduced||stage>4?1:stage===4?historicalProgress(local,i):0;
      path.style.strokeDashoffset=String(historicalLengths[i]*(1-amount));
      historicalLabels[i].style.opacity=amount>.98?'1':'0';
    });
    const aiAmount=reduced||stage>5?1:stage===5?aiProgress(local):0;
    aiPath.style.strokeDashoffset=String(aiLength*(1-aiAmount));
    aiDot.style.opacity=aiAmount>.98?'1':'0';
    aiLabel.style.opacity=aiAmount>.98?'1':'0';
  };
  window.AIChartHover?.attach(svg,{bounds:{left,right,top,bottom},keyboard:[...historical.flatMap(series=>series.points.map(point=>({x:x(point[0]),y:y(point[1])}))),{x:x(5),y:y(aiLog(5))}],get:point=>{
    const stage=Number(scene.dataset.stage||0),local=Number(scene.dataset.localProgress||0),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduced&&stage!==4&&stage!==5)return null;
    const candidates=[];
    if(reduced||stage===4)historical.forEach((series,i)=>{const amount=reduced?1:historicalProgress(local,i),count=Math.ceil(series.points.length*amount);series.points.slice(0,count).forEach(p=>candidates.push({name:series.name,color:series.color,p}));});
    if(reduced||stage===5){const amount=reduced?1:aiProgress(local);if(amount>0){const year=5*amount;candidates.push({name:'AI · estimate',color:'#009da3',p:[year,aiLog(year)]});}}
    if(!candidates.length)return null;
    const hit=candidates.reduce((best,item)=>{const score=(x(item.p[0])-point.x)**2+(y(item.p[1])-point.y)**2;return !best||score<best.score?{...item,score}:best},null);
    return{title:`${hit.p[0].toFixed(1)} years since start`,guide:false,items:[{label:hit.name,value:`${(10**hit.p[1]).toLocaleString('en-US',{maximumFractionDigits:0})}× cheaper`,color:hit.color,x:x(hit.p[0]),y:y(hit.p[1])}]};
  }});
  scene.addEventListener('chart-progress',event=>update(event.detail));
  update({stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
})();
