// Keep the completed visual pinned while its last passage leaves the viewport.
(() => {
  const layouts = new WeakMap();
  const clamp = value => Math.max(0, Math.min(1, value));
  function timing(scene) {
    const sticky = scene.querySelector('.sticky'), card = scene.querySelector('.passage');
    const disabled = document.body.classList.contains('all-mode');
    const key = `${innerWidth}:${innerHeight}:${disabled}`;
    let layout = layouts.get(scene);
    if (!layout || layout.key !== key) {
      if (layout?.active) scene.style.height = layout.originalHeight;
      const active = !disabled && card && getComputedStyle(card).position === 'absolute' && getComputedStyle(sticky).position === 'sticky';
      const height = scene.offsetHeight;
      const top = parseFloat(getComputedStyle(sticky).top) || 0;
      const travel = Math.max(1, height - sticky.offsetHeight);
      let exit = 0;
      if (active) {
        // Measure the final passage without changing the visible stage.
        const passages = [...card.querySelectorAll('[data-passage], .card-copy')];
        const hidden = passages.map(el => el.hidden);
        passages.forEach((el, i) => el.hidden = i !== passages.length - 1);
        exit = Math.max(1, card.offsetHeight + card.offsetTop + 26 + top + 24);
        passages.forEach((el, i) => el.hidden = hidden[i]);
      }
      layout = {key, active, travel, exit, top, originalHeight:scene.style.height};
      if (active) scene.style.height = `${height + exit}px`;
      layouts.set(scene, layout);
    }
    const distance = (layout.active ? layout.top : 0) - scene.getBoundingClientRect().top;
    return {...layout, progress:clamp(distance / layout.travel), exitDistance:Math.max(0, Math.min(layout.exit, distance - layout.travel))};
  }
  function shift(scene, local, final, fallback) {
    const t = timing(scene);
    if (!t.active || !final) return fallback;
    const sticky = scene.querySelector('.sticky');
    // Finish reading the last box at the top, then use real scroll pixels to exit.
    return sticky.offsetHeight + (26 - sticky.offsetHeight) * clamp(local) - t.exitDistance;
  }
  window.AIScrollExit = {timing, shift};
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.scene').forEach(scene => {
        if (layouts.has(scene)) timing(scene);
      });
      window.dispatchEvent(new Event('scroll'));
    });
  });
})();
