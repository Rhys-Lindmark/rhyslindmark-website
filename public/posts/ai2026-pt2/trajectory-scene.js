(() => {
  'use strict';

  const scene = document.getElementById('trajectory-paths');
  if (!scene) return;

  const style = document.createElement('style');
  style.textContent = `
    .scene.trajectory-scene{height:320svh;background:#070b10}
    .trajectory-scene>.sticky{padding:0!important;min-height:0;overflow:hidden;background:#070b10}
    .trajectory-frame{position:absolute;inset:0;margin:0;background:#070b10}
    .trajectory-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block}
    .trajectory-ready .trajectory-base{clip-path:inset(0 var(--trajectory-cut,100%) 0 0);will-change:clip-path}
    .trajectory-frame .trajectory-highlight{opacity:var(--trajectory-highlight,0);will-change:opacity}
    .all-mode .scene.trajectory-scene{height:auto}
    .all-mode .trajectory-scene>.sticky{position:relative;top:0;height:min(82svh,850px);min-height:560px}
    .all-mode .trajectory-base{clip-path:none}
    .all-mode .trajectory-frame .trajectory-highlight{opacity:1}
    @media(max-width:760px){.all-mode .trajectory-scene>.sticky{height:62svh;min-height:420px}}
    @media(prefers-reduced-motion:reduce){.trajectory-base{clip-path:none!important}.trajectory-frame .trajectory-highlight{opacity:1!important}}
  `;
  document.head.append(style);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function render() {
    frame = 0;
    const sticky = scene.querySelector('.sticky');
    const travel = Math.max(1, scene.offsetHeight - sticky.offsetHeight);
    const progress = Math.max(0, Math.min(1, -scene.getBoundingClientRect().top / travel));
    // The paths share branches, so a continuous sweep keeps them connected.
    // Their arrowheads arrive in sequence because each ends at a different x position.
    const t = Math.max(0, Math.min(1, progress / .54));
    const drawn = t * t * (3 - 2 * t);
    scene.style.setProperty('--trajectory-cut', `${((1 - drawn) * 100).toFixed(2)}%`);
    scene.classList.add('trajectory-ready');
    const reveal = reduce.matches ? 1 : Math.max(0, Math.min(1, (progress - .62) / .13));
    scene.style.setProperty('--trajectory-highlight', reveal.toFixed(3));
  }

  function request() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  addEventListener('scroll', request, {passive: true});
  addEventListener('resize', request, {passive: true});
  reduce.addEventListener('change', request);
  new ResizeObserver(request).observe(scene);
  request();
})();
