(() => {
  'use strict';

  const scene = document.getElementById('trajectory-paths');
  if (!scene) return;

  const style = document.createElement('style');
  style.textContent = `
    .scene.trajectory-scene{height:320svh;background:#070b10}
    .trajectory-scene>.sticky{padding:0!important;min-height:0;overflow:hidden;background:#070b10}
    .trajectory-frame{position:absolute;inset:0;margin:0;background:#070b10}
    .trajectory-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(1.025);display:block}
    .trajectory-frame .trajectory-highlight{opacity:var(--trajectory-highlight,0);will-change:opacity}
    .all-mode .scene.trajectory-scene{height:auto}
    .all-mode .trajectory-scene>.sticky{position:relative;top:0;height:min(82svh,850px);min-height:560px}
    .all-mode .trajectory-frame .trajectory-highlight{opacity:1}
    @media(max-width:760px){.trajectory-frame img{object-fit:contain;transform:none}.all-mode .trajectory-scene>.sticky{height:62svh;min-height:420px}}
    @media(prefers-reduced-motion:reduce){.trajectory-frame .trajectory-highlight{opacity:1!important}}
  `;
  document.head.append(style);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function render() {
    frame = 0;
    const sticky = scene.querySelector('.sticky');
    const travel = Math.max(1, scene.offsetHeight - sticky.offsetHeight);
    const progress = Math.max(0, Math.min(1, -scene.getBoundingClientRect().top / travel));
    const reveal = reduce.matches ? 1 : Math.max(0, Math.min(1, (progress - .48) / .24));
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
