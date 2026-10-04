import { Plot, fmt, strings } from './plot';

type Act = 'sigmoid' | 'tanh' | 'relu';
const ACT: Record<Act, { f: (z: number) => number; df: (z: number) => number; yRange: [number, number] }> = {
  sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), df: (z) => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); }, yRange: [0, 1] },
  tanh: { f: Math.tanh, df: (z) => 1 - Math.tanh(z) ** 2, yRange: [-1, 1] },
  relu: { f: (z) => Math.max(0, z), df: (z) => (z > 0 ? 1 : 0), yRange: [0, 3] },
};

export function initNeuron(root: HTMLElement): void {
  const s = strings(root);
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const act = q<HTMLSelectElement>('[data-act]');
  const inputs = {
    x: q<HTMLInputElement>('[data-x]'),
    y: q<HTMLInputElement>('[data-y]'),
    w: q<HTMLInputElement>('[data-w]'),
    b: q<HTMLInputElement>('[data-b]'),
    lr: q<HTMLInputElement>('[data-lr]'),
  };
  const chain = q<HTMLElement>('.nn-chain');
  const p = new Plot(q<HTMLCanvasElement>('canvas'), { x0: 0, x1: 50, y0: 0, y1: 0.5 });
  p.pad = { l: 44, r: 10, t: 8, b: 22 };

  let w = Number(inputs.w.value) / 100;
  let b = Number(inputs.b.value) / 100;
  const init = { w, b };
  let history: number[] = [];

  const A = () => ACT[act.value as Act];
  const x = () => Number(inputs.x.value) / 10;
  const target = () => {
    const [lo, hi] = A().yRange;
    return lo + ((hi - lo) * (Number(inputs.y.value) + 10)) / 20;
  };
  const lr = () => 10 ** (-2 + (2.3 * Number(inputs.lr.value)) / 100);

  function forward() {
    const z = w * x() + b;
    const yh = A().f(z);
    const L = 0.5 * (yh - target()) ** 2;
    const dyh = yh - target();
    const dz = dyh * A().df(z);
    return { z, yh, L, dyh, dz, dw: dz * x(), db: dz };
  }

  function set(sel: string, text: string): void {
    const el = root.querySelector<HTMLElement>(sel);
    if (el) el.textContent = text;
  }

  function render(): void {
    const r = forward();
    set('[data-x-out]', fmt(x(), 3));
    set('[data-y-out]', fmt(target(), 3));
    set('[data-w-out]', fmt(w, 3));
    set('[data-b-out]', fmt(b, 3));
    set('[data-lr-out]', fmt(lr(), 2));
    set('[data-v="x"]', fmt(x(), 4));
    set('[data-v="w"]', fmt(w, 4));
    set('[data-v="b"]', fmt(b, 4));
    set('[data-v="z"]', fmt(r.z, 4));
    set('[data-v="yh"]', fmt(r.yh, 4));
    set('[data-v="L"]', fmt(r.L, 4));
    set('[data-g="yh"]', `∂L/∂ŷ = ${fmt(r.dyh, 3)}`);
    set('[data-g="z"]', `∂L/∂z = ${fmt(r.dz, 3)}`);
    set('[data-g="w"]', `∂L/∂w = ${fmt(r.dw, 3)}`);
    set('[data-g="b"]', `∂L/∂b = ${fmt(r.db, 3)}`);
    chain.replaceChildren();
    const line = (label: string, parts: string[], result: number) => {
      const span = document.createElement('span');
      span.append(`${label} = ${parts.join(' · ')} = `);
      const bEl = document.createElement('b');
      bEl.textContent = fmt(result, 4);
      span.append(bEl);
      chain.append(span);
    };
    line('∂L/∂w', [`(ŷ − y) ${fmt(r.dyh, 3)}`, `f′(z) ${fmt(A().df(r.z), 3)}`, `x ${fmt(x(), 3)}`], r.dw);
    line('∂L/∂b', [`(ŷ − y) ${fmt(r.dyh, 3)}`, `f′(z) ${fmt(A().df(r.z), 3)}`, '1'], r.db);
    p.redraw();
  }

  function drawLoss(): void {
    const { c } = p;
    const all = history.length ? history : [forward().L];
    p.view = { x0: 0, x1: Math.max(10, all.length - 1), y0: 0, y1: Math.max(1e-3, ...all) * 1.1 };
    p.clear();
    p.axes();
    p.ctx.save();
    p.clip();
    p.ctx.strokeStyle = c.comp;
    p.ctx.lineWidth = 2;
    p.ctx.beginPath();
    all.forEach((L, i) => (i ? p.ctx.lineTo(p.X(i), p.Y(L)) : p.ctx.moveTo(p.X(i), p.Y(L))));
    p.ctx.stroke();
    p.ctx.restore();
    p.label(`${s('loss')} L`, p.view.x1, p.view.y1, c.muted, 'right', 14);
  }

  function step(): void {
    if (!history.length) history.push(forward().L);
    const r = forward();
    w -= lr() * r.dw;
    b -= lr() * r.db;
    w = Math.max(-3, Math.min(3, w));
    b = Math.max(-3, Math.min(3, b));
    inputs.w.value = String(Math.round(w * 100));
    inputs.b.value = String(Math.round(b * 100));
    history.push(forward().L);
  }

  q('[data-step]').addEventListener('click', () => {
    step();
    render();
  });
  q('[data-train]').addEventListener('click', () => {
    for (let i = 0; i < 50; i++) step();
    render();
  });
  q('[data-reset]').addEventListener('click', () => {
    w = init.w;
    b = init.b;
    inputs.w.value = String(Math.round(w * 100));
    inputs.b.value = String(Math.round(b * 100));
    history = [];
    render();
  });
  inputs.w.addEventListener('input', () => {
    w = Number(inputs.w.value) / 100;
    history = [];
    render();
  });
  inputs.b.addEventListener('input', () => {
    b = Number(inputs.b.value) / 100;
    history = [];
    render();
  });
  for (const el of [inputs.x, inputs.y, inputs.lr, act])
    el.addEventListener('input', () => {
      history = [];
      render();
    });

  p.onDraw(drawLoss);
  render();
}
