(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));

  window.drawModelCodeLoop = (scene, reducedMotion) => () => {
    const stage = Number(scene.dataset.stage || 0);
    const local = clamp(Number(scene.dataset.localProgress || 0));
    const done = reducedMotion();
    const growth = done ? 1 : stage === 2 ? local : 0;

    scene.style.setProperty('--code-reveal', `${Math.round((done || stage > 0 ? 1 : clamp(local * 1.35)) * 100)}%`);
    scene.style.setProperty('--transfer-duration', `${(done ? 0 : 2.3 - local * .9).toFixed(2)}s`);
    scene.style.setProperty('--forest-progress', growth.toFixed(3));
    scene.style.setProperty('--forest-scale', (0.73 + growth * .34).toFixed(3));
    scene.style.setProperty('--orbit-duration', `${(done ? 3 : 3.4 - growth * 2.95).toFixed(2)}s`);
  };
})();
