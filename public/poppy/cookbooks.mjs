const outline = document.querySelector('.cookbook-outline details');
if (outline && window.matchMedia('(max-width: 51rem)').matches) outline.open = false;

const copyFeedback = document.querySelector('.cookbook-feedback');
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
  const groups = Array.from(document.querySelectorAll('[data-proposal-group]'), (group) => ({
    group,
    id: group.querySelector('h3').id,
    proposals: Array.from(group.querySelectorAll('[data-proposal]'), (row) => ({
      row, text: row.textContent.toLowerCase(),
    })),
  }));

  function filterProposals() {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const { group, id, proposals } of groups) {
      let matches = 0;
      for (const { row, text } of proposals) {
        row.hidden = (topic.value !== '' && topic.value !== id) || !words.every((word) => text.includes(word));
        if (!row.hidden) matches += 1;
      }
      group.hidden = matches === 0;
      count += matches;
    }
    status.textContent = count === 0 ? 'No matching proposals' : count + (count === 1 ? ' proposal' : ' proposals');
  }

  filter.hidden = false;
  input.addEventListener('input', filterProposals);
  topic.addEventListener('change', filterProposals);
  filterProposals();
}
