(() => {
  'use strict';
  const scenes = [...document.querySelectorAll('.scene.agents')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.querySelector('#reading-mode');
  let reading = reduced.matches;
  let frame = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  function update() {
    frame = 0;
    scenes.forEach(scene => {
      const sticky = scene.querySelector('.sticky');
      const card = scene.querySelector('.passage');
      const passages = [...card.children];
      const progress = clamp(-scene.getBoundingClientRect().top / Math.max(1, scene.offsetHeight - sticky.offsetHeight));
      const stage = Math.min(passages.length - 1, Math.floor(progress * passages.length));
      passages.forEach((el, i) => el.hidden = !reading && i !== stage);
      const local = Math.min(1, progress * passages.length - stage);
      card.style.setProperty('--card-shift', `${reading ? 0 : sticky.offsetHeight - (sticky.offsetHeight + card.offsetHeight) * local}px`);
      scene.querySelector('.track span').style.width = `${progress * 100}%`;
      scene.dataset.stage = stage;
    });
  }
  function request() { if (!frame) frame = requestAnimationFrame(update); }
  function setMode(value) {
    const anchor = scenes.find(s => s.getBoundingClientRect().top <= innerHeight / 2 && s.getBoundingClientRect().bottom > innerHeight / 2);
    reading = value;
    document.body.classList.toggle('all-mode', reading);
    button.setAttribute('aria-pressed', String(reading));
    button.textContent = reading ? 'Scroll mode' : 'Reading mode';
    update();
    if (anchor) anchor.scrollIntoView({block:'start', behavior:'instant'});
  }
  button.hidden = false;
  button.addEventListener('click', () => setMode(!reading));
  reduced.addEventListener('change', () => setMode(reduced.matches));
  window.addEventListener('scroll', request, {passive:true});
  window.addEventListener('resize', request, {passive:true});
  const observer = new ResizeObserver(request);
  scenes.forEach(s => observer.observe(s.querySelector('.sticky')));
  // Keyboard focus reveals every passage before following links in a moving box.
  scenes.forEach(s => s.querySelector('.passage').addEventListener('focusin', () => { if (!reading) setMode(true); }));
  setMode(reading);
  if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
})();
