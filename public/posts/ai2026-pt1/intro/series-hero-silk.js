/* Shared Silk opening for Chips, Models and Agents. Geometry is prepared once;
 * finished marks are cached, and the frame loop stops after three seconds. */
(() => {
  'use strict';
  const DURATION = 3;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const controllers = [];

  // Each tuple is a cubic pen gesture: two handles, then its destination.
  function curve(start, segments) {
    const points = [start];
    let a = start;
    for (const [bx, by, cx, cy, dx, dy] of segments) {
      for (let i = 1; i <= 48; i++) {
        const t = i / 48, u = 1 - t;
        points.push([u ** 3 * a[0] + 3 * u * u * t * bx + 3 * u * t * t * cx + t ** 3 * dx,
          u ** 3 * a[1] + 3 * u * u * t * by + 3 * u * t * t * cy + t ** 3 * dy]);
      }
      a = [dx, dy];
    }
    return points;
  }

  function composition() {
    const strokes = [];
    const add = (points, start, end, width = 2, opacity = 1, nib = .7, line = false) => {
      const distance = [0];
      for (let i = 1; i < points.length; i++) distance.push(distance[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
      const total = distance.at(-1);
      const edges = points.map((p, i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const progress = distance[i] / total;
        const taper = .22 + .78 * Math.pow(Math.sin(Math.PI * progress), .28);
        const pressure = (1 - nib) + nib * (.16 + .84 * Math.abs(Math.sin(angle - .65)));
        const radius = (.24 + width * pressure / 2) * taper;
        return [-Math.sin(angle) * radius, Math.cos(angle) * radius];
      });
      strokes.push({ points, distance, total, edges, start, end, width, opacity, line, cached: false, fullPath: null });
    };
    const ink = (start, segments, begin, end, width = 2, opacity = 1, nib = .7) => add(curve(start, segments), begin, end, width, opacity, nib);
    // A slightly open, asymmetric pen loop, with the same tapered nib as Silk.
    ink([222,248], [
      [224,208,192,191,158,203], [113,218,104,253,114,282],
      [127,321,174,331,208,304], [221,294,230,277,228,260],
    ], 0, .46, 3.1, .96, .75);
    ink([228,260], [[254,260,285,262,313,260]], .43, .66, 2, .95, .25);

      // Bring the three curls 32 units left, beneath the MODELS label.
      ink([313,260], [
        [393,249,468,108,554,118], [628,127,623,198,573,196],
        [519,192,555,119,619,132], [701,148,749,235,891,249],
      ], .62, 1.46, 2.35, .96);
      ink([313,260], [
        [403,256,499,218,572,227], [637,235,633,293,581,292],
        [529,291,556,224,626,240], [703,257,784,260,891,249],
      ], .84, 1.72, 2.1, .83);
      ink([313,260], [
        [398,275,461,400,560,399], [636,398,640,323,590,323],
        [528,323,561,404,639,380], [729,354,757,279,891,249],
      ], 1.05, 1.98, 2.5, .95);
      // Eye, eye, then a single sweep around the head. No profile details.
      ink([891,249], [
        [919,240,947,236,958,247], [971,262,935,272,929,254],
        [926,243,949,241,973,244], [992,246,1006,235,1021,241],
        [1044,252,1012,273,1003,254], [996,238,1021,229,1043,221],
      ], 1.91, 2.45, 2.2, 1);
      ink([1043,221], [
        [1129,184,1061,87,974,107], [896,123,875,199,886,282],
        [895,361,939,417,989,410], [1046,402,1096,311,1079,252],
      ], 2.4, 3, 2.8, .97);
    return strokes;
  }

  class SilkHero {
    constructor(section) {
      this.section = section;
      this.canvas = section.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.layer = document.createElement('canvas');
      this.saved = this.layer.getContext('2d');
      this.strokes = composition();
      this.elapsed = 0; this.last = 0; this.frame = 0; this.visible = false;
      this.tick = this.tick.bind(this);
      this.resize();
      new ResizeObserver(() => this.resize()).observe(this.canvas);
      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.resume(); else this.pause();
      }, { threshold: .25 }).observe(this.canvas);
      if (reduced.matches) this.finish();
    }
    configure(ctx, scale, x, y) {
      ctx.setTransform(scale, 0, 0, scale, x, y);
      const gradient = ctx.createLinearGradient(110, 0, 1120, 0);
      gradient.addColorStop(0, '#eff4f5');
      gradient.addColorStop(.44, '#c1dff0');
      gradient.addColorStop(.73, '#9fcbee');
      gradient.addColorStop(1, '#72ace3');
      ctx.fillStyle = ctx.strokeStyle = gradient;
      ctx.lineJoin = ctx.lineCap = 'round';
    }
    path(stroke, progress) {
      if (progress === 1 && stroke.fullPath) return stroke.fullPath;
      const limit = progress * stroke.total;
      let count = 1;
      while (count < stroke.points.length && stroke.distance[count] <= limit) count++;
      const points = stroke.points.slice(0, count);
      const edges = stroke.edges.slice(0, count);
      if (count < stroke.points.length) {
        const i = count - 1, t = (limit - stroke.distance[i]) / (stroke.distance[count] - stroke.distance[i]);
        points.push(stroke.points[i].map((v, axis) => v + (stroke.points[count][axis] - v) * t));
        edges.push(stroke.edges[i].map((v, axis) => v + (stroke.edges[count][axis] - v) * t));
      }
      const path = new Path2D();
      if (stroke.line) {
        path.moveTo(...points[0]);
        for (let i = 1; i < points.length; i++) path.lineTo(...points[i]);
      } else {
        path.moveTo(points[0][0] + edges[0][0] * this.penScale, points[0][1] + edges[0][1] * this.penScale);
        for (let i = 1; i < points.length; i++) path.lineTo(points[i][0] + edges[i][0] * this.penScale, points[i][1] + edges[i][1] * this.penScale);
        for (let i = points.length - 1; i >= 0; i--) path.lineTo(points[i][0] - edges[i][0] * this.penScale, points[i][1] - edges[i][1] * this.penScale);
        path.closePath();
      }
      if (progress === 1) stroke.fullPath = path;
      return path;
    }
    draw(ctx, stroke, progress) {
      const path = this.path(stroke, progress);
      ctx.globalAlpha = stroke.opacity;
      if (stroke.line) { ctx.lineWidth = stroke.width * this.penScale; ctx.stroke(path); }
      else ctx.fill(path);
    }
    render() {
      for (const stroke of this.strokes) {
        if (this.elapsed >= stroke.end && !stroke.cached) {
          this.draw(this.saved, stroke, 1); stroke.cached = true;
        }
      }
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(this.layer, 0, 0);
      this.ctx.restore();
      for (const stroke of this.strokes) if (this.elapsed > stroke.start && this.elapsed < stroke.end) {
        this.draw(this.ctx, stroke, clamp((this.elapsed - stroke.start) / (stroke.end - stroke.start)));
      }
    }
    clear() {
      this.saved.save(); this.saved.setTransform(1, 0, 0, 1, 0, 0);
      this.saved.clearRect(0, 0, this.layer.width, this.layer.height); this.saved.restore();
      this.strokes.forEach(stroke => { stroke.cached = false; stroke.fullPath = null; });
    }
    resize() {
      const { width, height } = this.canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (w === this.canvas.width && h === this.canvas.height) return;
      this.canvas.width = this.layer.width = w; this.canvas.height = this.layer.height = h;
      const scale = Math.min(w / 1200, h / 500);
      this.penScale = width < 650 ? 1.65 : 1;
      this.configure(this.ctx, scale, (w - 1200 * scale) / 2, (h - 500 * scale) / 2);
      this.configure(this.saved, scale, (w - 1200 * scale) / 2, (h - 500 * scale) / 2);
      this.clear(); this.render();
    }
    pause() { cancelAnimationFrame(this.frame); this.frame = 0; this.last = 0; }
    resume() {
      if (this.visible && !document.hidden && this.elapsed < DURATION && !this.frame) this.frame = requestAnimationFrame(this.tick);
    }
    tick(now) {
      this.frame = 0;
      if (!this.visible || document.hidden) { this.last = 0; return; }
      if (this.last) this.elapsed = Math.min(DURATION, this.elapsed + (now - this.last) / 1000);
      this.last = now; this.render();
      if (this.elapsed >= DURATION) this.finish(); else this.resume();
    }
    finish() {
      this.pause(); this.elapsed = DURATION; this.render();
      this.section.dataset.art = 'complete';
    }
  }

  document.querySelectorAll('.series-hero').forEach(section => controllers.push(new SilkHero(section)));
  document.addEventListener('visibilitychange', () => controllers.forEach(study => document.hidden ? study.pause() : study.resume()));
  reduced.addEventListener('change', () => { if (reduced.matches) controllers.forEach(study => study.finish()); });
})();
