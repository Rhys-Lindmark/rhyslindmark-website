// Port Null: a top-down driving game about Hotel Null's night shift.
// Guest texts come from Night Shift at Hotel Null (data.json): every Jev answer
// shown on the phone is a real recorded answer from jev-1.14.0. The policy, and
// so the right call, comes from the same data. Everything else is the city.
'use strict';
(() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const hyp = Math.hypot;
let seed = 1;
const srnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = Math.random;
const pick = (a, r = R) => a[Math.floor(r() * a.length)];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---------------------------------------------------------------- world
const COLS = 8, ROWS = 8, ROAD = 150, BLOCK = 420, P = ROAD + BLOCK;
const CITY_W = COLS * P + ROAD, CITY_H = ROWS * P + ROAD, SAND = 300, WORLD_W = CITY_W + SAND, WORLD_H = CITY_H;
const SW = 22, LANE = ROAD * 0.22, CURB = ROAD * 0.4, CAMH = 1500;
const nodeX = i => i * P + ROAD / 2, nodeY = j => j * P + ROAD / 2;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const SPECIALS = {
  hotel: { i: 4, j: 4, name: 'Hotel Null', sign: 'HOTEL NULL', color: '#f386a1', h: 250, icon: '🏨', roof: '#fbe1e8' },
  diner: { i: 1, j: 1, name: "Sunny's Diner", sign: "SUNNY'S", color: '#ffd166', h: 70, icon: '🍳', item: 'breakfast', roof: '#fff1c9' },
  gas: { i: 6, j: 2, name: 'Gas-N-Go', sign: 'GAS N GO', color: '#06d6a0', h: 46, icon: '🌹', item: 'gas-station roses', roof: '#d6fff1' },
  laundry: { i: 1, j: 6, name: 'Suds City', sign: 'SUDS 24H', color: '#7bdff2', h: 84, icon: '🧺', item: 'towels', roof: '#dff7fc' },
  mattress: { i: 7, j: 5, name: 'Mattress Mania', sign: 'MATTRESS', color: '#c77dff', h: 110, icon: '🛏️', item: 'a pillow', roof: '#efe0ff' },
  pharmacy: { i: 5, j: 1, name: 'Null Rx', sign: 'RX 24H', color: '#ff5d8f', h: 92, icon: '🪥', item: 'a toothbrush kit', roof: '#ffe0ea' },
  club: { i: 3, j: 2, name: 'Club Void', sign: 'VOID', color: '#e040fb', h: 120, icon: '💪', item: 'the bouncer', roof: '#3a2440' },
  clinic: { i: 0, j: 4, name: 'Night Clinic', sign: 'CLINIC +', color: '#72efdd', h: 150, icon: '🩺', item: 'the night nurse', roof: '#e3fffb' },
  burger: { i: 6, j: 7, name: 'Burger Barn', sign: 'BURGERS', color: '#ff9f1c', h: 60, icon: '🍔', item: 'a burger', roof: '#ffe8c7' },
  wrap: { i: 2, j: 4, name: 'Wrap It Up', sign: 'WRAP IT UP', color: '#9ef01a', h: 60, icon: '🎨', roof: '#effcd9' },
};
const SIGNS = ['BAIL BONDS', 'PAWN', 'CASH 4 GOLD', 'LIQUOR', 'NAILS', 'TATTOO', 'VAPE', 'CHECKS CASHED', 'MOTEL', 'OPEN 24H', 'WINGS', 'CUBAN', 'GYM', 'PALMS', 'XXL TEES', 'PHONE FIX', 'LOTTO', 'TAN'];
const NEONS = ['#f386a1', '#2ec4ff', '#b06bff', '#3dffb0', '#ffd23f', '#ff5d3c'];
const ROOFS = ['#f6d6c8', '#cfeee3', '#f7c6d0', '#d8d0f0', '#f6e8b8', '#bfe3f0', '#efefea', '#e9d3ef', '#ffd9b8', '#c7e9c0'];
const WINDOWS = ['#ffd27a', '#ffe9b0', '#9be7ff', '#ff9ecb'];

const blocks = [], buildings = [], palms = [], props = [], lamps = [], parkSpots = [];
// static collision grid
const GS = 300, GC = Math.ceil(WORLD_W / GS) + 1, GR = Math.ceil(WORLD_H / GS) + 1, grid = new Array(GC * GR);
for (let k = 0; k < grid.length; k++) grid[k] = [];
function gridAdd(o, x0, y0, x1, y1) {
  for (let gy = Math.max(0, Math.floor(y0 / GS)); gy <= Math.min(GR - 1, Math.floor(y1 / GS)); gy++)
    for (let gx = Math.max(0, Math.floor(x0 / GS)); gx <= Math.min(GC - 1, Math.floor(x1 / GS)); gx++) grid[gy * GC + gx].push(o);
}
const GQ = [];
function gridNear(x, y, r = 16) { // everything registered in the cells this circle touches (may repeat)
  GQ.length = 0;
  for (let gy = Math.max(0, Math.floor((y - r) / GS)); gy <= Math.min(GR - 1, Math.floor((y + r) / GS)); gy++)
    for (let gx = Math.max(0, Math.floor((x - r) / GS)); gx <= Math.min(GC - 1, Math.floor((x + r) / GS)); gx++) for (const o of grid[gy * GC + gx]) GQ.push(o);
  return GQ;
}
const cellAt = (x, y) => { const gx = Math.floor(x / GS), gy = Math.floor(y / GS); return gx >= 0 && gy >= 0 && gx < GC && gy < GR ? grid[gy * GC + gx] : []; };
function addBuilding(x, y, w, h, height, o = {}) {
  const b = { x0: x, y0: y, x1: x + w, y1: y + h, h: height, roof: o.roof || pick(ROOFS, srnd), sign: o.sign, neon: o.neon, special: o.special, win: [], cx: x + w / 2, cy: y + h / 2, kind: 'b', seed: srnd() * 1e6 | 0, ac: srnd() < 0.7 };
  const lit = 0.25 + srnd() * 0.45, wc = pick(WINDOWS, srnd);
  for (let k = 0; k < 64; k++) b.win.push(srnd() < lit ? (srnd() < 0.8 ? wc : pick(WINDOWS, srnd)) : null);
  if (!b.sign && w > 110 && h > 90 && srnd() < 0.42) { b.sign = pick(SIGNS, srnd); b.neon = pick(NEONS, srnd); b.small = true; }
  else if (!b.sign && srnd() < 0.3) { b.neon = pick(NEONS, srnd); b.rim = true; }
  buildings.push(b); gridAdd(b, b.x0, b.y0, b.x1, b.y1);
  return b;
}
function addPalm(x, y, h = 70 + srnd() * 40) { const p = { x, y, h, r: 9, kind: 'p', cx: x, cy: y, rot: srnd() * TAU }; palms.push(p); gridAdd(p, x - 10, y - 10, x + 10, y + 10); }
function addProp(kind, x, y, a = 0) { props.push({ kind, x, y, a, hx: x, hy: y, ha: a, vx: 0, vy: 0, va: 0, hit: false, t: 0 }); }

function genCity() {
  seed = 20261121;
  const at = {}; for (const [k, s] of Object.entries(SPECIALS)) at[s.i + ',' + s.j] = k;
  const center = { x: CITY_W / 2, y: CITY_H / 2 };
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const x = i * P + ROAD, y = j * P + ROAD, sp = at[i + ',' + j];
    const roll = srnd();
    const type = sp ? 'special' : roll < 0.13 ? 'park' : roll < 0.22 ? 'lot' : 'city';
    const blk = { i, j, x, y, type, sp };
    blocks.push(blk);
    const ix = x + SW, iy = y + SW, iw = BLOCK - 2 * SW;
    const down = 1.3 - 0.75 * hyp(x + BLOCK / 2 - center.x, y + BLOCK / 2 - center.y) / hyp(center.x, center.y);
    if (type === 'special') {
      const s = SPECIALS[sp];
      s.b = addBuilding(ix + 18, iy + 18, iw - 36, iw - 120, s.h, { sign: s.sign, neon: s.color, special: sp, roof: s.roof });
      s.marker = { x: x + BLOCK / 2, y: y + BLOCK + ROAD * 0.3 };
      addPalm(ix + 12, y + BLOCK - SW - 14); addPalm(ix + iw - 12, y + BLOCK - SW - 14);
    } else if (type === 'park') {
      blk.pond = srnd() < 0.4 ? { x: ix + iw * 0.3 + srnd() * iw * 0.2, y: iy + iw * 0.3 + srnd() * iw * 0.2, r: 50 + srnd() * 30 } : null;
      for (let k = 0; k < 9; k++) addPalm(ix + 30 + srnd() * (iw - 60), iy + 30 + srnd() * (iw - 60));
      for (let k = 0; k < 4; k++) addProp('bench', ix + 40 + srnd() * (iw - 80), iy + 40 + srnd() * (iw - 80), srnd() < 0.5 ? 0 : Math.PI / 2);
    } else if (type === 'lot') {
      addBuilding(ix + iw - 90, iy + 10, 80, 70, 40 + srnd() * 20);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) if (srnd() < 0.5) parkSpots.push({ x: ix + 40 + c * 52, y: iy + 130 + r * 100, a: Math.PI / 2, lot: true });
      for (let k = 0; k < 6; k++) addProp('cone', ix + 20 + srnd() * (iw - 40), iy + 100 + srnd() * (iw - 120));
    } else {
      const g = srnd() < 0.5 ? 14 : 46, L = srnd(), hh = () => (46 + Math.pow(srnd(), 1.4) * 200) * down;
      if (L < 0.28) addBuilding(ix, iy, iw, iw, hh());
      else if (L < 0.64) {
        const split = 0.35 + srnd() * 0.3;
        if (srnd() < 0.5) { const w1 = (iw - g) * split; addBuilding(ix, iy, w1, iw, hh()); addBuilding(ix + w1 + g, iy, iw - w1 - g, iw, hh()); }
        else { const h1 = (iw - g) * split; addBuilding(ix, iy, iw, h1, hh()); addBuilding(ix, iy + h1 + g, iw, iw - h1 - g, hh()); }
      } else {
        const w1 = (iw - g) * (0.4 + srnd() * 0.2), h1 = (iw - g) * (0.4 + srnd() * 0.2);
        addBuilding(ix, iy, w1, h1, hh()); addBuilding(ix + w1 + g, iy, iw - w1 - g, h1, hh());
        addBuilding(ix, iy + h1 + g, w1, iw - h1 - g, hh()); addBuilding(ix + w1 + g, iy + h1 + g, iw - w1 - g, iw - h1 - g, hh());
      }
    }
    addProp('hydrant', x + 9, y + 9);
    if (srnd() < 0.7) addProp('trash', x + BLOCK - 10, y + 8 + srnd() * (BLOCK - 16));
    if (srnd() < 0.5) addProp('news', x + 8 + srnd() * (BLOCK - 16), y + BLOCK - 9);
  }
  // beach
  for (let y = 60; y < CITY_H - 40; y += 150) addPalm(CITY_W + 40 + srnd() * 180, y + srnd() * 70, 80 + srnd() * 40);
  // street lamps: one per intersection, one mid-block per road
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) {
    lamps.push({ x: nodeX(i) + ROAD / 2 - 4, y: nodeY(j) - ROAD / 2 + 4 });
    if (i < COLS) lamps.push({ x: nodeX(i) + P / 2, y: nodeY(j) + (j % 2 ? -1 : 1) * (ROAD / 2 - 4) });
    if (j < ROWS) lamps.push({ x: nodeX(i) + (i % 2 ? -1 : 1) * (ROAD / 2 - 4), y: nodeY(j) + P / 2 });
  }
  // curbside parking
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) if (srnd() < 0.22) parkSpots.push({ x: nodeX(i) + 110 + srnd() * (P - 220), y: nodeY(j) + (srnd() < 0.5 ? -CURB : CURB), a: 0 });
  for (let i = 0; i <= COLS; i++) for (let j = 0; j < ROWS; j++) if (srnd() < 0.22) parkSpots.push({ x: nodeX(i) + (srnd() < 0.5 ? -CURB : CURB), y: nodeY(j) + 110 + srnd() * (P - 220), a: Math.PI / 2 });
}
genCity();
const blockAt = (x, y) => { const i = Math.floor((x - ROAD) / P), j = Math.floor((y - ROAD) / P); if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return null; const b = blocks[j * COLS + i]; return x >= b.x && x <= b.x + BLOCK && y >= b.y && y <= b.y + BLOCK ? b : null; };
function terrain(x, y) {
  if (x > CITY_W) return 'sand';
  const b = blockAt(x, y); if (!b) return 'road';
  if (b.type === 'park' && x > b.x + SW && x < b.x + BLOCK - SW && y > b.y + SW && y < b.y + BLOCK - SW) return 'grass';
  return 'walk';
}
const areaName = (x, y) => x > CITY_W - 40 ? 'Null Beach' : y < CITY_H * 0.33 ? (x < CITY_W * 0.5 ? 'Uptown' : 'Little Havana-ish') : y > CITY_H * 0.66 ? (x < CITY_W * 0.5 ? 'The Flats' : 'Ocean Ave') : (x < CITY_W * 0.4 ? 'Westside' : 'Downtown');

// ---------------------------------------------------------------- canvas
const cv = $('#game'), ctx = cv.getContext('2d');
const oc = document.createElement('canvas'), octx = oc.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  VW = innerWidth; VH = innerHeight;
  cv.width = oc.width = Math.round(VW * DPR); cv.height = oc.height = Math.round(VH * DPR);
}
addEventListener('resize', resize); resize();
function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
const LIGHT = sprite(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const CONE = sprite(256, (g, s) => { const gr = g.createRadialGradient(0, s / 2, 0, 0, s / 2, s); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, s / 2 - 8); g.lineTo(s, s * 0.08); g.lineTo(s, s * 0.92); g.lineTo(0, s / 2 + 8); g.closePath(); g.fill(); });
const glowCache = {};
function glow(color) {
  return glowCache[color] ||= sprite(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
}
const shadeCache = {};
function shade(hex, f, night) {
  const k = hex + f + '|' + night; if (shadeCache[k]) return shadeCache[k];
  const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  r *= f; g *= f; b *= f; const t = night / 20 * 0.42;
  r = lerp(r, 26, t); g = lerp(g, 14, t); b = lerp(b, 52, t);
  return shadeCache[k] = `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------------------------------------------------------------- audio
const A = {
  ctx: null, on: false, muted: store.get('pn-muted', false), station: 0,
  init() {
    if (this.ctx || /[?&]debug\b/.test(location.search)) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.comp);
    this.music = c.createGain(); this.music.gain.value = 0.34; this.music.connect(this.comp);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; this.noise = nb;
    // engine
    this.eg = c.createGain(); this.eg.gain.value = 0; this.ef = c.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 600;
    this.e1 = c.createOscillator(); this.e1.type = 'sawtooth'; this.e2 = c.createOscillator(); this.e2.type = 'square';
    this.e1.connect(this.ef); this.e2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.sfx); this.e1.start(); this.e2.start();
    // skid
    this.sk = c.createBufferSource(); this.sk.buffer = nb; this.sk.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 3;
    this.skg = c.createGain(); this.skg.gain.value = 0; this.sk.connect(bp); bp.connect(this.skg); this.skg.connect(this.sfx); this.sk.start();
    // siren
    this.si = c.createOscillator(); this.si.type = 'triangle'; this.sig = c.createGain(); this.sig.gain.value = 0; this.si.connect(this.sig); this.sig.connect(this.sfx); this.si.start();
    // heli
    this.hl = c.createBufferSource(); this.hl.buffer = nb; this.hl.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    this.hlg = c.createGain(); this.hlg.gain.value = 0; this.hl.connect(lp); lp.connect(this.hlg); this.hlg.connect(this.sfx); this.hl.start();
    // horn
    this.h1 = c.createOscillator(); this.h1.type = 'square'; this.h1.frequency.value = 392; this.h2 = c.createOscillator(); this.h2.type = 'square'; this.h2.frequency.value = 466;
    this.hg = c.createGain(); this.hg.gain.value = 0; const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1400;
    this.h1.connect(hf); this.h2.connect(hf); hf.connect(this.hg); this.hg.connect(this.sfx); this.h1.start(); this.h2.start();
    this.on = true; this.next = c.currentTime + 0.1; this.step = 0;
    setInterval(() => this.schedule(), 25);
  },
  resume() { this.ctx?.state === 'suspended' && this.ctx.resume(); },
  mute(m) { this.muted = m; store.set('pn-muted', m); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05); },
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  noiseHit(t, dur, freq, type, vol, dest = this.sfx) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + R() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(dest); this.env(g, t, 0.003, vol, dur); s.start(t, R() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(t, freq, dur, type, vol, dest = this.sfx, slide) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    o.connect(g); g.connect(dest); this.env(g, t, 0.005, vol, dur); o.start(t); o.stop(t + dur + 0.05);
  },
  crash(k) { if (!this.on) return; const t = this.ctx.currentTime; this.noiseHit(t, 0.25 + k * 0.3, 900, 'lowpass', clamp(0.25 + k * 0.6, 0, 0.9)); this.tone(t, 90, 0.25, 'sine', clamp(k, 0.1, 0.7), this.sfx, 40); if (k > 0.5) this.noiseHit(t + 0.03, 0.4, 3500, 'highpass', 0.25); },
  boom() { if (!this.on) return; const t = this.ctx.currentTime; this.noiseHit(t, 1.4, 500, 'lowpass', 1); this.tone(t, 70, 1.2, 'sine', 0.9, this.sfx, 25); },
  bonk() { if (!this.on) return; const t = this.ctx.currentTime; this.tone(t, 520, 0.12, 'square', 0.18, this.sfx, 200); this.tone(t + 0.08, 900, 0.1, 'triangle', 0.12); },
  cash() { if (!this.on) return; const t = this.ctx.currentTime; [988, 1319, 1976].forEach((f, k) => this.tone(t + k * 0.05, f, 0.12, 'square', 0.07)); },
  good() { if (!this.on) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, k) => this.tone(t + k * 0.07, f, 0.2, 'triangle', 0.14)); },
  bad() { if (!this.on) return; const t = this.ctx.currentTime; [330, 247, 185].forEach((f, k) => this.tone(t + k * 0.12, f, 0.25, 'sawtooth', 0.09)); },
  ring() { if (!this.on) return; const t = this.ctx.currentTime; for (let k = 0; k < 2; k++) { this.tone(t + k * 0.18, 1318, 0.08, 'square', 0.08); this.tone(t + k * 0.18 + 0.08, 1760, 0.08, 'square', 0.08); } },
  splash() { if (!this.on) return; const t = this.ctx.currentTime; this.noiseHit(t, 0.5, 1200, 'bandpass', 0.4); },
  whoosh() { if (!this.on) return; const t = this.ctx.currentTime; this.noiseHit(t, 0.25, 2500, 'bandpass', 0.18); },
  horn(on) { if (this.on) this.hg.gain.setTargetAtTime(on ? 0.11 : 0, this.ctx.currentTime, 0.01); },
  update(spd, thr, skid, siren, heli, slow) {
    if (!this.on) return; const t = this.ctx.currentTime;
    const f = 38 + spd * 0.16 + thr * 12;
    this.e1.frequency.setTargetAtTime(f * (slow ? 0.6 : 1), t, 0.05); this.e2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    this.ef.frequency.setTargetAtTime(300 + spd * 1.5 + thr * 500, t, 0.08);
    this.eg.gain.setTargetAtTime(spd > 0 || thr ? 0.05 + thr * 0.04 : 0, t, 0.1);
    this.skg.gain.setTargetAtTime(clamp(skid, 0, 1) * 0.22, t, 0.04);
    this.sig.gain.setTargetAtTime(clamp(siren, 0, 1) * 0.07, t, 0.1);
    this.si.frequency.setTargetAtTime(760 + 340 * Math.sin(t * 2.6), t, 0.02);
    this.hlg.gain.setTargetAtTime(heli ? heli * (0.5 + 0.5 * Math.sin(t * 70)) * 0.5 : 0, t, 0.01);
  },
  // radio: two stations synthesized live
  STATIONS: [null, { name: 'Jev FM 101.4', bpm: 140 }, { name: 'Null Wave 88.8', bpm: 108 }],
  setStation(n) { this.station = n; this.step = 0; if (this.ctx) this.next = this.ctx.currentTime + 0.05; },
  schedule() {
    if (!this.ctx || !this.station || this.muted) return;
    const st = this.STATIONS[this.station], spb = 60 / st.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.12) { this.playStep(this.step, this.next, spb); this.step++; this.next += spb; }
  },
  playStep(s, t, spb) {
    const bar = Math.floor(s / 16) % 4, k = s % 16, m = this.music;
    if (this.station === 1) {
      const roots = [55, 43.65, 65.41, 49], chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 329.6], [196, 246.9, 293.7]];
      if ([0, 7, 10].includes(k) || (bar === 3 && k === 14)) { this.tone(t, 150, 0.12, 'sine', 0.55, m, 45); this.tone(t, roots[bar] * 2, 0.7, 'sine', 0.42, m, roots[bar]); }
      if (k === 8) { this.noiseHit(t, 0.18, 1800, 'bandpass', 0.45, m); this.noiseHit(t + 0.01, 0.12, 4000, 'highpass', 0.2, m); }
      const roll = bar % 2 === 1 && k >= 12;
      if (k % 2 === 0 || roll) { this.noiseHit(t, 0.03, 9000, 'highpass', 0.12, m); if (roll) this.noiseHit(t + spb / 2, 0.03, 9000, 'highpass', 0.09, m); }
      if (k === 0) chords[bar].forEach(f => this.tone(t, f, spb * 15, 'triangle', 0.035, m));
      const mel = [880, 1046.5, 1318.5, 1174.7, 987.8, 784];
      if ((s * 7919) % 5 === 0 && k % 3 === 0) this.tone(t, pick(mel), 0.35, 'sine', 0.05, m);
    } else {
      const roots = [110, 87.3, 130.8, 98], arp = [[440, 523, 659], [349, 440, 523], [523, 659, 784], [392, 494, 587]];
      if (k % 4 === 0) this.tone(t, 130, 0.18, 'sine', 0.6, m, 40);
      if (k === 4 || k === 12) this.noiseHit(t, 0.22, 1500, 'bandpass', 0.4, m);
      if (k % 4 === 2) this.noiseHit(t, 0.04, 8000, 'highpass', 0.12, m);
      if (k % 2 === 0) this.tone(t, roots[bar], spb * 1.8, 'sawtooth', 0.09, m);
      this.tone(t, arp[bar][k % 3] * (k % 8 < 4 ? 1 : 2), spb * 0.9, 'square', 0.025, m);
    }
  },
};

// ---------------------------------------------------------------- input
const keys = {}, pressed = {};
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (GAME_KEYS.includes(e.code) && G.state !== 'title' && G.state !== 'results') e.preventDefault();
  onKey(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.state === 'play' && !/[?&]debug\b/.test(location.search)) setPause(true); });
const touch = { on: false, sx: 0, sy: 0, dx: 0, dy: 0, id: null, drift: false };
function setupTouch() {
  const coarse = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  if (!coarse) return;
  $('#touch').classList.add('on');
  const stick = $('#stick'), knob = $('#knob');
  stick.addEventListener('pointerdown', e => { touch.on = true; touch.id = e.pointerId; touch.sx = e.clientX; touch.sy = e.clientY; touch.dx = touch.dy = 0; knob.style.display = 'block'; knob.style.left = (e.clientX - 60) + 'px'; knob.style.top = (e.clientY - 60) + 'px'; stick.setPointerCapture(e.pointerId); A.init(); A.resume(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId !== touch.id) return; let dx = e.clientX - touch.sx, dy = e.clientY - touch.sy; const l = hyp(dx, dy); if (l > 60) { dx *= 60 / l; dy *= 60 / l; } touch.dx = dx / 60; touch.dy = dy / 60; knob.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; });
  const end = e => { if (e.pointerId !== touch.id) return; touch.on = false; touch.dx = touch.dy = 0; knob.style.display = 'none'; knob.firstElementChild.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const btn = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); down(); }); const u = () => { el.classList.remove('down'); up && up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', u); };
  btn('#tb-drift', () => touch.drift = true, () => touch.drift = false);
  btn('#tb-car', () => pressed.KeyE = true);
  btn('#tb-horn', () => keys.KeyH = true, () => keys.KeyH = false);
}
setupTouch();

// ---------------------------------------------------------------- entities
const KINDS = {
  sedan: { L: 46, W: 22, acc: 430, max: 520, grip: 7.5, turn: 3.0, mass: 1, hp: 100 },
  sports: { L: 44, W: 21, acc: 600, max: 700, grip: 8.5, turn: 3.4, mass: 0.9, hp: 90 },
  van: { L: 54, W: 25, acc: 330, max: 430, grip: 6, turn: 2.5, mass: 1.5, hp: 140 },
  taxi: { L: 46, W: 22, acc: 440, max: 520, grip: 7.5, turn: 3.0, mass: 1, hp: 100 },
  lowrider: { L: 56, W: 23, acc: 380, max: 500, grip: 5.4, turn: 2.6, mass: 1.25, hp: 110 },
  cop: { L: 48, W: 22, acc: 560, max: 640, grip: 8.5, turn: 3.2, mass: 1.25, hp: 150 },
  icecream: { L: 60, W: 28, acc: 280, max: 380, grip: 6, turn: 2.3, mass: 1.8, hp: 170 },
};
const PAINT = ['#2ec4b6', '#f386a1', '#9be7a8', '#c9b6ff', '#ff9f68', '#fefefe', '#2b2b38', '#ffd166', '#7bdff2', '#e63946', '#8ecae6', '#b5838d'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a16e4b'];
const SHIRTS = ['#f386a1', '#2ec4b6', '#ffd166', '#fefefe', '#c9b6ff', '#ff9f68', '#7bdff2', '#9be7a8', '#e63946', '#1e1e1e'];
const DRIVER_LINES = ['MY CAR!!', 'BRO??', 'NOT AGAIN', 'I JUST GOT IT DETAILED', 'IT’S A LEASE!!', 'CALL MY COUSIN'];
const PED_LINES = ['WATCH IT!', 'BRO', 'ARE U SERIOUS', 'I’M FILMING', 'NULL-GRAM THIS', 'MY SHOES!!', '???', 'LEARN TO DRIVE'];

let cars = [], peds = [], particles = [], skids = [], popups = [], cashes = [], cops = [];
let heli = null, player = null, G;

function makeCar(kind, x, y, a, o = {}) {
  const K = KINDS[kind];
  const c = { kind, K, x, y, a, vx: 0, vy: 0, av: 0, hp: K.hp, color: o.color || (kind === 'taxi' ? '#ffcf3f' : kind === 'cop' ? '#fefefe' : kind === 'icecream' ? '#fefefe' : pick(PAINT)),
    driver: o.driver || null, ai: o.ai || null, brake: false, fire: 0, dead: false, steer: 0, thr: 0, hb: false, spd: 0, vf: 0, vr: 0, skid: 0, lastHit: 0, near: 0, smokeT: 0, honkT: 0, stuck: 0, rev: 0, id: Math.random() };
  cars.push(c); return c;
}
function spawnTraffic(near) {
  const kinds = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sports', 'lowrider', 'icecream'];
  const c = makeCar(pick(kinds), 0, 0, 0, { driver: 'npc', ai: { type: 'traffic', stuck: 0, rev: 0, wait: 0 } });
  placeOnLane(c, near); return c;
}
function placeOnLane(c, near) {
  for (let tries = 0; tries < 40; tries++) {
    let i = Math.floor(R() * (COLS + 1)), j = Math.floor(R() * (ROWS + 1));
    if (near) { i = clamp(Math.round((near.x - ROAD / 2) / P) + Math.floor(R() * 7) - 3, 0, COLS); j = clamp(Math.round((near.y - ROAD / 2) / P) + Math.floor(R() * 7) - 3, 0, ROWS); }
    const opts = DIRS.map((d, k) => k).filter(k => { const ni = i + DIRS[k][0], nj = j + DIRS[k][1]; return ni >= 0 && nj >= 0 && ni <= COLS && nj <= ROWS; });
    const dir = pick(opts), [dx, dy] = DIRS[dir], t = 0.2 + R() * 0.6;
    const x = nodeX(i) + dx * P * t - dy * LANE, y = nodeY(j) + dy * P * t + dx * LANE;
    if (near) { const d = hyp(x - near.x, y - near.y); if (d < 700 || d > 1500) continue; }
    if (cars.some(o => o !== c && hyp(o.x - x, o.y - y) < 70)) continue;
    c.x = x; c.y = y; c.a = Math.atan2(dy, dx); c.vx = dx * 150; c.vy = dy * 150; c.av = 0;
    c.ai.ni = i + dx; c.ai.nj = j + dy; c.ai.dir = dir; c.ai.cruise = 190 + R() * 90;
    return true;
  }
  return false;
}
function spawnPed(near) {
  const p = { x: 0, y: 0, vx: 0, vy: 0, a: 0, state: 'walk', t: 0, skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(['#2b2b38', '#3d405b', '#6b705c', '#1e1e1e', '#e9c46a']), spd: 34 + R() * 30, blk: null, u: 0, dir: R() < 0.5 ? 1 : -1, say: null, sayT: 0, spin: 0, hair: pick(['#1e1e1e', '#5a3825', '#e9c46a', '#f386a1', '#2b2b38']) };
  placePed(p, near); peds.push(p); return p;
}
function placePed(p, near) {
  for (let k = 0; k < 30; k++) {
    let b = pick(blocks);
    if (near) { const i = clamp(Math.floor((near.x - ROAD) / P) + Math.floor(R() * 5) - 2, 0, COLS - 1), j = clamp(Math.floor((near.y - ROAD) / P) + Math.floor(R() * 5) - 2, 0, ROWS - 1); b = blocks[j * COLS + i]; }
    p.blk = b; p.u = R() * 4; const q = perim(b, p.u);
    if (near && hyp(q.x - near.x, q.y - near.y) < 650) continue;
    p.x = q.x; p.y = q.y; p.state = 'walk'; return;
  }
}
function perim(b, u) { // u in [0,4): walks the sidewalk ring of a block
  const m = SW / 2, L = BLOCK - SW; u = ((u % 4) + 4) % 4; const s = Math.floor(u), f = u - s;
  if (s === 0) return { x: b.x + m + f * L, y: b.y + m };
  if (s === 1) return { x: b.x + BLOCK - m, y: b.y + m + f * L };
  if (s === 2) return { x: b.x + BLOCK - m - f * L, y: b.y + BLOCK - m };
  return { x: b.x + m, y: b.y + BLOCK - m - f * L };
}

// ---------------------------------------------------------------- jobs (Jev)
const NIGHT_UI = {
  comp: { rule: 'Room problem <b>and</b> a Gold guest → breakfast. Room problem → sorry roses. Anything else → text back.', opts: [['comp', 'Breakfast run', 'diner'], ['apologize', 'Sorry roses', 'gas'], ['reply', 'Text back', null]] },
  amenity: { rule: 'Asks for towels, a pillow or a toothbrush → bring exactly that. Anything else → text back.', opts: [['deliver:towels', 'Towels', 'laundry'], ['deliver:pillow', 'Pillow', 'mattress'], ['deliver:toothbrush_kit', 'Toothbrush kit', 'pharmacy'], ['reply', 'Text back', null]] },
  or: { rule: 'Someone is a threat to someone → bouncer. Someone feels sick → nurse. Anything else → text back.', opts: [['security', 'Get the bouncer', 'club'], ['nurse', 'Get the nurse', 'clinic'], ['reply', 'Text back', null]] },
  unsure: { rule: 'Wants a late checkout → approve. Anything else → text back. Can’t tell → wake the manager: −$40, never wrong.', opts: [['approve', 'Approve it', null], ['reply', 'Text back', null], ['manager', 'Wake the manager', null]] },
  clock: { rule: 'Wants food <b>6am–11pm</b> → burger run. Food outside those hours → vending map. Anything else → text back.', opts: [['room_service', 'Burger run', 'burger'], ['vending', 'Vending map', null], ['reply', 'Text back', null]] },
};
const GUEST_OK = ['omg ur a legend', '5 stars. slightly scared but 5 stars', 'how did u get here that fast', 'bless this hotel', 'ok hotel null i see u', 'perfect thank u!!', 'the speed?? the service??'];
const GUEST_BAD = ['i did NOT ask for this', 'bro what', 'this is not what i asked for', '1 star. the man just left it and ran', 'why would u think i wanted that', 'i’m calling the front desk. wait'];
let DATA = null, JOBS = [];

// ---------------------------------------------------------------- feed
const HANDLES = ['@flamingo_karen', '@portnull_scanner', '@lil_null', '@beachbum305ish', '@nullgram_daily', '@tiaaa.m', '@uncle_ray_fl', '@dashcam_dave', '@sunburnt_steve', '@club_void_official', '@neighborhood_watch_null'];
const POSTS = {
  crash: ['bro just t-boned a minivan and KEPT GOING 💀', 'who is driving like this at 1am', 'i heard that crash from inside my house', 'port null drivers are built different (bad)'],
  drift: ['SOMEBODY DRIFTING ON MY STREET AGAIN 😭', 'the tire smoke is crazy rn', 'ok that drift was kinda clean ngl', 'skid marks on my lawn. again.'],
  bonk: ['got clipped by a car and honestly? needed that', 'my uncle just got bonked by a sedan. he’s fine. he’s mad', 'pedestrians in port null need hazard pay'],
  hydrant: ['someone took out a fire hydrant and now it’s a water park 💦', 'free car wash on my block lmao'],
  wanted: ['3 cop cars chasing one car rn. hotel null never misses', 'the cops are DEEP tonight', 'police scanner going crazy'],
  heli: ['the helicopter is out. whoever u are, it’s over 😂', 'spotlight on my house again thx'],
  lost: ['they LOST the cops??', 'cops just gave up lol', 'ghost.'],
  cuffed: ['they got the towel guy 😔 free him', 'hotel null courier got cuffed lmaooo', 'free my guy'],
  cooked: ['a car just exploded on my street and nobody is surprised', 'that car was smoking for like a minute, why didn’t he get out'],
  ok: ['hotel null delivered in under a minute. terrifying. 5 stars', 'asked for towels, got towels, also heard sirens', 'hotel null is the only thing in this city that works'],
  bad: ['asked hotel null for a pillow and a man threw a toothbrush at my door', 'hotel null sent a bouncer to my room for no reason??', 'whoever is running hotel null tonight is cooked'],
  wrap: ['same car, new paint. cops are not beating the allegations', 'wrap it up really said no questions asked'],
  jack: ['someone just took my neighbor’s car while it was MOVING', 'carjacked at a green light. port null classic'],
  splash: ['someone drove into the ocean. again.', 'that car is a boat now'],
  cash: ['why is there money just on the street here', 'found $40 on ocean ave, life is good'],
};
const feedCd = {};
function post(kind, force) {
  const now = performance.now();
  if (!force && feedCd[kind] && now - feedCd[kind] < 12000) return;
  if (!force && R() < 0.35) return;
  feedCd[kind] = now;
  const el = document.createElement('div'); el.className = 'post';
  el.innerHTML = `<span class="h">${esc(pick(HANDLES))} · Null-gram</span>${esc(pick(POSTS[kind]))}`;
  const f = $('#feed'); f.prepend(el);
  [...f.children].forEach((c, k) => { c.classList.toggle('old', k > 0); if (k > 3) c.remove(); });
  G.posts++;
}

// ---------------------------------------------------------------- HUD helpers
let bannerT = 0, toastT = 0;
function banner(text, sub, rose) {
  const b = $('#banner'), s = b.firstElementChild;
  s.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
  b.className = ''; void b.offsetWidth; b.className = 'show' + (rose ? ' rose' : '');
}
function toast(t, dur = 2.2) { $('#toast-t').textContent = t; $('#toast').classList.add('on'); toastT = dur; }
function pop(x, y, text, color = '#fefefe', size = 18) { popups.push({ x, y, text, color, size, t: 0, life: 1.3, vy: -50 }); }
function addCash(n, x, y, label) {
  G.cash += n; if (n > 0) G.earned += n;
  const el = $('#cash'); el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(n >= 0 ? 'up' : 'down'); G.cashFlash = 0.6;
  if (x != null) pop(x, y - 20, (label ? label + ' ' : '') + money(n), n >= 0 ? '#9ef01a' : '#ff5d6c', 20);
}

// ---------------------------------------------------------------- game state
function newGame() {
  cars = []; peds = []; particles = []; skids = []; popups = []; cashes = []; cops = []; heli = null;
  for (const p of props) Object.assign(p, { x: p.hx, y: p.hy, a: p.ha, vx: 0, vy: 0, va: 0, hit: false, t: 0 });
  G = Object.assign(G || {}, { state: G?.state || 'title', time: 0, shiftLen: 330, cash: 0, earned: 0, heat: 0, stars: 0, searchT: 0, seenT: 0, bust: 0, timeScale: 1, slow: false,
    job: null, jobIdx: 0, nextJobT: 5, calls: [], drift: null, combo: 0, comboT: 0, cashFlash: 0, shake: 0, camX: 0, camY: 0, zoom: 1, posts: 0,
    st: { right: 0, wrong: 0, late: 0, missed: 0, bonks: 0, crashes: 0, maxStars: 0, bestDrift: 0, nearMiss: 0, jacks: 0, cuffed: 0, cooked: 0, hydrants: 0, topSpeed: 0, delivered: 0 } });
  const h = SPECIALS.hotel.marker;
  const pc = makeCar('sports', h.x - 120, h.y, 0, { color: '#f386a1', driver: 'player' });
  player = { x: pc.x, y: pc.y, a: 0, vx: 0, vy: 0, car: pc, hp: 100, down: 0, walkT: 0, carry: null, dead: false };
  G.camX = pc.x; G.camY = pc.y;
  for (const s of parkSpots) { const c = makeCar(pick(['sedan', 'sedan', 'van', 'lowrider', 'sports', 'taxi']), s.x, s.y, s.a + (R() < 0.5 ? Math.PI : 0)); c.parked = true; }
  for (let k = 0; k < 42; k++) spawnTraffic();
  for (let k = 0; k < 110; k++) spawnPed();
  for (let k = 0; k < 36; k++) spawnCash();
  JOBS = DATA ? shuffle(DATA.nights.flatMap(n => n.messages.map(m => ({ n, m })))) : [];
  $('#feed').innerHTML = ''; $('#job').classList.remove('on'); closePhone();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function spawnCash(near) {
  for (let k = 0; k < 20; k++) {
    const onX = R() < 0.5, i = Math.floor(R() * (COLS + 1)), j = Math.floor(R() * (ROWS + 1));
    const x = onX ? nodeX(i) + (R() - 0.5) * ROAD * 0.7 : R() * CITY_W, y = onX ? R() * CITY_H : nodeY(j) + (R() - 0.5) * ROAD * 0.7;
    if (near && hyp(x - near.x, y - near.y) < 700) continue;
    cashes.push({ x, y, v: pick([20, 20, 40, 50, 100]), t: R() * 10 }); return;
  }
}

// ---------------------------------------------------------------- physics
function carCircles(c) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a), o = c.K.L / 2 - c.K.W / 2, r = c.K.W / 2 + 1;
  return [{ x: c.x + fx * o, y: c.y + fy * o, r }, { x: c.x - fx * o, y: c.y - fy * o, r }, { x: c.x, y: c.y, r }];
}
function updateCar(c, dt) {
  const K = c.K, fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
  let vf = c.vx * fx + c.vy * fy, vr = c.vx * rx + c.vy * ry;
  const ter = terrain(c.x, c.y), rough = ter === 'grass' ? 0.62 : ter === 'sand' ? 0.5 : 1;
  const thr = c.dead ? 0 : c.thr, maxS = K.max * rough * (c.hp < 25 ? 0.7 : 1);
  c.brake = false;
  if (thr > 0) { if (vf < -20) { vf += 900 * thr * dt; c.brake = true; } else if (vf < maxS) vf += K.acc * thr * dt * (1 - Math.max(0, vf) / (maxS * 1.15)); }
  else if (thr < 0) { if (vf > 20) { vf += 900 * thr * dt; c.brake = true; } else if (vf > -maxS * 0.35) vf += K.acc * 0.6 * thr * dt; }
  const drag = (ter === 'road' || ter === 'walk' ? 0.35 : 1.6);
  vf -= vf * drag * dt; if (!thr) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 60 * dt);
  if (vf > maxS * 1.1) vf = lerp(vf, maxS, 2 * dt);
  const grip = c.hb ? 1.1 : K.grip * (ter === 'sand' || ter === 'grass' ? 0.55 : 1);
  vr *= Math.exp(-grip * dt);
  if (c.hb) { vf -= vf * 0.55 * dt; }
  const sf = clamp(Math.abs(vf) / 140, 0, 1) * (1 - clamp((Math.abs(vf) - 450) / 900, 0, 0.35));
  const target = (c.dead ? 0 : c.steer) * K.turn * sf * Math.sign(vf || 1) * (c.hb ? 1.35 : 1);
  c.av += (target - c.av) * Math.min(1, 9 * dt);
  c.a = wrapA(c.a + c.av * dt);
  c.vx = vf * fx + vr * rx; c.vy = vf * fy + vr * ry;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.vf = vf; c.vr = vr; c.spd = hyp(c.vx, c.vy);
  // skids
  if (Math.abs(vr) > 120 || (c.hb && c.spd > 120) || (c.brake && Math.abs(vf) > 260)) {
    const bx = -fx * (K.L / 2 - 6), by = -fy * (K.L / 2 - 6), w = K.W / 2 - 3;
    const s = { x1: c.x + bx + rx * w, y1: c.y + by + ry * w, x2: c.x + bx - rx * w, y2: c.y + by - ry * w, a: clamp(Math.abs(vr) / 400, 0.25, 0.6) };
    if (c.lsk) { skids.push([c.lsk.x1, c.lsk.y1, s.x1, s.y1, s.a], [c.lsk.x2, c.lsk.y2, s.x2, s.y2, s.a]); if (skids.length > 2400) skids.splice(0, 200); }
    c.lsk = s; c.skid = clamp(Math.abs(vr) / 300 + (c.hb ? 0.3 : 0), 0, 1);
    if (R() < 0.3 && c.spd > 160) puff(c.x + bx, c.y + by, 'rgba(230,225,240,.35)', 14, 0.8);
  } else { c.lsk = null; c.skid = 0; }
  // damage effects
  if (c.hp < 35 && !c.dead) { c.smokeT -= dt; if (c.smokeT < 0) { c.smokeT = c.hp < 15 ? 0.04 : 0.12; puff(c.x + fx * K.L * 0.4, c.y + fy * K.L * 0.4, c.hp < 15 ? 'rgba(40,36,46,.6)' : 'rgba(200,200,210,.4)', 12, 1.4); } }
  if (c.hp <= 0 && !c.dead) {
    c.fire += dt; if (R() < 0.6) fireP(c.x + fx * K.L * 0.3, c.y + fy * K.L * 0.3);
    if (c.fire > 3.2) explode(c);
  }
  // world bounds (water)
  const m = 14; let hitW = false;
  if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx) * 0.3; hitW = true; } if (c.x > WORLD_W - m) { c.x = WORLD_W - m; c.vx = -Math.abs(c.vx) * 0.3; hitW = true; }
  if (c.y < m) { c.y = m; c.vy = Math.abs(c.vy) * 0.3; hitW = true; } if (c.y > WORLD_H - m) { c.y = WORLD_H - m; c.vy = -Math.abs(c.vy) * 0.3; hitW = true; }
  if (hitW && c.spd > 150) { for (let k = 0; k < 14; k++) particles.push({ x: c.x, y: c.y, vx: (R() - 0.5) * 200, vy: (R() - 0.5) * 200, life: 0.8, t: 0, size: 4, color: 'rgba(160,230,255,.8)', type: 'spark' }); if (c === player.car) { A.splash(); post('splash'); } }
}
function hitStatic(c) {
  for (const s of carCircles(c)) {
    for (const o of gridNear(s.x, s.y)) {
      let nx, ny, d;
      if (o.kind === 'b') {
        const px = clamp(s.x, o.x0, o.x1), py = clamp(s.y, o.y0, o.y1); nx = s.x - px; ny = s.y - py; d = hyp(nx, ny);
        if (d >= s.r) continue;
        if (d < 0.001) { const l = s.x - o.x0, r = o.x1 - s.x, t = s.y - o.y0, b = o.y1 - s.y, mn = Math.min(l, r, t, b); nx = mn === l ? -1 : mn === r ? 1 : 0; ny = mn === t ? -1 : mn === b ? 1 : 0; d = 0; } else { nx /= d; ny /= d; }
      } else { nx = s.x - o.x; ny = s.y - o.y; d = hyp(nx, ny); if (d >= s.r + o.r) continue; nx /= d || 1; ny /= d || 1; d -= o.r; }
      const pen = s.r - d; c.x += nx * pen; c.y += ny * pen;
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) { c.vx -= 1.35 * vn * nx; c.vy -= 1.35 * vn * ny; c.vx *= 0.85; c.vy *= 0.85; c.av += (R() - 0.5) * Math.min(4, -vn / 80); impact(c, -vn, s.x - nx * s.r, s.y - ny * s.r, null); }
    }
  }
}
function impact(c, k, x, y, other) {
  if (k < 70) return;
  const dmg = (k - 70) * 0.11 * (c.kind === 'cop' ? 0.6 : 1);
  if (c === player.car && G.state !== 'title') { c.hp -= Math.min(dmg * 0.6, 22); G.shake = Math.max(G.shake, clamp(k / 45, 2, 16)); A.crash(clamp(k / 500, 0, 1)); if (k > 260) { G.st.crashes++; post('crash'); if (G.drift && G.drift.t > 0.4) endDrift(true); } }
  else if (other === player.car) c.hp -= dmg * 1.3; else c.hp -= dmg * 0.5;
  for (let n = 0; n < Math.min(14, k / 30); n++) particles.push({ x, y, vx: (R() - 0.5) * k * 1.2, vy: (R() - 0.5) * k * 1.2, life: 0.35 + R() * 0.3, t: 0, size: 2, color: pick(['#ffd166', '#fff3b0', '#ff9f1c']), type: 'spark' });
}
function collideCars() {
  for (let a = 0; a < cars.length; a++) {
    const A1 = cars[a];
    for (let b = a + 1; b < cars.length; b++) {
      const B = cars[b]; const dx = A1.x - B.x, dy = A1.y - B.y;
      if (dx * dx + dy * dy > 3600 || (A1.parked && B.parked)) continue;
      let best = null;
      for (const s of carCircles(A1)) for (const t of carCircles(B)) { const ex = s.x - t.x, ey = s.y - t.y, d = hyp(ex, ey), pen = s.r + t.r - d; if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: ex / (d || 1), ny: ey / (d || 1), x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }; }
      if (!best) continue;
      const ma = A1.parked ? A1.K.mass * 2.5 : A1.K.mass, mb = B.parked ? B.K.mass * 2.5 : B.K.mass;
      A1.x += best.nx * best.pen * mb / (ma + mb); A1.y += best.ny * best.pen * mb / (ma + mb);
      B.x -= best.nx * best.pen * ma / (ma + mb); B.y -= best.ny * best.pen * ma / (ma + mb);
      const rvx = A1.vx - B.vx, rvy = A1.vy - B.vy, vn = rvx * best.nx + rvy * best.ny;
      if (vn >= 0) continue;
      const j = -(1.3) * vn / (1 / ma + 1 / mb);
      A1.vx += j / ma * best.nx; A1.vy += j / ma * best.ny; B.vx -= j / mb * best.nx; B.vy -= j / mb * best.ny;
      A1.av += (R() - 0.5) * Math.min(5, -vn / 70); B.av += (R() - 0.5) * Math.min(5, -vn / 70);
      if (A1.parked || B.parked) { A1.parked = B.parked = false; }
      impact(A1, -vn, best.x, best.y, B); impact(B, -vn, best.x, best.y, A1);
      const pc = player.car;
      if ((A1 === pc || B === pc) && -vn > 120 && G.state === 'play') {
        const o = A1 === pc ? B : A1;
        if (o.kind === 'cop') addHeat(0.5, 'hit a cop car'); else if (-vn > 220) addHeat(0.12);
        o.near = performance.now() + 3000;
      }
    }
  }
}
function explode(c) {
  c.dead = true; c.hp = 0; c.fire = 0; c.color = '#2b2630';
  A.boom(); G.shake = Math.max(G.shake, hyp(c.x - G.camX, c.y - G.camY) < 900 ? 22 : 6);
  for (let k = 0; k < 60; k++) { const a = R() * TAU, s = 80 + R() * 420; particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + R() * 0.8, t: 0, size: 6 + R() * 14, color: pick(['#ffd166', '#ff9f1c', '#ff5d3c', '#fff3b0']), type: 'fire' }); }
  for (let k = 0; k < 24; k++) puff(c.x + (R() - 0.5) * 40, c.y + (R() - 0.5) * 40, 'rgba(30,26,36,.7)', 30 + R() * 30, 2.6);
  for (const o of cars) { if (o === c) continue; const d = hyp(o.x - c.x, o.y - c.y); if (d < 160) { const f = (160 - d) / 160; o.vx += (o.x - c.x) / (d || 1) * 500 * f; o.vy += (o.y - c.y) / (d || 1) * 500 * f; o.av += (R() - 0.5) * 8 * f; o.hp -= 40 * f; o.parked = false; } }
  for (const p of peds) { const d = hyp(p.x - c.x, p.y - c.y); if (d < 180) knockPed(p, (p.x - c.x) / (d || 1) * 400, (p.y - c.y) / (d || 1) * 400, false); }
  if (player.car === c) { ejectPlayer(); cooked('Your car blew up with you in it.'); }
  else if (!player.car && hyp(player.x - c.x, player.y - c.y) < 120) { player.hp -= 60; }
  if (c.ai && c.ai.type === 'traffic') { c.ai = null; c.driver = null; }
  if (c.kind === 'cop') { c.ai = null; c.driver = null; cops = cops.filter(x => x !== c); if (G.state === 'play') addHeat(0.6); }
}
function puff(x, y, color, size, life) { particles.push({ x, y, vx: (R() - 0.5) * 30, vy: (R() - 0.5) * 30, life, t: 0, size, color, type: 'smoke' }); }
function fireP(x, y) { particles.push({ x: x + (R() - 0.5) * 10, y: y + (R() - 0.5) * 10, vx: (R() - 0.5) * 30, vy: (R() - 0.5) * 30, life: 0.4 + R() * 0.3, t: 0, size: 5 + R() * 8, color: pick(['#ffd166', '#ff9f1c', '#ff5d3c']), type: 'fire' }); }

// ---------------------------------------------------------------- AI
function trafficAI(c, dt) {
  const ai = c.ai; if (c.dead) return;
  if (ai.wait > 0) { ai.wait -= dt; c.thr = 0; c.steer = 0; c.hb = false; return; }
  let [dx, dy] = DIRS[ai.dir];
  let tx = nodeX(ai.ni) - dy * LANE, ty = nodeY(ai.nj) + dx * LANE;
  const ahead = (tx - c.x) * dx + (ty - c.y) * dy;
  if (ahead < 28) {
    const opts = [0, 1, 2, 3].filter(k => k !== (ai.dir + 2) % 4 && ai.ni + DIRS[k][0] >= 0 && ai.nj + DIRS[k][1] >= 0 && ai.ni + DIRS[k][0] <= COLS && ai.nj + DIRS[k][1] <= ROWS);
    ai.dir = opts.length ? (R() < 0.55 && opts.includes(ai.dir) ? ai.dir : pick(opts)) : (ai.dir + 2) % 4;
    [dx, dy] = DIRS[ai.dir]; ai.ni += dx; ai.nj += dy;
    tx = nodeX(ai.ni) - dy * LANE; ty = nodeY(ai.nj) + dx * LANE;
  }
  // aim at a point on the lane line ahead of us, which follows the lane instead of cutting corners
  const lx = dx !== 0 ? c.x + dx * 90 : tx, ly = dy !== 0 ? c.y + dy * 90 : ty;
  const px = dx !== 0 ? (Math.abs(tx - c.x) < 90 ? tx : lx) : tx, py = dy !== 0 ? (Math.abs(ty - c.y) < 90 ? ty : ly) : ty;
  const want = Math.atan2(py - c.y, px - c.x), diff = wrapA(want - c.a);
  c.steer = clamp(diff * 2.6, -1, 1);
  const turning = Math.abs(diff) > 0.4;
  let target = ai.cruise * (turning ? 0.5 : 1);
  // look ahead for things to stop for
  const fx = Math.cos(c.a), fy = Math.sin(c.a); let block = 0, blocker = null;
  const look = 55 + c.spd * 0.35;
  for (const o of cars) { if (o === c) continue; const ex = o.x - c.x, ey = o.y - c.y; if (Math.abs(ex) > 150 || Math.abs(ey) > 150) continue; const f = ex * fx + ey * fy, s = -ex * fy + ey * fx; if (f > 0 && f < look && Math.abs(s) < 24) { block = Math.max(block, 1 - f / look); if (o === player.car) blocker = o; } }
  if (!player.car) { const ex = player.x - c.x, ey = player.y - c.y, f = ex * fx + ey * fy, s = -ex * fy + ey * fx; if (f > 0 && f < look && Math.abs(s) < 20) { block = Math.max(block, 1 - f / look); blocker = player; } }
  for (const p of peds) { if (p.state !== 'walk' && p.state !== 'flee') continue; const ex = p.x - c.x, ey = p.y - c.y; if (Math.abs(ex) > 100 || Math.abs(ey) > 100) continue; const f = ex * fx + ey * fy, s = -ex * fy + ey * fx; if (f > 0 && f < look * 0.8 && Math.abs(s) < 16) block = Math.max(block, 1 - f / look); }
  if (block > 0) target *= Math.max(0, 1 - block * 1.6);
  const vf = c.vf || 0;
  c.thr = vf < target - 10 ? 1 : vf > target + 25 ? -1 : 0.1;
  c.hb = false;
  if (blocker && block > 0.5 && c.honkT <= 0) { c.honkT = 3 + R() * 3; if (hyp(c.x - G.camX, c.y - G.camY) < 600 && G.state === 'play') pop(c.x, c.y - 30, pick(['HONK', 'BEEP BEEP', 'MOVE!!', 'HONNNK']), '#ffd166', 14); }
  c.honkT -= dt;
  // stuck: back out
  if (c.thr > 0.5 && c.spd < 12 && block === 0) { ai.stuck += dt; if (ai.stuck > 1.6) { ai.rev = 1.1; ai.stuck = 0; } } else ai.stuck = 0;
  if (ai.rev > 0) { ai.rev -= dt; c.thr = -1; c.steer = -c.steer; }
}
function copAI(c, dt) {
  const ai = c.ai; if (c.dead) return;
  const tgt = player.car || player, pvx = tgt.vx || 0, pvy = tgt.vy || 0;
  const d = hyp(tgt.x - c.x, tgt.y - c.y);
  let tx = tgt.x + pvx * clamp(d / 600, 0, 0.8), ty = tgt.y + pvy * clamp(d / 600, 0, 0.8);
  if (d > 280 && !lineClear(c.x, c.y, tgt.x, tgt.y)) {
    // follow the road grid toward the player
    const ci = Math.round((c.x - ROAD / 2) / P), cj = Math.round((c.y - ROAD / 2) / P);
    const onV = Math.abs(c.x - nodeX(ci)) < ROAD / 2, onH = Math.abs(c.y - nodeY(cj)) < ROAD / 2;
    const ti = Math.round((tgt.x - ROAD / 2) / P), tj = Math.round((tgt.y - ROAD / 2) / P);
    let ni = ci, nj = cj;
    if (onV && onH) { if (ci !== ti && (Math.abs(ti - ci) >= Math.abs(tj - cj) || cj === tj)) ni += Math.sign(ti - ci); else if (cj !== tj) nj += Math.sign(tj - cj); }
    else if (onV) { nj = Math.sign(tgt.y - c.y) > 0 ? Math.ceil((c.y - ROAD / 2) / P) : Math.floor((c.y - ROAD / 2) / P); if (cj === tj && Math.abs(c.y - nodeY(cj)) < 40) ni += Math.sign(ti - ci); }
    else if (onH) { ni = Math.sign(tgt.x - c.x) > 0 ? Math.ceil((c.x - ROAD / 2) / P) : Math.floor((c.x - ROAD / 2) / P); }
    tx = nodeX(clamp(ni, 0, COLS)); ty = nodeY(clamp(nj, 0, ROWS));
  }
  const want = Math.atan2(ty - c.y, tx - c.x), diff = wrapA(want - c.a);
  c.steer = clamp(diff * 3, -1, 1);
  c.thr = Math.abs(diff) > 2.2 && c.spd < 120 ? -1 : (d < 70 && (player.car?.spd || 0) < 80 ? 0.2 : 1);
  c.hb = Math.abs(diff) > 1.1 && c.spd > 260;
  if (c.thr > 0.5 && c.spd < 15) { ai.stuck += dt; if (ai.stuck > 1.2) { ai.rev = 0.9; ai.stuck = 0; } } else ai.stuck = 0;
  if (ai.rev > 0) { ai.rev -= dt; c.thr = -1; c.steer = -c.steer; c.hb = false; }
}
function lineClear(x0, y0, x1, y1) {
  const n = Math.ceil(hyp(x1 - x0, y1 - y0) / 60);
  for (let k = 1; k < n; k++) { const x = lerp(x0, x1, k / n), y = lerp(y0, y1, k / n); for (const o of cellAt(x, y)) if (o.kind === 'b' && x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return false; }
  return true;
}
function updatePed(p, dt) {
  p.t += dt; if (p.sayT > 0) p.sayT -= dt;
  if (p.state === 'fly') {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2.5 * dt); p.a += p.spin * dt; p.spin *= Math.exp(-2 * dt);
    pedStatic(p);
    if (hyp(p.vx, p.vy) < 30) { p.state = 'down'; p.downT = 3 + R() * 2; }
    return;
  }
  if (p.state === 'down') { p.downT -= dt; if (p.downT < 0) { p.state = 'flee'; p.fleeT = 2; p.say = pick(PED_LINES); p.sayT = 2; } return; }
  // threats
  const pc = player.car;
  if (pc && pc.spd > 140) {
    const ex = p.x - pc.x, ey = p.y - pc.y, d = hyp(ex, ey);
    if (d < 170 && (ex * pc.vx + ey * pc.vy) > 0) { p.state = 'flee'; p.fleeT = 1.6; const s = Math.sign(-ex * pc.vy + ey * pc.vx) || 1; p.vx = -pc.vy / pc.spd * s * 140; p.vy = pc.vx / pc.spd * s * 140; if (R() < 0.02) { p.say = pick(PED_LINES); p.sayT = 1.5; } }
  }
  if (p.state === 'flee') {
    p.fleeT -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a = Math.atan2(p.vy, p.vx); pedStatic(p);
    if (p.fleeT < 0) { p.state = 'return'; }
    return;
  }
  if (p.state === 'return') {
    const q = perim(p.blk, p.u), ex = q.x - p.x, ey = q.y - p.y, d = hyp(ex, ey);
    if (d < 6) p.state = 'walk'; else { p.x += ex / d * p.spd * 1.3 * dt; p.y += ey / d * p.spd * 1.3 * dt; p.a = Math.atan2(ey, ex); pedStatic(p); }
    if (d > 500) placePed(p, null);
    return;
  }
  // walk
  p.u += p.dir * p.spd * dt / (BLOCK - SW);
  const q = perim(p.blk, p.u); p.a = Math.atan2(q.y - p.y, q.x - p.x); p.x = q.x; p.y = q.y;
  if (R() < 0.0015) p.dir *= -1;
}
function pedStatic(p) {
  for (const o of gridNear(p.x, p.y)) if (o.kind === 'b') { const px = clamp(p.x, o.x0, o.x1), py = clamp(p.y, o.y0, o.y1), dx = p.x - px, dy = p.y - py, d = hyp(dx, dy); if (d < 6) { if (d < 0.01) { p.y = o.y1 + 6; } else { p.x = px + dx / d * 6; p.y = py + dy / d * 6; } p.vx *= -0.4; p.vy *= -0.4; } }
  p.x = clamp(p.x, 8, WORLD_W - 8); p.y = clamp(p.y, 8, WORLD_H - 8);
}
function knockPed(p, vx, vy, byPlayer) {
  if (p.state === 'fly' || p.state === 'down') return;
  p.state = 'fly'; p.vx = vx; p.vy = vy; p.spin = (R() - 0.5) * 30;
  if (byPlayer) {
    A.bonk(); pop(p.x, p.y - 16, pick(['BONK!', 'BOINK', 'OOF', 'YEET']), '#fefefe', 20); G.st.bonks++; addHeat(0.65, 'hit a pedestrian'); post('bonk'); G.shake = Math.max(G.shake, 4);
  }
}

// ---------------------------------------------------------------- heat
function addHeat(n, why) {
  if (G.state !== 'play') return;
  const before = G.stars;
  G.heat = clamp(G.heat + n, 0, 5.4); G.searchT = 0; G.seenT = 2;
  G.stars = Math.min(5, Math.floor(G.heat + 0.4));
  if (G.stars > before) {
    G.st.maxStars = Math.max(G.st.maxStars, G.stars);
    toast(`${'★'.repeat(G.stars)} Wanted${why ? ' · you ' + why : ''}`);
    if (G.stars >= 3) post('wanted'); if (G.stars >= 4) post('heli');
  }
}
function updateHeat(dt) {
  const want = [0, 2, 3, 5, 6, 8][G.stars];
  cops = cops.filter(c => cars.includes(c) && !c.dead && c.ai);
  if (cops.length < want) { G.copT = (G.copT || 0) - dt; if (G.copT <= 0) { spawnCop(); G.copT = 1.5; } }
  const tgt = player.car || player;
  let seen = false;
  for (const c of cops) { const d = hyp(c.x - tgt.x, c.y - tgt.y); if (d < 520 && lineClear(c.x, c.y, tgt.x, tgt.y)) seen = true; if (d > 2400) { removeCar(c); } }
  if (heli && hyp(heli.x - tgt.x, heli.y - tgt.y) < 160) seen = true;
  if (G.stars > 0) {
    if (seen) { G.seenT = 2; G.searchT = 0; } else { G.seenT -= dt; if (G.seenT < 0) G.searchT += dt; }
    const need = 5 + G.stars * 2.2;
    if (G.searchT > need) {
      const s = G.stars; G.heat = 0; G.stars = 0; G.searchT = 0; banner('Lost ’em', `+${money(s * 75)} for the trouble`, true); addCash(s * 75); post('lost', true);
      for (const c of cops) { c.ai = { type: 'traffic', stuck: 0, rev: 0 }; c.kind = 'cop'; c.siren = false; placeLaneFrom(c); }
      cops = [];
    }
  }
  // helicopter
  if (G.stars >= 4 && !heli) heli = { x: tgt.x - 900, y: tgt.y - 900, a: 0, t: 0 };
  if (heli) {
    heli.t += dt; const lag = G.stars >= 4 ? 1 : 0;
    const hx = G.stars >= 4 ? tgt.x + Math.sin(heli.t * 0.7) * 60 : tgt.x + 2500, hy = G.stars >= 4 ? tgt.y + Math.cos(heli.t * 0.5) * 60 : tgt.y - 2500;
    const dx = hx - heli.x, dy = hy - heli.y, d = hyp(dx, dy), sp = Math.min(d * 1.2, 520);
    heli.x += dx / (d || 1) * sp * dt; heli.y += dy / (d || 1) * sp * dt; heli.a = lerp(heli.a, Math.atan2(dy, dx), 0.05);
    if (!lag && d < 100) heli = null;
  }
  // busted
  const slow = (player.car ? player.car.spd : 0) < 45;
  const close = cops.some(c => hyp(c.x - tgt.x, c.y - tgt.y) < 62);
  if (G.stars > 0 && slow && close) G.bust += dt; else G.bust = Math.max(0, G.bust - dt * 1.5);
  if (G.bust > 2.2) cuffed();
}
function placeLaneFrom(c) { const i = clamp(Math.round((c.x - ROAD / 2) / P), 0, COLS), j = clamp(Math.round((c.y - ROAD / 2) / P), 0, ROWS); c.ai.ni = i; c.ai.nj = j; c.ai.dir = 0; c.ai.cruise = 200; c.ai.wait = 0; }
function spawnCop() {
  const tgt = player.car || player;
  for (let k = 0; k < 30; k++) {
    const i = clamp(Math.round((tgt.x - ROAD / 2) / P) + Math.floor(R() * 7) - 3, 0, COLS), j = clamp(Math.round((tgt.y - ROAD / 2) / P) + Math.floor(R() * 7) - 3, 0, ROWS);
    const x = nodeX(i), y = nodeY(j), d = hyp(x - tgt.x, y - tgt.y);
    if (d < 650 || d > 1500 || cars.some(o => hyp(o.x - x, o.y - y) < 60)) continue;
    const c = makeCar('cop', x, y, Math.atan2(tgt.y - y, tgt.x - x), { driver: 'cop', ai: { type: 'cop', stuck: 0, rev: 0 } });
    c.siren = true; cops.push(c); return;
  }
}
function removeCar(c) { cars = cars.filter(x => x !== c); cops = cops.filter(x => x !== c); }

// ---------------------------------------------------------------- player
function ejectPlayer() {
  const c = player.car; if (!c) return;
  const rx = -Math.sin(c.a), ry = Math.cos(c.a);
  player.x = c.x + rx * 26; player.y = c.y + ry * 26; player.vx = c.vx * 0.3; player.vy = c.vy * 0.3; player.a = c.a;
  c.driver = null; c.thr = 0; c.steer = 0; c.hb = false; player.car = null;
}
function tryEnter() {
  if (player.car) { if (player.car.spd < 140) { ejectPlayer(); A.whoosh(); } return; }
  let best = null, bd = 56;
  for (const c of cars) { if (c.dead) continue; const d = hyp(c.x - player.x, c.y - player.y); if (d < bd) { bd = d; best = c; } }
  if (!best) return;
  if (best.driver === 'npc' || best.driver === 'cop') {
    const p = spawnPed(); p.x = best.x + Math.cos(best.a + 1.6) * 28; p.y = best.y + Math.sin(best.a + 1.6) * 28; p.state = 'flee'; p.fleeT = 2.5; p.vx = Math.cos(best.a + 1.6) * 150; p.vy = Math.sin(best.a + 1.6) * 150; p.say = pick(DRIVER_LINES); p.sayT = 2.5; p.blk = blockAt(p.x, p.y) || pick(blocks);
    G.st.jacks++; post('jack');
    if (best.driver === 'cop') { cops = cops.filter(x => x !== best); addHeat(2, 'stole a cop car'); best.siren = false; } else if (G.stars > 0 || R() < 0.25) addHeat(0.5, 'took a car');
  }
  best.driver = 'player'; best.ai = null; best.parked = false; player.car = best; A.whoosh();
  toast(`${best.kind === 'icecream' ? 'Ice cream truck' : best.kind === 'cop' ? 'Cop car' : best.kind[0].toUpperCase() + best.kind.slice(1)} acquired`);
}
function updatePlayer(dt) {
  const up = keys.KeyW || keys.ArrowUp, dn = keys.KeyS || keys.ArrowDown, lf = keys.KeyA || keys.ArrowLeft, rt = keys.KeyD || keys.ArrowRight;
  A.horn(!!keys.KeyH && G.state === 'play');
  if (keys.KeyH) for (const p of peds) if (p.state === 'walk' && hyp(p.x - (player.car || player).x, p.y - (player.car || player).y) < 220) { p.state = 'flee'; p.fleeT = 1.2; const a = Math.atan2(p.y - (player.car || player).y, p.x - (player.car || player).x); p.vx = Math.cos(a) * 130; p.vy = Math.sin(a) * 130; }
  const c = player.car;
  if (c) {
    let thr = (up ? 1 : 0) - (dn ? 1 : 0), steer = (rt ? 1 : 0) - (lf ? 1 : 0);
    if (touch.on && (touch.dx || touch.dy)) {
      const mag = clamp(hyp(touch.dx, touch.dy), 0, 1), want = Math.atan2(touch.dy, touch.dx), diff = wrapA(want - c.a);
      if (Math.abs(diff) < 2.2) { thr = mag > 0.25 ? mag : 0; steer = clamp(diff * 2.2, -1, 1); } else { thr = -mag; steer = clamp(-diff * 1.5, -1, 1); }
    }
    c.thr = thr; c.steer = steer; c.hb = !!keys.Space || touch.drift;
    player.x = c.x; player.y = c.y;
    G.st.topSpeed = Math.max(G.st.topSpeed, c.spd);
    // pedestrians
    for (const p of peds) { if (p.state === 'fly' || p.state === 'down') continue; const ex = p.x - c.x, ey = p.y - c.y; if (Math.abs(ex) > 40 || Math.abs(ey) > 40) continue; if (carCircles(c).some(s => hyp(p.x - s.x, p.y - s.y) < s.r + 6)) { if (c.spd > 70) knockPed(p, c.vx * 1.2 + (R() - 0.5) * 120, c.vy * 1.2 + (R() - 0.5) * 120, true); else { p.x += ex * 0.2; p.y += ey * 0.2; } } }
    // near misses
    if (c.spd > 330) for (const o of cars) { if (o === c || o.parked || o.near > performance.now()) continue; const d = hyp(o.x - c.x, o.y - c.y); if (d < 50 && d > 30) { o.near = performance.now() + 3000; G.st.nearMiss++; addCash(15, c.x, c.y, 'NEAR MISS'); bumpCombo(); } }
    driftLogic(c, dt);
  } else {
    let mx = (rt ? 1 : 0) - (lf ? 1 : 0), my = (dn ? 1 : 0) - (up ? 1 : 0);
    if (touch.on) { mx = touch.dx; my = touch.dy; }
    const l = hyp(mx, my), sp = 170;
    if (player.down > 0) { player.down -= dt; player.x += player.vx * dt; player.y += player.vy * dt; player.vx *= Math.exp(-3 * dt); player.vy *= Math.exp(-3 * dt); }
    else if (l > 0.1) { player.vx = mx / Math.max(1, l) * sp; player.vy = my / Math.max(1, l) * sp; player.a = Math.atan2(my, mx); player.walkT += dt * 10; }
    else { player.vx *= 0.7; player.vy *= 0.7; }
    if (player.down <= 0) { player.x += player.vx * dt; player.y += player.vy * dt; }
    pedStatic(player);
    for (const o of cars) { if (o.spd < 30) continue; if (carCircles(o).some(s => hyp(player.x - s.x, player.y - s.y) < s.r + 7)) { if (o.spd > 110 && player.down <= 0) { player.hp -= o.spd * 0.06; player.down = 1.2; player.vx = o.vx * 1.1; player.vy = o.vy * 1.1; A.bonk(); G.shake = 8; pop(player.x, player.y - 20, 'OUCH', '#ff5d6c', 22); } } }
    if (player.hp <= 0) cooked('You got flattened on foot.');
  }
}
function driftLogic(c, dt) {
  const drifting = c.spd > 200 && Math.abs(c.vr) > 95;
  if (drifting) {
    if (!G.drift) G.drift = { t: 0, score: 0, off: 0 };
    G.drift.t += dt; G.drift.off = 0; G.drift.score += dt * (c.spd * 0.045 + Math.abs(c.vr) * 0.05);
  } else if (G.drift) { G.drift.off += dt; G.drift.score += 0; if (G.drift.off > 0.45) endDrift(false); }
}
function endDrift(busted) {
  const d = G.drift; G.drift = null; if (!d) return;
  if (busted) { pop(player.x, player.y - 30, 'DRIFT BUSTED', '#ff5d6c', 20); return; }
  if (d.t < 0.8) return;
  const mult = 1 + Math.min(G.combo, 6) * 0.25, cash = Math.round(d.score * mult);
  G.st.bestDrift = Math.max(G.st.bestDrift, d.t);
  addCash(cash, player.x, player.y, d.t > 3 ? 'MEGA DRIFT' : 'DRIFT'); bumpCombo(); A.cash();
  if (d.t > 2.2) post('drift');
}
function bumpCombo() { G.combo++; G.comboT = 4; }
function cuffed() {
  if (G.state !== 'play') return;
  const fine = Math.max(100, Math.round(G.cash * 0.25));
  G.st.cuffed++; failJob('You got cuffed mid-run.');
  downState('Cuffed', `Bail: ${money(fine)}`, () => { addCash(-fine); respawn(SPECIALS.hotel.marker); });
  post('cuffed', true);
}
function cooked(why) {
  if (G.state !== 'play') return;
  G.st.cooked++; failJob(why);
  downState('Cooked', 'Hospital bill: $150', () => { addCash(-150); respawn(SPECIALS.clinic.marker); });
  post('cooked', true);
}
function downState(txt, sub, after) { G.state = 'down'; G.downT = 2.6; G.after = after; banner(txt, sub); A.bad(); }
function respawn(at) {
  G.heat = 0; G.stars = 0; G.bust = 0; G.searchT = 0; heli = null;
  for (const c of cops) removeCar(c); cops = [];
  if (player.car) ejectPlayer();
  const c = makeCar(pick(['sedan', 'sports', 'lowrider']), at.x - 90, at.y, 0, { driver: 'player' });
  player = { x: c.x, y: c.y, a: 0, vx: 0, vy: 0, car: c, hp: 100, down: 0, walkT: 0, carry: null };
  G.state = 'play';
}

// ---------------------------------------------------------------- jobs
const phone = { open: false, t: 0, max: 12, job: null, result: 0 };
function nextJob() {
  if (!JOBS.length) return;
  const { n, m } = JOBS[G.jobIdx++ % JOBS.length];
  const ui = NIGHT_UI[n.id]; if (!ui) return;
  G.job = { n, m, ui, stage: 'phone', choice: null };
  openPhone(G.job);
}
function openPhone(job) {
  const { n, m, ui } = job;
  phone.open = true; phone.t = 0; phone.job = job; phone.result = 0;
  A.ring(); G.slow = true;
  const reads = Object.entries(n.cards).map(([id, card]) => {
    const a = m.jev[id], trap = card.kind !== 'judgment';
    const tag = `<small class="${trap ? 'trap' : ''}"> ${trap ? card.kind : card.q.type === 'choice' ? 'choice' : 'judgment'}</small>`;
    if (a.p != null) return `<div class="read" title="${esc(card.q.instructions.replace(/`/g, ''))}"><span class="k">${esc(id)}${tag}</span><span class="meter"><i style="width:${Math.round(a.p * 100)}%"></i></span><span class="v">${a.p.toFixed(2)}</span></div>`;
    const top = Object.entries(a.probs || { [a.choice]: 1 }).sort((x, y) => y[1] - x[1])[0];
    return `<div class="read" title="${esc(card.q.instructions.replace(/`/g, ''))}"><span class="k">${esc(id)}${tag}</span><span class="v" style="text-align:left">→ ${esc(a.choice)}</span><span class="v">${(+top[1]).toFixed(2)}</span></div>`;
  }).join('');
  const facts = [];
  if (m.gold != null) facts.push(m.gold ? 'Gold guest' : 'Standard guest');
  if (m.time) facts.push('sent ' + m.time);
  $('#phone-model').textContent = DATA.model + ' · read';
  $('#phone-body').innerHTML = `<div class="sms">${esc(m.text)}<div class="meta">${facts.map(f => `<span class="chip">${esc(f)}</span>`).join('')}<span class="chip">Your code knows these</span></div></div>
    <div><p class="lbl" style="margin:0 0 6px">Jev read · ${esc(n.title.split('·')[1]?.trim() || '')}</p><div class="reads">${reads}</div></div>
    <p class="rule"><b>House rules:</b> ${ui.rule}</p>
    <div class="opts">${ui.opts.map(([k, label, shop], i) => `<button class="opt" data-opt="${i}"><kbd>${i + 1}</kbd><span>${esc(label)}${shop ? ` <span class="lbl" style="display:block;margin-top:3px">${SPECIALS[shop].icon} ${esc(SPECIALS[shop].name)}</span>` : ''}</span></button>`).join('')}</div>`;
  $('#phone').classList.add('open');
}
function closePhone() { phone.open = false; $('#phone').classList.remove('open'); G && (G.slow = false); }
$('#phone').addEventListener('click', e => { const b = e.target.closest('[data-opt]'); if (b) choose(+b.dataset.opt); });
function choose(i) {
  const job = G.job; if (!job || job.stage !== 'phone' || !phone.open) return;
  const opt = job.ui.opts[i]; if (!opt) return;
  const [k, label, shop] = opt; job.choice = k; job.label = label;
  const right = k === job.m.truth;
  if (!shop) {
    // instant answers
    let pay, verdict;
    if (k === 'manager') { pay = -40; verdict = 'mgr'; }
    else if (right) { pay = 60; verdict = 'ok'; }
    else { pay = -80; verdict = 'bad'; }
    logCall(job, verdict, pay);
    showVerdict(verdict, pay, job);
    addCash(pay); verdict === 'ok' ? A.good() : verdict === 'bad' ? A.bad() : A.cash();
    G.job = null; G.nextJobT = 7 + R() * 5;
    return;
  }
  const s = SPECIALS[shop], h = SPECIALS.hotel;
  const from = player.car || player;
  const dist = Math.abs(from.x - s.marker.x) + Math.abs(from.y - s.marker.y) + Math.abs(s.marker.x - h.marker.x) + Math.abs(s.marker.y - h.marker.y);
  Object.assign(job, { stage: 'pickup', shop, target: s.marker, limit: Math.round(dist / 250 + 18), t: 0 });
  job.timeLeft = job.limit;
  closePhone(); A.cash();
  toast(`Go: ${s.icon} ${s.name}`);
  $('#job').classList.add('on');
}
function showVerdict(v, pay, job) {
  const truthLabel = job.ui.opts.find(o => o[0] === job.m.truth)?.[1] || job.m.truth;
  const msg = v === 'ok' ? pick(GUEST_OK) : v === 'bad' ? pick(GUEST_BAD) : 'manager handled it. he’s mad you woke him up';
  $('#phone-body').innerHTML = `<div class="verdict ${v === 'ok' ? 'ok' : v === 'bad' ? 'bad' : ''}">${v === 'ok' ? 'Right call' : v === 'bad' ? 'Wrong call' : 'Played it safe'} · ${money(pay)}</div>
    <div class="sms">${esc(msg)}</div>
    <p class="rule">${v === 'bad' ? `The rules said <b>${esc(truthLabel)}</b>. ` : ''}${esc(lessonFor(job, v))}</p>`;
  phone.result = 2.8; phone.open = true; $('#phone').classList.add('open'); G.slow = false;
}
function lessonFor(job, v) {
  const { n, m } = job, J = m.jev, f = x => x.toFixed(2), truth = job.ui.opts.find(o => o[0] === m.truth)?.[1] || m.truth;
  if (n.id === 'comp') return `room_problem read ${f(J.room_problem.p)} and this is a ${m.gold ? 'Gold' : 'Standard'} guest, so: ${truth}. should_comp read ${f(J.should_comp.p)}, but Jev never saw the Gold-only rule. Don’t ask Jev to decide.`;
  if (n.id === 'amenity') return `which_amenity said ${J.which_amenity.choice}. A Choice always picks something, so check any_amenity too: it read ${f(J.any_amenity.p)}.`;
  if (n.id === 'or') return `threat ${f(J.threat.p)} · unwell ${f(J.unwell.p)}. The compound question, danger_or_unwell (${f(J.danger_or_unwell.p)}), can’t tell you which one to send.`;
  if (n.id === 'unsure') return `late_checkout read ${f(J.late_checkout.p)}. ${J.late_checkout.p > 0.25 && J.late_checkout.p < 0.75 ? 'That’s the unsure band. The safe fallback beats a coin flip there.' : 'That’s a confident read. Trust it.'}`;
  if (n.id === 'clock') return `wants_food read ${f(J.wants_food.p)}. outside_hours_jev read ${f(J.outside_hours_jev.p)}${m.time ? `, but the text was sent at ${m.time}` : ''}. Code can read a clock exactly, so don’t ask Jev.`;
  return '';
}
function logCall(job, verdict, pay) { G.calls.push({ text: job.m.text, night: job.n.id, choice: job.label, truth: job.ui.opts.find(o => o[0] === job.m.truth)?.[1] || job.m.truth, verdict, pay }); G.st[verdict === 'ok' ? 'right' : verdict === 'bad' ? 'wrong' : 'right']++; }
function updateJob(dt, rdt) {
  if (phone.open && phone.result > 0) { phone.result -= rdt; if (phone.result <= 0) closePhone(); }
  else if (phone.open) {
    phone.t += rdt; $('#phone-timer').style.width = (100 - phone.t / phone.max * 100) + '%';
    if (phone.t > phone.max) { const job = G.job; G.st.missed++; job.label = 'No answer'; logCall(job, 'bad', -50); addCash(-50); G.job = null; G.nextJobT = 6; closePhone(); toast('Guest left a 1-star review · −$50'); A.bad(); }
  }
  const job = G.job;
  if (!job) { G.nextJobT -= dt; if (G.nextJobT <= 0 && G.time < G.shiftLen - 25 && G.state === 'play') nextJob(); $('#job').classList.remove('on'); return; }
  if (job.stage === 'phone') return;
  job.timeLeft -= dt;
  const from = player.car || player, d = hyp(from.x - job.target.x, from.y - job.target.y);
  const s = SPECIALS[job.shop];
  $('#job-ico').textContent = job.stage === 'pickup' ? s.icon : '🏨';
  $('#job-title').textContent = job.stage === 'pickup' ? 'Pick up' : 'Deliver';
  $('#job-text').textContent = job.stage === 'pickup' ? `${s.item[0].toUpperCase() + s.item.slice(1)} at ${s.name}` : `Bring ${s.item} to Hotel Null`;
  $('#job-dist').textContent = Math.round(d / 10) + ' m';
  const tl = Math.max(0, job.timeLeft); const te = $('#job-t'); te.textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`; te.classList.toggle('hot', tl < 10);
  if (d < 54) {
    if (job.stage === 'pickup') { job.stage = 'deliver'; job.target = SPECIALS.hotel.marker; player.carry = s.icon; A.cash(); pop(from.x, from.y - 30, 'GOT IT ' + s.icon, '#fefefe', 22); toast(`Now get ${s.item} to Hotel Null`); }
    else {
      const right = job.choice === job.m.truth, late = job.timeLeft < 0;
      let pay, verdict;
      if (right) { pay = late ? 60 : 150 + Math.round(job.timeLeft * 6); verdict = 'ok'; if (late) G.st.late++; }
      else { pay = -100; verdict = 'bad'; }
      G.st.delivered++;
      logCall(job, verdict, pay); addCash(pay, from.x, from.y, right ? (late ? 'LATE' : 'TIP') : 'WRONG');
      showVerdict(verdict, pay, job); right ? A.good() : A.bad(); post(right ? 'ok' : 'bad');
      if (right && !late) banner('Delivered', `${s.icon} ${money(pay)}`, true);
      player.carry = null; G.job = null; G.nextJobT = 5 + R() * 4; $('#job').classList.remove('on');
    }
  }
}
function failJob(why) {
  const job = G.job; if (!job || job.stage === 'phone') { if (job) { closePhone(); G.job = null; } return; }
  logCall(job, 'bad', 0); G.calls[G.calls.length - 1].choice += ' (never arrived)';
  player.carry = null; G.job = null; G.nextJobT = 8; $('#job').classList.remove('on');
}

// ---------------------------------------------------------------- update
function update(dt, rdt) {
  if (G.state === 'play') { G.time += rdt * (G.slow ? 0.3 : 1); if (G.time >= G.shiftLen) return endShift(); }
  if (G.state === 'down') { G.downT -= rdt; if (G.downT <= 0) G.after(); }
  if (G.state === 'play') updatePlayer(dt); else if (player.car) { player.car.thr = 0; player.car.steer = 0; player.car.hb = false; A.horn(false); }
  for (const c of cars) {
    if (c.ai) c.ai.type === 'cop' ? copAI(c, dt) : trafficAI(c, dt);
    else if (c.driver !== 'player') { c.thr = 0; c.steer = 0; c.hb = false; }
    if (c.parked) continue;
    updateCar(c, dt); hitStatic(c);
  }
  collideCars();
  // recycle traffic far from the camera
  for (const c of cars) if (c.ai && c.ai.type === 'traffic' && !c.dead && hyp(c.x - G.camX, c.y - G.camY) > 1700 && c !== player.car) placeOnLane(c, { x: G.camX, y: G.camY });
  if (cars.length > 140) { const far = cars.find(c => !c.ai && c.driver !== 'player' && hyp(c.x - G.camX, c.y - G.camY) > 1800 && !c.parked); if (far) removeCar(far); }
  for (const p of peds) { updatePed(p, dt); if (hyp(p.x - G.camX, p.y - G.camY) > 1500 && p.state === 'walk' && R() < 0.02) placePed(p, { x: G.camX, y: G.camY }); }
  if (peds.length > 140) peds.splice(0, peds.length - 140);
  // props
  const pc = player.car;
  for (const p of props) {
    if (p.hit) { p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; p.vx *= Math.exp(-2 * dt); p.vy *= Math.exp(-2 * dt); p.va *= Math.exp(-2 * dt); p.t += dt;
      if (p.kind === 'hydrant' && p.t < 14 && hyp(p.hx - G.camX, p.hy - G.camY) < 900) for (let k = 0; k < 2; k++) particles.push({ x: p.hx, y: p.hy, vx: (R() - 0.5) * 60, vy: (R() - 0.5) * 60, life: 0.9, t: 0, size: 5 + R() * 5, color: 'rgba(150,220,255,.6)', type: 'water' });
      if (p.t > 40 && hyp(p.hx - G.camX, p.hy - G.camY) > 900) Object.assign(p, { x: p.hx, y: p.hy, a: p.ha, hit: false, t: 0 });
      continue; }
    for (const c of cars) { if (c.spd < 60 || Math.abs(c.x - p.x) > 40 || Math.abs(c.y - p.y) > 40) continue; if (carCircles(c).some(s => hyp(p.x - s.x, p.y - s.y) < s.r + 7)) { p.hit = true; p.vx = c.vx * 1.3 + (R() - 0.5) * 100; p.vy = c.vy * 1.3 + (R() - 0.5) * 100; p.va = (R() - 0.5) * 20; c.vx *= 0.93; c.vy *= 0.93;
      if (c === pc) { A.crash(0.25); if (p.kind === 'hydrant') { G.st.hydrants++; pop(p.x, p.y - 20, 'SPLASH', '#7bdff2', 18); post('hydrant'); addHeat(0.08); } else addCash(5, p.x, p.y, 'SMASH'); } break; } }
  }
  // cash pickups
  const who = pc || player;
  for (let k = cashes.length - 1; k >= 0; k--) { const m = cashes[k]; m.t += dt; if (hyp(m.x - who.x, m.y - who.y) < 34 && G.state === 'play') { cashes.splice(k, 1); addCash(m.v, m.x, m.y); A.cash(); if (R() < 0.3) post('cash'); spawnCash(who); } }
  // wrap shop
  const w = SPECIALS.wrap.marker;
  if (pc && G.state === 'play' && hyp(pc.x - w.x, pc.y - w.y) < 54 && (G.wrapCd || 0) <= 0) {
    G.wrapCd = 6; if (G.stars > 0 || pc.hp < pc.K.hp) { const cost = 100; pc.color = pick(PAINT.filter(c => c !== pc.color)); pc.hp = pc.K.hp; pc.fire = 0; addCash(-cost, pc.x, pc.y, 'FRESH WRAP'); if (G.stars) { G.heat = 0; G.stars = 0; for (const c of cops) { c.ai = { type: 'traffic', stuck: 0, rev: 0 }; c.siren = false; placeLaneFrom(c); } cops = []; heli = null; post('wrap', true); banner('Fresh wrap', 'Cops lost interest'); } else toast('Fixed up and repainted · −$100'); }
    else toast('Wrap It Up: come back with a dent or some stars');
  }
  G.wrapCd = (G.wrapCd || 0) - dt;
  if (G.state === 'play') updateHeat(dt);
  if (G.state === 'play' || G.state === 'down') updateJob(dt, rdt);
  // particles
  for (let k = particles.length - 1; k >= 0; k--) { const p = particles[k]; p.t += dt; if (p.t > p.life) { particles.splice(k, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const f = p.type === 'spark' ? 3 : 1.2; p.vx *= Math.exp(-f * dt); p.vy *= Math.exp(-f * dt); }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
  for (let k = popups.length - 1; k >= 0; k--) { const p = popups[k]; p.t += rdt; p.y += p.vy * rdt; if (p.t > p.life) popups.splice(k, 1); }
  if (G.comboT > 0) { G.comboT -= rdt; if (G.comboT <= 0) G.combo = 0; }
  // camera
  const t = player.car || player, look = player.car ? 0.38 : 0.1;
  const tx = t.x + (t.vx || 0) * look, ty = t.y + (t.vy || 0) * look;
  if (G.state === 'title') { G.camX = SPECIALS.hotel.marker.x + Math.sin(performance.now() / 9000) * 900; G.camY = SPECIALS.hotel.marker.y + Math.cos(performance.now() / 11000) * 700; }
  else { const k = 1 - Math.exp(-5 * rdt); G.camX = lerp(G.camX, tx, k); G.camY = lerp(G.camY, ty, k); }
  const base = clamp(Math.min(VW, VH) / 820, 0.5, 1.25);
  const zt = G.state === 'title' ? base * 0.8 : player.car ? base * (1 - 0.28 * clamp(player.car.spd / 650, 0, 1)) : base * 1.35;
  G.zoom = lerp(G.zoom, zt, 1 - Math.exp(-2 * rdt));
  G.shake *= Math.exp(-7 * rdt);
  // audio
  const sirenD = cops.reduce((m, c) => Math.min(m, hyp(c.x - G.camX, c.y - G.camY)), 9999);
  A.update(player.car ? Math.abs(player.car.vf || 0) : 0, player.car ? Math.abs(player.car.thr) : 0, player.car ? player.car.skid : 0, clamp(1 - sirenD / 1200, 0, 1), heli ? clamp(1 - hyp(heli.x - G.camX, heli.y - G.camY) / 1200, 0, 1) : 0, G.slow);
}

// ---------------------------------------------------------------- render
function night() { // 0..20 darkness bucket, plus overlay color
  if (G.state === 'title') return { n: 12, a: 0.55, col: [14, 8, 34] };
  const f = G.time / G.shiftLen;
  const a = f < 0.15 ? lerp(0.32, 0.62, f / 0.15) : f < 0.8 ? 0.66 : lerp(0.66, 0.42, (f - 0.8) / 0.2);
  const col = f < 0.15 ? [lerp(70, 12, f / 0.15), lerp(24, 8, f / 0.15), lerp(70, 32, f / 0.15)] : f < 0.8 ? [12, 8, 32] : [lerp(12, 80, (f - 0.8) / 0.2), lerp(8, 34, (f - 0.8) / 0.2), lerp(32, 70, (f - 0.8) / 0.2)];
  return { n: Math.round(a / 0.7 * 20), a, col };
}
function render(now) {
  if (innerWidth !== VW || innerHeight !== VH) resize();
  if (!cv.width || !cv.height) return;
  const z = G.zoom, sx = (R() - 0.5) * G.shake, sy = (R() - 0.5) * G.shake;
  const cx = G.camX + sx / z, cy = G.camY + sy / z;
  const hw = VW / 2 / z, hh = VH / 2 / z, v = { x0: cx - hw - 300, y0: cy - hh - 300, x1: cx + hw + 300, y1: cy + hh + 300 };
  const T = (c) => c.setTransform(DPR * z, 0, 0, DPR * z, DPR * (VW / 2 - cx * z), DPR * (VH / 2 - cy * z));
  const nt = night();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d3a4a'; ctx.fillRect(0, 0, cv.width, cv.height);
  T(ctx);
  drawGround(v, now);
  // skids
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const s of skids) { if (s[0] < v.x0 || s[0] > v.x1 || s[1] < v.y0 || s[1] > v.y1) continue; ctx.strokeStyle = `rgba(10,8,14,${s[4]})`; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }
  drawMarkers(now);
  for (const m of cashes) { if (m.x < v.x0 || m.x > v.x1 || m.y < v.y0 || m.y > v.y1) continue; const b = Math.sin(m.t * 4) * 3; ctx.save(); ctx.translate(m.x, m.y + b); ctx.rotate(Math.sin(m.t * 2) * 0.3); ctx.fillStyle = '#3d9a4a'; ctx.fillRect(-11, -6, 22, 12); ctx.strokeStyle = '#c8f7c5'; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -4, 18, 8); ctx.fillStyle = '#e9ffe6'; ctx.font = '700 9px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 0.5); ctx.restore(); }
  for (const p of props) if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) drawProp(p);
  // shadows
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (const c of cars) { if (c.x < v.x0 || c.x > v.x1 || c.y < v.y0 || c.y > v.y1) continue; ctx.save(); ctx.translate(c.x + 4, c.y + 5); ctx.rotate(c.a); ctx.fillRect(-c.K.L / 2, -c.K.W / 2, c.K.L, c.K.W); ctx.restore(); }
  for (const p of peds) if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) drawPed(p);
  if (!player.car) drawWalker(player);
  for (const c of cars) if (c.x > v.x0 && c.x < v.x1 && c.y > v.y0 && c.y < v.y1) drawCar(c, now);
  if (player.carry && player.car) { ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(player.carry, player.car.x, player.car.y - 30 + Math.sin(now / 150) * 3); }
  // darkness
  drawLights(v, nt, T, now);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(oc, 0, 0);
  T(ctx);
  // colored light
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lamps) if (l.x > v.x0 && l.x < v.x1 && l.y > v.y0 && l.y < v.y1) { ctx.globalAlpha = 0.25 * nt.a; ctx.drawImage(glow('rgba(255,170,90,1)'), l.x - 110, l.y - 110, 220, 220); }
  ctx.globalAlpha = 1;
  for (const c of cars) {
    if (c.x < v.x0 || c.x > v.x1 || c.y < v.y0 || c.y > v.y1) continue;
    const fx = Math.cos(c.a), fy = Math.sin(c.a), bx = c.x - fx * c.K.L / 2, by = c.y - fy * c.K.L / 2;
    ctx.globalAlpha = c.brake ? 0.9 : 0.4; ctx.drawImage(glow('rgba(255,30,60,1)'), bx - 22, by - 22, 44, 44);
    if (c.siren && !c.dead) { const on = Math.floor(now / 140) % 2; ctx.globalAlpha = 0.95; ctx.drawImage(glow(on ? 'rgba(255,40,70,1)' : 'rgba(40,90,255,1)'), c.x - 80, c.y - 80, 160, 160); }
    if (c.fire > 0 || c.hp <= 0 && !c.dead) { ctx.globalAlpha = 0.7; ctx.drawImage(glow('rgba(255,140,40,1)'), c.x - 70, c.y - 70, 140, 140); }
  }
  for (const s of Object.values(SPECIALS)) if (s.marker && (s === SPECIALS.wrap || G.job?.target === s.marker)) { ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 200); ctx.drawImage(glow(s === SPECIALS.wrap ? 'rgba(158,240,26,1)' : 'rgba(243,134,161,1)'), s.marker.x - 120, s.marker.y - 120, 240, 240); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawTall(v, nt, cx, cy, now);
  // particles
  for (const p of particles) {
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
    const f = clamp(p.t / p.life, 0, 1);
    if (p.type === 'fire') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - f; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - f * 0.5), 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.type === 'spark') { ctx.globalAlpha = 1 - f; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else { ctx.globalAlpha = (1 - f) * 0.9; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + f), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  if (heli) drawHeli(now);
  // GPS arrow
  if (G.job && G.job.target && G.state === 'play') drawArrow(G.job.target, now, '#f386a1');
  // popups
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of popups) { const f = p.t / p.life; ctx.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1; ctx.font = `italic 700 ${p.size / z}px "Inter Tight", Arial, sans-serif`; ctx.lineWidth = 4 / z; ctx.strokeStyle = '#1e1e1e'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); }
  ctx.globalAlpha = 1;
  // bust ring
  if (G.bust > 0 && G.state === 'play') { const t = player.car || player; ctx.strokeStyle = '#ff2a4d'; ctx.lineWidth = 5 / z; ctx.beginPath(); ctx.arc(t.x, t.y, 44, -Math.PI / 2, -Math.PI / 2 + TAU * G.bust / 2.2); ctx.stroke(); }
  // screen fx
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, G.stars >= 3 ? `rgba(${Math.floor(now / 300) % 2 ? '120,0,20' : '0,20,120'},.45)` : 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
  drawMini(now);
}
function drawGround(v, now) {
  // sand + water
  ctx.fillStyle = '#e9c99a'; ctx.fillRect(CITY_W - 10, 0, SAND + 10, WORLD_H);
  ctx.fillStyle = '#0d3a4a';
  const wx = WORLD_W - 30;
  ctx.fillStyle = '#126077'; ctx.fillRect(wx, -400, 2000, WORLD_H + 800);
  ctx.strokeStyle = 'rgba(220,250,255,.7)'; ctx.lineWidth = 6; ctx.beginPath();
  for (let y = Math.max(-400, v.y0); y < Math.min(WORLD_H + 400, v.y1); y += 20) { const x = wx + Math.sin(y / 60 + now / 600) * 10; y === Math.max(-400, v.y0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.fillStyle = '#126077'; ctx.fillRect(-2000, -2000, 2000, WORLD_H + 4000); ctx.fillRect(-2000, -2000, WORLD_W + 4000, 2000); ctx.fillRect(-2000, WORLD_H, WORLD_W + 4000, 2000);
  // asphalt
  ctx.fillStyle = '#2c2836'; ctx.fillRect(0, 0, CITY_W, CITY_H);
  // blocks
  for (const b of blocks) {
    if (b.x > v.x1 || b.x + BLOCK < v.x0 || b.y > v.y1 || b.y + BLOCK < v.y0) continue;
    ctx.fillStyle = '#8f8a9e'; ctx.fillRect(b.x, b.y, BLOCK, BLOCK);
    ctx.fillStyle = '#a6a1b4'; ctx.fillRect(b.x, b.y, BLOCK, 3); ctx.fillRect(b.x, b.y, 3, BLOCK);
    const ix = b.x + SW, iy = b.y + SW, iw = BLOCK - 2 * SW;
    if (b.type === 'park') {
      ctx.fillStyle = '#2f7a55'; ctx.fillRect(ix, iy, iw, iw);
      ctx.fillStyle = '#378a61'; for (let k = 0; k < 8; k++) ctx.fillRect(ix + k * iw / 8, iy, iw / 16, iw);
      ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ix, iy + iw / 2); ctx.quadraticCurveTo(ix + iw / 2, iy + iw * 0.2, ix + iw, iy + iw / 2); ctx.moveTo(ix + iw / 2, iy); ctx.lineTo(ix + iw / 2, iy + iw); ctx.stroke();
      if (b.pond) { ctx.fillStyle = '#1f8aa6'; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.r * 1.3, b.pond.r, 0, 0, TAU); ctx.fill(); }
    } else if (b.type === 'lot') {
      ctx.fillStyle = '#35313f'; ctx.fillRect(ix, iy, iw, iw);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) for (let c = 0; c <= 6; c++) { const x = ix + 14 + c * 52, y = iy + 104 + r * 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 52); ctx.stroke(); }
    } else {
      ctx.fillStyle = b.type === 'special' ? '#4a4558' : '#3e3a4b'; ctx.fillRect(ix, iy, iw, iw);
      if (b.type === 'special') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let k = 0; k < 7; k++) { const x = ix + 30 + k * 50; ctx.beginPath(); ctx.moveTo(x, iy + iw - 70); ctx.lineTo(x, iy + iw - 20); ctx.stroke(); } }
    }
  }
  // lane markings
  ctx.lineWidth = 2;
  for (let i = 0; i <= COLS; i++) {
    const x = nodeX(i); if (x < v.x0 || x > v.x1) continue;
    for (let j = 0; j < ROWS; j++) { const y0 = nodeY(j) + ROAD / 2, y1 = y0 + BLOCK; if (y1 < v.y0 || y0 > v.y1) continue;
      ctx.strokeStyle = '#e8c547'; ctx.beginPath(); ctx.moveTo(x - 3, y0 + 18); ctx.lineTo(x - 3, y1 - 18); ctx.moveTo(x + 3, y0 + 18); ctx.lineTo(x + 3, y1 - 18); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 6; k++) { ctx.fillRect(x - ROAD / 2 + 12 + k * 22, y0 + 2, 12, 12); ctx.fillRect(x - ROAD / 2 + 12 + k * 22, y1 - 14, 12, 12); }
    }
  }
  for (let j = 0; j <= ROWS; j++) {
    const y = nodeY(j); if (y < v.y0 || y > v.y1) continue;
    for (let i = 0; i < COLS; i++) { const x0 = nodeX(i) + ROAD / 2, x1 = x0 + BLOCK; if (x1 < v.x0 || x0 > v.x1) continue;
      ctx.strokeStyle = '#e8c547'; ctx.beginPath(); ctx.moveTo(x0 + 18, y - 3); ctx.lineTo(x1 - 18, y - 3); ctx.moveTo(x0 + 18, y + 3); ctx.lineTo(x1 - 18, y + 3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 6; k++) { ctx.fillRect(x0 + 2, y - ROAD / 2 + 12 + k * 22, 12, 12); ctx.fillRect(x1 - 14, y - ROAD / 2 + 12 + k * 22, 12, 12); }
    }
  }
  // boardwalk
  ctx.fillStyle = '#b08a5a'; ctx.fillRect(CITY_W + 6, 0, 26, CITY_H);
  ctx.strokeStyle = 'rgba(60,40,20,.4)'; ctx.lineWidth = 1; for (let y = Math.max(0, Math.floor(v.y0 / 12) * 12); y < Math.min(CITY_H, v.y1); y += 12) { ctx.beginPath(); ctx.moveTo(CITY_W + 6, y); ctx.lineTo(CITY_W + 32, y); ctx.stroke(); }
}
function drawMarkers(now) {
  const list = [];
  if (G.job && G.job.target) list.push([G.job.target, '#f386a1', G.job.stage === 'pickup' ? SPECIALS[G.job.shop].icon : '🏨']);
  list.push([SPECIALS.wrap.marker, '#9ef01a', '🎨']);
  for (const [m, col, icon] of list) {
    const pulse = 1 + Math.sin(now / 180) * 0.08;
    ctx.save(); ctx.translate(m.x, m.y);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = '26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, Math.sin(now / 250) * 4);
    ctx.restore();
  }
}
function drawProp(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
  if (p.kind === 'hydrant') { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffb3b8'; ctx.beginPath(); ctx.arc(-1, -1, 2.5, 0, TAU); ctx.fill(); }
  else if (p.kind === 'trash') { ctx.fillStyle = '#3c6e47'; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = '#5c9a68'; ctx.fillRect(-4, -4, 8, 8); }
  else if (p.kind === 'news') { ctx.fillStyle = '#2a6fdb'; ctx.fillRect(-6, -5, 12, 10); ctx.fillStyle = '#fefefe'; ctx.fillRect(-4, -3, 8, 3); }
  else if (p.kind === 'bench') { ctx.fillStyle = '#8a5a3b'; ctx.fillRect(-16, -5, 32, 10); ctx.fillStyle = '#a8734e'; ctx.fillRect(-16, -5, 32, 3); }
  else if (p.kind === 'cone') { ctx.fillStyle = '#ff7b1c'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.fill(); }
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawCar(c, now) {
  const { L, W } = c.K;
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  ctx.fillStyle = '#141018'; ctx.fillRect(L / 2 - 13, -W / 2 - 2, 9, 3); ctx.fillRect(L / 2 - 13, W / 2 - 1, 9, 3); ctx.fillRect(-L / 2 + 5, -W / 2 - 2, 9, 3); ctx.fillRect(-L / 2 + 5, W / 2 - 1, 9, 3);
  const body = c.dead ? '#2b2630' : c.color;
  ctx.fillStyle = body; rr(-L / 2, -W / 2, L, W, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
  if (c.kind === 'cop') { ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-L / 2 + 2, -W / 2, L * 0.3, W); ctx.fillRect(L / 2 - L * 0.22, -W / 2, L * 0.2, W); }
  if (c.kind === 'taxi') { ctx.fillStyle = '#1e1e1e'; for (let k = 0; k < 6; k++) ctx.fillRect(-L / 2 + 6 + k * 6, W / 2 - 3, 3, 3); }
  if (c.kind === 'sports') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-L / 2, -2.5, L, 2); ctx.fillRect(-L / 2, 1, L, 2); }
  if (c.kind === 'icecream') { ctx.fillStyle = '#f386a1'; ctx.fillRect(-L / 2 + 2, -W / 2, L * 0.62, 4); ctx.fillRect(-L / 2 + 2, W / 2 - 4, L * 0.62, 4); ctx.fillStyle = '#ffd6e0'; ctx.beginPath(); ctx.arc(-L * 0.12, 0, 6, 0, TAU); ctx.fill(); }
  if (c.kind === 'lowrider') { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 2); }
  // glass
  const roofX = c.kind === 'van' || c.kind === 'icecream' ? -L * 0.42 : -L * 0.26, roofW = c.kind === 'van' || c.kind === 'icecream' ? L * 0.58 : L * 0.42;
  ctx.fillStyle = c.dead ? '#141018' : '#1d2a3a'; rr(roofX - 3, -W / 2 + 3, roofW + 9, W - 6, 3); ctx.fill();
  ctx.fillStyle = c.dead ? '#2b2630' : shadeHex(body, 0.85); rr(roofX + 3, -W / 2 + 4, roofW - 4, W - 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(160,200,255,.35)'; ctx.fillRect(roofX + roofW + 1, -W / 2 + 4, 3, W - 8);
  if (c.kind === 'cop' && !c.dead) { const on = Math.floor(now / 140) % 2; ctx.fillStyle = on ? '#ff2a4d' : '#3a5bff'; ctx.fillRect(-2, -W / 2 + 3, 4, W / 2 - 3); ctx.fillStyle = on ? '#3a5bff' : '#ff2a4d'; ctx.fillRect(-2, 0, 4, W / 2 - 3); }
  if (c.kind === 'taxi') { ctx.fillStyle = '#fff3b0'; ctx.fillRect(-3, -4, 6, 8); }
  // lights
  ctx.fillStyle = '#fff6d5'; ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5); ctx.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
  ctx.fillStyle = c.brake ? '#ff3355' : '#9b1b30'; ctx.fillRect(-L / 2, -W / 2 + 2, 2.5, 5); ctx.fillRect(-L / 2, W / 2 - 7, 2.5, 5);
  if (c.driver === 'player' && G.state !== 'title') { ctx.strokeStyle = '#f386a1'; ctx.lineWidth = 2; rr(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 8); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.restore();
}
const hexCache = {};
function shadeHex(hex, f) { const k = hex + f; if (hexCache[k]) return hexCache[k]; const n = parseInt(hex.slice(1), 16); return hexCache[k] = `rgb(${(n >> 16 & 255) * f | 0},${(n >> 8 & 255) * f | 0},${(n & 255) * f | 0})`; }
function drawPed(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.state === 'down' || p.state === 'fly') {
    ctx.rotate(p.a); ctx.fillStyle = p.pants; ctx.fillRect(-2, -4, 12, 3); ctx.fillRect(-2, 1, 12, 3);
    ctx.fillStyle = p.shirt; ctx.fillRect(-9, -5, 9, 10); ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(-12, 0, 3.5, 0, TAU); ctx.fill();
    ctx.fillRect(-7, -9, 2, 5); ctx.fillRect(-7, 4, 2, 5);
    if (p.state === 'down') { ctx.rotate(-p.a); ctx.fillStyle = '#ffd166'; ctx.font = '10px system-ui'; const t = performance.now() / 200; for (let k = 0; k < 3; k++) ctx.fillText('✦', Math.cos(t + k * 2.1) * 9 - 3, Math.sin(t + k * 2.1) * 5 - 12); }
  } else {
    ctx.rotate(p.a);
    const sw = Math.sin(p.t * (p.state === 'flee' ? 22 : 10)) * 4;
    ctx.fillStyle = p.pants; ctx.fillRect(sw - 2, -4, 5, 3); ctx.fillRect(-sw - 2, 1, 5, 3);
    ctx.fillStyle = p.shirt; rr(-4, -6, 8, 12, 3); ctx.fill();
    ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); ctx.fill();
    if (p.state === 'flee') { ctx.fillStyle = p.skin; ctx.fillRect(-1, -9, 3, 3); ctx.fillRect(-1, 6, 3, 3); }
  }
  ctx.restore();
  if (p.sayT > 0 && p.say) { ctx.font = '700 11px "Inter Tight", Arial'; ctx.textAlign = 'center'; const w = ctx.measureText(p.say).width + 10; ctx.fillStyle = '#fefefe'; ctx.fillRect(p.x - w / 2, p.y - 32, w, 16); ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1; ctx.strokeRect(p.x - w / 2, p.y - 32, w, 16); ctx.fillStyle = '#1e1e1e'; ctx.textBaseline = 'middle'; ctx.fillText(p.say, p.x, p.y - 24); }
}
function drawWalker(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
  if (p.down > 0) ctx.rotate(p.down * 8);
  const sw = Math.sin(p.walkT) * 4;
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(sw - 2, -5, 6, 3); ctx.fillRect(-sw - 2, 2, 6, 3);
  ctx.fillStyle = '#f386a1'; rr(-5, -7, 10, 14, 3); ctx.fill(); ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(243,134,161,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, TAU); ctx.stroke();
  // nearest car hint
  let best = null, bd = 56; for (const c of cars) { if (c.dead) continue; const d = hyp(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
  if (best) { ctx.font = '700 12px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fefefe'; ctx.fillRect(best.x - 34, best.y - 40, 68, 18); ctx.strokeStyle = '#1e1e1e'; ctx.strokeRect(best.x - 34, best.y - 40, 68, 18); ctx.fillStyle = '#1e1e1e'; ctx.textBaseline = 'middle'; ctx.fillText(touch.on || $('#touch').classList.contains('on') ? 'CAR: TAKE' : 'E: TAKE', best.x, best.y - 31); }
}
function drawLights(v, nt, T, now) {
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-over';
  octx.fillStyle = `rgba(${nt.col[0] | 0},${nt.col[1] | 0},${nt.col[2] | 0},${nt.a})`; octx.fillRect(0, 0, oc.width, oc.height);
  T(octx); octx.globalCompositeOperation = 'destination-out';
  for (const l of lamps) if (l.x > v.x0 && l.x < v.x1 && l.y > v.y0 && l.y < v.y1) { octx.globalAlpha = 0.85; octx.drawImage(LIGHT, l.x - 140, l.y - 140, 280, 280); }
  for (const c of cars) {
    if (c.x < v.x0 || c.x > v.x1 || c.y < v.y0 || c.y > v.y1 || c.dead || !c.driver) continue;
    octx.save(); octx.translate(c.x, c.y); octx.rotate(c.a); octx.globalAlpha = c.driver === 'player' ? 1 : 0.75;
    octx.drawImage(CONE, c.K.L / 2 - 4, -130, 300, 260); octx.restore();
    if (c.siren) { octx.globalAlpha = 0.7; octx.drawImage(LIGHT, c.x - 90, c.y - 90, 180, 180); }
  }
  const pl = player.car || player; octx.globalAlpha = 0.9; octx.drawImage(LIGHT, pl.x - 90, pl.y - 90, 180, 180);
  if (G.job?.target) { octx.globalAlpha = 0.9; octx.drawImage(LIGHT, G.job.target.x - 120, G.job.target.y - 120, 240, 240); }
  for (const p of particles) if (p.type === 'fire' && p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) { octx.globalAlpha = 0.25; octx.drawImage(LIGHT, p.x - 60, p.y - 60, 120, 120); }
  if (heli) { const sx = heli.x + Math.sin(now / 900) * 30, sy = heli.y + 40; octx.globalAlpha = 1; octx.drawImage(LIGHT, sx - 110, sy - 110, 220, 220); }
  for (const s of Object.values(SPECIALS)) if (s.marker) { octx.globalAlpha = 0.6; octx.drawImage(LIGHT, s.marker.x - 160, s.marker.y - 160, 320, 320); }
  octx.globalAlpha = 1;
}
function drawTall(v, nt, cx, cy, now) {
  const list = [];
  for (const b of buildings) if (b.x1 > v.x0 - 200 && b.x0 < v.x1 + 200 && b.y1 > v.y0 - 200 && b.y0 < v.y1 + 200) list.push(b);
  for (const p of palms) if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) list.push(p);
  for (const o of list) o.d = (o.cx - cx) ** 2 + (o.cy - cy) ** 2;
  list.sort((a, b) => b.d - a.d);
  const pr = (x, y, h) => { const s = CAMH / (CAMH - h); return [cx + (x - cx) * s, cy + (y - cy) * s]; };
  for (const o of list) {
    if (o.kind === 'p') { drawPalm(o, pr, nt, now); continue; }
    const b = o, h = b.h;
    const B = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], Rf = B.map(([x, y]) => pr(x, y, h));
    const faces = [[0, 1, 0.92, Rf[0][1] > b.y0], [1, 2, 0.64, Rf[1][0] < b.x1], [2, 3, 0.5, Rf[2][1] < b.y1], [3, 0, 0.78, Rf[3][0] > b.x0]];
    for (const [i, j, f, vis] of faces) {
      if (!vis) continue;
      ctx.fillStyle = shade(b.roof, f * 0.8, nt.n);
      ctx.beginPath(); ctx.moveTo(B[i][0], B[i][1]); ctx.lineTo(B[j][0], B[j][1]); ctx.lineTo(Rf[j][0], Rf[j][1]); ctx.lineTo(Rf[i][0], Rf[i][1]); ctx.closePath(); ctx.fill();
      // windows
      const floors = Math.floor(h / 28), len = hyp(B[j][0] - B[i][0], B[j][1] - B[i][1]), cols = Math.floor(len / 26);
      if (floors > 0 && cols > 0) {
        let k = 0;
        for (let fl = 0; fl < floors; fl++) for (let cl = 0; cl < cols; cl++) {
          const col = b.win[(k++ + i * 7) % 64]; if (!col) continue;
          const u = (cl + 0.5) / cols, w = (fl + 0.55) / floors;
          const gx = lerp(B[i][0], B[j][0], u), gy = lerp(B[i][1], B[j][1], u), rx = lerp(Rf[i][0], Rf[j][0], u), ry = lerp(Rf[i][1], Rf[j][1], u);
          const x = lerp(gx, rx, w), y = lerp(gy, ry, w);
          ctx.fillStyle = col; ctx.globalAlpha = 0.35 + nt.a * 0.9; ctx.fillRect(x - 3, y - 2.5, 6, 5);
        }
        ctx.globalAlpha = 1;
      }
    }
    // roof
    ctx.fillStyle = shade(b.roof, 1, nt.n);
    ctx.beginPath(); ctx.moveTo(Rf[0][0], Rf[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(Rf[k][0], Rf[k][1]); ctx.closePath(); ctx.fill();
    const rw = Rf[1][0] - Rf[0][0], rh = Rf[3][1] - Rf[0][1];
    ctx.strokeStyle = shade(b.roof, 0.72, nt.n); ctx.lineWidth = 4; ctx.strokeRect(Rf[0][0] + 4, Rf[0][1] + 4, rw - 8, rh - 8);
    if (b.ac && !b.special && rw > 60 && rh > 60) { ctx.fillStyle = shade('#cfcbd8', 0.8, nt.n); ctx.fillRect(Rf[0][0] + rw * 0.2, Rf[0][1] + rh * 0.25, 18, 14); ctx.fillRect(Rf[0][0] + rw * 0.6, Rf[0][1] + rh * 0.55, 14, 14); ctx.fillStyle = shade('#8a8696', 0.8, nt.n); ctx.beginPath(); ctx.arc(Rf[0][0] + rw * 0.6 + 7, Rf[0][1] + rh * 0.55 + 7, 5, 0, TAU); ctx.fill(); }
    if (b.special === 'hotel') { ctx.fillStyle = shade('#3fc1d9', 1, nt.n); ctx.fillRect(Rf[0][0] + rw * 0.12, Rf[0][1] + rh * 0.55, rw * 0.35, rh * 0.3); ctx.strokeStyle = '#fefefe'; ctx.lineWidth = 2; ctx.strokeRect(Rf[0][0] + rw * 0.12, Rf[0][1] + rh * 0.55, rw * 0.35, rh * 0.3); ctx.beginPath(); ctx.arc(Rf[0][0] + rw * 0.75, Rf[0][1] + rh * 0.7, Math.min(rw, rh) * 0.13, 0, TAU); ctx.strokeStyle = shade('#fefefe', 1, nt.n); ctx.lineWidth = 3; ctx.stroke(); ctx.font = `700 ${Math.min(rw, rh) * 0.14}px "Inter Tight", Arial`; ctx.fillStyle = shade('#fefefe', 1, nt.n); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', Rf[0][0] + rw * 0.75, Rf[0][1] + rh * 0.7); }
    if (b.rim) { ctx.save(); ctx.shadowColor = b.neon; ctx.shadowBlur = 12; ctx.strokeStyle = b.neon; ctx.lineWidth = 2.5; ctx.strokeRect(Rf[0][0] + 3, Rf[0][1] + 3, rw - 6, rh - 6); ctx.restore(); }
    if (b.sign) {
      const flick = b.special === 'club' ? (Math.sin(now / 90) > -0.6 ? 1 : 0.3) : (b.seed % 7 === 0 && Math.sin(now / 47 + b.seed) > 0.97 ? 0.2 : 1);
      const fs = b.small ? Math.min(rw / (b.sign.length * 0.62), rh * 0.3, 30 * (rw / (b.x1 - b.x0))) : Math.min(rw / (b.sign.length * 0.62), rh * 0.32);
      ctx.save(); ctx.font = `italic 700 ${fs}px "Inter Tight", Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = b.neon; ctx.shadowBlur = 20 * flick; ctx.globalAlpha = flick; ctx.fillStyle = b.neon;
      ctx.fillText(b.sign, Rf[0][0] + rw / 2, Rf[0][1] + rh * (b.special === 'hotel' ? 0.28 : 0.5));
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.55 * flick; ctx.fillText(b.sign, Rf[0][0] + rw / 2, Rf[0][1] + rh * (b.special === 'hotel' ? 0.28 : 0.5));
      ctx.globalAlpha = 1; if (!b.small) { ctx.shadowColor = b.neon; ctx.shadowBlur = 14; ctx.strokeStyle = b.neon; ctx.lineWidth = 3; ctx.strokeRect(Rf[0][0] + 2, Rf[0][1] + 2, rw - 4, rh - 4); }
      ctx.restore();
    }
  }
}
function drawPalm(p, pr, nt, now) {
  const [tx, ty] = pr(p.x, p.y, p.h);
  ctx.strokeStyle = shade('#8a6a45', 1, nt.n); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + tx) / 2 + 6, (p.y + ty) / 2, tx, ty); ctx.stroke();
  const sway = Math.sin(now / 900 + p.rot) * 0.08;
  for (let k = 0; k < 7; k++) {
    const a = p.rot + k * TAU / 7 + sway, l = 26 + (k % 2) * 6;
    ctx.fillStyle = shade(k % 2 ? '#2f9e5b' : '#3bb36a', 1, nt.n);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a - 0.35) * l * 0.7, ty + Math.sin(a - 0.35) * l * 0.7, tx + Math.cos(a) * l, ty + Math.sin(a) * l); ctx.quadraticCurveTo(tx + Math.cos(a + 0.35) * l * 0.7, ty + Math.sin(a + 0.35) * l * 0.7, tx, ty); ctx.fill();
  }
  ctx.fillStyle = shade('#6b4f2f', 1, nt.n); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fill();
}
function drawHeli(now) {
  const h = heli, s = 1.5;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(h.x + 60, h.y + 80, 30, 14, h.a, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a); ctx.scale(s, s);
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-34, -2, 26, 4); ctx.fillRect(-36, -7, 4, 14);
  ctx.fillStyle = '#2a3550'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9fd3e6'; ctx.beginPath(); ctx.ellipse(8, 0, 8, 8, 0, -1.2, 1.2); ctx.fill();
  ctx.fillStyle = '#fefefe'; ctx.font = '700 6px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText('PNPD', -4, 2);
  ctx.rotate(now / 30); ctx.strokeStyle = 'rgba(220,220,230,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.moveTo(0, -34); ctx.lineTo(0, 34); ctx.stroke();
  ctx.restore();
  const on = Math.floor(now / 300) % 2; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow(on ? 'rgba(255,40,70,1)' : 'rgba(60,255,120,1)'), h.x - 20, h.y - 20, 40, 40); ctx.globalCompositeOperation = 'source-over';
}
function drawArrow(t, now, col) {
  const p = player.car || player, d = hyp(t.x - p.x, t.y - p.y); if (d < 140) return;
  const a = Math.atan2(t.y - p.y, t.x - p.x), r = 58 + Math.sin(now / 160) * 4;
  ctx.save(); ctx.translate(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); ctx.rotate(a);
  ctx.fillStyle = col; ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// minimap
const MS = 176, MK = MS / WORLD_W, mini = $('#mini'), mctx = mini.getContext('2d');
const mbase = sprite(MS * 2, (g) => {
  g.scale(2 * MK, 2 * MK);
  g.fillStyle = '#126077'; g.fillRect(-100, -100, WORLD_W + 200, WORLD_H + 200);
  g.fillStyle = '#e9c99a'; g.fillRect(CITY_W, 0, SAND - 30, WORLD_H);
  g.fillStyle = '#5a5468'; g.fillRect(0, 0, CITY_W, CITY_H);
  for (const b of blocks) { g.fillStyle = b.type === 'park' ? '#2f7a55' : b.type === 'special' ? '#3a3448' : '#241f2e'; g.fillRect(b.x, b.y, BLOCK, BLOCK); }
});
function drawMini(now) {
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.drawImage(mbase, 0, 0, MS, MS);
  mctx.setTransform(MK, 0, 0, MK, 0, 0);
  for (const [k, s] of Object.entries(SPECIALS)) { mctx.fillStyle = s.color; mctx.fillRect(s.b.x0, s.b.y0, s.b.x1 - s.b.x0, s.b.y1 - s.b.y0); }
  const p = player.car || player;
  if (G.job?.target) {
    const t = G.job.target; mctx.strokeStyle = '#f386a1'; mctx.lineWidth = 40; mctx.setLineDash([80, 60]);
    const i0 = clamp(Math.round((p.x - ROAD / 2) / P), 0, COLS), j0 = clamp(Math.round((p.y - ROAD / 2) / P), 0, ROWS), i1 = clamp(Math.round((t.x - ROAD / 2) / P), 0, COLS), j1 = clamp(Math.round((t.y - ROAD / 2) / P), 0, ROWS);
    mctx.beginPath(); mctx.moveTo(p.x, p.y); mctx.lineTo(nodeX(i0), nodeY(j0)); mctx.lineTo(nodeX(i1), nodeY(j0)); mctx.lineTo(nodeX(i1), nodeY(j1)); mctx.lineTo(t.x, t.y); mctx.stroke(); mctx.setLineDash([]);
    mctx.fillStyle = '#fefefe'; mctx.beginPath(); mctx.arc(t.x, t.y, 90 + Math.sin(now / 150) * 20, 0, TAU); mctx.fill();
  }
  for (const c of cops) { mctx.fillStyle = Math.floor(now / 200) % 2 ? '#ff2a4d' : '#3a5bff'; mctx.fillRect(c.x - 50, c.y - 50, 100, 100); }
  if (heli) { mctx.fillStyle = '#ff2a4d'; mctx.beginPath(); mctx.arc(heli.x, heli.y, 90, 0, TAU); mctx.fill(); }
  const a = player.car ? player.car.a : player.a;
  mctx.save(); mctx.translate(p.x, p.y); mctx.rotate(a); mctx.fillStyle = '#fefefe'; mctx.strokeStyle = '#1e1e1e'; mctx.lineWidth = 30; mctx.beginPath(); mctx.moveTo(130, 0); mctx.lineTo(-90, -85); mctx.lineTo(-50, 0); mctx.lineTo(-90, 85); mctx.closePath(); mctx.stroke(); mctx.fill(); mctx.restore();
}

// ---------------------------------------------------------------- HUD + screens
let hudT = 0;
function hud(rdt) {
  hudT -= rdt; if (hudT > 0) return; hudT = 0.1;
  $('#cash').textContent = money(G.cash);
  if ((G.cashFlash -= 0.1) <= 0) $('#cash').classList.remove('up', 'down');
  const st = $('#stars'); st.innerHTML = '<b>' + '★'.repeat(G.stars) + '</b>' + '☆'.repeat(5 - G.stars); st.classList.toggle('search', G.stars > 0 && G.searchT > 0);
  const mins = 23 * 60 + Math.floor(G.time / G.shiftLen * 360), hh = Math.floor(mins / 60) % 24, mm = mins % 60;
  $('#clock').textContent = `${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`;
  const c = player.car;
  $('#mode').textContent = c ? (c.kind === 'icecream' ? 'Ice cream truck' : c.kind[0].toUpperCase() + c.kind.slice(1)) : 'On foot';
  $('#speed').textContent = Math.round((c ? c.spd : hyp(player.vx, player.vy)) / 6) + ' mph';
  const hp = c ? clamp(c.hp / c.K.hp, 0, 1) : clamp(player.hp / 100, 0, 1);
  $('#hp').firstElementChild.style.width = hp * 100 + '%'; $('#hp').classList.toggle('low', hp < 0.35);
  $('#area').textContent = areaName((c || player).x, (c || player).y);
  const cb = $('#combo');
  if (G.drift && G.drift.t > 0.5) { cb.textContent = `DRIFT ${G.drift.t.toFixed(1)}s · $${Math.round(G.drift.score * (1 + Math.min(G.combo, 6) * 0.25))}`; cb.classList.add('on'); }
  else if (G.combo > 1) { cb.textContent = `×${G.combo} COMBO`; cb.classList.add('on'); } else cb.classList.remove('on');
  if (toastT > 0) { toastT -= 0.1; if (toastT <= 0) $('#toast').classList.remove('on'); }
}
function onKey(code) {
  A.resume();
  if (G.state === 'title') { if (code === 'Enter') start(); return; }
  if (G.state === 'results') { if (code === 'Enter') { setScreen(null); start(); } return; }
  if (code === 'KeyP' || code === 'Escape') { setPause(G.state !== 'paused'); return; }
  if (code === 'KeyM') { A.mute(!A.muted); toast(A.muted ? 'Muted' : 'Sound on'); }
  if (G.state !== 'play') return;
  if (code === 'KeyR') { A.init(); const n = (A.station + 1) % 3; A.setStation(n); $('#radio').textContent = n ? A.STATIONS[n].name : 'Radio off'; toast(n ? `📻 ${A.STATIONS[n].name}` : 'Radio off'); }
  if (/^Digit[1-4]$/.test(code)) choose(+code.slice(5) - 1);
}
function setScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
function setPause(p) {
  if (G.state !== 'play' && G.state !== 'paused') return;
  G.state = p ? 'paused' : 'play'; setScreen(p ? 'pause' : null); if (A.ctx) p ? A.ctx.suspend() : A.ctx.resume();
}
function start() {
  A.init(); A.resume();
  G.state = 'play'; newGame(); G.state = 'play'; setScreen(null);
  banner('Clock in', '11:00 PM · Hotel Null', true);
  setTimeout(() => toast('Keep the phone close. Guests text all night.', 3), 1600);
}
function endShift() {
  G.state = 'results'; closePhone(); A.horn(false);
  const best = store.get('pn-best', 0), isBest = G.cash > best; if (isBest) store.set('pn-best', G.cash);
  $('#r-cash').textContent = money(G.cash);
  const right = G.calls.filter(c => c.verdict === 'ok').length, wrong = G.calls.filter(c => c.verdict === 'bad').length;
  $('#r-line').textContent = G.cash > 2500 ? 'Legend of the night shift. Hotel Null owes you a raise it will never give you.' : G.cash > 1200 ? 'Solid shift. Some guests are scared of you, but they got their towels.' : G.cash > 0 ? 'You survived the shift. That counts.' : 'Rough night. The cops know your car by name now.';
  $('#r-best').textContent = isBest ? 'New best' : `Best ${money(Math.max(best, G.cash))}`;
  const s = G.st;
  $('#r-stats').innerHTML = [['Right calls', right], ['Wrong calls', wrong], ['Runs delivered', s.delivered], ['Pedestrians bonked', s.bonks], ['Cars taken', s.jacks], ['Best drift', s.bestDrift.toFixed(1) + 's'], ['Near misses', s.nearMiss], ['Hydrants', s.hydrants], ['Most stars', '★'.repeat(s.maxStars) || '0'], ['Times cuffed', s.cuffed], ['Times cooked', s.cooked], ['Top speed', Math.round(s.topSpeed / 6) + ' mph'], ['Null-gram posts about you', G.posts]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#r-log').innerHTML = G.calls.length ? G.calls.map(c => `<div class="${c.verdict === 'bad' ? 'bad' : 'ok'}">“${esc(c.text)}”<small>you: ${esc(c.choice)} · rules: ${esc(c.truth)} · ${money(c.pay)}</small></div>`).join('') : '<div>No calls answered. The phone was ringing, though.</div>';
  const traps = G.calls.filter(c => c.verdict === 'bad').length;
  $('#r-lesson').innerHTML = `<p>Every number on the phone came from one Jev request per text, with all of that night’s questions asked at once. Jev answered what a person could tell from the words: is there a room problem, which amenity, does this sound like a threat.</p>
    <p>It never saw the rules. The right call came from your rules plus what code already knew, like Gold status or the time a text was sent. The questions tagged in red are traps: a <b>decision</b> asks Jev to apply a rule it can’t see, a <b>compound</b> question hides two questions in one, a <b>vague</b> one leaves Jev guessing, and <b>math</b> belongs in code.</p>
    <p class="small">${traps ? `You made ${traps} wrong call${traps > 1 ? 's' : ''}. ` : ''}Want to write the rules yourself instead of driving them? <a href="/jev/game/night-shift/" style="color:var(--ink)">Play Night Shift at Hotel Null →</a></p>`;
  setScreen('results');
}
$('#start').addEventListener('click', start);
$('#again').addEventListener('click', () => { setScreen(null); start(); });
$('#resume').addEventListener('click', () => setPause(false));
$('#restart').addEventListener('click', () => { setScreen(null); start(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play' && !DEBUG) setPause(true); });
const best = store.get('pn-best', 0); if (best) $('#best').textContent = `Your best shift: ${money(best)}`;

// ---------------------------------------------------------------- loop
G = { state: 'title' };
newGame(); G.state = 'title';
let last = performance.now();
let stepping = false;
function frame(now) {
  const rdt = clamp((now - last) / 1000, 0, 0.05); last = Math.max(last, now);
  if (G.state !== 'paused' && G.state !== 'results') {
    const ts = G.slow ? 0.18 : G.state === 'down' ? 0.35 : 1;
    G.timeScale = lerp(G.timeScale, ts, 1 - Math.exp(-10 * rdt));
    const dt = rdt * G.timeScale;
    const n = dt > 0.02 ? 2 : 1; for (let k = 0; k < n; k++) update(dt / n, rdt / n);
    cv.classList.toggle('slow', !!G.slow);
  }
  // keys consumed once per frame
  if (pressed.KeyE && (G.state === 'play')) tryEnter();
  for (const k in pressed) delete pressed[k];
  render(now);
  if (G.state === 'play' || G.state === 'down') hud(rdt);
  if (DEBUG) { const ms = performance.now() - now; DEBUG.ms = DEBUG.ms * 0.9 + ms * 0.1; }
  if (!stepping) requestAnimationFrame(frame);
}
// ?debug exposes state for testing, and a step() that runs frames while the tab is backgrounded
const DEBUG = /[?&]debug\b/.test(location.search) ? (window.__pn = { ms: 0, get G() { return G; }, get player() { return player; }, get cars() { return cars; }, get cops() { return cops; }, keys, SPECIALS,
  step(n = 1, dt = 1 / 60) { stepping = true; for (let k = 0; k < n; k++) { const t = performance.now(); last = t - dt * 1000; frame(t); } stepping = false; } }) : null;
fetch('data.json').then(r => r.ok ? r.json() : Promise.reject()).then(d => { DATA = d; JOBS = shuffle(d.nights.flatMap(n => n.messages.map(m => ({ n, m })))); })
  .catch(() => { $('#start').insertAdjacentHTML('afterend', '<span class="small">Couldn’t load the guest texts, so tonight is free roam.</span>'); });
requestAnimationFrame(frame);
})();
