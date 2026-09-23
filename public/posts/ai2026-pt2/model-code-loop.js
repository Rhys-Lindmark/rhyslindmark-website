(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rows = 18;

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
    scene.classList.remove('loop-ready');
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
    const edgeLayer = document.createElement('div');
    edgeLayer.className = 'loop-edge-layer';
    model.append(edgeLayer);
    let edgeSignature = '';
    let edgeMappings = null;
    let edgeSize = '';
    const shuffle = () => {
      const order = [0, 1, 2];
      for (let index = 2; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      return order;
    };
    const paintEdges = () => {
      if (!edgeMappings) return;
      const centers = modelRows.slice(0, 3).map(row => [...row.children].map(node => ({
        x: row.offsetLeft + node.offsetLeft + node.offsetWidth / 2,
        y: row.offsetTop + node.offsetTop + node.offsetHeight / 2
      })));
      const connections = [];
      edgeMappings[0].forEach((target, source) => connections.push([centers[source][0], centers[target][1]]));
      edgeMappings[1].forEach((target, source) => connections.push([centers[source][1], centers[target][2]]));
      edgeLayer.replaceChildren(...connections.map(([from, to]) => {
        const edge = document.createElement('i');
        edge.className = 'loop-edge';
        edge.style.left = `${from.x}px`;
        edge.style.top = `${from.y}px`;
        edge.style.width = `${Math.hypot(to.x - from.x, to.y - from.y)}px`;
        edge.style.transform = `rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad)`;
        return edge;
      }));
      edgeSize = `${model.clientWidth}x${model.clientHeight}`;
    };
    const trainModel = () => {
      let next;
      do {
        next = [shuffle(), shuffle()];
      } while (next.map(order => order.join('')).join('-') === edgeSignature);
      edgeMappings = next;
      edgeSignature = next.map(order => order.join('')).join('-');
      paintEdges();
    };
    let tick = 0;
    const changeCode = () => {
      if (reducedMotion()) return;
      tick++;
      codeRows.forEach((line, row) => {
        if (line.classList.contains('is-built')) line.textContent = codeText(row, tick);
      });
      if (scene.dataset.stage === '1') trainModel();
    };
    const zap = scene.querySelector('.loop-zap');
    if (scene._loopChangeCode) zap.removeEventListener('animationiteration', scene._loopChangeCode);
    zap.addEventListener('animationiteration', changeCode);
    scene._loopChangeCode = changeCode;
    let previousStage = -1;
    return () => {
      const stage = Number(scene.dataset.stage || 0);
      const local = clamp(Number(scene.dataset.localProgress || 0));
      const done = reducedMotion();
      const growth = stage === 2 ? clamp(local / .55) : 0;
      const growthStep = stage === 2 ? Math.min(31, Math.floor(growth * 31)) : 0;
      const modelCount = done ? rows : stage === 0 ? 1 : stage === 1 ? 3 : Math.min(rows, 3 + Math.floor(growthStep / 2));
      const codeCount = done ? rows : stage < 2 ? 2 : Math.min(rows, 2 + Math.ceil(growthStep / 2));
      modelRows.forEach((row, index) => row.classList.toggle('is-built', index < modelCount));
      codeRows.forEach((row, index) => row.classList.toggle('is-built', index < codeCount));
      scene.dataset.direction = stage === 0 ? 'forward' : stage === 1 ? 'back' : 'still';
      scene.querySelector('.loop-link-caption').textContent = stage === 0 ? 'WRITES' : stage === 1 ? 'TRAINS' : '↔';
      scene.style.setProperty('--loop-speed', `${(stage === 2 ? 1.55 - local * .55 : 1.8).toFixed(2)}s`);
      const redwood = done ? 1 : stage === 2 ? clamp((local - .55) / .18) : 0;
      scene.style.setProperty('--redwood-opacity', redwood.toFixed(3));
      scene.style.setProperty('--tower-opacity', (1 - redwood).toFixed(3));
      scene.style.setProperty('--human-opacity', stage === 2 && !done ? (clamp((local - .42) / .1) * (1 - redwood)).toFixed(3) : 0);
      if (stage === 1 && !done) {
        if (previousStage !== 1) trainModel();
        else if (`${model.clientWidth}x${model.clientHeight}` !== edgeSize) paintEdges();
      }
      previousStage = stage;
      scene.classList.add('loop-ready');
    };
  };
})();
