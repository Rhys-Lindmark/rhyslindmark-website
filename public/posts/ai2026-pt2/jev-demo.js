// Phones use an animated image, avoiding mobile video autoplay restrictions.
(() => {
  const video=document.querySelector('.jev-demo video');
  if (!video) return;
  const source=video.querySelector('source');
  const mobile=matchMedia('(max-width:760px)');
  function update() {
    if (mobile.matches) {
      video.pause();
      if (source.hasAttribute('src')) {source.removeAttribute('src');video.load();}
      video.preload='none';
    } else {
      video.muted=true;video.preload='auto';
      if (!source.hasAttribute('src')) {source.src=source.dataset.src;video.load();}
      video.play().catch(()=>{});
    }
  }
  mobile.addEventListener('change',update);
  update();
})();
