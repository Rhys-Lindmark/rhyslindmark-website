/* Fixed-output workload scenarios; assumptions and milestone sources are linked below each chart. */
window.NativeMechanization = (svg, scene, data, W, H, api) => {
  const {make, text, title, wrapLabel, colors, addLegend, ease, clamp} = api;
  const small = W < 620, left = 16, right = W - 16, width = right - left;
  const compact = H < 520;
  const barY = compact ? Math.max(165,H*.38) : Math.max(190,H*.4);
  const barHeight = Math.min(compact?40:100, H*.14);
  const scale = value => width * value / 100;
  const fmt = value => `${+value.toFixed(1)}%`;
  addLegend(scene, [{name:'Human time remaining', color:colors[0]}, {name:'Time saved by machines', color:colors[2]}]);
  const total = text(svg, left, 28, '', {class:'mechanization-total'});
  text(svg, left, 52, 'Illustrative model · same output · original labor = 100%', {class:'mechanization-note'});
  let cumulative = 0;
  const marks = data.stages.map((stage, i) => {
    const x = left + scale(cumulative), w = scale(stage.original), center = x + w / 2;
    cumulative += stage.original;
    const heading = small ? stage.label.replace(/Picking|Removing|Spinning|Weaving|Preparing|Sowing|Reaping|Threshing/, word => ({Picking:'Pick',Removing:'Remove',Spinning:'Spin',Weaving:'Weave',Preparing:'Prepare',Sowing:'Sow',Reaping:'Reap',Threshing:'Thresh'})[word]) : stage.label;
    wrapLabel(svg, heading, center, barY-(compact?70:105), Math.max(5, Math.floor(w/(small?5.5:9))), {'text-anchor':'middle', class:'mechanization-label', style:small?'font-size:10px':''});
    text(svg, center, barY-26, fmt(stage.original), {'text-anchor':'middle', class:'axis-tick'});
    make('line', {x1:x, x2:x, y1:barY-15, y2:barY+barHeight+50, stroke:'#263744'}, svg);
    const value = text(svg, center, barY+barHeight+26, '', {'text-anchor':'middle', class:'mechanization-value', style:small?'font-size:11px':''});
    const remaining = make('rect', {x, y:barY, width:w, height:barHeight, fill:colors[0]}, svg);
    const saved = make('rect', {x:x+w, y:barY, width:0, height:barHeight, fill:colors[2], 'fill-opacity':'.25'}, svg);
    title(remaining, `${stage.label}: assumed ${stage.original}% before, ${stage.remaining}% after mechanization`);
    const columns = small ? 2 : 4, cellWidth = width/columns;
    const noteTop = barY+barHeight+(compact?50:small?65:95);
    const noteStep = small ? Math.min(compact?60:85, Math.max(42,H-noteTop-65)) : 85;
    const noteX = left + (i%columns)*cellWidth, noteY = noteTop+Math.floor(i/columns)*noteStep;
    text(svg, noteX, noteY, stage.label, {class:'mechanization-label', style:small?'font-size:11px':''});
    const technology = make('g', {}, svg);
    return {stage, x, w, value, remaining, saved, technology, noteX, noteY, noteChars:Math.max(14,Math.floor((cellWidth-12)/(small?5.5:8)))};
  });
  for (const mark of marks.slice(1)) {
    make('line', {x1:mark.x, x2:mark.x, y1:barY, y2:barY+barHeight, stroke:'#070b10', 'stroke-width':2}, svg);
  }
  text(svg, (left+right)/2, H-8, 'FULL BAR = 100% OF ORIGINAL WORKLOAD', {'text-anchor':'middle', class:'axis-label'});
  let amount = 0;
  const render = state => {
    amount = state.reduced ? 1 : state.stage > 0 ? ease(clamp(state.local/.38)) : 0;
    const sum = data.stages.reduce((n,s) => n + s.original + (s.remaining-s.original)*amount, 0);
    total.textContent = amount === 0 ? 'Before machines · 100% human labor' : `After mechanization · ${fmt(sum)} remains · ${(100/sum).toFixed(1)}×`;
    marks.forEach(({stage, x, value, remaining, saved, technology, noteX, noteY, noteChars}) => {
      const now = stage.original + (stage.remaining-stage.original)*amount;
      remaining.setAttribute('width', scale(now));
      saved.setAttribute('x', x+scale(now));
      saved.setAttribute('width', scale(stage.original-now));
      value.textContent = fmt(now);
      const description = amount === 0 ? stage.manual : stage.technology;
      // Rebuild wrapped notes only when switching between manual and mechanized views.
      if (technology.dataset.description !== description) {
        technology.replaceChildren();
        wrapLabel(technology, description, noteX, noteY+22, noteChars, {class:'mechanization-technology'});
        technology.dataset.description = description;
      }
    });
  };
  window.AIChartHover?.attach(svg, {
    bounds:{left, right, top:barY, bottom:barY+barHeight},
    keyboard:marks.map(m => ({x:m.x+m.w/2, y:barY+barHeight/2})),
    get:point => {
      const mark = marks.find(m => point.x >= m.x && point.x <= m.x+m.w);
      if (!mark) return null;
      const stage = mark.stage, now = stage.original+(stage.remaining-stage.original)*amount;
      return {title:stage.label, guide:false, items:[
        {label:'Original labor share (assumed)', value:fmt(stage.original), color:colors[0]},
        {label:'Labor remaining (model)', value:fmt(now), color:colors[0]},
        {label:'Labor saved (model)', value:fmt(stage.original-now), color:colors[2]}
      ]};
    }
  });
  return render;
};
