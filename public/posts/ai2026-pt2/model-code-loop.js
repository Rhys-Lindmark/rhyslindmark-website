(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rows = 14;

  function codeText(row, tick) {
    let seed = (row + 7) * 113 + tick * 97;
    return Array.from({length: 22}, () => {
      seed = (seed * 16807) % 2147483647;
      return alphabet[seed % alphabet.length];
    }).join('');
  }

  window.drawModelCodeLoop = (scene, reducedMotion) => {
    const model = scene.querySelector('.loop-model-stack');
    const code = scene.querySelector('.loop-code-stack');
    if (!model || !code) return () => {};
    model.replaceChildren();
    code.replaceChildren();
    const modelRows = [];
    const codeRows = [];
    for (let row = 0; row < rows; row++) {
      const modelRow = document.createElement('div');
      modelRow.className = 'loop-model-row';
      for (let node = 0; node < 3; node++) {
        const dot = document.createElement('i');
        dot.className = 'loop-node';
        modelRow.append(dot);
      }
      model.append(modelRow);
      modelRows.push(modelRow);
      const codeRow = document.createElement('span');
      codeRow.className = 'loop-code-row';
      codeRow.textContent = codeText(row, 0);
      code.append(codeRow);
      codeRows.push(codeRow);
    }
    let tick = 0;
    const changeCode = () => {
      if (reducedMotion()) return;
      tick++;
      codeRows.forEach((line, row) => {
        if (line.classList.contains('is-built')) line.textContent = codeText(row, tick);
      });
    };
    const zap = scene.querySelector('.loop-zap');
    if (scene._loopChangeCode) zap.removeEventListener('animationiteration', scene._loopChangeCode);
    zap.addEventListener('animationiteration', changeCode);
    scene._loopChangeCode = changeCode;
    return () => {
      const stage = Number(scene.dataset.stage || 0);
      const local = clamp(Number(scene.dataset.localProgress || 0));
      const done = reducedMotion();
      const growthStep = stage === 2 ? Math.min(22, Math.floor(local * 23)) : 0;
      const modelCount = done ? rows : stage === 0 ? 1 : stage === 1 ? 3 : Math.min(rows, 3 + Math.floor(growthStep / 2));
      const codeCount = done ? rows : stage < 2 ? 2 : Math.min(rows, 2 + Math.ceil(growthStep / 2));
      modelRows.forEach((row, index) => row.classList.toggle('is-built', index < modelCount));
      codeRows.forEach((row, index) => row.classList.toggle('is-built', index < codeCount));
      scene.dataset.direction = stage === 0 ? 'forward' : stage === 1 ? 'back' : growthStep % 2 ? 'back' : 'forward';
      scene.querySelector('.loop-link-caption').textContent = stage === 0 ? 'WRITES' : stage === 1 ? 'TRAINS' : '↔';
      scene.style.setProperty('--loop-speed', `${(stage === 2 ? 1.55 - local * .55 : 1.8).toFixed(2)}s`);
      scene.style.setProperty('--human-opacity', done || stage === 2 && local > .9 ? clamp((local - .9) * 10) : 0);
    };
  };
})();
