/* Fixed-output workload scenarios; assumptions and milestone sources are linked below each chart. */
window.NativeMechanization = (svg, scene, data, W, H, api) => {
  const {make, text, title, colors, addLegend, ease, clamp} = api;
  const small = W < 620, left = 16, right = W - 16, width = right - left;
  const top = 90, bottom = H - 55, step = (bottom - top) / data.stages.length;
  const scale = value => width * value / 60;
  const fmt = value => `${+value.toFixed(1)}%`;
  addLegend(scene, [{name:'Human time remaining', color:colors[0]}, {name:'Time saved by machines', color:colors[2]}]);
  const total = text(svg, left, 28, '', {class:'mechanization-total'});
  text(svg, left, 52, 'Illustrative model · same output · original labor = 100%', {class:'mechanization-note'});
  const marks = data.stages.map((stage, i) => {
    const y = top + step * i;
    text(svg, left, y, stage.label, {class:'mechanization-label'});
    const value = text(svg, right, y, '', {'text-anchor':'end', class:'mechanization-value'});
    const remaining = make('rect', {x:left, y:y+15, width:scale(stage.original), height:22, fill:colors[0]}, svg);
    const saved = make('rect', {x:left+scale(stage.original), y:y+15, width:0, height:22, fill:colors[2], 'fill-opacity':'.25'}, svg);
    title(remaining, `${stage.label}: assumed ${stage.original}% before, ${stage.remaining}% after mechanization`);
    const technology = text(svg, left, y+58, '', {class:'mechanization-technology'});
    return {stage, y, value, remaining, saved, technology};
  });
  for (const value of [0,10,20,30,40,50,60]) {
    const x = left + scale(value);
    text(svg, x, H-30, `${value}%`, {'text-anchor':value===0?'start':value===60?'end':'middle', class:'axis-tick'});
  }
  text(svg, (left+right)/2, H-8, 'SHARE OF ORIGINAL WORKLOAD', {'text-anchor':'middle', class:'axis-label'});
  let amount = 0;
  const render = state => {
    amount = state.reduced ? 1 : state.stage > 0 ? ease(clamp(state.local/.38)) : 0;
    const sum = data.stages.reduce((n,s) => n + s.original + (s.remaining-s.original)*amount, 0);
    total.textContent = amount === 0 ? 'Before machines · 100% human labor' : `After mechanization · ${fmt(sum)} remains · ${(100/sum).toFixed(1)}×`;
    marks.forEach(({stage, value, remaining, saved, technology}) => {
      const now = stage.original + (stage.remaining-stage.original)*amount;
      remaining.setAttribute('width', scale(now));
      saved.setAttribute('x', left+scale(now));
      saved.setAttribute('width', scale(stage.original-now));
      value.textContent = amount === 0 ? fmt(stage.original) : `${fmt(stage.original)} → ${fmt(now)} · ${Math.round((1-now/stage.original)*100)}% less`;
      technology.textContent = amount === 0 ? stage.manual : stage.technology;
    });
  };
  window.AIChartHover?.attach(svg, {
    bounds:{left, right, top:top-12, bottom},
    keyboard:marks.map(m => ({x:left+scale(m.stage.original)/2, y:m.y+26})),
    get:point => {
      const mark = marks.find(m => point.y >= m.y-12 && point.y < m.y+step-12);
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
