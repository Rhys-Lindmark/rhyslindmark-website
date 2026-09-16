/* AI 2026 article intro.
   A fully native SVG building: five niche bots on top, a country of geniuses below,
   a data centre corridor beneath that. Dependency-free; isolated from the chart styles. */
(()=>{
if(customElements.get('ai-building-intro'))return;

/* ── Geometry ────────────────────────────────────────────────────────────────
   One 1536×1024 stage. Every floor is a horizontal band; the corridor's
   vanishing point doubles as the target the camera dives into at the end. */
const W=1536,H=1024;
const X0=100,X1=1436;                    // building envelope
const BEAM1=[150,198],FLOOR_A=[198,420]; // five bots
const BEAM2=[420,468],FLOOR_B=[468,716]; // brains in jars
const BEAM3=[716,764],FLOOR_C=[764,1010];// data centre
const VP={x:768,y:880};                  // corridor vanishing point
const CELLS=5,CELL_X=108,CELL_W=264;     // five equal bays on floor A
const cellLeft=i=>CELL_X+i*CELL_W;

/* ── Tiny helpers ────────────────────────────────────────────────────────── */
const r2=n=>Math.round(n*100)/100;
const range=n=>Array.from({length:n},(_,i)=>i);
// Deterministic jitter so the scene is identical on every load.
const rand=(()=>{let s=20260916;return()=>(s=s*1664525+1013904223>>>0)/4294967296;})();

/* ── Floor A · the five bots ─────────────────────────────────────────────────
   Each bay is authored in its own 264×222 frame, so a bot is a self-contained
   drawing that knows nothing about where on the stage it lands. */

// Shared bay chrome: back wall, floor slab, one ceiling lamp.
const bay=(inner,lampX=132)=>`
<rect width="264" height="222" fill="url(#bayWall)"/>
<path d="M${lampX} 0v13" stroke="#3c5265" stroke-width="2"/>
<path d="M${lampX-11} 13h22l5 9h-32Z" fill="#2c3d4d" stroke="#4b6376" stroke-width="1"/>
<path d="M${lampX-13} 22h26l34 92h-94Z" fill="url(#lampCone)"/>
${inner}
<rect y="196" width="264" height="26" fill="#17242f"/>
<path d="M0 196.5H264" stroke="#3a5164" stroke-width="1.4"/>`;

// Shared bot anatomy, so all five read as the same species of machine.
const botHead=(x,y,w=28,h=26,eye='#7ff0dd')=>`
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#43596d" stroke="#9db6cc" stroke-width="1.4"/>
<circle cx="${x+w*.33}" cy="${y+h*.42}" r="2.6" fill="${eye}" class="eye"/>
<circle cx="${x+w*.67}" cy="${y+h*.42}" r="2.6" fill="${eye}" class="eye"/>`;
const botTorso=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#34485a" stroke="#8fa9c2" stroke-width="1.4"/>
<rect x="${x+w*.28}" y="${y+7}" width="${w*.44}" height="7" rx="3.5" fill="#12333c" stroke="#5f8ea0" stroke-width=".8"/>`;

/* 1 · Two-arm robot shuttling a block from the left pad to the right pad. */
const cellBlock=()=>bay(`
<rect x="24" y="186" width="56" height="10" rx="2" fill="#26374a" stroke="#6a8093" stroke-width="1.1"/>
<rect x="184" y="186" width="56" height="10" rx="2" fill="#26374a" stroke="#6a8093" stroke-width="1.1"/>
<g class="blk blk-src"><rect x="42" y="166" width="20" height="20" rx="2.5" fill="#2f4a52" stroke="#7fe3d2" stroke-width="1.4"/><path d="M46 176h12" stroke="#7fe3d2" stroke-width="1.2" opacity=".6"/></g>
<g class="blk blk-dst"><rect x="202" y="166" width="20" height="20" rx="2.5" fill="#2f4a52" stroke="#7fe3d2" stroke-width="1.4"/><path d="M206 176h12" stroke="#7fe3d2" stroke-width="1.2" opacity=".6"/></g>
<rect x="112" y="150" width="40" height="46" rx="4" fill="#2a3b4c" stroke="#8fa9c2" stroke-width="1.4"/>
<rect x="122" y="100" width="20" height="52" fill="#34485a" stroke="#8fa9c2" stroke-width="1.3"/>
${botHead(106,68,52,30)}
<g class="arm">
  <path d="M132 104V160" stroke="#8fa9c2" stroke-width="9" stroke-linecap="round"/>
  <path d="M132 104V160" stroke="#445b6f" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="132" cy="160" r="5.5" fill="#54708a" stroke="#adc6db" stroke-width="1.2"/>
  <g class="wrist">
    <path d="M132 160V202" stroke="#8fa9c2" stroke-width="7" stroke-linecap="round"/>
    <path d="M132 160V202" stroke="#445b6f" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M122 200v9M142 200v9" stroke="#b9d2e6" stroke-width="3" stroke-linecap="round"/>
    <g class="blk blk-held"><rect x="122" y="206" width="20" height="20" rx="2.5" fill="#2f4a52" stroke="#7fe3d2" stroke-width="1.4"/><path d="M126 216h12" stroke="#7fe3d2" stroke-width="1.2" opacity=".6"/></g>
  </g>
</g>
<circle cx="132" cy="104" r="7" fill="#54708a" stroke="#adc6db" stroke-width="1.3"/>`);

/* 2 · Coding bot: a monitor of scrolling source and a blinking caret. */
const codeLines=['const w = await world()','for (const t of tasks) {','  ship(t) // 2026','}','if (gpu.free) run(next)','return margin * 1.66','await compile(model)','// 100 GW'];
const cellCode=()=>bay(`
<rect x="86" y="170" width="164" height="7" rx="2" fill="#2b3d4f" stroke="#6a8093" stroke-width="1"/>
<path d="M96 177v19M240 177v19" stroke="#6a8093" stroke-width="2.4"/>
<rect x="120" y="72" width="118" height="88" rx="5" fill="#1b2a38" stroke="#93adc4" stroke-width="1.6"/>
<rect x="126" y="78" width="106" height="76" rx="2" fill="#071a20"/>
<g clip-path="url(#codeClip)">
  <g class="code-flow" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="7.4" fill="#7fd6ab">
  ${range(3).map(rep=>codeLines.map((l,i)=>`<text x="131" y="${88+rep*90+i*11}"${i%3===1?' fill="#d5f3e0"':i%3===2?' fill="#9fe8d6"':''}>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`).join('')).join('')}
  </g>
  <rect class="caret" x="131" y="146" width="5" height="8" fill="#b6f9d6"/>
  <rect class="scan" x="126" y="78" width="106" height="12" fill="url(#scanFade)"/>
</g>
<path d="M174 160v10h-8" stroke="#6a8093" stroke-width="2" fill="none"/>
<rect x="150" y="164" width="48" height="6" rx="2" fill="#2b3d4f" stroke="#6a8093" stroke-width="1"/>
<g class="typist">
  <rect x="96" y="164" width="46" height="7" rx="2" fill="#31465a" stroke="#8fa9c2" stroke-width="1"/>
  ${range(8).map(i=>`<rect class="key" style="--d:${-i*.13}s" x="${99+i*5.4}" y="166" width="4" height="3" rx="1" fill="#8ce4d3"/>`).join('')}
</g>
<path d="M30 196v-46q0-12 12-12h18" fill="none" stroke="#6a8093" stroke-width="3"/>
${botTorso(46,118,44,58)}
<g class="bob">${botHead(52,90,32,28)}</g>
<path class="arm-type" d="M88 134q22 6 30 30" fill="none" stroke="#8fa9c2" stroke-width="6" stroke-linecap="round"/>`,168);

/* 3 · Science bot: pipette, flask, a molecule diagram on the wall. */
const cellScience=()=>bay(`
<g class="mol" fill="none" stroke="#6fc9e8" stroke-width="1.6">
  <path d="M46 62 78 46M78 46 110 64M110 64 92 94M92 94 58 90M58 90 46 62"/>
  ${[[46,62],[78,46],[110,64],[92,94],[58,90]].map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#123642" stroke="#8fe0f5" class="node" style="--d:${-i*.5}s"/>`).join('')}
</g>
<rect x="18" y="166" width="228" height="8" rx="2" fill="#2b3d4f" stroke="#6a8093" stroke-width="1"/>
<path d="M26 174v22M238 174v22" stroke="#6a8093" stroke-width="2.4"/>
<g class="beaker">
  <path d="M44 138h30v20l10 24a4 4 0 0 1-4 6H38a4 4 0 0 1-4-6l10-24Z" fill="#0e2a33" stroke="#a6cadd" stroke-width="1.5"/>
  <path d="M40 158h38l8 20a4 4 0 0 1-4 6H36a4 4 0 0 1-4-6Z" fill="#1f7f79" class="brew"/>
  ${range(4).map(i=>`<circle class="bub" style="--d:${-i*.55}s" cx="${46+i*8}" cy="178" r="${1.8+i%2*.8}" fill="#a9f2e2"/>`).join('')}
  <path d="M42 138h34" stroke="#cfe7f2" stroke-width="2.2" stroke-linecap="round"/>
</g>
<g>
  <rect x="98" y="146" width="24" height="28" rx="2" fill="#0e2a33" stroke="#a6cadd" stroke-width="1.4"/>
  <rect x="99" y="160" width="22" height="13" fill="#3f8fa8" opacity=".8"/>
</g>
<path class="drop" d="M62 128a3.4 3.4 0 1 0 .01 0" fill="#9df0e0"/>
${botTorso(168,110,44,62)}
${botHead(174,82,32,28)}
<path d="M212 126q16 4 18 18" fill="none" stroke="#8fa9c2" stroke-width="6" stroke-linecap="round"/>
<g class="pip-arm">
  <path d="M168 126q-40 -6 -66 -12" fill="none" stroke="#8fa9c2" stroke-width="6" stroke-linecap="round"/>
  <path d="M104 108l-38 14 4 10 38-14Z" fill="#54708a" stroke="#c2dbef" stroke-width="1.2"/>
  <path d="M66 122l-8 3 6 6 5-4Z" fill="#a6cadd"/>
</g>`,132);

/* 4 · Inside a self-driving car: dashboard, windshield, city sliding past. */
const cellCar=()=>{
  const bldg=(side,i)=>{
    const w=16+((i*7)%14),h=30+((i*11)%34);
    return `<g class="pass" style="--d:${-(i*.82)}s;--dir:${side}"><rect x="${side<0?116-w:148}" y="${86-h}" width="${w}" height="${h}" fill="#101d2b" stroke="#22405a" stroke-width=".8"/>${range(Math.max(2,Math.floor(h/12))).map(k=>`<rect x="${(side<0?116-w:148)+3}" y="${88-h+k*11}" width="${w-6}" height="4" fill="#5fd8ff" opacity="${.15+((i+k)%3)*.13}"/>`).join('')}</g>`;
  };
  return bay(`
<g clip-path="url(#windClip)">
  <rect x="12" y="14" width="240" height="134" fill="#070f18"/>
  <rect x="12" y="14" width="240" height="72" fill="url(#nightSky)"/>
  ${range(30).map(()=>{const x=r2(14+rand()*236),y=r2(16+rand()*60);return `<circle cx="${x}" cy="${y}" r="${r2(.5+rand())}" fill="#cfe9ff" opacity="${r2(.15+rand()*.4)}"/>`;}).join('')}
  <path d="M12 86h240" stroke="#2b5573" stroke-width="1"/>
  <path d="M132 86 -30 148H12Zm0 0L294 148h-42Z" fill="#0c141d"/>
  <path d="M132 86 -40 148H264L132 86Z" fill="#131b24"/>
  <path d="M132 86 -14 148M132 86 278 148" stroke="#3d566d" stroke-width="1.4"/>
  ${range(9).map(i=>bldg(-1,i)).concat(range(9).map(i=>bldg(1,i+4))).join('')}
  ${range(5).map(i=>`<path class="lane" style="--d:${-(i*.56)}s" d="M130 86h4l0 10h-4Z" fill="#dfeffb"/>`).join('')}
  <g class="hud" fill="none" stroke="#4ff0d4" stroke-width="1.4">
    <path d="M112 92v-6h10M152 86h10v6M112 108v6h10M152 114h10v-6"/>
  </g>
  <path class="hud-lane" d="M132 88 96 148H168L132 88Z" fill="#3fd8ff" opacity=".1"/>
  <path class="hud-lane" d="M132 88 96 148M132 88 168 148" stroke="#3fd8ff" stroke-width="1.2" opacity=".55" fill="none"/>
</g>
<path d="M0 0h264v18l-14 4H14l-14-4Z" fill="#101a24" stroke="#33485c" stroke-width="1"/>
<rect x="116" y="16" width="32" height="11" rx="3" fill="#18242f" stroke="#41586d" stroke-width="1"/>
<path d="M0 0h30l-16 150H0ZM264 0h-30l16 150h14Z" fill="#131e29" stroke="#33485c" stroke-width="1"/>
<path d="M0 142q132 22 264 0v80H0Z" fill="#131c26" stroke="#3a5164" stroke-width="1.4"/>
<rect x="88" y="156" width="88" height="30" rx="5" fill="#0a1420" stroke="#3fd8ff" stroke-width="1.2" opacity=".95"/>
<g text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Consolas,monospace">
  <text class="spd s0" x="124" y="180" font-size="21" fill="#dff6ff">72</text>
  <text class="spd s1" x="124" y="180" font-size="21" fill="#dff6ff">74</text>
  <text class="spd s2" x="124" y="180" font-size="21" fill="#dff6ff">71</text>
  <text x="160" y="180" font-size="8" fill="#6f93a8">MPH</text>
</g>
<rect x="96" y="146" width="40" height="9" rx="4.5" fill="#0d3b3a" stroke="#4ff0d4" stroke-width="1"/>
<text x="116" y="153" font-size="6.4" text-anchor="middle" fill="#8ff6e4" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" letter-spacing="1.4">AUTO</text>
<g>
  <circle cx="44" cy="174" r="17" fill="#0a1420" stroke="#3a5164" stroke-width="1.2"/>
  <circle cx="44" cy="174" r="11" fill="none" stroke="#2b6f74" stroke-width=".8"/>
  <path class="sweep" d="M44 174V158" stroke="#4ff0d4" stroke-width="1.6"/>
  <circle cx="50" cy="166" r="1.8" fill="#8ff6e4"/><circle cx="38" cy="180" r="1.5" fill="#8ff6e4" opacity=".7"/>
</g>
<g>
  <rect x="196" y="158" width="48" height="32" rx="4" fill="#0a1420" stroke="#3a5164" stroke-width="1.2"/>
  <path d="M202 186q10-14 18-10t18-16" fill="none" stroke="#4ff0d4" stroke-width="1.6" stroke-dasharray="3 3"/>
  <circle class="ping" cx="202" cy="186" r="2.6" fill="#8ff6e4"/>
</g>
<path d="M78 222v-14a54 30 0 0 1 108 0v14" fill="#18242f" stroke="#4a627a" stroke-width="1.6"/>
<path d="M92 210a42 22 0 0 1 80 0" fill="none" stroke="#3fd8ff" stroke-width="1.6" opacity=".55"/>`,132);
};

/* 5 · Art bot: strokes, blobs and tiles generating themselves on a display. */
const cellArt=()=>bay(`
<rect x="92" y="42" width="152" height="122" rx="6" fill="#0a1420" stroke="#93adc4" stroke-width="1.6"/>
<rect x="98" y="48" width="140" height="110" rx="3" fill="#07101a"/>
<g clip-path="url(#artClip)" class="gen">
  <ellipse class="blob" style="--d:.1s" cx="140" cy="88" rx="30" ry="26" fill="#2f6fd6" opacity=".55"/>
  <ellipse class="blob" style="--d:.5s" cx="192" cy="112" rx="26" ry="22" fill="#a24fd8" opacity=".5"/>
  <ellipse class="blob" style="--d:.9s" cx="176" cy="70" rx="20" ry="17" fill="#3fd8ff" opacity=".4"/>
  <path class="stroke s1" d="M108 134q28-52 62-30t60-46" fill="none" stroke="#7ff0dd" stroke-width="4" stroke-linecap="round"/>
  <path class="stroke s2" d="M106 108q36 26 70-6t56 24" fill="none" stroke="#ffd98a" stroke-width="3" stroke-linecap="round"/>
  <path class="stroke s3" d="M118 60q22 30 54 16t62 22" fill="none" stroke="#ff8fd0" stroke-width="2.6" stroke-linecap="round"/>
  ${range(4).map(i=>`<rect class="tile" style="--d:${-i*.28}s" x="${104+i*34}" y="138" width="12" height="12" rx="2" fill="#cfe9ff"/>`).join('')}
</g>
<rect x="98" y="48" width="140" height="110" rx="3" fill="none" stroke="#3fd8ff" stroke-width="1" opacity=".35"/>
<g>
  <rect x="150" y="172" width="86" height="7" rx="3.5" fill="#1b2a38" stroke="#4a627a" stroke-width=".9"/>
  <rect class="prog" x="151" y="173" width="30" height="5" rx="2.5" fill="#4ff0d4"/>
</g>
${botTorso(30,114,44,62)}
${botHead(36,86,32,28)}
<g class="emit">
  <path d="M74 128q12-4 20-10" fill="none" stroke="#8fa9c2" stroke-width="6" stroke-linecap="round"/>
  <path class="beam" d="M96 116 132 96" stroke="#7ff0dd" stroke-width="2" stroke-dasharray="4 5" fill="none"/>
</g>
<path d="M20 196v-30q0-8 8-8h12" fill="none" stroke="#6a8093" stroke-width="2.6"/>`,192);

/* ── Floor B · a country of geniuses ─────────────────────────────────────── */
const jar=(x,y,s,d,dim)=>`<g transform="translate(${x} ${y}) scale(${s})" opacity="${dim}">
<rect x="-11" y="-6" width="22" height="5" rx="2" fill="#5d7a8e"/>
<rect x="-13" y="-8" width="26" height="6" rx="2" fill="#4d6478" stroke="#89a2b8" stroke-width=".9"/>
<rect x="-11" y="-2" width="22" height="40" rx="6" fill="#0f3a41" stroke="#79b6c4" stroke-width="1.1"/>
<rect x="-11" y="-2" width="22" height="40" rx="6" fill="url(#jarGloss)"/>
<g class="brainlet" style="--d:${d}s">
  <circle cx="0" cy="18" r="7.5" fill="#6ff0d8" opacity=".22"/>
  <path d="M-5 18q-1-6 5-6t5 6q0 6-5 6t-5-6Z" fill="#8ff6e4"/>
  <path d="M0 12v12M-4 15h8M-4 21h8" stroke="#0f3a41" stroke-width=".8"/>
</g>
</g>`;

// Shelf banks in one-point perspective, so the jars genuinely recede rather
// than repeating. Depth 0 is the bank nearest the glass; 3 is deepest.
const VP_B={x:768,y:590};
const shelfBank=(side,d)=>{
  const s=1/(1+d*.42),out=[];
  const near=side<0?-644:104,far=side<0?-104:644;
  const px=wx=>r2(VP_B.x+wx*s),py=wy=>r2(VP_B.y+wy*s);
  const dim=r2(.34+ (3-d)/3*.66);
  for(const wy of[-78,-10,58]){
    const y=py(wy),x0=px(Math.min(near,far)),x1=px(Math.max(near,far));
    out.push(`<rect x="${x0}" y="${r2(y+44*s)}" width="${r2(x1-x0)}" height="${r2(6*s)}" fill="#2b3d4f" opacity="${dim}"/>`);
    const pitch=38*s;
    for(let x=x0+pitch*.6;x<x1-pitch*.3;x+=pitch)out.push(jar(r2(x),y,r2(s),r2(-rand()*6),dim));
  }
  // Uprights break the run of jars into bays.
  const x0=px(Math.min(near,far)),x1=px(Math.max(near,far));
  for(let k=0;k<=4;k++){const x=r2(x0+(x1-x0)*k/4);
    out.push(`<rect x="${r2(x-2*s)}" y="${py(-88)}" width="${r2(4*s)}" height="${r2(158*s)}" fill="#22303d" opacity="${dim}"/>`);}
  return out.join('');
};

const floorB=()=>{
  // The central model: a cloud of nodes wired to its neighbours.
  const N=18,nodes=range(N).map(i=>{const a=i/N*Math.PI*2+rand()*.4,rr=.45+rand()*.55;
    return{x:r2(768+Math.cos(a)*78*rr),y:r2(578+Math.sin(a)*58*rr)};});
  const edges=[];
  nodes.forEach((n,i)=>nodes.forEach((m,j)=>{if(j<=i)return;const d=Math.hypot(n.x-m.x,n.y-m.y);if(d<52)edges.push(`M${n.x} ${n.y}L${m.x} ${m.y}`);}));
  const banks=[];
  for(let d=3;d>=0;d--)for(const side of[-1,1])banks.push(shelfBank(side,d));
  return `
<rect x="${X0}" y="${FLOOR_B[0]}" width="${X1-X0}" height="${FLOOR_B[1]-FLOOR_B[0]}" fill="url(#floorBWall)"/>
<ellipse cx="768" cy="590" rx="300" ry="120" fill="#0a3a3f" opacity=".45"/>
${banks.join('')}
<rect x="${X0}" y="700" width="${X1-X0}" height="16" fill="#17242f"/>
<path d="M${X0} 700.5H${X1}" stroke="#3a5164" stroke-width="1.4"/>
<path d="M130 700V668h380v32M906 700V668h380v32" fill="none" stroke="#4a627a" stroke-width="1.6" opacity=".55"/>
<path d="M700 700h136l-16-44H716Z" fill="#2b3d4f" stroke="#7d97ad" stroke-width="1.4"/>
<circle cx="768" cy="578" r="104" fill="url(#brainHalo)" class="brain-halo"/>
<g class="brain-net">
  <path d="${edges.join('')}" fill="none" stroke="#5fe3cf" stroke-width="1.5" opacity=".5"/>
  ${nodes.map((n,i)=>`<circle cx="${n.x}" cy="${n.y}" r="4.6" fill="#9ffbe8" class="bnode" style="--d:${r2(-i*.21)}s"/>`).join('')}
</g>
<path d="M768 636v20" stroke="#5fe3cf" stroke-width="2.4"/>
<path d="M742 656h52" stroke="#9ffbe8" stroke-width="3" stroke-linecap="round"/>`;
};

/* ── Floor C · the data centre corridor ──────────────────────────────────── */
const floorC=()=>{
  const depth=i=>1/(1+i*.52);                       // perspective foreshortening
  const px=(wx,s)=>r2(VP.x+wx*s),py=(wy,s)=>r2(VP.y+wy*s);
  const TOP=-150,BOT=138,INNER=150,rows=[];
  for(let i=6;i>=0;i--){
    const s0=depth(i+1),s1=depth(i);
    for(const side of[-1,1]){
      const xi0=px(side*INNER,s0),xi1=px(side*INNER,s1);
      rows.push(`<path d="M${xi0} ${py(TOP,s0)}L${xi1} ${py(TOP,s1)}L${xi1} ${py(BOT,s1)}L${xi0} ${py(BOT,s0)}Z" fill="${i%2?'#141f2b':'#182533'}"/>`);
      rows.push(`<path d="M${xi0} ${py(TOP,s0)}L${xi1} ${py(TOP,s1)}M${xi0} ${py(BOT,s0)}L${xi1} ${py(BOT,s1)}" stroke="#3d5468" stroke-width="1.1" fill="none"/>`);
      const cols=3,leds=[];
      for(let c=0;c<cols;c++)for(let k=0;k<9;k++){
        const t=(c+.5)/cols,s=s0+(s1-s0)*t,x=px(side*INNER,s),y=py(TOP+22+k*((BOT-TOP-40)/8),s);
        leds.push(`<rect x="${r2(x-3.2*s1)}" y="${r2(y)}" width="${r2(6.4*s1)}" height="${r2(3.2*s1)}" rx="1" fill="#63ff91" class="led" style="--d:${r2(-((i*3+c+k)%11)*.23)}s"/>`);
      }
      rows.push(leds.join(''));
      // Outer face, catching the corridor light.
      rows.push(`<path d="M${xi1} ${py(TOP,s1)}L${px(side*520,s1)} ${py(TOP,s1)}L${px(side*520,s1)} ${py(BOT,s1)}L${xi1} ${py(BOT,s1)}Z" fill="#101a24" opacity="${r2(.55+i*.05)}"/>`);
    }
    // Ceiling light panel at this depth.
    rows.push(`<path d="M${px(-26,s0)} ${py(TOP+6,s0)}L${px(26,s0)} ${py(TOP+6,s0)}L${px(26,s1)} ${py(TOP+6,s1)}L${px(-26,s1)} ${py(TOP+6,s1)}Z" fill="#cfefff" opacity="${r2(.1+i*.05)}"/>`);
  }
  return `
<rect x="${X0}" y="${FLOOR_C[0]}" width="${X1-X0}" height="${FLOOR_C[1]-FLOOR_C[0]}" fill="#080e15"/>
<path d="M${X0} ${FLOOR_C[1]}L${VP.x} ${VP.y}L${X1} ${FLOOR_C[1]}Z" fill="#121b25"/>
<path d="M${X0} ${FLOOR_C[0]}L${VP.x} ${VP.y}L${X1} ${FLOOR_C[0]}Z" fill="#0d151e"/>
${rows.join('')}
<circle cx="${VP.x}" cy="${VP.y}" r="86" fill="url(#vpGlow)" class="vp-glow"/>
<circle cx="${VP.x}" cy="${VP.y}" r="9" fill="#f2fbff"/>`;
};

/* ── Labels ──────────────────────────────────────────────────────────────── */
const plate=(cx,w,y,h,text,size)=>`<rect x="${r2(cx-w/2)}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0d1923"/>
<text x="${cx}" y="${r2(y+h*.74)}" font-size="${size}" text-anchor="middle" fill="#dcecf9">${text}</text>`;

const labels=()=>`<g class="floor-labels" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="400">
${['A','bot','for','every','niche'].map((w,i)=>plate(cellLeft(i)+CELL_W/2,206,BEAM1[0]+4,40,w,31)).join('')}
${plate(768,442,BEAM2[0]+4,40,'A country of geniuses',31)}
${plate(768,404,BEAM3[0]+4,40,'In a data center',31)}
</g>`;

/* ── The building shell ──────────────────────────────────────────────────── */
const shell=()=>`
<rect x="${X0-12}" y="64" width="${X1-X0+24}" height="${H-64}" fill="#0c141d"/>
<rect x="${X0-16}" y="120" width="${X1-X0+32}" height="34" fill="#1b2732"/>
<g stroke="#5f788e" stroke-width="2" fill="none">
  <path d="M${X0-16} 120h${X1-X0+32}M${X0-16} 154h${X1-X0+32}"/>
  <path d="M${X0} 64v${H-64}M${X1} 64v${H-64}"/>
</g>
<rect x="${X0-16}" y="64" width="${X1-X0+32}" height="56" fill="#111b25"/>
<g fill="#1b2732" stroke="#5f788e" stroke-width="1.6">
  <rect x="300" y="28" width="140" height="40" rx="4"/><circle cx="335" cy="48" r="13" fill="#0e1720"/><circle cx="405" cy="48" r="13" fill="#0e1720"/>
  <rect x="1030" y="36" width="104" height="32" rx="4"/><circle cx="1060" cy="52" r="10" fill="#0e1720"/><circle cx="1104" cy="52" r="10" fill="#0e1720"/>
  <rect x="640" y="12" width="26" height="56" rx="3"/><rect x="900" y="20" width="20" height="48" rx="3"/>
</g>
`;

const slab=(y,h)=>`<rect x="${X0-16}" y="${y}" width="${X1-X0+32}" height="${h}" fill="#1b2732"/>
<path d="M${X0-16} ${y+.5}h${X1-X0+32}M${X0-16} ${y+h-.5}h${X1-X0+32}" stroke="#66809a" stroke-width="1.6"/>`;

const columns=()=>range(CELLS+1).map(i=>{const x=cellLeft(i)-4;return `<rect x="${x}" y="${BEAM1[1]}" width="8" height="${FLOOR_A[1]-FLOOR_A[0]}" fill="#22303d" stroke="#5f788e" stroke-width="1.2"/>`;}).join('');

const buildingSVG=()=>`
${shell()}
${slab(BEAM1[0],BEAM1[1]-BEAM1[0])}
<g>${range(CELLS).map(i=>`<g transform="translate(${cellLeft(i)} ${FLOOR_A[0]})">${[cellBlock,cellCode,cellScience,cellCar,cellArt][i]()}</g>`).join('')}</g>
${columns()}
${slab(BEAM2[0],BEAM2[1]-BEAM2[0])}
${floorB()}
${slab(BEAM3[0],BEAM3[1]-BEAM3[0])}
${floorC()}
<rect x="${X0-16}" y="${FLOOR_C[1]}" width="${X1-X0+32}" height="${H-FLOOR_C[1]}" fill="#1b2732"/>
${labels()}`;

/* ── Defs & keyframes ────────────────────────────────────────────────────── */
const DEFS=`<defs>
<linearGradient id="bayWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16222e"/><stop offset="1" stop-color="#0e1822"/></linearGradient>
<linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9ff" stop-opacity=".16"/><stop offset="1" stop-color="#cfe9ff" stop-opacity="0"/></linearGradient>
<linearGradient id="scanFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6f9d6" stop-opacity="0"/><stop offset=".5" stop-color="#b6f9d6" stop-opacity=".18"/><stop offset="1" stop-color="#b6f9d6" stop-opacity="0"/></linearGradient>
<linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a2b"/><stop offset="1" stop-color="#16304a"/></linearGradient>
<linearGradient id="floorBWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121d28"/><stop offset="1" stop-color="#0a121b"/></linearGradient>
<linearGradient id="jarGloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".06"/></linearGradient>
<radialGradient id="brainHalo"><stop offset="0" stop-color="#6ff0d8" stop-opacity=".34"/><stop offset="1" stop-color="#6ff0d8" stop-opacity="0"/></radialGradient>
<radialGradient id="vpGlow"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".35" stop-color="#bff0ff" stop-opacity=".5"/><stop offset="1" stop-color="#3fd8ff" stop-opacity="0"/></radialGradient>
<clipPath id="codeClip"><rect x="126" y="78" width="106" height="76" rx="2"/></clipPath>
<clipPath id="windClip"><rect x="12" y="14" width="240" height="134" rx="10"/></clipPath>
<clipPath id="artClip"><rect x="98" y="48" width="140" height="110" rx="3"/></clipPath>
</defs>`;

const SKY=`<svg class="sky" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
<linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05080d"/><stop offset=".55" stop-color="#0a1220"/><stop offset="1" stop-color="#0d1a28"/></linearGradient>
<linearGradient id="hillG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1621"/><stop offset="1" stop-color="#070c12"/></linearGradient>
</defs>
<rect x="-800" y="-400" width="3136" height="1824" fill="url(#skyG)"/>
${range(120).map(()=>`<circle cx="${r2(-700+rand()*2900)}" cy="${r2(-300+rand()*900)}" r="${r2(.4+rand()*1.3)}" fill="#dceaff" opacity="${r2(.1+rand()*.45)}"/>`).join('')}
<path d="M-800 780q220-120 430-44t380-16 300 80 340-70 386 60v674H-800Z" fill="url(#hillG)"/>
${range(46).map(()=>{const x=r2(-760+rand()*3050),w=r2(22+rand()*46),h=r2(50+rand()*210),y=r2(1024-h-rand()*40);
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0a121b"/>${range(Math.floor(h/26)).map(k=>`<rect x="${r2(x+5)}" y="${r2(y+10+k*24)}" width="${r2(w-10)}" height="5" fill="#8fd6ff" opacity="${r2(.06+rand()*.22)}"/>`).join('')}</g>`;}).join('')}
<rect y="1004" width="1536" height="20" x="-800" fill="#070c12"/>
</svg>`;

const KEYFRAMES=`
.eye{animation:eye-flick 5.5s steps(1) infinite}
@keyframes eye-flick{0%,94%{opacity:1}95%,97%{opacity:.25}98%,100%{opacity:1}}

/* 1 · block shuttle */
.arm{transform-origin:132px 104px;animation:arm-swing 5s cubic-bezier(.45,0,.35,1) infinite}
.wrist{transform-origin:132px 160px;animation:wrist-level 5s cubic-bezier(.45,0,.35,1) infinite}
@keyframes arm-swing{0%,8%{transform:rotate(-52deg)}42%,58%{transform:rotate(52deg)}92%,100%{transform:rotate(-52deg)}}
@keyframes wrist-level{0%,8%{transform:rotate(52deg)}42%,58%{transform:rotate(-52deg)}92%,100%{transform:rotate(52deg)}}
.blk-held{animation:blk-held 5s infinite}
@keyframes blk-held{0%,7%{opacity:0}9%,44%{opacity:1}46%,100%{opacity:0}}
.blk-src{animation:blk-src 5s infinite}
@keyframes blk-src{0%,8%{opacity:1}10%,86%{opacity:0}90%,100%{opacity:1}}
.blk-dst{animation:blk-dst 5s infinite}
@keyframes blk-dst{0%,44%{opacity:0}47%,74%{opacity:1}78%,100%{opacity:0}}

/* 2 · coder */
.code-flow{animation:code-roll 9s linear infinite}
@keyframes code-roll{from{transform:translateY(0)}to{transform:translateY(-90px)}}
.caret{animation:caret 1.1s steps(1) infinite}
@keyframes caret{0%,50%{opacity:1}51%,100%{opacity:0}}
.scan{animation:scan 3.1s linear infinite}
@keyframes scan{from{transform:translateY(-14px)}to{transform:translateY(78px)}}
.key{animation:key 1.05s ease-in-out infinite;animation-delay:var(--d)}
@keyframes key{0%,70%,100%{opacity:.25}12%,26%{opacity:1}}
.bob{animation:bob 3.4s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}
.arm-type{animation:arm-type 1.05s ease-in-out infinite;transform-origin:88px 134px}
@keyframes arm-type{0%,100%{transform:rotate(0)}50%{transform:rotate(2.4deg)}}

/* 3 · science */
.node{animation:node-pulse 3.4s ease-in-out infinite;animation-delay:var(--d)}
@keyframes node-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.pip-arm{transform-origin:168px 126px;animation:pip 4.2s ease-in-out infinite}
@keyframes pip{0%,40%,100%{transform:rotate(0)}55%,70%{transform:rotate(-4deg)}}
.drop{animation:drop 4.2s ease-in-out infinite;opacity:0}
@keyframes drop{0%,58%{opacity:0;transform:translateY(0)}62%{opacity:1}78%{opacity:1;transform:translateY(22px)}82%,100%{opacity:0;transform:translateY(24px)}}
.brew{animation:brew 4.2s ease-in-out infinite}
@keyframes brew{0%,74%,100%{fill:#1f7f79}84%{fill:#35b9a4}}
.bub{animation:bub 2.3s ease-in-out infinite;animation-delay:var(--d);opacity:0}
@keyframes bub{0%{opacity:0;transform:translateY(0)}25%{opacity:.9}100%{opacity:0;transform:translateY(-20px)}}

/* 4 · car */
.lane{animation:lane 1.4s linear infinite;animation-delay:var(--d);transform-origin:132px 86px}
@keyframes lane{from{transform:translateY(0) scale(.14);opacity:0}12%{opacity:1}to{transform:translateY(46px) scale(2.6);opacity:.9}}
.pass{animation:pass 3.3s linear infinite;animation-delay:var(--d);transform-origin:132px 86px}
@keyframes pass{from{transform:translate(0,0) scale(.16);opacity:0}14%{opacity:1}to{transform:translate(calc(var(--dir)*118px),52px) scale(2.9);opacity:0}}
.hud{animation:hud 2.6s ease-in-out infinite}
@keyframes hud{0%,100%{opacity:.5;transform:translate(0,0)}50%{opacity:1;transform:translate(2px,-1px)}}
.hud-lane{animation:hud-lane 2.6s ease-in-out infinite}
@keyframes hud-lane{0%,100%{opacity:.35}50%{opacity:.75}}
.sweep{transform-origin:44px 174px;animation:sweep 2.4s linear infinite}
@keyframes sweep{to{transform:rotate(360deg)}}
.ping{animation:ping 2.2s ease-out infinite}
@keyframes ping{0%{opacity:1;r:2.6}70%,100%{opacity:0;r:8}}
.spd{opacity:0;animation:spd 3.6s steps(1) infinite}
.s0{animation-delay:0s}.s1{animation-delay:-2.4s}.s2{animation-delay:-1.2s}
@keyframes spd{0%,33%{opacity:1}34%,100%{opacity:0}}

/* 5 · art */
.gen{animation:regen 9s ease-in-out infinite}
@keyframes regen{0%,88%{opacity:1}96%{opacity:.08}100%{opacity:1}}
.blob{animation:blob 9s ease-in-out infinite;animation-delay:var(--d);transform-origin:168px 103px}
@keyframes blob{0%{opacity:0;transform:scale(.3)}18%,80%{opacity:.5;transform:scale(1)}94%,100%{opacity:0;transform:scale(1.1)}}
.stroke{stroke-dasharray:260;stroke-dashoffset:260;animation:draw 9s ease-in-out infinite}
.k1{animation-delay:.4s}.k2{animation-delay:1.5s}.k3{animation-delay:2.6s}
@keyframes draw{0%{stroke-dashoffset:260}30%,86%{stroke-dashoffset:0}96%,100%{stroke-dashoffset:260}}
.tile{animation:tile 2.4s steps(1) infinite;animation-delay:var(--d)}
@keyframes tile{0%{opacity:.12;fill:#cfe9ff}25%{opacity:.7;fill:#7ff0dd}50%{opacity:.35;fill:#ffd98a}75%{opacity:.6;fill:#ff8fd0}}
.beam{animation:beam .8s linear infinite}
@keyframes beam{to{stroke-dashoffset:-18}}
.prog{animation:prog 9s ease-in-out infinite}
@keyframes prog{0%{width:4px}88%{width:84px}94%,100%{width:4px}}

/* floor B & C */
.brainlet{animation:brainlet 4.6s ease-in-out infinite;animation-delay:var(--d)}
@keyframes brainlet{0%,100%{opacity:.4}45%{opacity:1}}
.bnode{animation:bnode 3.2s ease-in-out infinite;animation-delay:var(--d)}
@keyframes bnode{0%,100%{opacity:.35}50%{opacity:1}}
.brain-halo{animation:halo 5s ease-in-out infinite}
@keyframes halo{0%,100%{opacity:.55}50%{opacity:1}}
.led{animation:led 2.4s steps(1) infinite;animation-delay:var(--d)}
@keyframes led{0%,44%{opacity:.16}46%,70%{opacity:1}72%,100%{opacity:.3}}
.vp-glow{animation:vp 4.4s ease-in-out infinite}
@keyframes vp{0%,100%{opacity:.75}50%{opacity:1}}
`;

const STYLE=`
:host{display:block;background:#05080d;color:#d8e2ee;--intro-top:0px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;contain:style}
*{box-sizing:border-box}
.section{height:560svh;position:relative}
.pin{position:sticky;top:var(--intro-top);height:calc(100svh - var(--intro-top));overflow:hidden;background:#05080d}
.viewport{position:absolute;inset:0;overflow:hidden}
.sky{position:absolute;inset:0;width:100%;height:100%;display:block}
.camera{position:absolute;inset:0;transform-origin:50% 86%;will-change:transform,opacity}
.camera>svg{width:100%;height:100%;display:block;overflow:visible}
.controls{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;padding:34px 16px 15px;background:linear-gradient(to top,#05080dcc,#05080d00);font-size:12px;pointer-events:none}
.controls>*{pointer-events:auto}
.skip{color:#a6bacb;text-decoration:none;font-size:20px}
.skip:hover{text-decoration:underline}
a:focus-visible{outline:2px solid #baffea;outline-offset:3px}
.heading{position:absolute;top:0;left:0;right:0;z-index:3;text-align:center;padding:18px 20px 10px;pointer-events:none}
.eyebrow{font-size:12px;letter-spacing:.12em;color:#9aafbf;margin:0}
:host([hide-heading]) .heading{display:none}
${KEYFRAMES}
:host([data-offscreen]) svg *{animation-play-state:paused!important}

.finale{position:absolute;inset:0;z-index:2;pointer-events:none}
.title-card{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 clamp(24px,6vw,90px);opacity:0;will-change:opacity,transform}
.title-line{margin:0;max-width:16ch;text-align:center;font-weight:500;font-size:clamp(34px,6.4vw,92px);line-height:1.06;letter-spacing:-.02em;color:#fff;text-shadow:0 4px 40px #000c,0 0 90px #05080dcc}
.flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#fff 0%,#fff 38%,#dff3ff 100%);opacity:0;will-change:opacity}
.chip-scene{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0f0c22;opacity:0;will-change:opacity;--flow:0;--pulse:0;--w:0}
.chip-scene svg{position:relative;width:100%;height:100%;display:block}
/* Each pad holds its own phase; scrolling moves --w and the wave front sweeps past. */
.bga{animation:bga-wave 1s linear paused both;animation-delay:calc((var(--p) - var(--w))*1s)}
@keyframes bga-wave{0%{opacity:.06}5%{opacity:1}16%{opacity:.9}45%{opacity:.4}100%{opacity:.16}}
.cell{animation:cell-wave 1s linear paused both;animation-delay:calc((var(--p) - var(--w))*1s)}
@keyframes cell-wave{0%{fill:#252c3c}6%{fill:#6ce0ff}40%{fill:#3a5470}100%{fill:#2b3346}}
.trace{stroke-dasharray:24 58;stroke-dashoffset:var(--flow);opacity:calc(.25 + .75*var(--pulse))}
.pad{filter:drop-shadow(0 0 7px currentColor);opacity:calc(.35 + .65*var(--pulse))}
.pad-c{color:#43c8ff}.pad-p{color:#b06bff}
.die-glow{animation:die-breathe 3.4s ease-in-out infinite}
@keyframes die-breathe{0%,100%{opacity:.62}50%{opacity:1}}

:host([preview]) .section{height:auto}
:host([preview]) .pin{position:relative;top:0;height:auto;aspect-ratio:3/2;min-height:0}
:host([preview]) .finale,:host([preview]) .controls,:host([preview]) .heading{display:none}

@media(max-width:760px){.section{height:820svh}.controls{padding:20px 16px 10px}.heading{display:none}}
@media(prefers-reduced-motion:reduce){
 :host(:not([data-motion=play])) svg *{animation:none!important}
 .section{height:auto}.pin{position:relative;top:0;height:auto;aspect-ratio:3/2}
 .camera{transform:none!important;opacity:1!important}.finale{display:none}
}
`;

/* ── The chip the corridor hands off to ──────────────────────────────────────
   A package seen straight on: grey pins on all four sides, a recessed substrate
   carrying a ball-grid of pads, and a glowing die in the middle. Scrolling
   drives a rainbow wave of current through the ball grid. */
const CHIP_W=1200,CHIP_H=900;
const PANEL={x:228,y:188,w:744,h:544};
const DIE={x:478,y:348,w:244,h:224};

const bgaField=()=>{
  const pitch=29,cols=Math.floor(PANEL.w/pitch),rows=Math.floor(PANEL.h/pitch);
  const ox=PANEL.x+(PANEL.w-(cols-1)*pitch)/2,oy=PANEL.y+(PANEL.h-(rows-1)*pitch)/2;
  const base=[],live=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=ox+c*pitch,y=oy+r*pitch;
    const edge=Math.min(c,cols-1-c,r,rows-1-r);
    const ring=Math.max(Math.abs(c-(cols-1)/2)/((cols-1)/2),Math.abs(r-(rows-1)/2)/((rows-1)/2));
    if(!(edge<=2||(ring>.52&&ring<.66)))continue;
    if(x>DIE.x-26&&x<DIE.x+DIE.w+26&&y>DIE.y-26&&y<DIE.y+DIE.h+26)continue;
    // Phase along a diagonal sweep, so the wave crosses the package corner to corner.
    const ph=r2(((x-PANEL.x)/PANEL.w*.6+(y-PANEL.y)/PANEL.h*.4));
    base.push(`<circle cx="${r2(x)}" cy="${r2(y)}" r="5.6" fill="#222a39"/>`);
    live.push(`<circle cx="${r2(x)}" cy="${r2(y)}" r="5.6" class="bga" style="--p:${ph};fill:hsl(${r2(18+ph*300)} 92% 64%)"/>`);
  }
  return `<g>${base.join('')}</g><g class="bga-field" filter="url(#cGlow)">${live.join('')}</g>`;
};

const pins=()=>{
  const out=[];
  for(let i=0;i<9;i++){const x=r2(252+i*84);
    out.push(`<rect x="${x}" y="58" width="24" height="96" rx="9" fill="url(#cPinV)"/>`);
    out.push(`<rect x="${x}" y="746" width="24" height="96" rx="9" fill="url(#cPinV)"/>`);}
  for(let i=0;i<7;i++){const y=r2(212+i*78);
    out.push(`<rect x="86" y="${y}" width="96" height="24" rx="9" fill="url(#cPin)"/>`);
    out.push(`<rect x="1018" y="${y}" width="96" height="24" rx="9" fill="url(#cPin)"/>`);}
  return out.join('');
};

const traces=()=>{
  const cx=DIE.x+DIE.w/2,dieL=DIE.x,dieR=DIE.x+DIE.w,dieT=DIE.y,dieB=DIE.y+DIE.h;
  const out=[];
  [0,1,2].forEach(i=>{
    const y=r2(DIE.y+52+i*60);
    out.push(`<path class="trace" d="M${dieL} ${y}H300" stroke="#4a5164"/>`);
    out.push(`<rect x="286" y="${r2(y-6)}" width="76" height="12" rx="6" fill="#43c8ff" class="pad pad-c"/>`);
    out.push(`<path class="trace" d="M${dieR} ${y}H900" stroke="#4a5164"/>`);
    out.push(`<rect x="838" y="${r2(y-6)}" width="76" height="12" rx="6" fill="#b06bff" class="pad pad-p"/>`);
    const x=r2(cx-60+i*60);
    out.push(`<path class="trace" d="M${x} ${dieT}V268" stroke="#4a5164"/>`);
    out.push(`<rect x="${r2(x-6)}" y="252" width="12" height="70" rx="6" fill="#43c8ff" class="pad pad-c"/>`);
    out.push(`<path class="trace" d="M${x} ${dieB}V654" stroke="#4a5164"/>`);
    out.push(`<rect x="${r2(x-6)}" y="612" width="12" height="70" rx="6" fill="#b06bff" class="pad pad-p"/>`);
  });
  return out.join('');
};

const dieGrid=()=>range(5).map(r=>range(5).map(c=>
  `<rect x="${r2(DIE.x+24+c*40)}" y="${r2(DIE.y+22+r*38)}" width="30" height="28" rx="5" fill="#252c3c" class="cell" style="--p:${r2((c+r)/8)}"/>`
).join('')).join('');

const CHIP=`<div class="chip-scene"><svg viewBox="0 0 ${CHIP_W} ${CHIP_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="An AI chip with current flowing through its ball grid">
<defs>
<linearGradient id="cEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#43c8ff"/><stop offset=".5" stop-color="#8ab4ff"/><stop offset="1" stop-color="#c86bff"/></linearGradient>
<linearGradient id="cBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#343a48"/><stop offset="1" stop-color="#23283393"/></linearGradient>
<linearGradient id="cPin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d2d7e0"/><stop offset="1" stop-color="#8f96a4"/></linearGradient>
<linearGradient id="cPinV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d2d7e0"/><stop offset="1" stop-color="#8f96a4"/></linearGradient>
<linearGradient id="cBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#241b45"/><stop offset=".55" stop-color="#171232"/><stop offset="1" stop-color="#0f0c22"/></linearGradient>
<radialGradient id="cHalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6f5cff" stop-opacity=".3"/><stop offset="1" stop-color="#6f5cff" stop-opacity="0"/></radialGradient>
<filter id="cGlow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="cDieGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect x="-400" y="-300" width="2000" height="1500" fill="url(#cBg)"/>
<ellipse cx="600" cy="440" rx="560" ry="420" fill="url(#cHalo)"/>
<g stroke="#8a6fd8" stroke-width="1.2" opacity=".3" fill="none">
${range(7).map(i=>`<path d="M-400 ${r2(806+i*i*4.6)}H1600"/>`).join('')}
${range(19).map(i=>`<path d="M600 796L${r2(-1600+i*355)} 1200"/>`).join('')}
</g>
${pins()}
<rect x="176" y="150" width="848" height="612" rx="52" fill="#11131d" opacity=".55"/>
<rect x="180" y="140" width="840" height="620" rx="48" fill="url(#cBody)" stroke="#4a5162" stroke-width="3"/>
<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="28" fill="#151a25" stroke="#2a3141" stroke-width="2"/>
<circle cx="272" cy="236" r="9" fill="#3b4354"/>
${bgaField()}
<g stroke-width="3" fill="none" stroke-linecap="round">${traces()}</g>
<rect x="${DIE.x}" y="${DIE.y}" width="${DIE.w}" height="${DIE.h}" rx="18" fill="#1a2030"/>
${dieGrid()}
<rect class="die-glow" x="${DIE.x}" y="${DIE.y}" width="${DIE.w}" height="${DIE.h}" rx="18" fill="none" stroke="url(#cEdge)" stroke-width="5" filter="url(#cDieGlow)"/>
</svg></div>`;

const MARKUP=()=>`<style>${STYLE}</style>
<section class="section"><div class="pin">
<div class="viewport">
  ${SKY}
  <div class="camera"><svg class="stage" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="A three-storey building: five bots each working a different niche; a country of geniuses in jars around one large model; a data centre corridor below.">${DEFS}${buildingSVG()}</svg></div>
  <div class="finale" aria-hidden="true">
    <div class="title-card card1"><h2 class="title-line">Part I: Chips in a data center</h2></div>
    <div class="title-card card2"><h2 class="title-line">Nvidia &amp; The 100 GW Opportunity</h2></div>
    <div class="flash"></div>
    ${CHIP}
  </div>
</div>
<div class="heading"><p class="eyebrow"></p></div>
<div class="controls"><a class="skip" href="#1" aria-label="Continue to the charts">&darr;</a></div>
</div></section>`;

/* ── Choreography ────────────────────────────────────────────────────────────
   The building simply holds, full-screen. Both title cards come and go over it,
   each with a long dwell. Only then does the camera dive into the corridor's
   vanishing point and hand off to the chip. */
const T={
  dim:[.03,.09],
  card1In:[.07,.12],card1Out:[.24,.29],
  card2In:[.33,.38],card2Out:[.51,.56],
  dive:[.56,.72],
  flashIn:[.68,.73],flashOut:[.73,.78],
  chipIn:[.71,.76],pulse:[.76,1]
};
const DIVE_SCALE=70;

class AIBuildingIntro extends HTMLElement{
connectedCallback(){
  if(this.shadowRoot)return;
  const root=this.attachShadow({mode:'open'});
  root.innerHTML=MARKUP();

  const label=this.getAttribute('part-label');
  if(label)root.querySelector('.eyebrow').textContent=label;
  const continueTo=this.getAttribute('continue-to');
  if(continueTo?.startsWith('#'))root.querySelector('.skip').href=continueTo;

  const focus=this.getAttribute('focus-floor');           // 'agents' | 'brains' | null
  const section=root.querySelector('.section'),camera=root.querySelector('.camera');
  const viewport=root.querySelector('.viewport'),finale=root.querySelector('.finale');
  const card1=root.querySelector('.card1'),card2=root.querySelector('.card2');
  const flash=root.querySelector('.flash'),chip=root.querySelector('.chip-scene');
  const controls=root.querySelector('.controls');

  const seg=(v,[a,b])=>Math.min(1,Math.max(0,(v-a)/(b-a))),ease=v=>v*v*(3-2*v);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');

  // Map a point in stage coordinates to pixels inside .camera, matching
  // the stage SVG's own xMidYMax/meet fitting.
  const toCamera=(vx,vy)=>{
    const cw=camera.clientWidth,ch=camera.clientHeight,s=Math.min(cw/W,ch/H);
    return{x:(cw-W*s)/2+vx*s,y:(ch-H*s)+vy*s,s};
  };

  let raf=0;
  const paint=()=>{
    raf=0;
    if(this.hasAttribute('preview')||reduce.matches){camera.style.transform='';camera.style.opacity='';return;}
    const r=section.getBoundingClientRect();
    const top=parseFloat(getComputedStyle(this).getPropertyValue('--intro-top'))||0;
    const p=Math.min(1,Math.max(0,(top-r.top)/Math.max(1,r.height-innerHeight+top)));

    // Sibling parts park the camera on one floor instead of running the finale.
    if(!finale||focus){
      const target=focus==='agents'?{x:W/2,y:(FLOOR_A[0]+FLOOR_A[1])/2}
                  :focus==='brains'?{x:W/2,y:(FLOOR_B[0]+FLOOR_B[1])/2}
                  :{x:VP.x,y:VP.y};
      const k=ease(Math.min(1,p/.9)),z=1+1.9*k,pt=toCamera(target.x,target.y);
      camera.style.transformOrigin=`${pt.x}px ${pt.y}px`;
      camera.style.transform=`translate(${(viewport.clientWidth/2-pt.x)*k}px,${(viewport.clientHeight/2-pt.y)*k}px) scale(${z})`;
      return;
    }

    const dim=ease(seg(p,T.dim));
    const t1=ease(seg(p,T.card1In)),t1o=ease(seg(p,T.card1Out));
    const t2=ease(seg(p,T.card2In)),t2o=ease(seg(p,T.card2Out));
    const dive=ease(seg(p,T.dive));
    const fIn=ease(seg(p,T.flashIn)),fOut=ease(seg(p,T.flashOut));
    const cIn=ease(seg(p,T.chipIn)),pulse=seg(p,T.pulse);

    // Nothing moves until the cards are done; then the corridor swallows the camera.
    let tx=0,ty=0,scale=1;
    if(dive>0){
      const pt=toCamera(VP.x,VP.y),k=ease(seg(p,[T.dive[0],T.dive[0]+.06]));
      camera.style.transformOrigin=`${pt.x}px ${pt.y}px`;
      tx=(viewport.clientWidth/2-pt.x)*k;
      ty=(viewport.clientHeight/2-pt.y)*k;
      scale=Math.pow(DIVE_SCALE,dive);
    }
    // Dim behind the cards, then brighten again as the dive takes over.
    const lit=1-.62*dim*(1-Math.min(1,dive*2.4));
    camera.style.opacity=String(cIn>=1?0:lit);
    camera.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;

    card1.style.opacity=String(t1*(1-t1o));
    card1.style.transform=`translateY(${(1-t1)*26-t1o*20}px)`;
    card2.style.opacity=String(t2*(1-t2o));
    card2.style.transform=`translateY(${(1-t2)*26-t2o*20}px)`;
    flash.style.opacity=String(fIn*(1-fOut));
    controls.style.opacity=String(1-dim);
    chip.style.opacity=String(cIn);
    chip.style.setProperty('--flow',String(-pulse*1600));
    chip.style.setProperty('--pulse',String(Math.min(1,pulse*2.2)));
    chip.style.setProperty('--w',String((pulse*2.6)%1));
    chip.style.transform=`scale(${1+.07*pulse})`;
  };

  const update=()=>{if(!raf)raf=requestAnimationFrame(paint);};
  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',update,{passive:true});
  const io=new IntersectionObserver(e=>this.toggleAttribute('data-offscreen',!e[0].isIntersecting),{threshold:0});
  io.observe(this);
  const ro=new ResizeObserver(update);ro.observe(this);
  update();

  // The sticky header eats the top of the frame until the page is scrolled past
  // it, so nudge past it once on load and let the intro own the whole screen.
  let settle=0;
  if(!this.hasAttribute('preview')&&!reduce.matches&&!location.hash&&scrollY<4){
    const cancel=()=>clearTimeout(settle);
    ['wheel','touchstart','keydown','pointerdown'].forEach(t=>addEventListener(t,cancel,{once:true,passive:true}));
    settle=setTimeout(()=>{
      const h=document.querySelector('header')?.offsetHeight||58;
      if(scrollY<4)scrollTo({top:h+2,behavior:'smooth'});
    },420);
  }

  this.cleanup=()=>{removeEventListener('scroll',update);removeEventListener('resize',update);io.disconnect();ro.disconnect();cancelAnimationFrame(raf);clearTimeout(settle);};
}
disconnectedCallback(){this.cleanup?.();}
}
customElements.define('ai-building-intro',AIBuildingIntro);
})();
