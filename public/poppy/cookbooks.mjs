const outline = document.querySelector('.cookbook-outline details');
if (outline) {
  if (window.matchMedia('(max-width: 51rem)').matches) outline.open = false;
  const sections = Array.from(outline.querySelectorAll('a'), (link) => ({
    link, heading: document.getElementById(link.hash.slice(1)),
  }));
  let active;
  const markSection = () => {
    const current = sections.findLast(({ heading }) => heading.getBoundingClientRect().top <= 110) ?? sections[0];
    if (current === active) return;
    active?.link.removeAttribute('aria-current');
    current.link.setAttribute('aria-current', 'location');
    active = current;
  };
  window.addEventListener('scroll', markSection, { passive: true });
  markSection();
}

const copyFeedback = document.querySelector('.cookbook-feedback');
const copyPage = document.querySelector('[data-copy-page]');
if (copyPage) {
  const markdown = document.querySelector('#cookbook-markdown').content.textContent;
  let reset;
  copyPage.hidden = false;
  copyPage.addEventListener('click', async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(markdown);
      copyPage.textContent = 'Copied';
      copyFeedback.textContent = 'Cookbook Markdown copied.';
    } catch {
      copyPage.textContent = 'Copy was blocked';
      copyFeedback.textContent = 'Open the Markdown link to copy the cookbook.';
    }
    reset = setTimeout(() => { copyPage.textContent = 'Copy page'; copyFeedback.textContent = ''; }, 2300);
  });
}

for (const button of document.querySelectorAll('[data-copy]')) {
  const code = button.closest('.cookbook-code').querySelector('code');
  let reset;
  button.hidden = false;
  button.addEventListener('click', async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied';
      copyFeedback.textContent = 'Code copied to clipboard.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Selected';
      copyFeedback.textContent = 'Code selected. Use your device’s copy command.';
    }
    reset = setTimeout(() => {
      button.textContent = 'Copy';
      copyFeedback.textContent = '';
    }, 1800);
  });
}

const filter = document.querySelector('[data-filter]');
if (filter) {
  const input = filter.querySelector('input');
  const topic = filter.querySelector('select');
  const status = filter.querySelector('[data-count]');
  const featured = document.querySelector('[data-featured]');
  const guides = document.querySelector('[data-guide-section]');
  const proposals = document.querySelector('[data-proposal-section]');
  const groups = Array.from(proposals.querySelectorAll('[data-proposal-group]'));
  const rows = Array.from(document.querySelectorAll('[data-guide], [data-proposal]'), (row) => ({
    row, text: row.textContent.toLowerCase(), topic: row.dataset.topic ?? row.closest('[data-proposal-group]').querySelector('h3').id,
  }));

  function filterCookbooks() {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const narrowed = words.length > 0 || topic.value !== '';
    let matches = 0;
    for (const item of rows) {
      item.row.hidden = (topic.value !== '' && topic.value !== item.topic) || !words.every((word) => item.text.includes(word));
      if (!item.row.hidden) matches += 1;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-proposal]:not([hidden])');
    featured.hidden = narrowed;
    guides.hidden = !guides.querySelector('[data-guide]:not([hidden])');
    proposals.hidden = groups.every((group) => group.hidden);
    document.querySelector('.cookbook-source a[href="#runnable-guides"]').hidden = guides.hidden;
    document.querySelector('.cookbook-source a[href="#proposals"]').hidden = proposals.hidden;
    status.textContent = !narrowed ? '' : matches === 0 ? 'No matching cookbooks' :
      matches + (matches === 1 ? ' result' : ' results');
  }

  filter.hidden = false;
  input.addEventListener('input', filterCookbooks);
  topic.addEventListener('change', filterCookbooks);
  filterCookbooks();
}
