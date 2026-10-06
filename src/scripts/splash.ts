export {};

// Home: the whole knowledge map drawn as a sky. Every star is a topic (positions from the same build-time layout as
// the map), faint lines are the connections, pulses of light travel along the applications from mathematics to
// computing, and every few seconds the longest chain of ideas behind one computing topic lights up, with its names.
// Hover a star to read it, click to open it.

type NodeTuple = [number, number, number, 0 | 1, 0 | 1, number];
interface Data {
  nodes: NodeTuple[];
  ids: string[];
  titles: string[];
  edges: [number, number, 0 | 1][];
  areas: { t: string; k: 0 | 1; x: number; y: number }[];
  featured: number[];
  topicUrl: string;
}

const root = document.querySelector<HTMLElement>('.splash');
const dataEl = document.getElementById('splash-data');
if (root && dataEl) start(root, JSON.parse(dataEl.textContent ?? '{}') as Data);

function start(root: HTMLElement, data: Data) {
  const canvas = root.querySelector<HTMLCanvasElement>('.splash-canvas')!;
  const copy = root.querySelector<HTMLElement>('.splash-copy')!;
  const hud = root.querySelector<HTMLElement>('.splash-hud')!;
  const caption = root.querySelector<HTMLElement>('.splash-caption')!;
  const traceBtn = root.querySelector<HTMLButtonElement>('[data-trace]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-pause]')!;
  const ctx = canvas.getContext('2d')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = data.nodes.length;

  // ---------------------------------------------------------------- graph helpers
  const preds: number[][] = Array.from({ length: N }, () => []);
  data.edges.forEach(([a, b]) => preds[b]!.push(a));
  // Longest chain of prerequisites ending at each topic (the graph is a DAG; the guard only protects against a cycle).
  const depth = new Array<number>(N).fill(-1);
  function chainDepth(i: number, seen = new Set<number>()): number {
    if (depth[i]! >= 0) return depth[i]!;
    if (seen.has(i)) return 0;
    seen.add(i);
    let best = 0;
    for (const p of preds[i]!) best = Math.max(best, 1 + chainDepth(p, seen));
    seen.delete(i);
    depth[i] = best;
    return best;
  }
  for (let i = 0; i < N; i++) chainDepth(i);
  const targets = data.nodes.map((_, i) => i).filter((i) => data.nodes[i]![3] === 1 && depth[i]! >= 4);
  const appEdges = data.edges.filter((e) => e[2] === 1);

  function chainTo(target: number): number[] {
    const chain = [target];
    let cur = target;
    while (preds[cur]!.length && chain.length < 11) {
      // Prefer core topics (the backbone of the syllabus), then the longest way back.
      const score = (i: number) => (data.nodes[i]![4] ? 1000 : 0) + depth[i]!;
      cur = preds[cur]!.reduce((a, b) => (score(b) > score(a) ? b : a));
      chain.unshift(cur);
    }
    return chain;
  }

  // ---------------------------------------------------------------- layout and colours
  let W = 0, H = 0, scale = 1, ox = 0, oy = 0, fadeTo = 0;
  let C = { bg: '#0a0d12', fg: '#e6edf3', muted: '#8b98a5', math: '#7cc4ff', comp: '#f2b661', dark: true };
  const bounds = data.nodes.reduce(
    (b, n) => ({ x0: Math.min(b.x0, n[0]), x1: Math.max(b.x1, n[0]), y0: Math.min(b.y0, n[1]), y1: Math.max(b.y1, n[1]) }),
    { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
  );

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    C = { bg: v('--bg', '#0a0d12'), fg: v('--fg', '#e6edf3'), muted: v('--muted', '#8b98a5'), math: v('--accent', '#7cc4ff'), comp: v('--comp', '#f2b661'), dark };
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(280, r.width);
    H = Math.max(240, r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cr = copy.getBoundingClientRect();
    const overlay = cr.bottom > r.top + 10 && cr.top < r.bottom;
    fadeTo = overlay ? cr.right - r.left + 30 : 0;
    const left = overlay ? cr.right - r.left + 10 : 14;
    const bottom = overlay ? hud.offsetHeight + 16 : 14;
    const top = 24;
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    scale = Math.min((W - left - 24) / bw, (H - top - bottom) / bh);
    ox = left + (W - left - 24 - bw * scale) / 2 - bounds.x0 * scale;
    oy = top + (H - top - bottom - bh * scale) / 2 - bounds.y0 * scale;
  }

  // Background stars, with a little parallax.
  const sky = Array.from({ length: 180 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: i * 1.7 }));

  // ---------------------------------------------------------------- animation state
  let time = 0, paused = false, visible = true, running = false;
  let pulses: { e: [number, number, 0 | 1]; t: number; d: number }[] = [];
  let pulseClock = 0;
  let chain: number[] = [], chainT = 0, traceClock = 0;
  let hover = -1;
  const pointer = { x: 0, y: 0, inside: false };

  function pos(i: number) {
    const n = data.nodes[i]!;
    const wob = reduce ? 0 : 1;
    return {
      x: ox + n[0] * scale + Math.sin(time * 0.35 + i * 1.7) * 2.2 * wob,
      y: oy + n[1] * scale + Math.cos(time * 0.3 + i * 1.3) * 2.2 * wob,
    };
  }

  function trace(target?: number, given?: number[]) {
    if (given && given.length > 2) {
      chain = given.slice();
      chainT = reduce ? 99 : 0;
      traceClock = 0;
      showChain();
      return;
    }
    if (!targets.length) return;
    let tgt = target ?? targets[Math.floor(Math.random() * targets.length)]!;
    if (target === undefined && chain.length && tgt === chain[chain.length - 1]) tgt = targets[(targets.indexOf(tgt) + 1) % targets.length]!;
    chain = chainTo(tgt);
    chainT = reduce ? 99 : 0;
    traceClock = 0;
    showChain();
  }

  function showChain() {
    caption.textContent = '';
    if (!chain.length) return;
    caption.append(document.createTextNode((caption.dataset.chainLabel ?? '') + ' '));
    chain.forEach((i, k) => {
      if (k) caption.append(document.createTextNode(' → '));
      const last = k === chain.length - 1;
      const a = document.createElement('a');
      a.href = data.topicUrl + data.ids[i] + '/';
      a.textContent = data.titles[i]!;
      if (last) {
        const b = document.createElement('b');
        b.append(a);
        caption.append(b);
      } else {
        a.className = data.nodes[i]![3] ? '' : 'math';
        caption.append(a);
      }
    });
  }

  // ---------------------------------------------------------------- drawing
  function withAlpha(color: string, a: number) {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1]!, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Sky.
    const px = pointer.inside ? (pointer.x - W / 2) / W : 0, py = pointer.inside ? (pointer.y - H / 2) / H : 0;
    for (const s of sky) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 * s.z + s.p));
      ctx.fillStyle = withAlpha(C.dark ? '#ffffff' : '#5a6b80', (C.dark ? 0.55 : 0.3) * s.z * tw);
      const sx = s.x * W - px * 24 * s.z, sy = s.y * H - py * 24 * s.z;
      ctx.fillRect(sx, sy, s.z > 0.85 ? 1.6 : 1, s.z > 0.85 ? 1.6 : 1);
    }
    // Nebulae: one soft glow per area, and its name, faintly.
    for (const a of data.areas) {
      const x = ox + a.x * scale, y = oy + a.y * scale;
      const r = 150 * scale + 30;
      const g = ctx.createRadialGradient(x, y + r * 0.35, 0, x, y + r * 0.35, r);
      g.addColorStop(0, withAlpha(a.k ? C.comp : C.math, C.dark ? 0.1 : 0.08));
      g.addColorStop(1, withAlpha(a.k ? C.comp : C.math, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y + r * 0.35 - r, r * 2, r * 2);
    }
    if (W > 700) {
      ctx.font = '600 10px ui-monospace, "JetBrains Mono Variable", monospace';
      ctx.textAlign = 'center';
      for (const a of data.areas) {
        ctx.fillStyle = withAlpha(a.k ? C.comp : C.math, C.dark ? 0.42 : 0.55);
        ctx.fillText(a.t.toUpperCase(), ox + a.x * scale, oy + a.y * scale - 12);
      }
      ctx.textAlign = 'left';
    }
    const P = Array.from({ length: N }, (_, i) => pos(i));
    // Connections.
    ctx.lineWidth = 1;
    for (const [a, b, app] of data.edges) {
      const hl = hover >= 0 && (a === hover || b === hover);
      ctx.strokeStyle = withAlpha(app ? C.comp : C.math, hl ? 0.7 : app ? (C.dark ? 0.1 : 0.16) : C.dark ? 0.08 : 0.13);
      ctx.beginPath();
      ctx.moveTo(P[a]!.x, P[a]!.y);
      ctx.lineTo(P[b]!.x, P[b]!.y);
      ctx.stroke();
    }
    // The traced chain: segments light up one after another, from the first idea to the application.
    if (chain.length) {
      const shown = Math.min(chain.length - 1, chainT / 0.32);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let k = 0; k < chain.length - 1; k++) {
        const f = Math.max(0, Math.min(1, shown - k));
        if (f <= 0) break;
        const a = P[chain[k]!]!, b = P[chain[k + 1]!]!;
        const col = data.nodes[chain[k + 1]!]![3] ? C.comp : C.math;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    // Pulses travelling from mathematics to computing.
    for (const p of pulses) {
      const a = P[p.e[0]]!, b = P[p.e[1]]!, k = p.t / p.d;
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
      const k0 = Math.max(0, k - 0.12), tx = a.x + (b.x - a.x) * k0, ty = a.y + (b.y - a.y) * k0;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, withAlpha(C.comp, 0));
      g.addColorStop(1, withAlpha(C.comp, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = C.dark ? '#fff4dc' : C.comp;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stars.
    const inChain = new Set(chain.slice(0, Math.floor(chainT / 0.32) + 1));
    for (let i = 0; i < N; i++) {
      const n = data.nodes[i]!, p = P[i]!;
      const col = n[3] ? C.comp : C.math;
      const tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(time * (1.2 + (i % 7) * 0.2) + i);
      const r = Math.max(1.5, n[2] * scale * 0.85) * (inChain.has(i) || i === hover ? 1.5 : 1);
      ctx.globalAlpha = tw;
      if (n[4] || inChain.has(i) || i === hover) {
        ctx.shadowColor = col;
        ctx.shadowBlur = C.dark ? 14 : 6;
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (n[4] && C.dark) {
        // A four-point sparkle on core topics.
        ctx.strokeStyle = withAlpha('#ffffff', 0.5 * tw);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - r * 2.4, p.y); ctx.lineTo(p.x + r * 2.4, p.y);
        ctx.moveTo(p.x, p.y - r * 2.4); ctx.lineTo(p.x, p.y + r * 2.4);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // Names along the traced chain, and of the star under the pointer.
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    const labels = [...inChain];
    if (hover >= 0 && !inChain.has(hover)) labels.push(hover);
    for (const i of labels) {
      const p = P[i]!, text = data.titles[i]!;
      const w = ctx.measureText(text).width + 12;
      const x = Math.min(W - w - 6, Math.max(6, p.x + 10)), y = p.y - 22;
      ctx.fillStyle = withAlpha(C.bg, 0.86);
      ctx.strokeStyle = withAlpha(data.nodes[i]![3] ? C.comp : C.math, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 19, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.fg;
      ctx.fillText(text, x + 6, y + 13.5);
    }
    // Keep the copy readable on wide screens.
    if (fadeTo) {
      const g = ctx.createLinearGradient(0, 0, fadeTo + 100, 0);
      g.addColorStop(0, withAlpha(C.bg, 0.94));
      g.addColorStop(0.75, withAlpha(C.bg, 0.78));
      g.addColorStop(1, withAlpha(C.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, fadeTo + 100, H);
    }
  }

  // ---------------------------------------------------------------- loop
  let last = 0;
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    chainT += dt;
    traceClock += dt;
    if (traceClock > 8.5) trace();
    pulseClock += dt;
    while (pulseClock > 0.12 && appEdges.length) {
      pulseClock -= 0.12;
      pulses.push({ e: appEdges[Math.floor(Math.random() * appEdges.length)]!, t: 0, d: 1.4 + Math.random() * 1.4 });
    }
    pulses.forEach((p) => (p.t += dt));
    pulses = pulses.filter((p) => p.t < p.d);
    draw();
    requestAnimationFrame(frame);
  }

  function setRunning(on: boolean) {
    const go = on && !paused && visible && !reduce;
    if (go === running) return;
    running = go;
    last = 0;
    if (go) requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  function nearest(x: number, y: number) {
    let best = -1, bd = 16 * 16;
    for (let i = 0; i < N; i++) {
      const p = pos(i), d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside = true;
    hover = nearest(pointer.x, pointer.y);
    canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
    if (!running) draw();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    hover = -1;
    if (!running) draw();
  });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = nearest(e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) window.location.href = data.topicUrl + data.ids[i] + '/';
  });
  traceBtn.addEventListener('click', () => {
    trace();
    if (!running) draw();
  });
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = (paused ? pauseBtn.dataset.playLabel : pauseBtn.dataset.pauseLabel) ?? '';
    pauseBtn.setAttribute('aria-pressed', String(paused));
    setRunning(true);
  });
  if (reduce) pauseBtn.hidden = true;

  new IntersectionObserver((en) => {
    visible = en[0]!.isIntersecting;
    setRunning(true);
  }).observe(root);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    setRunning(true);
  });
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      layout();
      draw();
    }, 150);
  });
  new MutationObserver(() => {
    readColors();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  readColors();
  layout();
  trace(undefined, data.featured);
  draw();
  setRunning(true);
}
