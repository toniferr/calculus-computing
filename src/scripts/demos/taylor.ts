import { Plot, fmt, strings } from './plot';

// Truncated power series arithmetic ("Taylor mode" automatic differentiation): a series is the array of Taylor
// coefficients c_k = f^(k)(a)/k! up to order N. Each operation propagates them exactly (up to rounding).
const N = 20;
type S = Float64Array;

const series = (a0: number, a1 = 0): S => {
  const s = new Float64Array(N + 1);
  s[0] = a0;
  s[1] = a1;
  return s;
};
function mul(a: S, b: S): S {
  const r = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) for (let j = 0; j <= k; j++) r[k]! += a[j]! * b[k - j]!;
  return r;
}
function div(a: S, b: S): S {
  const r = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) {
    let acc = a[k]!;
    for (let j = 1; j <= k; j++) acc -= b[j]! * r[k - j]!;
    r[k] = acc / b[0]!;
  }
  return r;
}
function exp(a: S): S {
  const r = new Float64Array(N + 1);
  r[0] = Math.exp(a[0]!);
  for (let k = 1; k <= N; k++) {
    let acc = 0;
    for (let j = 1; j <= k; j++) acc += j * a[j]! * r[k - j]!;
    r[k] = acc / k;
  }
  return r;
}
function log(a: S): S {
  const r = new Float64Array(N + 1);
  r[0] = Math.log(a[0]!);
  for (let k = 1; k <= N; k++) {
    let acc = a[k]!;
    for (let j = 1; j < k; j++) acc -= (j / k) * r[j]! * a[k - j]!;
    r[k] = acc / a[0]!;
  }
  return r;
}
function sincos(a: S): [S, S] {
  const s = new Float64Array(N + 1);
  const c = new Float64Array(N + 1);
  s[0] = Math.sin(a[0]!);
  c[0] = Math.cos(a[0]!);
  for (let k = 1; k <= N; k++) {
    let as = 0;
    let ac = 0;
    for (let j = 1; j <= k; j++) {
      as += j * a[j]! * c[k - j]!;
      ac += j * a[j]! * s[k - j]!;
    }
    s[k] = as / k;
    c[k] = -ac / k;
  }
  return [s, c];
}

interface Fn {
  f: (x: number) => number;
  coeffs: (a: number) => S;
  radius: (a: number) => number;
  view: { x0: number; x1: number; y0: number; y1: number };
  lo: number;
  hi: number;
}

const one = () => series(1);
const FNS: Record<string, Fn> = {
  sin: { f: Math.sin, coeffs: (a) => sincos(series(a, 1))[0], radius: () => Infinity, view: { x0: -9, x1: 9, y0: -2.6, y1: 2.6 }, lo: -4, hi: 4 },
  cos: { f: Math.cos, coeffs: (a) => sincos(series(a, 1))[1], radius: () => Infinity, view: { x0: -9, x1: 9, y0: -2.6, y1: 2.6 }, lo: -4, hi: 4 },
  exp: { f: Math.exp, coeffs: (a) => exp(series(a, 1)), radius: () => Infinity, view: { x0: -5, x1: 4, y0: -3, y1: 22 }, lo: -2, hi: 2 },
  log1p: { f: (x) => (x > -1 ? Math.log1p(x) : NaN), coeffs: (a) => log(series(1 + a, 1)), radius: (a) => Math.abs(1 + a), view: { x0: -1.5, x1: 4, y0: -3.5, y1: 2.5 }, lo: -0.6, hi: 2 },
  geom: { f: (x) => 1 / (1 - x), coeffs: (a) => div(one(), series(1 - a, -1)), radius: (a) => Math.abs(1 - a), view: { x0: -3, x1: 3, y0: -4, y1: 6 }, lo: -1.5, hi: 0.6 },
  runge: {
    f: (x) => 1 / (1 + x * x),
    coeffs: (a) => {
      const x = series(a, 1);
      return div(one(), mul(x, x).map((v, k) => v + (k === 0 ? 1 : 0)) as S);
    },
    radius: (a) => Math.hypot(1, a),
    view: { x0: -3.5, x1: 3.5, y0: -0.8, y1: 1.6 },
    lo: -2,
    hi: 2,
  },
};

export function initTaylor(root: HTMLElement): void {
  const s = strings(root);
  const sel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const nIn = root.querySelector<HTMLInputElement>('[data-n]')!;
  const aIn = root.querySelector<HTMLInputElement>('[data-a]')!;
  const nOut = root.querySelector<HTMLOutputElement>('[data-n-out]')!;
  const aOut = root.querySelector<HTMLOutputElement>('[data-a-out]')!;
  const readout = root.querySelector<HTMLElement>('.demo-readout')!;
  const poly = root.querySelector<HTMLElement>('.demo-poly')!;
  let fn = FNS[sel.value]!;
  const p = new Plot(root.querySelector('canvas')!, fn.view);
  const center = () => {
    const raw = fn.lo + ((fn.hi - fn.lo) * Number(aIn.value)) / 100;
    return Math.abs(raw) < 0.03 ? 0 : raw;
  };

  function draw(): void {
    const { c, ctx } = p;
    const a = center();
    const n = Number(nIn.value);
    const co = fn.coeffs(a);
    const T = (x: number) => {
      let acc = 0;
      for (let k = n; k >= 0; k--) acc = acc * (x - a) + co[k]!;
      return acc;
    };
    const R = fn.radius(a);
    p.clear();
    p.axes();
    if (Number.isFinite(R)) {
      ctx.save();
      p.clip();
      ctx.fillStyle = c.hl;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(p.X(a - R), p.pad.t, p.X(a + R) - p.X(a - R), p.h - p.pad.t - p.pad.b);
      ctx.restore();
      p.line(a - R, fn.view.y0, a - R, fn.view.y1, c.hl, 1, [3, 4]);
      p.line(a + R, fn.view.y0, a + R, fn.view.y1, c.hl, 1, [3, 4]);
    }
    p.fn(fn.f, c.math, 3);
    p.fn(T, c.hl, 2);
    p.dot(a, fn.f(a), 5, c.hl, c.surface);

    let maxErr = 0;
    for (let i = 0; i <= 200; i++) {
      const x = a - 1 + (2 * i) / 200;
      const e = Math.abs(fn.f(x) - T(x));
      if (Number.isFinite(e)) maxErr = Math.max(maxErr, e);
    }
    nOut.textContent = String(n);
    aOut.textContent = fmt(a, 3);
    readout.replaceChildren();
    for (const [k, v] of [
      [s('order'), String(n)],
      ['R', Number.isFinite(R) ? fmt(R, 3) : '∞'],
      [s('maxerr'), fmt(maxErr, 3)],
    ]) {
      const span = document.createElement('span');
      span.append(`${k} = `);
      const b = document.createElement('b');
      b.textContent = v!;
      span.append(b);
      readout.append(span);
    }
    const xa = a === 0 ? 'x' : `(x ${a > 0 ? '−' : '+'} ${fmt(Math.abs(a), 3)})`;
    const terms: string[] = [];
    for (let k = 0; k <= n && terms.length < 7; k++) {
      const ck = co[k]!;
      if (Math.abs(ck) < 1e-12) continue;
      const mono = k === 0 ? '' : k === 1 ? xa : `${xa}^${k}`;
      terms.push(`${terms.length ? (ck < 0 ? ' − ' : ' + ') : ck < 0 ? '−' : ''}${fmt(Math.abs(ck), 4)}${mono ? ' ' + mono : ''}`);
    }
    poly.textContent = `T${n}(x) = ${terms.join('') || '0'}${n >= 7 ? ' + …' : ''}`;
  }

  sel.addEventListener('change', () => {
    fn = FNS[sel.value]!;
    p.view = fn.view;
    aIn.value = String(Math.round((-fn.lo / (fn.hi - fn.lo)) * 100));
    p.redraw();
  });
  for (const el of [nIn, aIn]) el.addEventListener('input', () => p.redraw());
  aIn.value = String(Math.round((-fn.lo / (fn.hi - fn.lo)) * 100));
  p.onDraw(draw);
}
