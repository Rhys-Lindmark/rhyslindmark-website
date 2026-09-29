/* Text-only studies. Cached lettering; short, discrete frames during a flicker.
 * No rendering loop while idle, offscreen, or in a hidden tab. */
(() => {
  'use strict';
  const W = 640, H = 200, D = 2, BG = '#070b10', BLUE = '#91c9f4';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.querySelector('#motion');
  let paused = reduced.matches;
  let slowPreview = false;
  const studies = [];
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const makeCanvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height });

  class Flicker {
    constructor(section, index) {
      this.section = section; this.effect = section.dataset.effect; this.index = index;
      this.canvas = section.querySelector('canvas');
      this.canvas.width = W * D; this.canvas.height = H * D;
      this.ctx = this.canvas.getContext('2d');
      this.base = makeCanvas(W * D, H * D);
      this.ink = this.base.getContext('2d', { willReadFrequently: true });
      this.low = makeCanvas(32, 32); this.lowCtx = this.low.getContext('2d');
      this.visible = false; this.timer = 0; this.frames = []; this.bursts = 0;
      this.button = section.querySelector('.preview');
      this.prepare();
      this.draw();
      this.canvas.parentElement.classList.add('ready');
      this.button.addEventListener('click', () => this.burst(true));
      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.schedule(); else this.stop();
      }, { threshold: .25 }).observe(this.canvas);
    }
    prepare() {
      const ctx = this.ink;
      ctx.scale(D, D); ctx.fillStyle = '#e6edf3';
      ctx.font = '400 76px SFMono-Regular, Consolas, "Liberation Mono", monospace';
      const letters = [...'AI 2026'], spacing = 76 * .14;
      const widths = letters.map(letter => ctx.measureText(letter).width);
      let x = (W - widths.reduce((a, b) => a + b, 0) - spacing * (letters.length - 1)) / 2;
      this.glyphs = [];
      letters.forEach((letter, i) => {
        ctx.fillText(letter, x, 125);
        if (letter !== ' ') this.glyphs.push({ x: Math.floor(x), y: 62, w: Math.ceil(widths[i]), h: 66 });
        x += widths[i] + spacing;
      });
      const { data } = ctx.getImageData(0, 0, W * D, H * D);
      this.pixels = [];
      // Keep all fragments attached to real letter strokes, not random noise.
      for (let y = 64; y < 127; y += 5) for (let x = 80; x < W - 70; x += 5) {
        const alpha = data[((y * D + 2) * W * D + x * D + 2) * 4 + 3];
        if (alpha > 160) this.pixels.push({ x, y, size: 4 });
      }
    }
    draw(phase = -1) {
      const ctx = this.ctx;
      ctx.setTransform(D, 0, 0, D, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H); ctx.drawImage(this.base, 0, 0, W, H);
      if (phase < 0) return;
      const { pixels, glyph, y } = this.active;
      if (this.effect === 'dropout') {
        ctx.fillStyle = BG;
        pixels.slice(phase === 1 ? 2 : 0, phase === 1 ? 7 : 5).forEach(p => ctx.fillRect(p.x, p.y, p.size + 1, p.size));
      } else if (this.effect === 'spark') {
        ctx.fillStyle = BLUE; ctx.globalAlpha = phase === 1 ? .95 : .68;
        pixels.slice(0, phase === 1 ? 7 : 4).forEach(p => ctx.fillRect(p.x, p.y, 4, 4));
        const p = pixels[0];
        ctx.globalAlpha = .38; ctx.fillRect(p.x + 7, p.y - 5, 3, 3);
      } else if (this.effect === 'scan') {
        const shift = phase === 1 ? -3 : 5, height = 4;
        ctx.fillStyle = BG; ctx.fillRect(75, y, W - 150, height);
        ctx.drawImage(this.base, 75 * D, y * D, (W - 150) * D, height * D, 75 + shift, y, W - 150, height);
        ctx.fillStyle = BLUE; ctx.globalAlpha = .4;
        ctx.fillRect(pixels[0].x + shift, y, 8, 2);
      } else if (this.effect === 'mosaic') {
        const cell = phase === 1 ? 4 : 6;
        const { x, y, w, h } = glyph, lw = Math.ceil(w / cell), lh = Math.ceil(h / cell);
        this.lowCtx.clearRect(0, 0, 32, 32);
        this.lowCtx.drawImage(this.base, x * D, y * D, w * D, h * D, 0, 0, lw, lh);
        ctx.fillStyle = BG; ctx.fillRect(x, y, w, h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.low, 0, 0, lw, lh, x, y, w, h);
        ctx.imageSmoothingEnabled = true;
      } else if (this.effect === 'echo') {
        ctx.fillStyle = BLUE; ctx.globalAlpha = phase === 0 ? .42 : phase === 1 ? .27 : .13;
        const dx = 4 + phase * 2;
        pixels.forEach(p => ctx.fillRect(p.x + dx, p.y + 2, 4, 3));
      }
      ctx.globalAlpha = 1;
    }
    schedule() {
      clearTimeout(this.timer);
      if (paused || document.hidden || !this.visible) return;
      const delay = this.bursts ? 7000 + Math.random() * 3000 : 1500 + this.index * 500;
      this.timer = setTimeout(() => this.burst(), delay);
    }
    burst(manual = false) {
      this.stop();
      if (!this.visible || document.hidden) return;
      this.bursts++;
      const speed = manual && slowPreview ? 4 : 1;
      this.active = { pixels: Array.from({ length: 10 }, () => pick(this.pixels)), glyph: pick(this.glyphs), y: 80 + Math.floor(Math.random() * 31) };
      this.section.dataset.state = 'flicker'; this.button.disabled = true;
      this.draw(0);
      // With reduced motion, a requested preview is one still effect, then clean text.
      if (!reduced.matches) {
        this.frames.push(setTimeout(() => this.draw(1), 75 * speed));
        if (this.effect === 'echo') this.frames.push(setTimeout(() => this.draw(2), 155 * speed));
      }
      const duration = reduced.matches ? 500 : this.effect === 'echo' ? 280 : this.effect === 'mosaic' ? 230 : 180;
      this.frames.push(setTimeout(() => {
        this.draw(); this.section.dataset.state = 'still'; this.button.disabled = false; this.frames = []; this.schedule();
      }, duration * speed));
    }
    stop() {
      clearTimeout(this.timer); this.frames.forEach(clearTimeout); this.frames = [];
      this.draw(); this.section.dataset.state = 'still'; this.button.disabled = false;
    }
  }
  document.querySelectorAll('[data-effect]').forEach((section, index) => studies.push(new Flicker(section, index)));
  function updateMotion() {
    motion.textContent = paused ? 'Resume motion' : 'Pause motion';
    motion.setAttribute('aria-pressed', String(paused));
    studies.forEach(study => paused ? study.stop() : study.schedule());
  }
  motion.addEventListener('click', () => { paused = !paused; updateMotion(); });
  document.querySelector('#slow').addEventListener('click', event => {
    slowPreview = !slowPreview; event.currentTarget.setAttribute('aria-pressed', String(slowPreview));
  });
  reduced.addEventListener('change', () => { paused = reduced.matches; updateMotion(); });
  document.addEventListener('visibilitychange', () => studies.forEach(study => document.hidden ? study.stop() : study.schedule()));
  updateMotion();
})();
