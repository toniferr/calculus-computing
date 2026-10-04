export {};

// Interactive knowledge map: positions come precomputed from the build (d3-force), so this script only draws,
// pans/zooms, filters and answers "where does it come from?" (upstream) and "where is it used?" (downstream).

interface Area { id: string; t: string; g: string; k: 'math' | 'computing'; n: number }
interface MapNode { id: string; t: string; a: number; lv: string; c: 0 | 1; x: number; y: number; r: number; o: number; s: string }
type EdgeTuple = [number, number, 0 | 1, number, 0 | 1];
interface Data {
  areas: Area[];
  nodes: MapNode[];
  edges: EdgeTuple[];
  urls: { topic: string };
  ui: { upstream: string; downstream: string; open: string; clear: string; levels: Record<string, string> };
}

const NS = 'http://www.w3.org/2000/svg';
const data = JSON.parse(document.getElementById('map-data')!.textContent!) as Data;
const svg = document.querySelector<SVGSVGElement>('.map-svg')!;
const vp = svg.querySelector<SVGGElement>('.viewport')!;
const gEdges = svg.querySelector<SVGGElement>('.edges')!;
const gNodes = svg.querySelector<SVGGElement>('.nodes')!;
const gAreas = svg.querySelector<SVGGElement>('.areas')!;
const panel = document.querySelector<HTMLElement>('.map-panel')!;
const N = data.nodes.length;

// ---------------------------------------------------------------- adjacency
const out: number[][] = Array.from({ length: N }, () => []);
const inn: number[][] = Array.from({ length: N }, () => []);
data.edges.forEach(([a, b], i) => {
  out[a]!.push(i);
  inn[b]!.push(i);
});

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

// ---------------------------------------------------------------- draw
const edgeEls = data.edges.map(([a, b, kind, , weak]) => {
  const A = data.nodes[a]!;
  const B = data.nodes[b]!;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const line = el('line', {
    x1: A.x + (dx / len) * A.r,
    y1: A.y + (dy / len) * A.r,
    x2: B.x - (dx / len) * (B.r + 2),
    y2: B.y - (dy / len) * (B.r + 2),
    class: `edge${kind ? ' app' : ''}${weak ? ' weak' : ''}`,
    'marker-end': 'url(#arr)',
  });
  gEdges.append(line);
  return line;
});

const nodeEls = data.nodes.map((n, i) => {
  const g = el('g', { class: `node${n.c ? ' core' : ''}`, transform: `translate(${n.x} ${n.y})`, 'data-i': i });
  const c = el('circle', { r: n.r });
  const title = el('title');
  title.textContent = `${n.t} · ${data.areas[n.a]!.t}`;
  c.append(title);
  const label = el('text', { x: n.r + 3, y: 4 });
  label.textContent = n.t;
  g.append(c, label);
  gNodes.append(g);
  return g;
});

// Area labels above each cluster.
const areaLabels = data.areas.map((a, ai) => {
  const members = data.nodes.filter((n) => n.a === ai);
  const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
  const top = Math.min(...members.map((n) => n.y));
  const text = el('text', { x: cx, y: top - 30, class: 'area-label' });
  text.textContent = `${a.g}  ${a.t}`;
  gAreas.append(text);
  return text;
});

// Colours: mathematics in cool hues, computing in warm hues; lightness follows the theme.
function paint(): void {
  const light = document.documentElement.dataset.theme === 'light';
  data.nodes.forEach((n, i) => {
    const a = data.areas[n.a]!;
    const hue = a.k === 'math' ? 185 + a.n * 5 : 18 + a.n * 6;
    const sat = a.k === 'math' ? 70 : 82;
    const lum = light ? (a.k === 'math' ? 42 : 45) : a.k === 'math' ? 66 : 62;
    nodeEls[i]!.firstElementChild!.setAttribute('fill', `hsl(${hue} ${sat}% ${lum}%)`);
  });
}
paint();
window.addEventListener('cc-theme', paint);

// ---------------------------------------------------------------- view transform
let k = 1;
let tx = 0;
let ty = 0;

function apply(): void {
  vp.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)})`);
  svg.style.setProperty('--k', String(k));
  svg.classList.toggle('mid', k > 0.75);
  svg.classList.toggle('near', k > 1.6);
}

function zoomAt(px: number, py: number, factor: number): void {
  const nk = Math.min(6, Math.max(0.12, k * factor));
  tx = px - (px - tx) * (nk / k);
  ty = py - (py - ty) * (nk / k);
  k = nk;
  apply();
}

function fit(indices: number[] = visibleIndices(), pad = 60, besidePanel = false): void {
  if (!indices.length) return;
  const xs = indices.map((i) => data.nodes[i]!.x);
  const ys = indices.map((i) => data.nodes[i]!.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys) - 30, Math.max(...ys)];
  const W = svg.clientWidth - (besidePanel && !panel.hidden ? Math.min(panel.offsetWidth + 16, svg.clientWidth / 2) : 0);
  const H = svg.clientHeight;
  k = Math.min(2, Math.min(W / (x1 - x0 + pad * 2), H / (y1 - y0 + pad * 2)));
  tx = W / 2 - k * (x0 + x1) / 2;
  ty = H / 2 - k * (y0 + y1) / 2;
  apply();
}

function centerOn(i: number, zoom = 1.8): void {
  const n = data.nodes[i]!;
  k = zoom;
  const panelW = panel.hidden ? 0 : Math.min(panel.offsetWidth, svg.clientWidth / 2);
  tx = (svg.clientWidth - panelW) / 2 - k * n.x;
  ty = svg.clientHeight / 2 - k * n.y;
  apply();
}

svg.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  },
  { passive: false },
);

// Pan with one pointer, pinch-zoom with two; a short press without movement is a click.
const pointers = new Map<number, { x: number; y: number }>();
let moved = 0;
let pinch = 0;
svg.addEventListener('pointerdown', (e) => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    pinch = Math.hypot(p!.x - q!.x, p!.y - q!.y);
  }
});
svg.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY };
  pointers.set(e.pointerId, cur);
  if (pointers.size === 1) {
    tx += cur.x - prev.x;
    ty += cur.y - prev.y;
    moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    if (moved > 4) svg.classList.add('dragging');
    apply();
  } else if (pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    const d = Math.hypot(p!.x - q!.x, p!.y - q!.y);
    const r = svg.getBoundingClientRect();
    if (pinch) zoomAt((p!.x + q!.x) / 2 - r.left, (p!.y + q!.y) / 2 - r.top, d / pinch);
    pinch = d;
    moved = 99;
  }
});
function release(e: PointerEvent): void {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  svg.classList.remove('dragging');
  if (pointers.size === 0 && moved <= 4 && e.type === 'pointerup') {
    const hit = (e.target as Element).closest?.('.node');
    if (hit) select(Number(hit.getAttribute('data-i')));
    else clearSelection();
  }
  if (pointers.size < 2) pinch = 0;
}
svg.addEventListener('pointerup', release);
svg.addEventListener('pointercancel', release);

// ---------------------------------------------------------------- filters
const state = { scope: 'all', kinds: new Set(['math', 'computing']), levels: new Set(Object.keys(data.ui.levels)) };

function visible(i: number): boolean {
  const n = data.nodes[i]!;
  return (state.scope === 'all' || n.c === 1) && state.kinds.has(data.areas[n.a]!.k) && state.levels.has(n.lv);
}

function visibleIndices(): number[] {
  return data.nodes.map((_, i) => i).filter(visible);
}

function applyFilters(): void {
  const vis = data.nodes.map((_, i) => visible(i));
  nodeEls.forEach((g, i) => g.classList.toggle('hidden', !vis[i]));
  edgeEls.forEach((l, i) => {
    const [a, b] = data.edges[i]!;
    l.classList.toggle('hidden', !vis[a] || !vis[b]);
  });
  areaLabels.forEach((t, ai) => t.classList.toggle('hidden', !state.kinds.has(data.areas[ai]!.k)));
  if (selected !== null && !vis[selected]) clearSelection();
}

function press(btn: HTMLButtonElement, on: boolean): void {
  btn.setAttribute('aria-pressed', String(on));
}

const scopeBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-scope]')];
for (const b of scopeBtns)
  b.addEventListener('click', () => {
    state.scope = b.dataset.scope!;
    scopeBtns.forEach((o) => press(o, o === b));
    applyFilters();
    fit();
  });
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-kind]'))
  b.addEventListener('click', () => {
    const kind = b.dataset.kind!;
    if (state.kinds.has(kind) && state.kinds.size > 1) state.kinds.delete(kind);
    else state.kinds.add(kind);
    press(b, state.kinds.has(kind));
    applyFilters();
    fit();
  });
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lv]'))
  b.addEventListener('click', () => {
    const lv = b.dataset.lv!;
    if (state.levels.has(lv) && state.levels.size > 1) state.levels.delete(lv);
    else state.levels.add(lv);
    press(b, state.levels.has(lv));
    applyFilters();
  });
document.querySelector('[data-reset]')?.addEventListener('click', () => {
  clearSelection();
  fit();
});

// ---------------------------------------------------------------- selection, upstream and downstream
let selected: number | null = null;
type Mode = 'nbr' | 'up' | 'down';

/** BFS over incoming (up) or outgoing (down) edges; returns node → distance. */
function reach(start: number, dir: 'up' | 'down'): Map<number, number> {
  const dist = new Map<number, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const v = queue.shift()!;
    for (const ei of dir === 'up' ? inn[v]! : out[v]!) {
      const [a, b] = data.edges[ei]!;
      const w = dir === 'up' ? a : b;
      if (!dist.has(w) && visible(w)) {
        dist.set(w, dist.get(v)! + 1);
        queue.push(w);
      }
    }
  }
  return dist;
}

function highlight(mode: Mode): Map<number, number> {
  const s = selected!;
  const set = mode === 'nbr' ? new Map<number, number>([[s, 0]]) : reach(s, mode);
  if (mode === 'nbr')
    for (const ei of [...inn[s]!, ...out[s]!]) {
      const [a, b] = data.edges[ei]!;
      set.set(a === s ? b : a, 1);
    }
  svg.classList.add('focus');
  nodeEls.forEach((g, i) => {
    g.classList.toggle('on', set.has(i));
    g.classList.toggle('sel', i === s);
  });
  edgeEls.forEach((l, i) => {
    const [a, b] = data.edges[i]!;
    const on = mode === 'nbr' ? (a === s || b === s) : set.has(a) && set.has(b) && (mode === 'up' ? set.get(a)! > set.get(b)! : set.get(b)! > set.get(a)!);
    l.classList.toggle('on', on);
  });
  return set;
}

function topicLink(i: number): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = `${data.urls.topic}${data.nodes[i]!.id}/`;
  a.textContent = data.nodes[i]!.t;
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    select(i);
    centerOn(i, Math.max(k, 1.2));
  });
  return a;
}

function renderPanel(mode: Mode, set: Map<number, number>): void {
  const n = data.nodes[selected!]!;
  const area = data.areas[n.a]!;
  panel.replaceChildren();
  const close = document.createElement('button');
  close.className = 'btn small panel-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', data.ui.clear);
  close.addEventListener('click', clearSelection);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  const chip = document.createElement('span');
  chip.className = `chip ${area.k}`;
  chip.textContent = `${area.g} ${area.t}`;
  const lvl = document.createElement('span');
  lvl.className = `level ${n.lv}`;
  lvl.textContent = data.ui.levels[n.lv]!;
  meta.append(chip, lvl);

  const h = document.createElement('h2');
  h.textContent = n.t;
  const p = document.createElement('p');
  p.textContent = n.s;

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const mk = (label: string, m: Mode) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(mode === m));
    b.addEventListener('click', () => {
      const next = mode === m ? 'nbr' : m;
      const set = select(selected!, next);
      if (next !== 'nbr') fit([...set.keys()], 40, true);
    });
    return b;
  };
  const open = document.createElement('a');
  open.className = 'btn small primary';
  open.href = `${data.urls.topic}${n.id}/`;
  open.textContent = `${data.ui.open} →`;
  actions.append(mk(`↑ ${data.ui.upstream}`, 'up'), mk(`↓ ${data.ui.downstream}`, 'down'), open);
  panel.append(close, meta, h, p, actions);

  if (mode !== 'nbr' && set.size > 1) {
    const list = document.createElement('ol');
    list.className = 'panel-list';
    // Upstream in study order (topological rank); downstream by distance, then study order.
    const ordered = [...set.entries()]
      .filter(([i]) => i !== selected)
      .sort((x, y) => (mode === 'up' ? 0 : x[1] - y[1]) || data.nodes[x[0]]!.o - data.nodes[y[0]]!.o);
    for (const [i] of ordered) {
      const li = document.createElement('li');
      li.append(topicLink(i));
      list.append(li);
    }
    panel.append(list);
  }
  panel.hidden = false;
}

function select(i: number, mode: Mode = 'nbr'): Map<number, number> {
  selected = i;
  const set = highlight(mode);
  renderPanel(mode, set);
  history.replaceState(null, '', `?focus=${data.nodes[i]!.id}`);
  return set;
}

function clearSelection(): void {
  selected = null;
  svg.classList.remove('focus');
  for (const g of nodeEls) g.classList.remove('on', 'sel');
  for (const l of edgeEls) l.classList.remove('on');
  panel.hidden = true;
  history.replaceState(null, '', location.pathname);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selected !== null) clearSelection();
});

// ---------------------------------------------------------------- find a topic
const findInput = document.querySelector<HTMLInputElement>('.map-find input')!;
const findList = document.querySelector<HTMLUListElement>('.map-find-results')!;
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
findInput.addEventListener('input', () => {
  const q = norm(findInput.value.trim());
  findList.replaceChildren();
  if (!q) {
    findList.hidden = true;
    return;
  }
  const hits = data.nodes
    .map((n, i) => ({ i, pos: norm(n.t).indexOf(q) }))
    .filter((h) => h.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
    .slice(0, 8);
  for (const h of hits) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = data.nodes[h.i]!.t;
    b.addEventListener('click', () => {
      findList.hidden = true;
      findInput.value = '';
      if (!visible(h.i)) {
        state.scope = 'all';
        state.kinds = new Set(['math', 'computing']);
        state.levels = new Set(Object.keys(data.ui.levels));
        document.querySelectorAll<HTMLButtonElement>('[data-kind], [data-lv]').forEach((x) => press(x, true));
        scopeBtns.forEach((x) => press(x, x.dataset.scope === 'all'));
        applyFilters();
      }
      select(h.i);
      centerOn(h.i);
    });
    li.append(b);
    findList.append(li);
  }
  findList.hidden = hits.length === 0;
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') findList.querySelector('button')?.click();
});

// ---------------------------------------------------------------- start
fit();
const focus = new URLSearchParams(location.search).get('focus');
const fi = focus ? data.nodes.findIndex((n) => n.id === focus) : -1;
if (fi >= 0) {
  select(fi);
  centerOn(fi);
}
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => (selected === null ? fit() : centerOn(selected, k)), 150);
});
