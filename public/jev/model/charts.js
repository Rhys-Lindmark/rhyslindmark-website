// /jev/model charts: eval small multiples and training loss. Data from evals/open-jev/results/summary.json
// and evals/open-jev/runs/<arm>/train.log (400-step runs, logged every 10 optimizer steps).
(() => {
  const MODELS = [
    { id: "jev", name: "Jev 1.14", long: "Jev 1.14 (hosted)" },
    { id: "parent", name: "Kev-4B", long: "Kev-4B, released" },
    { id: "hard", name: "+ majority", long: "+ crowd, majority labels" },
    { id: "soft", name: "+ vote shares", long: "+ crowd, human vote shares" },
    { id: "synth", name: "+ synthetic", long: "+ crowd, synthetic votes" },
  ];
  const PANELS = [
    { title: "Accuracy", sub: "breadth-v1 · 14 held-out datasets", v: { jev: 75.7, parent: 69.5, hard: 69.9, soft: 70.3, synth: 70.4 } },
    { title: "Automatable at 5% error", sub: "breadth-v1 · share answered alone", v: { jev: 54.2, parent: 33.4, hard: 33.9, soft: 33.6, synth: 34.8 } },
    { title: "Accuracy", sub: "transfer-v4 · never-trained datasets", v: { jev: null, parent: 81.7, hard: 81.7, soft: 81.7, synth: 81.6 } },
    { title: "Matches the majority", sub: "held-out crowd items", v: { jev: 55.9, parent: 47.4, hard: 65.2, soft: 65.2, synth: 59.9 } },
    { title: "Matches the vote split (1 − JSD)", sub: "held-out crowd items", v: { jev: 75.1, parent: 72.3, hard: 78.4, soft: 76.4, synth: 77.1 } },
    { title: "Matches the majority", sub: "ChaosNLI · never trained", v: { jev: 76.2, parent: 73.7, hard: 74.4, soft: 74.9, synth: 74.1 } },
  ];
  const LOSS = {
    hard: [1.076, .942, .773, .859, .696, .652, .802, .847, .834, .755, .800, .729, .888, .748, .849, .845, .669, .709, .747, .737, .618, .681, .774, .797, .860, .750, .877, .682, .785, .755, .719, .775, .672, .733, .759, .678, .653, .779, .650, .739],
    soft: [1.185, .987, .826, 1.006, .805, .803, .858, .931, .869, .837, .838, .766, .965, .834, .860, .891, .756, .829, .778, .835, .735, .831, .880, .877, .955, .772, .910, .776, .900, .866, .826, .851, .779, .825, .860, .814, .770, .845, .784, .884],
    synth: [.875, .703, .669, .727, .565, .653, .700, .680, .664, .616, .678, .629, .667, .615, .618, .735, .489, .604, .619, .601, .624, .537, .632, .621, .764, .553, .709, .566, .626, .617, .603, .661, .590, .550, .590, .624, .589, .621, .561, .626],
  };
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text) => {
    const n = tag.startsWith("svg:") ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  const tip = el("div", { class: "viz-tip", role: "tooltip" });
  document.body.appendChild(tip);
  const showTip = (html, x, y) => {
    tip.innerHTML = html; tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(x + 12, innerWidth - r.width - 8) + "px";
    tip.style.top = Math.max(8, y - r.height - 10) + "px";
  };
  const hideTip = () => { tip.style.display = "none"; };

  // ---- eval small multiples -------------------------------------------------------------------------------------
  const evals = document.getElementById("eval-chart");
  if (evals) {
    const legend = el("div", { class: "viz-legend" });
    for (const m of MODELS) {
      const item = el("span"); item.append(el("i", { class: `sw m-${m.id}` }), document.createTextNode(m.long)); legend.append(item);
    }
    evals.append(legend);
    const grid = el("div", { class: "viz-panels" });
    for (const p of PANELS) {
      const panel = el("div", { class: "viz-panel" });
      panel.append(el("div", { class: "viz-panel-title" }, p.title), el("div", { class: "viz-panel-sub" }, p.sub));
      const parent = p.v.parent;
      for (const m of MODELS) {
        const val = p.v[m.id];
        const row = el("div", { class: "viz-row", tabindex: "0" });
        row.append(el("span", { class: "viz-name" }, m.name));
        const track = el("span", { class: "viz-track" });
        if (val == null) {
          track.append(el("span", { class: "viz-na" }, "not measured"));
          row.setAttribute("aria-label", `${m.long}: not measured`);
        } else {
          const bar = el("span", { class: `viz-bar m-${m.id}` }); bar.style.width = `${val}%`;
          track.append(bar);
          const d = m.id !== "parent" ? val - parent : null;
          const label = `${m.long}: ${val.toFixed(1)}%` + (d != null ? ` (${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} vs released Kev-4B)` : "");
          row.setAttribute("aria-label", label);
          const html = `<b>${m.long}</b><br>${p.title}, ${p.sub}<br>${val.toFixed(1)}%` + (d != null ? ` · ${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} vs released` : "");
          row.addEventListener("mousemove", (e) => showTip(html, e.clientX, e.clientY));
          row.addEventListener("mouseleave", hideTip);
          row.addEventListener("focus", () => { const r = row.getBoundingClientRect(); showTip(html, r.left + r.width / 2, r.top); });
          row.addEventListener("blur", hideTip);
        }
        row.append(track, el("span", { class: "viz-val" }, val == null ? "–" : val.toFixed(1)));
        panel.append(row);
      }
      grid.append(panel);
    }
    evals.append(grid);
  }

  // ---- training loss --------------------------------------------------------------------------------------------
  const loss = document.getElementById("loss-chart");
  if (loss) {
    const W = 720, H = 300, m = { l: 44, r: 108, t: 12, b: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = (s) => m.l + (s / 400) * iw, Y0 = 0.4, Y1 = 1.2, Y = (v) => m.t + (1 - (v - Y0) / (Y1 - Y0)) * ih;
    const svg = el("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Training loss over 400 optimizer steps for the three arms. All three fall fastest in the first 50 steps, then flatten." });
    for (let v = 0.4; v <= 1.2001; v += 0.2) {
      svg.append(el("svg:line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), class: "viz-grid" }));
      svg.append(el("svg:text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end", class: "viz-tick" }, v.toFixed(1)));
    }
    for (let s = 0; s <= 400; s += 100) svg.append(el("svg:text", { x: X(s), y: H - 12, "text-anchor": "middle", class: "viz-tick" }, s));
    svg.append(el("svg:line", { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: "viz-axis" }));
    svg.append(el("svg:text", { x: m.l + iw / 2, y: H, "text-anchor": "middle", class: "viz-tick" }, "optimizer step"));
    const ends = [];
    for (const arm of ["hard", "soft", "synth"]) {
      const pts = LOSS[arm].map((v, i) => `${X((i + 1) * 10).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
      svg.append(el("svg:polyline", { points: pts, class: `viz-line m-${arm}` }));
      ends.push({ arm, y: Y(LOSS[arm].at(-1)) });
    }
    // direct labels at the right edge, nudged apart
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    for (const e of ends) svg.append(el("svg:text", { x: m.l + iw + 8, y: e.y + 4, class: "viz-endlabel" }, MODELS.find((x) => x.id === e.arm).name));
    const cross = el("svg:line", { y1: m.t, y2: m.t + ih, class: "viz-cross", style: "display:none" });
    const dots = ["hard", "soft", "synth"].map((arm) => { const c = el("svg:circle", { r: 4, class: `viz-dot m-${arm}`, style: "display:none" }); svg.append(c); return [arm, c]; });
    svg.append(cross);
    const hit = el("svg:rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    svg.append(hit);
    hit.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(39, Math.round(((sx - m.l) / iw) * 40) - 1));
      const x = X((i + 1) * 10);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.style.display = "";
      for (const [arm, c] of dots) { c.setAttribute("cx", x); c.setAttribute("cy", Y(LOSS[arm][i])); c.style.display = ""; }
      showTip(`<b>Step ${(i + 1) * 10}</b><br>` + ["hard", "soft", "synth"].map((a) => `<i class="sw m-${a}"></i>${MODELS.find((x) => x.id === a).name} ${LOSS[a][i].toFixed(3)}`).join("<br>"), e.clientX, e.clientY);
    });
    hit.addEventListener("mouseleave", () => { cross.style.display = "none"; dots.forEach(([, c]) => (c.style.display = "none")); hideTip(); });
    const legend = el("div", { class: "viz-legend" });
    for (const arm of ["hard", "soft", "synth"]) {
      const mm = MODELS.find((x) => x.id === arm);
      const item = el("span"); item.append(el("i", { class: `sw m-${arm}` }), document.createTextNode(mm.long)); legend.append(item);
    }
    loss.append(legend, svg);
  }
})();
