// One linear scale and two bars throughout the six scroll boxes on slide 66.
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs, parent, value) => {
    const el = document.createElementNS(NS, tag);
    for (const [key, item] of Object.entries(attrs)) el.setAttribute(key, item);
    if (value !== undefined) el.textContent = value;
    parent.append(el);
    return el;
  };
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const amounts = [0, 0, .1, .5, 100, 10]; // trillions of USD
  const format = value => value < 1 ? `$${Math.round(value * 1000)}B` : `$${Math.round(value)}T`;

  window.drawLaborValueChart = (scene, reduced) => {
    const plot = scene.querySelector('.plot-wrap');
    const svg = plot.querySelector('svg');
    const { width, height } = plot.getBoundingClientRect();
    const W = Math.max(300, width), H = Math.max(260, height);
    const small = W < 600;
    const left = small ? 44 : 70, right = W - 18;
    const top = 24, bottom = H - 45;
    const y = amount => bottom - amount / 100 * (bottom - top);
    const barWidth = Math.min(small ? 58 : 116, (right - left) * .19);
    const humanX = left + (right - left) * .49 - barWidth / 2;
    const aiX = left + (right - left) * .79 - barWidth / 2;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    make('title', {}, svg, 'Human and AI annual labor output');
    make('desc', {}, svg, 'Linear scale, zero to one hundred trillion US dollars. The human bar reaches 66 trillion. The AI bar changes across six scroll boxes.');
    for (const tick of [0, 25, 50, 75, 100]) {
      const yy = y(tick);
      make('line', { x1: left, x2: right, y1: yy, y2: yy, stroke: tick ? '#263744' : '#708797', 'stroke-width': tick ? 1 : 1.5 }, svg);
      make('text', { x: left - 8, y: yy + 4, 'text-anchor': 'end', class: 'labor-value-tick' }, svg, `$${tick}T`);
    }
    const humanBar = make('rect', { x: humanX, width: barWidth, y: bottom, height: 0, fill: '#43a9ff' }, svg);
    const aiBar = make('rect', { x: aiX, width: barWidth, y: bottom, height: 0, fill: '#ff914f' }, svg);
    const humanValue = make('text', { x: humanX + barWidth / 2, 'text-anchor': 'middle', class: 'labor-value-amount' }, svg);
    const aiValue = make('text', { x: aiX + barWidth / 2, 'text-anchor': 'middle', class: 'labor-value-amount' }, svg);
    make('text', { x: humanX + barWidth / 2, y: bottom + 25, 'text-anchor': 'middle', class: 'labor-value-name' }, svg, 'Human labor');
    make('text', { x: aiX + barWidth / 2, y: bottom + 25, 'text-anchor': 'middle', class: 'labor-value-name' }, svg, 'AI');
    const setBar = (bar, value, text) => {
      const yy = y(value);
      bar.setAttribute('y', yy);
      bar.setAttribute('height', Math.max(0, bottom - yy));
      text.setAttribute('y', Math.max(top + 15, yy - 10));
      text.textContent = format(value);
    };
    return () => {
      const stage = reduced() ? 5 : Number(scene.dataset.stage || 0);
      const local = Number(scene.dataset.localProgress || 0);
      const progress = reduced() ? 1 : ease(local * 3);
      const human = stage === 0 ? 66 * progress : 66;
      const previous = stage > 0 ? amounts[stage - 1] : 0;
      const ai = previous + (amounts[stage] - previous) * progress;
      setBar(humanBar, human, humanValue);
      setBar(aiBar, ai, aiValue);
      aiBar.style.opacity = ai > 0 ? '1' : '0';
      aiValue.style.opacity = ai > 0 ? '1' : '0';
    };
  };
})();
