// Small canvas plotting helper shared by the demos: HiDPI sizing, world↔screen transforms, axes and curves,
// colours read from the CSS theme, and automatic redraw on resize and theme change.

export interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Colors {
  fg: string;
  fg2: string;
  muted: string;
  faint: string;
  line: string;
  line2: string;
  surface: string;
  accent: string;
  math: string;
  comp: string;
  good: string;
  bad: string;
  /** highlight colour for tangents and approximations */
  hl: string;
}

export class Plot {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  view: View;
  pad = { l: 36, r: 10, t: 10, b: 24 };
  c!: Colors;
  private draw: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, view: View) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.view = view;
    this.readColors();
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('cc-theme', () => {
      this.readColors();
      this.draw();
    });
    this.resize();
  }

  /** Register the function that repaints everything; called on resize and theme change. */
  onDraw(fn: () => void): void {
    this.draw = fn;
    fn();
  }

  redraw(): void {
    this.draw();
  }

  private readColors(): void {
    const s = getComputedStyle(this.canvas);
    const v = (name: string) => s.getPropertyValue(name).trim();
    this.c = {
      fg: v('--fg'),
      fg2: v('--fg-2'),
      muted: v('--muted'),
      faint: v('--faint'),
      line: v('--line'),
      line2: v('--line-2'),
      surface: v('--surface'),
      accent: v('--accent'),
      math: v('--math'),
      comp: v('--comp'),
      good: v('--good'),
      bad: v('--bad'),
      hl: v('--hl'),
    };
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const aspect = Number(this.canvas.dataset.aspect ?? '0.6');
    const h = Math.round(Math.min(w * aspect, 520));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.height = Math.round(h * dpr);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  X(x: number): number {
    const { x0, x1 } = this.view;
    return this.pad.l + ((x - x0) / (x1 - x0)) * (this.w - this.pad.l - this.pad.r);
  }

  Y(y: number): number {
    const { y0, y1 } = this.view;
    return this.pad.t + ((y1 - y) / (y1 - y0)) * (this.h - this.pad.t - this.pad.b);
  }

  invX(px: number): number {
    const { x0, x1 } = this.view;
    return x0 + ((px - this.pad.l) / (this.w - this.pad.l - this.pad.r)) * (x1 - x0);
  }

  invY(py: number): number {
    const { y0, y1 } = this.view;
    return y1 - ((py - this.pad.t) / (this.h - this.pad.t - this.pad.b)) * (y1 - y0);
  }

  /** Pointer position in world coordinates. */
  world(ev: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: this.invX(ev.clientX - r.left), y: this.invY(ev.clientY - r.top) };
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  /** Grid lines at "nice" steps and labelled axes. */
  axes(): void {
    const { ctx, view, c } = this;
    const step = (span: number) => {
      const raw = span / 8;
      const p = 10 ** Math.floor(Math.log10(raw));
      const m = raw / p;
      return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    };
    const sx = step(view.x1 - view.x0);
    const sy = step(view.y1 - view.y0);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '11px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.fillStyle = c.muted;
    ctx.strokeStyle = c.line;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(view.x0 / sx) * sx; x <= view.x1 + 1e-9; x += sx) {
      const px = Math.round(this.X(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, this.pad.t);
      ctx.lineTo(px, this.h - this.pad.b);
      ctx.stroke();
      ctx.fillText(fmt(x), px, this.h - this.pad.b + 5);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(view.y0 / sy) * sy; y <= view.y1 + 1e-9; y += sy) {
      const py = Math.round(this.Y(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.pad.l, py);
      ctx.lineTo(this.w - this.pad.r, py);
      ctx.stroke();
      ctx.fillText(fmt(y), this.pad.l - 6, py);
    }
    ctx.strokeStyle = c.line2;
    ctx.lineWidth = 1.2;
    if (view.y0 < 0 && view.y1 > 0) {
      ctx.beginPath();
      ctx.moveTo(this.pad.l, this.Y(0));
      ctx.lineTo(this.w - this.pad.r, this.Y(0));
      ctx.stroke();
    }
    if (view.x0 < 0 && view.x1 > 0) {
      ctx.beginPath();
      ctx.moveTo(this.X(0), this.pad.t);
      ctx.lineTo(this.X(0), this.h - this.pad.b);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Plot y = f(x); breaks the path at non-finite values and wild jumps (poles). */
  fn(f: (x: number) => number, color: string, width = 2, dash: number[] = [], from = this.view.x0, to = this.view.x1): void {
    const { ctx } = this;
    const n = Math.max(200, Math.round(this.w * 1.5));
    const span = this.view.y1 - this.view.y0;
    ctx.save();
    this.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    let prev = NaN;
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n;
      const y = f(x);
      if (!Number.isFinite(y) || Math.abs(y - prev) > span * 4) {
        pen = false;
        prev = y;
        if (!Number.isFinite(y)) continue;
      }
      const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
      if (pen) ctx.lineTo(this.X(x), py);
      else ctx.moveTo(this.X(x), py);
      pen = true;
      prev = y;
    }
    ctx.stroke();
    ctx.restore();
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, width = 1.5, dash: number[] = []): void {
    const { ctx } = this;
    ctx.save();
    this.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(this.X(x0), this.Y(y0));
    ctx.lineTo(this.X(x1), this.Y(y1));
    ctx.stroke();
    ctx.restore();
  }

  dot(x: number, y: number, r: number, color: string, ring?: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(y), r, 0, Math.PI * 2);
    ctx.fill();
    if (ring) {
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  label(text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left', dy = -8): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '12px "Inter Variable", system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, this.X(x) + (align === 'left' ? 6 : align === 'right' ? -6 : 0), this.Y(y) + dy);
    ctx.restore();
  }

  clip(): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.rect(this.pad.l, this.pad.t, this.w - this.pad.l - this.pad.r, this.h - this.pad.t - this.pad.b);
    ctx.clip();
  }
}

/** Compact number formatting for axes and readouts. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-4) return v.toExponential(2).replace('-', '−');
  const s = Number(v.toPrecision(digits)).toString();
  return s.replace('-', '−');
}

/** Shorthand to read a localized string from the demo's data-s-* attributes. */
export function strings(root: HTMLElement): (key: string) => string {
  return (key) => root.dataset[`s${key[0]!.toUpperCase()}${key.slice(1)}`] ?? key;
}
