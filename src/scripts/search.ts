// Global search (Ctrl/⌘ K or "/"): full-text over titles, aliases (both languages) and summaries,
// then the graph neighbours of the best match, so "gradient" also surfaces backpropagation and the derivative.
import MiniSearch from 'minisearch';

interface Doc {
  id: string;
  t: string; // title
  a: string; // aliases, other-language title, notation
  s: string; // summary (plain text)
  ar: string; // area title
  c: 'math' | 'computing';
  lv: string; // level class
  lvl: string; // level label
  n: string[]; // neighbour ids
}

const dialog = document.querySelector<HTMLDialogElement>('.search-dialog')!;
const input = dialog.querySelector<HTMLInputElement>('input')!;
const results = dialog.querySelector<HTMLDivElement>('.search-results')!;
const topicBase = dialog.dataset.topicBase!;

let docs: Map<string, Doc> | undefined;
let mini: MiniSearch<Doc> | undefined;
let loading: Promise<void> | undefined;
let selected = 0;

function load(): Promise<void> {
  loading ??= fetch(dialog.dataset.index!)
    .then((r) => r.json() as Promise<Doc[]>)
    .then((list) => {
      docs = new Map(list.map((d) => [d.id, d]));
      mini = new MiniSearch<Doc>({
        fields: ['t', 'a', 's', 'ar'],
        storeFields: [],
        searchOptions: { boost: { t: 4, a: 2.5, ar: 0.5 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
        processTerm: (term) => term.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
      });
      mini.addAll(list);
    });
  return loading;
}

function open(): void {
  if (dialog.open) return;
  dialog.showModal();
  input.select();
  void load().then(render);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function item(d: Doc): HTMLAnchorElement {
  const a = el('a');
  a.href = `${topicBase}${d.id}/`;
  a.setAttribute('role', 'option');
  a.append(el('span', 'r-title', d.t));
  const meta = el('span', 'r-meta');
  meta.append(el('span', `chip ${d.c}`, d.ar), el('span', `level ${d.lv}`, d.lvl));
  a.append(meta, el('span', 'r-sum', d.s));
  return a;
}

function render(): void {
  if (!mini || !docs) return;
  const q = input.value.trim();
  results.replaceChildren();
  selected = 0;
  if (!q) return;
  let hits = mini.search(q);
  if (!hits.length) hits = mini.search(q, { combineWith: 'OR' });
  if (!hits.length) {
    results.append(el('p', 'empty', dialog.dataset.empty));
    return;
  }
  const shown = new Set<string>();
  for (const h of hits.slice(0, 8)) {
    const d = docs.get(String(h.id));
    if (!d) continue;
    shown.add(d.id);
    results.append(item(d));
  }
  const top = docs.get(String(hits[0]!.id));
  const related = (top?.n ?? []).filter((id) => !shown.has(id)).slice(0, 6);
  if (related.length) {
    results.append(el('div', 'group', `${dialog.dataset.related} · ${top!.t}`));
    for (const id of related) {
      const d = docs.get(id);
      if (d) results.append(item(d));
    }
  }
  highlight();
}

function options(): HTMLAnchorElement[] {
  return [...results.querySelectorAll<HTMLAnchorElement>('a')];
}

function highlight(): void {
  options().forEach((a, i) => {
    if (i === selected) {
      a.setAttribute('aria-selected', 'true');
      a.scrollIntoView({ block: 'nearest' });
    } else a.removeAttribute('aria-selected');
  });
}

input.addEventListener('input', render);
input.addEventListener('keydown', (e) => {
  const opts = options();
  if (e.key === 'ArrowDown') selected = Math.min(selected + 1, opts.length - 1);
  else if (e.key === 'ArrowUp') selected = Math.max(selected - 1, 0);
  else if (e.key === 'Enter' && opts[selected]) {
    location.href = opts[selected]!.href;
    return;
  } else return;
  e.preventDefault();
  highlight();
});

document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    open();
  }
});
