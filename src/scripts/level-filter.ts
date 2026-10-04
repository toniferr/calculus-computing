export {};

// Filter buttons: [data-level-filter] holds buttons with data-level; items anywhere on the page carry data-level.
// Used by the syllabus and the exercises page (which also filters by [data-type]).
for (const group of document.querySelectorAll<HTMLElement>('[data-level-filter], [data-type-filter]')) {
  const attr = group.hasAttribute('data-type-filter') ? 'type' : 'level';
  const buttons = [...group.querySelectorAll<HTMLButtonElement>(`button[data-${attr}]`)];
  for (const b of buttons) {
    b.addEventListener('click', () => {
      for (const o of buttons) o.setAttribute('aria-pressed', String(o === b));
      document.body.dataset[`filter${attr === 'type' ? 'Type' : 'Level'}`] = b.dataset[attr];
      apply();
    });
  }
}

function apply(): void {
  const level = document.body.dataset.filterLevel ?? 'all';
  const type = document.body.dataset.filterType ?? 'all';
  for (const el of document.querySelectorAll<HTMLElement>('[data-filterable], .syl-list li')) {
    const okLevel = level === 'all' || el.dataset.level === level;
    const okType = type === 'all' || !el.dataset.type || el.dataset.type === type;
    el.hidden = !(okLevel && okType);
  }
}
