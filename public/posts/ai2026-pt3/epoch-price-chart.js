(() => {
  const container = document.querySelector('#experience-curves .epoch-plot');
  if (!container) return;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1100 720');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'epoch-title epoch-desc');
  const add = (parent, name, attrs = {}, value) => {
    const el = document.createElementNS(ns, name);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    if (value !== undefined) el.textContent = value;
    parent.append(el);
    return el;
  };
  add(svg, 'title', {id:'epoch-title'}, 'The falling cost of fixed AI benchmark performance, 2023 to 2026');
  add(svg, 'desc', {id:'epoch-desc'}, 'Epoch AI estimates a 47 percent quarterly decline, roughly a twenty-thousand-fold price fall in three years. A shaded band shows alternative averaging methods, not a correction for Toby Ord’s comparability concern. Historical price trends for DNA sequencing, compute, batteries, and electricity are shown over the same three-year duration for reference.');

  const left = 130, right = 1040, top = 135, bottom = 590;
  const x = year => left + year / 3 * (right - left);
  const y = factor => top + Math.log10(factor) / 5 * (bottom - top);
  const path = fn => Array.from({length:61}, (_, i) => {
    const year = 3 * i / 60;
    return `${i ? 'L' : 'M'}${x(year).toFixed(1)},${y(fn(year)).toFixed(1)}`;
  }).join(' ');
  const ai = rate => year => Math.pow(1 / (1 - rate), year * 4);
  const curve = (rate, color, width, dash) => add(svg, 'path', {
    d:path(ai(rate)), fill:'none', stroke:color, 'stroke-width':width,
    ...(dash ? {'stroke-dasharray':dash} : {})
  });

  add(svg, 'text', {x:left,y:43,class:'epoch-heading'}, 'AI benchmark performance got dramatically cheaper');
  add(svg, 'text', {x:left,y:77,class:'epoch-subheading'}, 'Relative price · each series starts at 1× · log scale');
  for (const [factor,label] of [[1,'Starting price'],[10,'10× cheaper'],[100,'100×'],[1000,'1,000×'],[10000,'10,000×'],[100000,'100,000×']]) {
    const yy=y(factor);
    add(svg,'line',{x1:left,x2:right,y1:yy,y2:yy,class:'epoch-grid'});
    add(svg,'text',{x:left-17,y:yy+4,'text-anchor':'end',class:'epoch-tick'},label);
  }
  for (let year=0;year<=3;year++) {
    const xx=x(year);
    add(svg,'line',{x1:xx,x2:xx,y1:top,y2:bottom,class:'epoch-grid epoch-grid-vertical'});
    add(svg,'text',{x:xx,y:bottom+29,'text-anchor':'middle',class:'epoch-tick'},String(2023+year));
  }
  const slow=ai(.429), fast=ai(.58);
  const band=path(slow)+' '+Array.from({length:61},(_,i)=>{
    const year=3*(60-i)/60;
    return `L${x(year).toFixed(1)},${y(fast(year)).toFixed(1)}`;
  }).join(' ')+' Z';
  add(svg,'path',{d:band,fill:'#43a9ff','fill-opacity':'.15'});

  for (const [annual,color] of [[1.05,'#bda1ff'],[1.16,'#f1cf65'],[1.51,'#ff914f'],[1.84,'#39ffc1']]) {
    add(svg,'path',{d:path(year=>Math.pow(annual,year)),fill:'none',stroke:color,'stroke-width':'2.5','stroke-dasharray':'6 6'});
  }
  curve(.47,'#43a9ff',5);
  add(svg,'circle',{cx:x(3),cy:y(ai(.47)(3)),r:6,fill:'#43a9ff'});
  add(svg,'text',{x:x(3)-10,y:y(ai(.47)(3))-15,'text-anchor':'end',class:'epoch-ai-label'},'AI ~20,000×');
  add(svg,'text',{x:left,y:bottom+75,class:'epoch-note'},'Blue band: 42.9–58% quarterly under other averaging choices. It is not an Ord adjustment.');
  add(svg,'text',{x:left,y:bottom+100,class:'epoch-note'},'Other lines use each technology’s historical average rate, applied to a common three-year span.');
  container.append(svg);

  const caption = document.createElement('div');
  caption.className = 'epoch-caption';
  caption.innerHTML = '<span class="epoch-key"><i style="--key:#43a9ff"></i>AI benchmarks</span><span class="epoch-key"><i style="--key:#39ffc1"></i>DNA</span><span class="epoch-key"><i style="--key:#ff914f"></i>Compute</span><span class="epoch-key"><i style="--key:#f1cf65"></i>Batteries</span><span class="epoch-key"><i style="--key:#bda1ff"></i>Electricity</span><a href="https://epoch.ai/publications/the-plunging-price-of-thought">Source: Epoch AI</a>';
  container.append(caption);
})();
