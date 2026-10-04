import { Plot, fmt, strings } from './plot';

interface Fn {
  f: (x: number) => number;
  df: (x: number) => number;
  view: { x0: number; x1: number; y0: number; y1: number };
  lo: number;
  hi: number;
}

const FNS: Record<string, Fn> = {
  sq: { f: (x) => x * x, df: (x) => 2 * x, view: { x0: -3, x1: 3, y0: -2, y1: 9 }, lo: -2.6, hi: 2.6 },
  cubic: { f: (x) => x ** 3 - 3 * x, df: (x) => 3 * x * x - 3, view: { x0: -2.6, x1: 2.6, y0: -4.5, y1: 4.5 }, lo: -2.3, hi: 2.3 },
  sin: { f: Math.sin, df: Math.cos, view: { x0: -6.5, x1: 6.5, y0: -1.8, y1: 1.8 }, lo: -6, hi: 6 },
  exp: { f: Math.exp, df: Math.exp, view: { x0: -3, x1: 2.6, y0: -1, y1: 9 }, lo: -2.8, hi: 2 },
  log: { f: Math.log, df: (x) => 1 / x, view: { x0: 0, x1: 6, y0: -3, y1: 2.5 }, lo: 0.15, hi: 5.6 },
};

export function initTangent(root: HTMLElement): void {
  const s = strings(root);
  const sel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const aIn = root.querySelector<HTMLInputElement>('[data-a]')!;
  const hIn = root.querySelector<HTMLInputElement>('[data-h]')!;
  const deriv = root.querySelector<HTMLInputElement>('[data-deriv]')!;
  const aOut = root.querySelector<HTMLOutputElement>('[data-a-out]')!;
  const hOut = root.querySelector<HTMLOutputElement>('[data-h-out]')!;
  const readout = root.querySelector<HTMLElement>('.demo-readout')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  let fn = FNS[sel.value]!;
  const p = new Plot(canvas, fn.view);

  const a = () => fn.lo + ((fn.hi - fn.lo) * Number(aIn.value)) / 1000;
  // h from 2 down to 1e-3 on a log scale
  const h = () => 2 * 10 ** (-3.3 * (Number(hIn.value) / 100));

  function draw(): void {
    const { c } = p;
    const x = a();
    const hh = h();
    const y = fn.f(x);
    const m = fn.df(x);
    const ms = (fn.f(x + hh) - y) / hh;
    p.clear();
    p.axes();
    if (deriv.checked) p.fn(fn.df, c.muted, 1.5, [2, 3]);
    p.fn(fn.f, c.math, 2.5);
    const { x0, x1 } = fn.view;
    p.line(x0, y + m * (x0 - x), x1, y + m * (x1 - x), c.hl, 2);
    p.line(x0, y + ms * (x0 - x), x1, y + ms * (x1 - x), c.comp, 1.6, [6, 5]);
    p.dot(x + hh, fn.f(x + hh), 4, c.comp);
    if (deriv.checked) p.dot(x, m, 4, c.muted);
    p.dot(x, y, 6, c.hl, c.surface);
    aOut.textContent = fmt(x, 3);
    hOut.textContent = fmt(hh, 2);
    readout.innerHTML = '';
    const items: [string, string, string?][] = [
      ['f(a)', fmt(y)],
      [`f′(a) · ${s('slope')}`, fmt(m)],
      [`${s('secant')} (f(a+h) − f(a))/h`, fmt(ms)],
      ['|error|', fmt(Math.abs(ms - m), 3), Math.abs(ms - m) < 1e-2 ? 'good' : ''],
    ];
    for (const [k, v, cls] of items) {
      const span = document.createElement('span');
      span.append(`${k} = `);
      const b = document.createElement('b');
      b.textContent = v;
      if (cls) b.className = cls;
      span.append(b);
      readout.append(span);
    }
  }

  sel.addEventListener('change', () => {
    fn = FNS[sel.value]!;
    p.view = fn.view;
    p.redraw();
  });
  for (const el of [aIn, hIn, deriv]) el.addEventListener('input', () => p.redraw());

  // Drag the point along the curve.
  let dragging = false;
  const moveTo = (ev: PointerEvent) => {
    const w = p.world(ev);
    const x = Math.min(fn.hi, Math.max(fn.lo, w.x));
    aIn.value = String(Math.round(((x - fn.lo) / (fn.hi - fn.lo)) * 1000));
    p.redraw();
  };
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true;
    canvas.setPointerCapture(ev.pointerId);
    moveTo(ev);
  });
  canvas.addEventListener('pointermove', (ev) => dragging && moveTo(ev));
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointercancel', () => (dragging = false));

  p.onDraw(draw);
}
