(() => {
  const scene = document.getElementById('experience-curves');
  const container = scene?.querySelector('.rd-plot');
  if (!container) return;
  // Exact Epoch price knots and the linked repo's central, narrow R&D-stock estimates.
  // R&D stock: 15% annual depreciation; values are relative to each series' first price year.
  const series = [{"id":"electricity","label":"Electricity","slope":0.5,"points":[[1.0,1.0],[1.457436,1.019335],[2.164123,1.283294],[2.948184,2.172181],[3.78795,2.595142],[4.819867,4.129555],[4.910684,5.522861],[7.040844,6.134602],[8.086929,6.189792],[9.482572,6.257398],[10.825154,6.553957],[12.082162,6.719088],[13.344984,6.380092],[14.867032,5.924734],[16.715926,5.713674],[18.696023,6.099423],[20.826184,6.634283],[23.176375,7.221195],[25.82312,8.143599],[28.660267,8.262851],[32.145635,8.430745],[36.298135,8.845207],[40.984239,9.56136],[46.414226,10.746102],[51.995519,11.658825],[58.410031,12.165129],[66.468535,12.806466],[76.314333,14.692304],[86.924779,17.508847],[95.426627,19.425031],[105.846884,19.573393],[119.064776,20.301855],[133.922103,22.448028],[147.256964,23.210114],[163.395116,23.641328],[184.023775,24.261138],[208.651179,24.628731],[242.475306,25.380883],[296.540768,26.63039],[358.749174,27.713316],[423.181374,28.239965],[492.004118,29.074076],[556.414243,29.608491],[616.492177,30.401924],[665.453744,31.324507],[711.378826,32.558237],[753.09539,33.965593],[790.522661,35.73004],[831.8785,37.342028],[878.30954,39.824887],[928.183502,42.602094],[974.886584,44.825341],[1015.102505,44.866488],[1060.05372,44.284523],[1119.441294,45.260274]]},{"id":"battery","label":"Li-ion batteries","slope":1.2,"points":[[1.0,1.0],[1.255097,1.246624],[1.55907,1.565891],[1.896728,1.371703],[2.494519,1.461504],[3.138616,1.735214],[3.59311,2.026323],[3.959005,2.518615],[4.255881,3.325146],[4.757982,3.423079],[5.506687,4.904199],[6.008716,6.84506],[6.432641,8.852859],[6.926418,9.893857],[7.583334,11.476394],[8.190089,13.400678],[8.777759,14.043496],[9.396993,13.393642],[10.044396,15.035239],[10.501441,16.72396],[10.99053,17.55674],[11.790072,17.065699],[12.758759,18.762176],[13.813388,21.208539],[15.172015,27.746441],[16.454937,35.560734],[18.468645,49.252567],[20.748149,58.663885],[23.853373,69.77447],[27.208586,74.879919],[30.650991,77.396891],[37.543001,69.77447],[47.477015,82.975045],[57.147981,118.079872]]},{"id":"llm","label":"LLM inference","slope":2.7,"points":[[1.0,1.0],[3.48465,60.628433],[67.121629,188411.959959]]},{"id":"dna","label":"DNA sequencing","slope":5.9,"points":[[1.0,1.0],[1.055826,1.370493],[1.110907,1.581718],[1.158301,1.828163],[1.206026,2.471076],[1.224327,3.479601],[1.233453,4.938165],[1.244702,5.090973],[1.257815,5.552376],[1.270268,5.885477],[1.279289,6.426192],[1.290596,6.500918],[1.303837,7.699307],[1.318911,8.498276],[1.335385,9.203088],[1.354467,9.542864],[1.375554,10.344211],[1.402159,11.642902],[1.437302,12.258375],[1.475803,12.477481],[1.516427,15.822087],[1.563748,37.235683],[1.622089,85.319429],[1.684155,155.971972],[1.748578,333.818101],[1.82587,490.226521],[1.924405,738.546066],[2.029065,1069.380897],[2.136461,1656.716556],[2.250021,2491.7033],[2.370143,3698.663723],[2.497769,3755.570138],[2.628769,4048.783693],[2.74797,5677.878374],[2.836285,7215.405632],[2.931828,11553.970168],[3.030416,15736.090896],[3.122538,15975.757934],[3.189529,20788.603686],[3.262884,20606.804929],[3.340971,18741.821656],[3.416088,22030.986721],[3.478667,22410.706759],[3.548664,22561.758903],[3.623843,24640.360112],[3.7026,31522.444666],[3.78132,25826.80724],[3.868442,25968.484448],[3.961175,22180.774222],[4.056312,31798.621967],[4.148074,30190.374049],[4.249224,93658.328357],[4.356521,102520.929322],[4.605191,109592.683739],[4.719791,85798.704225],[4.839709,95994.452528],[4.942143,128839.389432],[5.041822,98220.270822],[5.149156,116569.976097],[5.262554,72079.625454],[5.37154,108637.173345],[5.485492,92024.376843],[5.607762,92189.654519],[5.736557,97423.064837],[5.862508,137334.620649],[5.950875,225853.171496],[6.089658,145768.675089],[6.285566,199499.476609],[6.438629,214747.392837],[6.605551,196525.816414],[6.780673,202537.115847],[6.96328,274545.302712],[7.166889,167037.904067],[7.393902,319739.33757],[7.631936,261347.107395],[7.877791,272806.410146],[8.109374,294126.064676],[8.346201,301572.410641]]},{"id":"compute","label":"Compute","slope":4.1,"points":[[1.0,1.0],[1.091167,1.0],[1.224044,2.847747],[1.376051,12.815063],[1.55503,12.815063],[1.756444,12.815063],[1.92511,21.560062],[2.063727,21.560062],[2.209653,21.560062],[2.388328,172.888593],[2.658343,172.888593],[3.147661,172.888593],[3.901388,172.888593],[5.182297,840.727321],[7.291609,840.727321],[9.823431,2508.212173],[19.777238,2508.212173],[23.693286,2508.212173],[28.811591,7027.063128],[33.806053,7645.90848],[38.10419,7645.90848],[42.407311,7645.90848],[46.974496,22400.491849],[51.71643,22400.491849],[57.452156,22400.491849],[62.715064,22400.491849],[72.791839,43035.070194],[78.526467,43035.070194],[83.461402,43035.070194],[87.756374,43035.070194],[93.281608,43035.070194],[108.03379,43035.070194],[116.811913,316273.611111],[125.975839,1374154.310345],[135.462351,1374154.310345],[156.259214,1374154.310345],[179.502303,7970095.0],[192.80047,7970095.0],[210.432256,7970095.0],[233.568564,7970095.0],[262.277013,39850475.0],[292.108317,39850475.0],[318.76544,209739342.105263],[373.189046,209739342.105263],[393.389072,664174583.333333],[407.890824,664174583.333333],[420.195784,1992523750.0],[432.57765,3985047500.0],[445.25384,3985047500.0],[460.158,3985047500.0],[470.418564,3985047500.0],[478.159727,16743897058.823532],[484.324444,26745285234.89933],[493.359398,26745285234.89933],[502.885757,97433924205.37897]]}];
  const colors = {electricity:'#e98bb4',battery:'#f1cf65',llm:'#43a9ff',dna:'#ff914f',compute:'#39ffc1'};
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 1100 720');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Price declines over cumulative R&D');
  svg.setAttribute('aria-describedby','rd-desc');
  const add=(parent,tag,attrs={},value)=>{
    const el=document.createElementNS(svgNS,tag);
    for (const [key,val] of Object.entries(attrs)) el.setAttribute(key,val);
    if (value!==undefined) el.textContent=value;
    parent.append(el);return el;
  };
  add(svg,'desc',{id:'rd-desc'},'The price of electricity, lithium-ion batteries, DNA sequencing, compute, and LLM inference versus estimated R&D stock. Both axes are logarithmic and all series start at one. This descriptive comparison does not isolate R&D from scale or learning effects.');
  const left=105,right=1040,top=28,bottom=620;
  const x=value=>left+Math.log10(Math.max(value,1))/4.08*(right-left);
  const y=value=>top+Math.log10(Math.max(value,1))/12*(bottom-top);
  for (const [power,label] of [[0,'Starting price'],[1,'10×'],[2,'100×'],[3,'1,000×'],[6,'1 million×'],[9,'1 billion×'],[12,'1 trillion×']]) {
    const yy=y(10**power);
    add(svg,'line',{x1:left,x2:right,y1:yy,y2:yy,class:'rd-grid'});
    add(svg,'text',{x:left-15,y:yy+5,'text-anchor':'end',class:'rd-tick'},label);
  }
  for (const [value,label] of [[1,'Start'],[10,'10×'],[100,'100×'],[1000,'1,000×']]) {
    const xx=x(value);
    add(svg,'line',{x1:xx,x2:xx,y1:top,y2:bottom,class:'rd-grid rd-grid-vertical'});
    add(svg,'text',{x:xx,y:bottom+26,'text-anchor':'middle',class:'rd-tick'},label);
  }
  add(svg,'text',{x:(left+right)/2,y:bottom+49,'text-anchor':'middle',class:'rd-axis-title'},'Cumulative R&D stock, relative to start');
  add(svg,'text',{x:20,y:(top+bottom)/2,transform:`rotate(-90 20 ${(top+bottom)/2})`,'text-anchor':'middle',class:'rd-axis-title'},'Relative cost decrease');
  const orderedSeries=['electricity','battery','dna','compute','llm'].map(id=>series.find(s=>s.id===id));
  const legend=document.createElement('div');
  legend.className='rd-legend';
  const marks=[];
  for (const s of orderedSeries) {
    const g=add(svg,'g',{'data-series':s.id,class:'rd-series'});
    const pts=s.points;
    let d='';
    pts.forEach(([px,py],i)=>{
      if (s.id==='compute' && i) d+=` L${x(px).toFixed(2)},${y(pts[i-1][1]).toFixed(2)}`;
      d+=` ${i?'L':'M'}${x(px).toFixed(2)},${y(py).toFixed(2)}`;
    });
    const path=add(g,'path',{d,fill:'none',stroke:colors[s.id],'stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'});
    const length=path.getTotalLength();
    path.style.strokeDasharray=String(length);
    const [ex,ey]=pts.at(-1);
    add(path,'title',{},`${s.label}: ${ex.toFixed(1)}× R&D stock, ${ey.toLocaleString('en-US',{maximumFractionDigits:0})}× cheaper; descriptive slope ${s.slope}`);
    const item=document.createElement('span');
    const swatch=document.createElement('i');
    swatch.style.background=colors[s.id];
    item.append(swatch,document.createTextNode(s.id==='battery'?'Lithium-ion batteries':s.label));
    legend.append(item);
    marks.push({path,length,item});
  }
  container.append(svg,legend);
  const caption=document.createElement('figcaption');
  caption.className='rd-caption';
  caption.innerHTML='Source: <a href="https://epoch.ai/publications/the-plunging-price-of-thought">Epoch AI</a> · <a href="https://github.com/karthiktadepalli1/rd-price-declines">Karthik Tadepalli</a>';
  container.append(caption);
  const clamp=n=>Math.max(0,Math.min(1,n));
  const update=({stage=0,local=0,reduced=false}={})=>{
    const active=reduced||stage===6;
    marks.forEach((mark,i)=>{
      const amount=reduced?1:active?clamp((local-i*.17)/.2):0;
      mark.path.style.strokeDashoffset=String(mark.length*(1-amount));
      const visible=amount>.95;
      mark.item.style.opacity=visible?'1':'0';
    });
  };
  scene.addEventListener('chart-progress',event=>update(event.detail));
  update({stage:Number(scene.dataset.stage||0),local:Number(scene.dataset.localProgress||0),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
})();
