import { Plot, fmt, strings } from './plot';

interface Fn {
  f: (x: number) => number;
  df: (x: number) => number;
  root: number;
  view: { x0: number; x1: number; y0: number; y1: number };
  lo: number;
  hi: number;
  start: number;
}

const cbrt = Math.cbrt;
const FNS: Record<string, Fn> = {
  sqrt2: { f: (x) => x * x - 2, df: (x) => 2 * x, root: Math.SQRT2, view: { x0: -0.5, x1: 4.2, y0: -3, y1: 12 }, lo: 0.2, hi: 4, start: 3.5 },
  cosx: { f: (x) => Math.cos(x) - x, df: (x) => -Math.sin(x) - 1, root: 0.7390851332151607, view: { x0: -2, x1: 3, y0: -3.5, y1: 2.5 }, lo: -1.8, hi: 2.8, start: -1 },
  exp3: { f: (x) => Math.exp(x) - 3, df: Math.exp, root: Math.log(3), view: { x0: -1, x1: 3.2, y0: -4, y1: 20 }, lo: -0.8, hi: 3, start: 2.8 },
  cycle: { f: (x) => x ** 3 - 2 * x + 2, df: (x) => 3 * x * x - 2, root: -1.7692923542386314, view: { x0: -2.6, x1: 2, y0: -5, y1: 6 }, lo: -2.4, hi: 1.8, start: 0 },
  atan: { f: Math.atan, df: (x) => 1 / (1 + x * x), root: 0, view: { x0: -6, x1: 6, y0: -1.8, y1: 1.8 }, lo: -2.5, hi: 2.5, start: 1.2 },
  cbrt: { f: cbrt, df: (x) => 1 / (3 * cbrt(x) ** 2), root: 0, view: { x0: -6, x1: 6, y0: -2, y1: 2 }, lo: -1.5, hi: 1.5, start: 0.6 },
};

export function initNewton(root: HTMLElement): void {
  const s = strings(root);
  const sel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const x0In = root.querySelector<HTMLInputElement>('[data-x0]')!;
  const x0Out = root.querySelector<HTMLOutputElement>('[data-x0-out]')!;
  const tbody = root.querySelector<HTMLTableSectionElement>('tbody')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  let fn = FNS[sel.value]!;
  const p = new Plot(canvas, fn.view);
  let xs: number[] = [];
  let note = '';

  // x0 is kept exactly (the 2-cycle of x³ − 2x + 2 needs x0 = 0, which the slider grid cannot hit).
  let start = fn.start;
  const x0 = () => start;
  const setX0 = (x: number) => {
    start = x;
    x0In.value = String(Math.round(((x - fn.lo) / (fn.hi - fn.lo)) * 1000));
  };

  function reset(): void {
    xs = [x0()];
    note = '';
  }

  function step(): void {
    if (note) return;
    const x = xs[xs.length - 1]!;
    const d = fn.df(x);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-14) {
      note = s('flat');
      return;
    }
    const nx = x - fn.f(x) / d;
    if (!Number.isFinite(nx) || Math.abs(nx) > 1e8) {
      note = '∞';
      return;
    }
    xs.push(nx);
  }

  function draw(): void {
    const { c } = p;
    p.clear();
    p.axes();
    p.fn(fn.f, c.math, 2.5);
    xs.forEach((x, k) => {
      const y = fn.f(x);
      const alpha = Math.max(0.35, 1 - k * 0.12);
      p.ctx.globalAlpha = alpha;
      p.line(x, 0, x, y, c.muted, 1, [3, 3]);
      const nx = xs[k + 1];
      if (nx !== undefined) p.line(x, y, nx, 0, c.hl, 2);
      p.ctx.globalAlpha = 1;
      p.dot(x, 0, k === xs.length - 1 ? 5.5 : 3.5, c.hl);
      if (k < 4) p.label(`x${'₀₁₂₃'[k]}`, x, 0, c.fg2, 'center', 18);
    });
    p.dot(fn.root, 0, 4, c.good);
    x0Out.textContent = fmt(xs[0]!, 4);

    tbody.replaceChildren();
    xs.forEach((x, k) => {
      const err = Math.abs(x - fn.root);
      const digits = err === 0 ? 16 : Math.max(0, Math.min(16, Math.floor(-Math.log10(err / Math.max(1, Math.abs(fn.root))))));
      const tr = document.createElement('tr');
      for (const v of [String(k), x.toPrecision(16), fmt(fn.f(x), 3), fmt(err, 2), String(digits)]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.append(td);
      }
      tbody.append(tr);
    });
    if (note) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = note;
      td.className = 'bad';
      tr.append(td);
      tbody.append(tr);
    }
  }

  root.querySelector('[data-step]')!.addEventListener('click', () => {
    step();
    p.redraw();
  });
  root.querySelector('[data-run]')!.addEventListener('click', () => {
    for (let i = 0; i < 6; i++) step();
    p.redraw();
  });
  root.querySelector('[data-reset]')!.addEventListener('click', () => {
    reset();
    p.redraw();
  });
  x0In.addEventListener('input', () => {
    start = fn.lo + ((fn.hi - fn.lo) * Number(x0In.value)) / 1000;
    reset();
    p.redraw();
  });
  sel.addEventListener('change', () => {
    fn = FNS[sel.value]!;
    p.view = fn.view;
    setX0(fn.start);
    reset();
    p.redraw();
  });
  canvas.addEventListener('pointerdown', (ev) => {
    setX0(Math.min(fn.hi, Math.max(fn.lo, p.world(ev).x)));
    reset();
    p.redraw();
  });

  setX0(fn.start);
  reset();
  p.onDraw(draw);
}
