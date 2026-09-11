(async () => {
  'use strict';
  const scene = document.querySelector('#claude-usage');
  if (!scene) return;
  const wrap = scene.querySelector('.usage-chart');
  const svg = wrap.querySelector('svg');
  const fallback = scene.querySelector('.usage-fallback');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  let rows, marks = [], x;
  const node = (tag, attrs, parent = svg, text) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    parent.append(el); return el;
  };
  function render(state = {}) {
    const stage = state.stage ?? Number(scene.dataset.stage || 0);
    const local = state.local ?? Number(scene.dataset.localProgress || 0);
    const reduced = state.reduced ?? reduce.matches;
    const workers = reduced || stage > 0 ? 1 : ease(local / .35);
    const comparing = reduced || stage > 0;
    scene.dataset.comparing = String(comparing);
    for (const m of marks) {
      const amount = reduced ? 1 : stage === 0 ? 0 : ease((local - (m.coding ? .12 : 0)) / (m.coding ? .45 : .28));
      const w = x(m.row.workers * workers);
      const a = x(m.row.workers + (m.row.claude - m.row.workers) * amount);
      m.worker.setAttribute('cx', w);
      m.worker.style.opacity = workers > 0 ? '1' : '0';
      m.workerValue.setAttribute('x', w + 8);
      m.workerValue.style.opacity = workers === 1 && (!comparing || m.coding) ? '1' : '0';
      m.workerValue.setAttribute('y', m.y + (comparing && m.coding ? -9 : 4));
      m.connector.setAttribute('x1', w); m.connector.setAttribute('x2', a);
      m.connector.style.opacity = String(amount);
      m.ai.setAttribute('cx', a); m.ai.style.opacity = String(amount);
      m.aiValue.setAttribute('x', a + 8);
      m.aiValue.style.opacity = comparing && m.coding && amount === 1 ? '1' : '0';
      m.group.style.opacity = comparing && !m.coding ? '.65' : '1';
      if (m.highlight) m.highlight.style.opacity = comparing ? '.12' : '.04';
    }
  }
  function draw() {
    const {width, height} = wrap.getBoundingClientRect();
    if (!width || !height) return;
    const small = width < 600, W = width, H = height;
    const left = small ? 112 : 212, right = small ? 38 : 55, top = 18, bottom = H - 50;
    x = v => left + v / 40 * (W - left - right);
    const step = (bottom - top) / rows.length;
    svg.replaceChildren();svg.classList.toggle('compact', small);svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    node('title', {}, svg, 'AI usage by job type · February 2025');
    node('desc', {}, svg, 'Computer and mathematical jobs: 3.4% of U.S. workers, 37.2% of Claude conversations. Scroll to compare the two distributions.');
    [0,10,20,30,40].forEach(v => {
      node('line', {x1:x(v), x2:x(v), y1:top-8, y2:bottom, stroke:'#2a3a47', 'stroke-dasharray':v ? '3 5' : 'none'});
      node('text', {x:x(v), y:bottom+20, 'text-anchor':'middle', class:'usage-tick'}, svg, `${v}%`);
    });
    node('text', {x:(left+W-right)/2, y:H-5, 'text-anchor':'middle', class:'usage-axis'}, svg, 'SHARE OF EACH TOTAL (%)');
    marks = rows.map((row, i) => {
      const coding = row.job === 'Computer and mathematical';
      const y = top + (i+.5)*step;
      const group = node('g', {'data-job':row.job});
      node('title', {}, group, `${row.job}: ${row.workers}% of U.S. workers; ${row.claude}% of Claude conversations`);
      const highlight = coding ? node('rect', {x:0,y:y-step*.47,width:W,height:step*.94,rx:3,fill:'#ff914f',opacity:'.04'}, group) : null;
      const compact = {'Installation & repair':'Install & repair','Computer & mathematical':'Computer & math','Healthcare practitioners':'Healthcare practice','Architecture & engineering':'Architecture & eng.','Community & social services':'Community services','Farming, fishing & forestry':'Farming & forestry'};
      node('text', {x:left-10,y:y+4,'text-anchor':'end',class:`usage-job${coding?' coding':''}`}, group, small ? (compact[row.label] || row.label) : row.label);
      const connector = node('line', {x1:x(row.workers),x2:x(row.workers),y1:y,y2:y,stroke:'#ff914f','stroke-width':coding?3:2,opacity:0}, group);
      const worker = node('circle', {cx:x(row.workers),cy:y,r:small?3:4.5,fill:'#a5bdca',class:'worker-dot'}, group);
      const ai = node('circle', {cx:x(row.workers),cy:y,r:coding?5:small?3:4.5,fill:'#ff914f',class:'claude-dot',opacity:0}, group);
      const workerValue = node('text', {x:x(row.workers)+8,y:y+4,class:'worker-value'}, group, `${row.workers}%`);
      const aiValue = node('text', {x:x(row.claude)+8,y:y+4,class:'claude-value',opacity:0}, group, `${row.claude}%`);
      return {row,coding,y,group,highlight,connector,worker,ai,workerValue,aiValue};
    });
    render();
  }
  try {
    const response = await fetch('/posts/ai2026-pt3/usage-data.json');
    if (!response.ok) throw Error('AI usage data unavailable');
    rows = (await response.json()).rows;
    wrap.hidden = false;fallback.hidden = true;
    draw();
    new ResizeObserver(draw).observe(wrap);
    scene.addEventListener('chart-progress', event => render(event.detail));
  } catch (error) {
    wrap.hidden = true;fallback.hidden = false;
    console.error(error);
  }
})();
