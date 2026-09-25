/* Three original canvas gestures. Geometry and nib pressure are prepared once;
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

  function composition(name) {
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
    // A true square, with one line leaving its right edge.
    add([[230,260],[230,320],[110,320],[110,200],[230,200],[230,260]], 0, .46, name === 'gesture' ? 2.5 : 1.8, .94, 0, true);
    ink([230,260], [[270,260,306,263,345,260]], .43, .66, 2, .95, .25);

    if (name === 'silk') {
      ink([345,260], [
        [425,249,500,108,586,118], [660,127,655,198,605,196],
        [551,192,587,119,651,132], [733,148,781,235,891,249],
      ], .62, 1.46, 2.35, .96);
      ink([345,260], [
        [435,256,531,218,604,227], [669,235,665,293,613,292],
        [561,291,588,224,658,240], [735,257,816,260,891,249],
      ], .84, 1.72, 2.1, .83);
      ink([345,260], [
        [430,275,493,400,592,399], [668,398,672,323,622,323],
        [560,323,593,404,671,380], [761,354,789,279,891,249],
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
    } else if (name === 'gesture') {
      ink([345,260], [
        [448,248,500,166,555,87], [617,-3,657,109,575,184],
        [519,235,539,110,605,104], [743,92,766,218,900,239],
      ], .62, 1.5, 5.4, .98, .97);
      ink([345,260], [
        [443,273,550,247,613,203], [684,153,690,269,612,300],
        [554,323,600,209,659,216], [765,228,834,261,900,239],
      ], .88, 1.75, 4.7, .9, .95);
      ink([345,260], [
        [465,300,503,405,621,433], [734,460,749,352,689,346],
        [621,339,616,447,707,391], [787,342,810,252,900,239],
      ], 1.12, 2, 5.8, .98, .98);
      ink([900,239], [
        [925,222,945,225,952,236], [965,255,927,266,926,247],
        [925,231,965,229,987,231], [1009,235,1011,220,1025,220],
        [1047,221,1034,254,1017,250], [994,244,1021,214,1044,201],
      ], 1.94, 2.47, 3.5, .98, .92);
      ink([1044,201], [
        [1116,154,1080,76,1001,88], [916,100,878,183,888,268],
        [896,341,945,413,990,406], [1047,398,1087,311,1082,261],
      ], 2.4, 3, 4.8, 1, .96);
    } else {
      // Petal loops have broad quiet interiors and nearly touch at their root.
      ink([345,260], [
        [431,225,467,103,606,99], [762,95,757,205,626,211],
        [501,217,507,112,628,125], [756,139,793,218,894,252],
      ], .62, 1.47, 2.3, .95, .46);
      ink([345,260], [
        [441,252,509,226,604,220], [751,210,752,307,608,310],
        [493,313,511,234,621,238], [760,243,793,277,894,252],
      ], .88, 1.73, 2.15, .88, .5);
      ink([345,260], [
        [431,295,485,419,617,422], [772,425,771,321,635,318],
        [515,315,524,412,641,400], [763,389,791,292,894,252],
      ], 1.1, 1.99, 2.3, .95, .46);
      ink([894,252], [
        [923,252,927,221,942,221], [963,221,962,264,943,264],
        [923,264,927,224,948,234], [970,249,994,240,1004,227],
        [1024,207,1040,230,1028,251], [1014,276,995,252,1008,233],
        [1024,210,1065,217,1079,243],
      ], 1.94, 2.5, 2.15, 1, .6);
      ink([1079,243], [
        [1129,334,1044,416,961,393], [879,370,855,277,880,201],
        [906,122,1003,91,1064,143], [1093,168,1104,199,1101,216],
      ], 2.43, 3, 2.55, .98, .58);
    }
    return strokes;
  }

  class Study {
    constructor(section) {
      this.section = section;
      this.canvas = section.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.layer = document.createElement('canvas');
      this.saved = this.layer.getContext('2d');
      this.strokes = composition(section.dataset.study);
      this.elapsed = 0; this.last = 0; this.frame = 0; this.visible = false;
      this.tick = this.tick.bind(this);
      this.resize();
      new ResizeObserver(() => this.resize()).observe(this.canvas);
      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.resume(); else this.pause();
      }, { threshold: .25 }).observe(this.canvas);
      section.querySelector('.replay').addEventListener('click', () => this.replay());
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
    replay() {
      this.pause(); this.elapsed = 0; this.section.dataset.art = 'pending';
      this.clear(); this.render();
      if (reduced.matches) this.finish(); else this.resume();
    }
  }

  document.querySelectorAll('.study').forEach(section => controllers.push(new Study(section)));
  document.addEventListener('visibilitychange', () => controllers.forEach(study => document.hidden ? study.pause() : study.resume()));
  reduced.addEventListener('change', () => { if (reduced.matches) controllers.forEach(study => study.finish()); });
  document.querySelector('#compare').addEventListener('click', event => {
    const comparing = document.body.classList.toggle('compare');
    event.currentTarget.setAttribute('aria-pressed', String(comparing));
    event.currentTarget.textContent = comparing ? 'View large' : 'Compare all';
    if (comparing) {
      window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
      controllers.forEach(study => study.finish());
    }
  });
  document.querySelectorAll('nav a').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.body.classList.remove('compare');
    const compare = document.querySelector('#compare');
    compare.setAttribute('aria-pressed', 'false'); compare.textContent = 'Compare all';
    const target = document.querySelector(link.getAttribute('href'));
    history.replaceState(null, '', link.getAttribute('href'));
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
      controllers.find(study => study.section === target).replay();
    });
  }));
})();
