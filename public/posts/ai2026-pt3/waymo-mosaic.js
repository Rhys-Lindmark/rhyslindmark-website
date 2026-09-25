(() => {
  const slide = document.querySelector('.waymo-mosaic-slide');
  const grid = slide?.querySelector('.waymo-mosaic-grid');
  if (!grid) return;

  const shuffle = items => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  // Every row and column mixes driving challenges, time of day, and weather.
  const pattern = [
    ['A', 'B', 'A', 'C', 'A'],
    ['C', 'A', 'B', 'A', 'A'],
    ['A', 'A', 'C', 'A', 'B'],
    ['B', 'A', 'A', 'C', 'A'],
    ['A', 'C', 'A', 'B', 'B'],
  ];
  const buckets = {A: [], B: [], C: []};
  [...grid.querySelectorAll('video')].forEach(video => {
    const scene = Number(video.dataset.scene);
    buckets[scene <= 14 ? 'A' : scene <= 20 ? 'B' : 'C'].push(video);
  });
  Object.values(buckets).forEach(shuffle);
  const rows = shuffle([0, 1, 2, 3, 4]);
  const columns = shuffle([0, 1, 2, 3, 4]);
  grid.replaceChildren(...rows.flatMap(row => columns.map(column => buckets[pattern[row][column]].pop())));

  const videos = [...grid.querySelectorAll('video')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;

  const updatePlayback = () => {
    const shouldPlay = inView && !document.hidden && !reducedMotion.matches;
    videos.forEach(video => {
      if (!shouldPlay) {
        video.pause();
        return;
      }
      if (video.dataset.loaded) {
        if (video.readyState >= 2) video.play().catch(() => {});
        return;
      }
      video.dataset.loaded = 'true';
      video.addEventListener('loadedmetadata', () => {
        video.playbackRate = 0.86 + Math.random() * 0.28;
        if (Number.isFinite(video.duration) && video.duration > 0.4) {
          video.currentTime = Math.random() * video.duration;
        }
        if (inView && !document.hidden && !reducedMotion.matches) video.play().catch(() => {});
      }, {once: true});
      video.preload = 'auto';
      video.load();
    });
  };

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePlayback();
  }, {rootMargin: '150px 0px'}).observe(slide);
  const bounds = slide.getBoundingClientRect();
  inView = bounds.top < innerHeight + 150 && bounds.bottom > -150;
  updatePlayback();
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', updatePlayback);
})();
