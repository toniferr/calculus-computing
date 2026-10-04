import { Plot, fmt, strings } from './plot';

type V2 = [number, number];
interface Fn {
  f: (x: number, y: number) => number;
  g: (x: number, y: number) => V2;
  view: { x0: number; x1: number; y0: number; y1: number };
  start: V2;
  /** learning rate range (log10) for the slider */
  lr: [number, number];
}

const FNS: Record<string, Fn> = {
  bowl: { f: (x, y) => x * x + y * y, g: (x, y) => [2 * x, 2 * y], view: { x0: -3, x1: 3, y0: -2, y1: 2 }, start: [-2.6, 1.6], lr: [-2.5, 0] },
  ravine: { f: (x, y) => 0.5 * x * x + 5 * y * y, g: (x, y) => [x, 10 * y], view: { x0: -3.2, x1: 3.2, y0: -2, y1: 2 }, start: [-2.9, 1.2], lr: [-2.5, -0.6] },
  rosen: {
    f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
    view: { x0: -2, x1: 2, y0: -1, y1: 3 },
    start: [-1.5, 2.5],
    lr: [-4, -2.2],
  },
  twomin: {
    f: (x, y) => (x * x - 1) ** 2 + y * y + 0.3 * x,
    g: (x, y) => [4 * x * (x * x - 1) + 0.3, 2 * y],
    view: { x0: -2, x1: 2, y0: -1.4, y1: 1.4 },
    start: [1.6, 1.1],
    lr: [-2.5, -0.5],
  },
  saddle: {
    f: (x, y) => x * x - y * y + 0.25 * y ** 4,
    g: (x, y) => [2 * x, -2 * y + y ** 3],
    view: { x0: -2.5, x1: 2.5, y0: -2.4, y1: 2.4 },
    start: [-2.2, 0.02],
    lr: [-2.5, -0.4],
  },
  himmel: {
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    g: (x, y) => [4 * x * (x * x + y - 11) + 2 * (x + y * y - 7), 2 * (x * x + y - 11) + 4 * y * (x + y * y - 7)],
    view: { x0: -5.5, x1: 5.5, y0: -5, y1: 5 },
    start: [0, 0],
    lr: [-3.5, -1.5],
  },
};

// A perceptually ordered ramp (viridis-like) that reads in light and dark themes.
const RAMP = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];
function ramp(t: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(u));
  const f = u - i;
  const a = RAMP[i]!;
  const b = RAMP[i + 1]!;
  return [a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f, a[2]! + (b[2]! - a[2]!) * f];
}

export function initGradientDescent(root: HTMLElement): void {
  const s = strings(root);
  const sel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const opt = root.querySelector<HTMLSelectElement>('[data-opt]')!;
  const lrIn = root.querySelector<HTMLInputElement>('[data-lr]')!;
  const lrOut = root.querySelector<HTMLOutputElement>('[data-lr-out]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const readout = root.querySelector<HTMLElement>('.demo-readout')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  let fn = FNS[sel.value]!;
  const p = new Plot(canvas, fn.view);
  p.pad = { l: 36, r: 10, t: 10, b: 24 };

  let path: V2[] = [];
  let v: V2 = [0, 0];
  let m: V2 = [0, 0];
  let s2: V2 = [0, 0];
  let t = 0;
  let status = '';
  let timer = 0;
  let heat: HTMLCanvasElement | null = null;
  let heatKey = '';

  const lr = () => 10 ** (fn.lr[0] + ((fn.lr[1] - fn.lr[0]) * Number(lrIn.value)) / 100);

  function reset(start: V2 = fn.start): void {
    path = [start];
    v = [0, 0];
    m = [0, 0];
    s2 = [0, 0];
    t = 0;
    status = '';
  }

  function step(): boolean {
    const [x, y] = path[path.length - 1]!;
    const g = fn.g(x, y);
    const eta = lr();
    let nx: number;
    let ny: number;
    if (opt.value === 'gd') {
      nx = x - eta * g[0];
      ny = y - eta * g[1];
    } else if (opt.value === 'mom') {
      v = [0.9 * v[0] - eta * g[0], 0.9 * v[1] - eta * g[1]];
      nx = x + v[0];
      ny = y + v[1];
    } else {
      t++;
      const b1 = 0.9;
      const b2 = 0.999;
      m = [b1 * m[0] + (1 - b1) * g[0], b1 * m[1] + (1 - b1) * g[1]];
      s2 = [b2 * s2[0] + (1 - b2) * g[0] ** 2, b2 * s2[1] + (1 - b2) * g[1] ** 2];
      const mh = [m[0] / (1 - b1 ** t), m[1] / (1 - b1 ** t)];
      const vh = [s2[0] / (1 - b2 ** t), s2[1] / (1 - b2 ** t)];
      // Adam's step size is in parameter units; scale it to the view so the same slider is usable.
      const a = eta * 30;
      nx = x - (a * mh[0]!) / (Math.sqrt(vh[0]!) + 1e-8);
      ny = y - (a * mh[1]!) / (Math.sqrt(vh[1]!) + 1e-8);
    }
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || Math.abs(nx) > 1e6 || Math.abs(ny) > 1e6) {
      status = 'diverged';
      return false;
    }
    path.push([nx, ny]);
    const gn = Math.hypot(...fn.g(nx, ny));
    if (gn < 1e-6 || (path.length > 2 && Math.hypot(nx - x, ny - y) < 1e-9)) {
      status = 'converged';
      return false;
    }
    if (path.length > 5000) return false;
    return true;
  }

  function buildHeat(): HTMLCanvasElement {
    const W = Math.max(160, Math.round((p.w - p.pad.l - p.pad.r) / 1.5));
    const H = Math.round((W * (p.h - p.pad.t - p.pad.b)) / (p.w - p.pad.l - p.pad.r)) || 140;
    const key = `${sel.value}:${W}x${H}:${document.documentElement.dataset.theme ?? ''}`;
    if (heat && key === heatKey) return heat;
    const { x0, x1, y0, y1 } = fn.view;
    const vals = new Float64Array(W * H);
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const x = x0 + ((i + 0.5) / W) * (x1 - x0);
        const y = y1 - ((j + 0.5) / H) * (y1 - y0);
        const v0 = fn.f(x, y);
        vals[j * W + i] = v0;
        lo = Math.min(lo, v0);
        hi = Math.max(hi, v0);
      }
    const norm = (v0: number) => Math.log1p(v0 - lo) / Math.log1p(hi - lo);
    const LEVELS = 16;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const ctx = off.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const dark = document.documentElement.dataset.theme !== 'light';
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const t0 = norm(vals[k]!);
        const band = Math.floor(t0 * LEVELS);
        const edge =
          (i + 1 < W && Math.floor(norm(vals[k + 1]!) * LEVELS) !== band) || (j + 1 < H && Math.floor(norm(vals[k + W]!) * LEVELS) !== band);
        let [r, g, b] = ramp(t0);
        const dim = dark ? 0.62 : 0.9;
        r *= dim;
        g *= dim;
        b *= dim;
        if (edge) {
          r *= 0.72;
          g *= 0.72;
          b *= 0.72;
        }
        img.data[k * 4] = r;
        img.data[k * 4 + 1] = g;
        img.data[k * 4 + 2] = b;
        img.data[k * 4 + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    heat = off;
    heatKey = key;
    return off;
  }

  function draw(): void {
    const { ctx, c } = p;
    p.clear();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buildHeat(), p.pad.l, p.pad.t, p.w - p.pad.l - p.pad.r, p.h - p.pad.t - p.pad.b);
    ctx.restore();
    p.axes();
    // path
    ctx.save();
    p.clip();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    path.forEach(([x, y], i) => (i ? ctx.lineTo(p.X(x), p.Y(y)) : ctx.moveTo(p.X(x), p.Y(y))));
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    if (path.length < 400) for (const [x, y] of path) ctx.fillRect(p.X(x) - 1.5, p.Y(y) - 1.5, 3, 3);
    ctx.restore();
    const [x, y] = path[path.length - 1]!;
    p.dot(path[0]![0], path[0]![1], 4, '#ffffff');
    p.dot(x, y, 7, c.hl, '#ffffff');
    // gradient arrow at the ball (direction of steepest descent)
    const g = fn.g(x, y);
    const gn = Math.hypot(...g);
    if (gn > 1e-9) {
      const len = (fn.view.x1 - fn.view.x0) * 0.08;
      p.line(x, y, x - (g[0] / gn) * len, y - (g[1] / gn) * len, c.hl, 2.5);
    }

    lrOut.textContent = fmt(lr(), 2);
    readout.replaceChildren();
    const items: [string, string, string][] = [
      [s('iter'), String(path.length - 1), ''],
      ['(x, y)', `(${fmt(x, 3)}, ${fmt(y, 3)})`, ''],
      ['f', fmt(fn.f(x, y), 4), ''],
      ['‖∇f‖', fmt(gn, 3), ''],
    ];
    for (const [k, val, cls] of items) {
      const span = document.createElement('span');
      span.append(`${k} = `);
      const b = document.createElement('b');
      b.textContent = val;
      if (cls) b.className = cls;
      span.append(b);
      readout.append(span);
    }
    if (status) {
      const b = document.createElement('b');
      b.className = status === 'diverged' ? 'bad' : 'good';
      b.textContent = s(status);
      readout.append(b);
    }
  }

  function stop(): void {
    clearInterval(timer);
    timer = 0;
    play.textContent = s('play');
  }

  function run(): void {
    if (timer) return stop();
    if (status) reset(path[0]);
    play.textContent = s('pause');
    timer = window.setInterval(() => {
      let go = true;
      for (let i = 0; i < 2 && go; i++) go = step();
      p.redraw();
      if (!go) stop();
    }, 40);
  }

  play.addEventListener('click', run);
  root.querySelector('[data-step]')!.addEventListener('click', () => {
    stop();
    if (!status) step();
    p.redraw();
  });
  root.querySelector('[data-reset]')!.addEventListener('click', () => {
    stop();
    reset(path[0]);
    p.redraw();
  });
  sel.addEventListener('change', () => {
    stop();
    fn = FNS[sel.value]!;
    p.view = fn.view;
    heat = null;
    reset();
    p.redraw();
  });
  for (const el of [opt, lrIn])
    el.addEventListener('input', () => {
      stop();
      reset(path[0]);
      p.redraw();
    });
  canvas.addEventListener('pointerdown', (ev) => {
    stop();
    const w = p.world(ev);
    reset([w.x, w.y]);
    p.redraw();
    run();
  });
  window.addEventListener('cc-theme', () => (heat = null));

  reset();
  p.onDraw(draw);
}
