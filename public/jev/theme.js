/* /jev theme switch: System / Light / Dark, top right of the header.
   Load in <head> without defer so the saved theme applies before first paint.
   The choice is kept per browser in localStorage ("jev-theme"); System clears it. */
(function () {
  var KEY = 'jev-theme';
  var root = document.documentElement;

  function read() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; }
    catch (e) { return 'system'; }
  }
  function apply(choice) {
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
  }
  function save(choice) {
    try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); }
    catch (e) {}
  }

  apply(read());

  var ICONS = {
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  };
  var CHECK = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
  var ORDER = ['system', 'light', 'dark'];

  function mount() {
    var header = document.querySelector('.shell > header') || document.querySelector('header');
    if (!header || header.querySelector('.theme-switch')) return;

    var wrap = document.createElement('div');
    wrap.className = 'theme-switch';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    var menu = document.createElement('div');
    menu.className = 'theme-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    var items = ORDER.map(function (choice) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.dataset.choice = choice;
      b.innerHTML = ICONS[choice] + '<span>' + LABELS[choice] + '</span>' + CHECK;
      b.addEventListener('click', function () { choose(choice); close(true); });
      menu.appendChild(b);
      return b;
    });

    function sync() {
      var current = read();
      btn.innerHTML = ICONS[current];
      btn.setAttribute('aria-label', 'Theme: ' + LABELS[current]);
      btn.title = 'Theme: ' + LABELS[current];
      items.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.choice === current)); });
    }
    function choose(choice) { save(choice); apply(choice); sync(); }
    function open() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var on = menu.querySelector('[aria-checked="true"]') || items[0];
      on.focus();
    }
    function close(refocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }

    btn.addEventListener('click', function () { menu.hidden ? open() : close(false); });
    menu.addEventListener('keydown', function (e) {
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i + items.length - 1) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(false); });
    window.addEventListener('storage', function (e) { if (e.key === KEY) { apply(read()); sync(); } });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    header.appendChild(wrap);
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
