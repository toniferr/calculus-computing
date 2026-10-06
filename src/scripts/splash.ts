export {};

// Home: one curve and four ideas of calculus at work on it, one after another — a tangent sliding along it (the
// derivative), Riemann rectangles growing thinner under it (the integral), Taylor polynomials of rising degree hugging
// it (series), and balls hopping down to its valleys (gradient descent). The pointer steers each act and holds it
// while it is over the canvas; in gradient descent a click drops another ball.

interface Words {
  lang: string;
  degree: string;
  step: string;
  local: string;
  global: string;
}

// ---------------------------------------------------------------- the curve
// f(x) = c + q (x − m)² + Σ a sin(w x + p) on [0, 10]: positive everywhere (so its area sits on the axis), with a
// global minimum near 4.8 and local ones near 1.5 and 7.75, and every derivative in closed form for Taylor.
const X0 = 0, X1 = 10, Y0 = 0, Y1 = 5.2;
const C0 = 2.6, Q = 0.035, M = 5.2;
const WAVES: [number, number, number][] = [
  [1.0, 0.85, 0.2],
  [0.5, 2.0, 1.3],
  [0.18, 3.7, 0.4],
];
const GLOBAL_MIN = 4.8;

/** n-th derivative of f at x. */
function d(x: number, n = 0): number {
  let v = n === 0 ? C0 + Q * (x - M) ** 2 : n === 1 ? 2 * Q * (x - M) : n === 2 ? 2 * Q : 0;
  for (const [a, w, p] of WAVES) v += a * w ** n * Math.sin(w * x + p + (n * Math.PI) / 2);
  return v;
}
const f = (x: number) => d(x);

/** Exact ∫ f from a to b, from the antiderivative. */
function integral(a: number, b: number): number {
  const F = (x: number) => C0 * x + (Q * (x - M) ** 3) / 3 - WAVES.reduce((s, [am, w, p]) => s + (am / w) * Math.cos(w * x + p), 0);
  return F(b) - F(a);
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => [...String(n)].map((c) => SUB[+c]).join('');
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---------------------------------------------------------------- the acts
const DURATION = [8.5, 9, 8.5, 10];
const ETA = 0.4, HOP = 0.42;
const RECTS = [2, 4, 8, 16, 32, 64, 160];
const START_BALLS = [0.9, 6.4, 8.9];

interface Ball {
  path: number[];
  done: boolean;
}

function start(root: HTMLElement, words: Words) {
  const canvas = root.querySelector<HTMLCanvasElement>('.splash-canvas')!;
  const copy = root.querySelector<HTMLElement>('.splash-copy')!;
  const hud = root.querySelector<HTMLElement>('.splash-hud')!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-act]')];
  const captions = [...root.querySelectorAll<HTMLElement>('[data-caption]')];
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-next]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-pause]')!;
  const ctx = canvas.getContext('2d')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const num = new Intl.NumberFormat(words.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------------------------------------------------------------- layout and colours
  let W = 0, H = 0;
  let L = 0, R = 0, T = 0, B = 0; // plot rectangle in CSS pixels
  let C = { bg: '#0a0d12', fg: '#e6edf3', muted: '#8b98a5', line: '#1f2630', math: '#7cc4ff', comp: '#f2b661', dark: true };

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string, dflt: string) => cs.getPropertyValue(n).trim() || dflt;
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    C = { bg: v('--bg', '#0a0d12'), fg: v('--fg', '#e6edf3'), muted: v('--muted', '#8b98a5'), line: v('--line-2', '#1f2630'), math: v('--accent', '#7cc4ff'), comp: v('--comp', '#f2b661'), dark };
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
    const beside = cr.bottom > r.top + 10 && cr.top < r.bottom;
    if (beside) {
      const edge = Math.max(24, (W - 1240) / 2);
      L = cr.right - r.left + 56;
      R = W - edge - 8;
      T = Math.max(56, H * 0.1);
      B = H - hud.offsetHeight - 54;
    } else {
      L = 34;
      R = W - 18;
      T = 64;
      B = H - 34;
    }
  }

  const sx = (x: number) => L + ((x - X0) / (X1 - X0)) * (R - L);
  const sy = (y: number) => B - ((y - Y0) / (Y1 - Y0)) * (B - T);
  const ux = (px: number) => X0 + ((px - L) / (R - L)) * (X1 - X0);
  const clampX = (x: number) => Math.min(X1 - 0.25, Math.max(X0 + 0.25, x));

  function rgba(color: string, a: number) {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1]!, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------------------------------------------------------------- state
  let act = 0, actT = 0, time = 0, paused = false, visible = true, running = false;
  let focus = 3.2; // the point each act works around (follows the pointer, smoothed)
  const pointer = { x: 0, y: 0, inside: false };
  let balls: Ball[] = [];
  let hopT = 0;

  function resetBalls() {
    balls = START_BALLS.map((x) => ({ path: [x], done: false }));
    hopT = 0;
    if (reduce) balls.forEach(settle);
  }
  function stepBall(b: Ball) {
    const x = b.path[b.path.length - 1]!;
    const next = clampX(x - ETA * d(x, 1));
    if (Math.abs(next - x) < 0.006 || b.path.length > 40) b.done = true;
    else b.path.push(next);
  }
  function settle(b: Ball) {
    while (!b.done) stepBall(b);
  }

  function setAct(i: number) {
    act = (i + 4) % 4;
    actT = 0;
    if (act === 0) focus = reduce ? 5.9 : 0.7;
    if (act === 2) focus = 3.3;
    if (act === 3) resetBalls();
    chips.forEach((c, k) => {
      c.setAttribute('aria-pressed', String(k === act));
      c.style.setProperty('--p', '0');
    });
    captions.forEach((c, k) => (c.hidden = k !== act));
    if (!running) draw();
  }

  // ---------------------------------------------------------------- drawing helpers
  function curvePath(g: (x: number) => number, a = X0, b = X1) {
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(((b - a) / (X1 - X0)) * (R - L) / 3));
    for (let k = 0; k <= n; k++) {
      const x = a + ((b - a) * k) / n;
      if (k) ctx.lineTo(sx(x), sy(g(x)));
      else ctx.moveTo(sx(x), sy(g(x)));
    }
  }

  function glowLine(color: string, width: number, blur: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = C.dark ? blur : blur / 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function dot(x: number, y: number, r: number, color: string) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = C.dark ? 16 : 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.dark ? '#ffffff' : C.bg;
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A straight line through (px, py) with pixel slope (dx, dy), `len` pixels each way. */
  function lineThrough(px: number, py: number, dx: number, dy: number, len: number) {
    const k = len / Math.hypot(dx, dy);
    ctx.beginPath();
    ctx.moveTo(px - dx * k, py - dy * k);
    ctx.lineTo(px + dx * k, py + dy * k);
  }

  /** Keep lines inside the plot (a little above it, below the readout). */
  function clipPlot() {
    ctx.beginPath();
    ctx.rect(L - 8, T - 6, R - L + 16, B - T + 6);
    ctx.clip();
  }

  function pill(text: string, x: number, y: number, color: string) {
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 14;
    const left = Math.min(R - w, Math.max(L, x - w / 2));
    ctx.fillStyle = rgba(C.bg, 0.88);
    ctx.strokeStyle = rgba(color, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, y - 10, w, 20, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.fg;
    ctx.textAlign = 'left';
    ctx.fillText(text, left + 7, y + 4);
  }

  function readout(lines: string[]) {
    ctx.font = '500 13px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textAlign = 'left';
    lines.forEach((s, k) => {
      ctx.fillStyle = k ? C.muted : C.fg;
      ctx.fillText(s, L + 14, T - 36 + k * 19);
    });
  }

  // ---------------------------------------------------------------- the frame
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const fade = reduce ? 1 : ease(actT / 0.45);

    // Graph paper and axes.
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(C.line, C.dark ? 0.55 : 0.7);
    ctx.beginPath();
    for (let x = X0; x <= X1; x++) {
      ctx.moveTo(Math.round(sx(x)) + 0.5, T - 8);
      ctx.lineTo(Math.round(sx(x)) + 0.5, B);
    }
    for (let y = Y0 + 1; y <= Y1; y++) {
      ctx.moveTo(L, Math.round(sy(y)) + 0.5);
      ctx.lineTo(R, Math.round(sy(y)) + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(C.muted, 0.7);
    ctx.beginPath();
    ctx.moveTo(L, B + 0.5);
    ctx.lineTo(R + 10, B + 0.5);
    ctx.moveTo(L + 0.5, B);
    ctx.lineTo(L + 0.5, T - 14);
    ctx.stroke();
    ctx.font = 'italic 13px "Source Serif 4 Variable", Georgia, serif';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'left';
    ctx.fillText('x', Math.min(R + 14, W - 10), B + (R + 14 > W - 10 ? 16 : 4));

    // The curve draws itself in on the first second.
    const reveal = reduce ? X1 : X0 + (X1 - X0) * ease(time / 1.4);

    ctx.globalAlpha = fade;
    if (act === 1) drawIntegral();
    ctx.globalAlpha = 1;

    // Faint fill under the curve, then the curve itself.
    const under = ctx.createLinearGradient(0, T, 0, B);
    under.addColorStop(0, rgba(C.math, C.dark ? 0.1 : 0.08));
    under.addColorStop(1, rgba(C.math, 0));
    curvePath(f, X0, reveal);
    ctx.lineTo(sx(reveal), B);
    ctx.lineTo(sx(X0), B);
    ctx.closePath();
    ctx.fillStyle = under;
    ctx.fill();
    curvePath(f, X0, reveal);
    glowLine(C.math, 3, 14);
    ctx.font = 'italic 14px "Source Serif 4 Variable", Georgia, serif';
    ctx.fillStyle = C.math;
    if (reveal >= X1) ctx.fillText('f(x)', sx(9.25) - 12, sy(f(9.25)) - 16);

    ctx.globalAlpha = fade;
    if (reveal >= X1) {
      if (act === 0) drawDerivative();
      if (act === 2) drawTaylor();
      if (act === 3) drawDescent();
    }
    ctx.globalAlpha = 1;
  }

  // 1 · the derivative: a tangent riding the curve, a secant closing in on it, and the slope triangle.
  function drawDerivative() {
    const x = focus, y = f(x), m = d(x, 1);
    ctx.save();
    clipPlot();
    const px = sx(x), py = sy(y);
    const kx = (R - L) / (X1 - X0), ky = (B - T) / (Y1 - Y0);
    // Secant through x and x + h, h shrinking towards 0 again and again.
    const h = reduce ? 0 : 2.4 * (1 - ((time * 0.45) % 1)) ** 2;
    if (h > 0.03) {
      const x2 = Math.min(X1, x + h), y2 = f(x2);
      ctx.strokeStyle = rgba(C.fg, 0.35 * Math.min(1, h));
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      lineThrough(px, py, (x2 - x) * kx, -(y2 - y) * ky, 260);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(C.fg, 0.6 * Math.min(1, h));
      ctx.beginPath();
      ctx.arc(sx(x2), sy(y2), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Slope triangle: one unit across (backwards near the right edge), f′(x) up or down.
    const run = x + 1 <= X1 ? 1 : -1;
    ctx.strokeStyle = rgba(C.comp, 0.7);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx(x + run), py);
    ctx.lineTo(sx(x + run), sy(y + run * m));
    ctx.stroke();
    ctx.setLineDash([]);
    lineThrough(px, py, kx, -m * ky, 230);
    glowLine(C.comp, 2.4, 12);
    ctx.restore();
    dot(px, py, 6.5, C.comp);
    readout([`f′(x) = ${num.format(m)}`, `x = ${num.format(x)}`]);
  }

  // 2 · the integral: midpoint rectangles from a to b, more and thinner every second.
  function drawIntegral() {
    const a = 0.4, b = pointer.inside ? Math.max(a + 0.6, clampX(ux(pointer.x))) : 9.6;
    const stage = reduce ? 3 : Math.min(RECTS.length - 1, Math.floor(actT / 1.15));
    const n = RECTS[stage]!;
    const grow = reduce ? 1 : ease((actT - stage * 1.15) / 0.55);
    const w = (b - a) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += f(a + (i + 0.5) * w) * w;
    const shown = Math.ceil(n * grow);
    ctx.fillStyle = rgba(C.comp, C.dark ? 0.24 : 0.3);
    ctx.strokeStyle = rgba(C.comp, n <= 32 ? 0.75 : 0);
    ctx.lineWidth = 1;
    for (let i = 0; i < shown; i++) {
      const x = a + i * w, h = f(x + w / 2);
      const left = sx(x), top = sy(h), width = sx(x + w) - left;
      ctx.fillRect(left, top, width, B - top);
      if (n <= 32) ctx.strokeRect(left + 0.5, top + 0.5, width - 1, B - top - 1);
    }
    ctx.font = 'italic 13px "Source Serif 4 Variable", Georgia, serif';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText('a', sx(a), B + 17);
    ctx.fillText('b', sx(b), B + 17);
    ctx.textAlign = 'left';
    readout([`n = ${n}    Σ f(xᵢ) Δx = ${num.format(sum)}`, `∫ₐᵇ f(x) dx = ${num.format(integral(a, b))}`]);
  }

  // 3 · Taylor: the polynomial of degree k around a, k rising; the previous one stays as a ghost.
  function drawTaylor() {
    const a = focus;
    const k = reduce ? 6 : Math.min(10, Math.floor(actT / 0.7));
    const coef: number[] = [];
    let fact = 1;
    for (let j = 0; j <= k; j++) {
      if (j) fact *= j;
      coef.push(d(a, j) / fact);
    }
    const poly = (deg: number) => (x: number) => {
      let v = 0;
      for (let j = deg; j >= 0; j--) v = v * (x - a) + coef[j]!;
      return v;
    };
    ctx.save();
    clipPlot();
    if (k > 0) {
      curvePath(poly(k - 1));
      ctx.strokeStyle = rgba(C.comp, 0.22);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    curvePath(poly(k));
    glowLine(C.comp, 2.6, 12);
    ctx.restore();
    ctx.strokeStyle = rgba(C.comp, 0.5);
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(a), sy(f(a)));
    ctx.lineTo(sx(a), B);
    ctx.stroke();
    ctx.setLineDash([]);
    dot(sx(a), sy(f(a)), 6, C.comp);
    ctx.font = 'italic 13px "Source Serif 4 Variable", Georgia, serif';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText('a', sx(a), B + 17);
    ctx.textAlign = 'left';
    readout([`T${sub(k)}(x) = Σ f⁽ʲ⁾(a) (x − a)ʲ / j!`, `${words.degree} ${k}`]);
  }

  // 4 · gradient descent: each ball hops x ← x − η f′(x) until the ground is flat.
  function drawDescent() {
    const hop = reduce ? 1 : ease(hopT / HOP);
    let steps = 0;
    for (const b of balls) {
      const path = b.path;
      steps = Math.max(steps, path.length - 1);
      // Trail: the hops already made, as dotted arcs.
      ctx.strokeStyle = rgba(C.comp, 0.45);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
      const last = b.done ? path.length - 1 : path.length - 2;
      for (let i = 0; i < last; i++) arc(path[i]!, path[i + 1]!, 1);
      ctx.setLineDash([]);
      for (let i = 0; i < last; i++) {
        ctx.fillStyle = rgba(C.comp, 0.5);
        ctx.beginPath();
        ctx.arc(sx(path[i]!), sy(f(path[i]!)), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // The ball, mid-hop or resting.
      let bx: number, by: number;
      if (b.done || path.length < 2) {
        bx = sx(path[path.length - 1]!);
        by = sy(f(path[path.length - 1]!));
      } else {
        const p = arc(path[path.length - 2]!, path[path.length - 1]!, hop, false);
        bx = p.x;
        by = p.y;
      }
      dot(bx, by - 7, 7, C.comp);
      if (b.done) {
        const x = path[path.length - 1]!;
        const global = Math.abs(x - GLOBAL_MIN) < 0.3;
        pill(global ? words.global : words.local, sx(x), sy(f(x)) + 26, global ? C.comp : C.math);
      }
    }
    readout(['x ← x − η f′(x)', `η = ${num.format(ETA)}    ${words.step} ${steps}`]);
  }

  /** The parabolic hop from x1 to x2 (drawn up to t, or just evaluated at t). */
  function arc(x1: number, x2: number, t: number, stroke = true) {
    const ax = sx(x1), ay = sy(f(x1)) - 7, bx = sx(x2), by = sy(f(x2)) - 7;
    const lift = 14 + Math.abs(bx - ax) * 0.25;
    const at = (s: number) => ({ x: ax + (bx - ax) * s, y: ay + (by - ay) * s - lift * 4 * s * (1 - s) });
    if (stroke) {
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const p = at((t * k) / 16);
        if (k) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    return at(t);
  }

  // ---------------------------------------------------------------- loop
  let last = 0;
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    // The act waits while the pointer plays with it.
    if (!pointer.inside || actT < 0.45) actT += dt;
    if (actT > DURATION[act]!) setAct(act + 1);
    chips[act]?.style.setProperty('--p', String(Math.min(1, actT / DURATION[act]!)));

    const target = pointer.inside ? clampX(ux(pointer.x)) : act === 0 ? 0.7 + 8.6 * ease(actT / DURATION[0]!) : act === 2 ? 3.3 : focus;
    focus += (target - focus) * Math.min(1, dt * 9);

    if (act === 3) {
      hopT += dt;
      if (hopT >= HOP) {
        hopT -= HOP;
        balls.forEach((b) => !b.done && stepBall(b));
      }
    }
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
  function track(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside = pointer.x > L - 20 && pointer.x < R + 20 && pointer.y > T - 40 && pointer.y < B + 30;
    if (!running) {
      if (pointer.inside) focus = clampX(ux(pointer.x));
      draw();
    }
  }
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    if (!running) draw();
  });
  canvas.addEventListener('click', (e) => {
    track(e);
    if (act !== 3 || !pointer.inside) return;
    balls.push({ path: [clampX(ux(pointer.x))], done: false });
    if (balls.length > 6) balls.shift();
    if (reduce || !running) {
      settle(balls[balls.length - 1]!);
      draw();
    }
  });
  chips.forEach((c, k) => c.addEventListener('click', () => setAct(k)));
  nextBtn.addEventListener('click', () => setAct(act + 1));
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
  setAct(0);
  draw();
  setRunning(true);
}

// Last, so every constant above is initialised before the scene starts.
const root = document.querySelector<HTMLElement>('.splash');
const dataEl = document.getElementById('splash-data');
if (root && dataEl) start(root, JSON.parse(dataEl.textContent ?? '{}') as Words);
