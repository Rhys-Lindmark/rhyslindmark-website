(() => {
  'use strict';
  const scenes = [...document.querySelectorAll('.scene.agents')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const entries = [...document.querySelectorAll('#article [data-slide]')].map(el => {
    const scene = el.closest('.scene.agents');
    const passages = scene ? [...scene.querySelectorAll('.card-copy')] : [el];
    return {id:el.dataset.slide, el, scene, index:passages.indexOf(el), count:passages.length};
  });
  let frame = 0, linksReady = false;
  const clamp = value => Math.max(0, Math.min(1, value));
  function setAddress(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('slide', id);
    else url.searchParams.delete('slide');
    url.hash = '';
    if (url.href !== location.href) history.replaceState(history.state, '', url.pathname + url.search);
  }
  function syncAddress() {
    if (!linksReady) return;
    let current;
    for (const entry of entries) {
      const target = entry.scene && !reduced.matches ? entry.scene : entry.el;
      if (target.getBoundingClientRect().top > document.querySelector('header').getBoundingClientRect().bottom + 1) break;
      if (!entry.scene || reduced.matches || entry.index === Number(entry.scene.dataset.stage || 0)) current = entry;
    }
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = entries.at(-1);
    setAddress(current?.id);
  }
  function update() {
    frame = 0;
    scenes.forEach(scene => {
      const sticky = scene.querySelector('.sticky');
      const card = scene.querySelector('.passage');
      const passages = [...card.children];
      const progress = clamp(-scene.getBoundingClientRect().top / Math.max(1, scene.offsetHeight - sticky.offsetHeight));
      const stage = Math.min(passages.length - 1, Math.floor(progress * passages.length));
      passages.forEach((el, i) => el.hidden = !reduced.matches && i !== stage);
      const local = Math.min(1, progress * passages.length - stage);
      card.style.setProperty('--card-shift', `${reduced.matches ? 0 : sticky.offsetHeight - (sticky.offsetHeight + card.offsetHeight) * local}px`);
      scene.querySelector('.track span').style.width = `${progress * 100}%`;
      scene.dataset.stage = stage;
    });
    syncAddress();
  }
  function request() { if (!frame) frame = requestAnimationFrame(update); }
  function followAddress() {
    linksReady = false;
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    const hashTarget = hash ? document.getElementById(hash) : null;
    const id = new URL(location.href).searchParams.get('slide');
    const entry = hashTarget
      ? entries.find(e => e.el === hashTarget || e.scene === hashTarget)
      : !hash && entries.find(e => e.id === id);
    if (entry) {
      const target = entry.scene && !reduced.matches ? entry.scene : entry.el;
      const sticky = entry.scene?.querySelector('.sticky');
      const travel = sticky && !reduced.matches ? Math.max(0, entry.scene.offsetHeight - sticky.offsetHeight) : 0;
      // Land with the requested text box visible, not below the graph.
      const inset = travel ? 0 : document.querySelector('header').offsetHeight;
      scrollTo({top:scrollY + target.getBoundingClientRect().top - inset + travel * (entry.index + .45) / entry.count, behavior:'instant'});
      setAddress(entry.id);
    } else if (hashTarget) {
      hashTarget.scrollIntoView({behavior:'instant'});
    } else if (!hash && !id) {
      scrollTo({top:0, behavior:'instant'});
    }
    linksReady = true;
    update();
  }
  document.body.classList.toggle('all-mode', reduced.matches);
  reduced.addEventListener('change', () => {
    document.body.classList.toggle('all-mode', reduced.matches);
    followAddress();
  });
  window.addEventListener('scroll', request, {passive:true});
  window.addEventListener('resize', request, {passive:true});
  window.addEventListener('hashchange', followAddress);
  window.addEventListener('popstate', followAddress);
  const observer = new ResizeObserver(request);
  scenes.forEach(s => observer.observe(s.querySelector('.sticky')));
  // The shared intro changes page height on upgrade. Finish that layout before
  // resolving an incoming slide, so direct links land on the intended passage.
  customElements.whenDefined('ai-building-intro').then(() => requestAnimationFrame(() => requestAnimationFrame(followAddress)));
  update();
})();
