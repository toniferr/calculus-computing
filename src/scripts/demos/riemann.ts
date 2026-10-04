import { Plot, fmt, strings } from './plot';

interface Fn {
  f: (x: number) => number;
  a: number;
  b: number;
  exact: number;
  view: { x0: number; x1: number; y0: number; y1: number };
}

const FNS: Record<string, Fn> = {
  sin: { f: Math.sin, a: 0, b: Math.PI, exact: 2, view: { x0: -0.3, x1: 3.5, y0: -0.2, y1: 1.25 } },
  sq: { f: (x) => x * x, a: 0, b: 2, exact: 8 / 3, view: { x0: -0.2, x1: 2.25, y0: -0.4, y1: 4.4 } },
  gauss: { f: (x) => Math.exp(-x * x), a: -2, b: 2, exact: 1.7641627815248431, view: { x0: -2.4, x1: 2.4, y0: -0.12, y1: 1.15 } },
  inv: { f: (x) => 1 / x, a: 1, b: Math.E, exact: 1, view: { x0: 0.6, x1: 3, y0: -0.1, y1: 1.15 } },
  circle: { f: (x) => Math.sqrt(Math.max(0, 1 - x * x)), a: -1, b: 1, exact: Math.PI / 2, view: { x0: -1.25, x1: 1.25, y0: -0.12, y1: 1.15 } },
};
const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 80, 100, 128, 160, 200, 256, 320, 400, 500, 640, 800, 1000];

export function initRiemann(root: HTMLElement): void {
  const s = strings(root);
  const sel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const rule = root.querySelector<HTMLSelectElement>('[data-rule]')!;
  const nIn = root.querySelector<HTMLInputElement>('[data-n]')!;
  const nOut = root.querySelector<HTMLOutputElement>('[data-n-out]')!;
  const readout = root.querySelector<HTMLElement>('.demo-readout')!;
  let fn = FNS[sel.value]!;
  const p = new Plot(root.querySelector('canvas')!, fn.view);

  function sum(n: number): number {
    const { f, a, b } = fn;
    const dx = (b - a) / n;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const l = a + i * dx;
      const r = l + dx;
      acc += rule.value === 'left' ? f(l) : rule.value === 'right' ? f(r) : rule.value === 'mid' ? f((l + r) / 2) : (f(l) + f(r)) / 2;
    }
    return acc * dx;
  }

  function draw(): void {
    const { c, ctx } = p;
    const n = NS[Number(nIn.value)]!;
    const { f, a, b } = fn;
    const dx = (b - a) / n;
    p.clear();
    p.axes();
    ctx.save();
    p.clip();
    ctx.fillStyle = c.comp;
    ctx.strokeStyle = c.comp;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const l = a + i * dx;
      const r = l + dx;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      if (rule.value === 'trap') {
        ctx.moveTo(p.X(l), p.Y(0));
        ctx.lineTo(p.X(l), p.Y(f(l)));
        ctx.lineTo(p.X(r), p.Y(f(r)));
        ctx.lineTo(p.X(r), p.Y(0));
      } else {
        const h = rule.value === 'left' ? f(l) : rule.value === 'right' ? f(r) : f((l + r) / 2);
        ctx.rect(p.X(l), p.Y(h), p.X(r) - p.X(l), p.Y(0) - p.Y(h));
      }
      ctx.closePath();
      ctx.fill();
      if (n <= 120) {
        ctx.globalAlpha = 0.8;
        ctx.stroke();
      }
    }
    ctx.restore();
    p.fn(f, c.math, 2.5);
    const S = sum(n);
    const err = S - fn.exact;
    nOut.textContent = String(n);
    readout.replaceChildren();
    for (const [k, v, cls] of [
      [`S_${n} (${s('sum')})`, fmt(S, 8), ''],
      [s('exact'), fmt(fn.exact, 8), ''],
      [s('error'), fmt(err, 3), Math.abs(err) < 1e-4 ? 'good' : ''],
      ['error · n', fmt(err * n, 3), ''],
      ['error · n²', fmt(err * n * n, 3), ''],
    ] as const) {
      const span = document.createElement('span');
      span.append(`${k} = `);
      const bEl = document.createElement('b');
      bEl.textContent = v;
      if (cls) bEl.className = cls;
      span.append(bEl);
      readout.append(span);
    }
  }

  sel.addEventListener('change', () => {
    fn = FNS[sel.value]!;
    p.view = fn.view;
    p.redraw();
  });
  for (const el of [rule, nIn]) el.addEventListener('input', () => p.redraw());
  p.onDraw(draw);
}
