/**
 * Markdown + TeX for the text fields of the content model.
 *
 * - `$...$` and `$$...$$` are rendered by KaTeX to native MathML at build time (no client-side math, no inline styles,
 *   so the strict CSP holds). A formula that does not compile fails the build.
 * - `[[topic-id]]` and `[[topic-id|label]]` become links to topic pages; an unknown id fails the build.
 */
import katex from 'katex';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { href, type Lang } from './i18n';

/** Shared macros for every formula in the portal. */
export const MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\dd': '\\mathrm{d}',
  '\\e': '\\mathrm{e}',
  '\\grad': '\\nabla',
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\lVert#1\\right\\rVert',
  '\\pd': '\\frac{\\partial #1}{\\partial #2}',
  '\\E': '\\mathbb{E}',
  '\\Var': '\\operatorname{Var}',
  '\\diverg': '\\nabla\\cdot',
  '\\curl': '\\nabla\\times',
};

const KATEX_OPTIONS = {
  output: 'mathml' as const,
  throwOnError: true,
  strict: 'ignore' as const,
  macros: MACROS,
};

const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex, KATEX_OPTIONS)
  .use(rehypeStringify);

// MathML Core (what Chrome implements) ignores mathvariant other than "normal", so KaTeX's
// <mi mathvariant="double-struck">R</mi> would show an italic R. Map those letters to the Unicode
// Mathematical Alphanumeric Symbols instead (with the letters that live in the Letterlike block).
const VARIANT_BASE: Record<string, [number, number, number?]> = {
  // [capital A, small a, digit 0]
  bold: [0x1d400, 0x1d41a, 0x1d7ce],
  'double-struck': [0x1d538, 0x1d552, 0x1d7d8],
  script: [0x1d49c, 0x1d4b6],
  fraktur: [0x1d504, 0x1d51e],
  'sans-serif': [0x1d5a0, 0x1d5ba, 0x1d7e2],
  monospace: [0x1d670, 0x1d68a, 0x1d7f6],
  'bold-italic': [0x1d468, 0x1d482],
};
const VARIANT_HOLES: Record<string, Record<string, string>> = {
  'double-struck': { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
  script: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' },
  fraktur: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' },
};

function mapVariant(variant: string, text: string): string | null {
  const base = VARIANT_BASE[variant];
  if (!base) return null;
  return [...text]
    .map((ch) => {
      const hole = VARIANT_HOLES[variant]?.[ch];
      if (hole) return hole;
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(base[0] + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(base[1] + c - 97);
      if (c >= 48 && c <= 57 && base[2]) return String.fromCodePoint(base[2] + c - 48);
      return ch;
    })
    .join('');
}

/** Make wide formulas scroll instead of widening the page (KaTeX's MathML output has no display wrapper). */
function wrapMath(html: string): string {
  return html
    .replace(/<span class="katex">(<math[^>]*display="block"[\s\S]*?<\/math>)<\/span>/g, '<div class="math-display">$1</div>')
    .replace(/<span class="katex">(<math(?![^>]*display="block")[\s\S]*?<\/math>)<\/span>/g, (m, inner: string) => {
      const tex = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(inner)?.[1] ?? '';
      return tex.length > 40 || inner.includes('<mtable') ? `<span class="katex katex-long">${inner}</span>` : m;
    });
}

function fixMathVariants(html: string): string {
  return wrapMath(html).replace(
    /<(mi|mn|mtext|mo)([^>]*?) mathvariant="([a-z-]+)"([^>]*)>([^<]*)<\/\1>/g,
    (m, tag: string, pre: string, variant: string, post: string, text: string) => {
      if (variant === 'normal') return m;
      const mapped = mapVariant(variant, text);
      if (mapped === null) return m;
      // A single mapped letter would otherwise be auto-italicized by <mi>; mark it normal.
      const normal = tag === 'mi' ? ' mathvariant="normal"' : '';
      return `<${tag}${pre}${post}${normal}>${mapped}</${tag}>`;
    },
  );
}

type Resolver = (id: string, lang: Lang) => string | undefined;
let resolveTitle: Resolver = () => undefined;

/** The graph registers itself so that [[id]] links can be checked and labelled. */
export function setTitleResolver(fn: Resolver): void {
  resolveTitle = fn;
}

const cache = new Map<string, string>();

function expandLinks(src: string, lang: Lang, where: string): string {
  return src.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_m, id: string, label?: string) => {
    const title = resolveTitle(id, lang);
    if (!title) throw new Error(`[md] unknown topic link [[${id}]] in ${where}`);
    return `[${label ?? title}](${href(lang, `topic/${id}/`)})`;
  });
}

/** Render a Markdown field to HTML. `where` names the field for error messages. */
export function md(src: string, lang: Lang, where = 'content'): string {
  const key = `${lang}\u0000${src}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // remark-math only treats $$…$$ as display math when the fences sit on their own lines.
  const fenced = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`);
  const html = fixMathVariants(String(processor.processSync(expandLinks(fenced, lang, where))).trim());
  // rehype-katex does not throw: it renders a red .katex-error span (with an inline style) instead.
  const bad = /class="katex-error"[^>]*title="([^"]*)"/.exec(html);
  if (bad) throw new Error(`[md] ${where}: ${bad[1]}`);
  cache.set(key, html);
  return html;
}

/** Same as md() but without the wrapping <p> of a single paragraph (for titles, list items, table cells). */
export function mdInline(src: string, lang: Lang, where = 'content'): string {
  const html = md(src, lang, where);
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return m && !m[1]!.includes('<p>') ? m[1]! : html;
}

/** Drop links from rendered HTML (for text placed inside another link, e.g. a card). */
export function unlink(html: string): string {
  return html.replace(/<a\b[^>]*>/g, '<span class="ilink">').replace(/<\/a>/g, '</span>');
}

/** A single TeX formula. */
export function tex(src: string, display = true): string {
  try {
    return fixMathVariants(katex.renderToString(src, { ...KATEX_OPTIONS, displayMode: display }));
  } catch (err) {
    throw new Error(`[tex] ${(err as Error).message}\n  in: ${src}`);
  }
}

/** TeX commands that have a reasonable Unicode rendering in plain text. */
const TEX_UNICODE: Record<string, string> = {
  partial: '∂', nabla: '∇', grad: '∇', int: '∫', oint: '∮', iint: '∬', sum: 'Σ', prod: 'Π', infty: '∞', to: '→',
  rightarrow: '→', leftarrow: '←', implies: '⇒', iff: '⇔', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
  approx: '≈', sim: '∼', cdot: '·', times: '×', pm: '±', mp: '∓', in: '∈', subset: '⊂', forall: '∀', exists: '∃',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', varepsilon: 'ε', epsilon: 'ε', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', psi: 'ψ', omega: 'ω',
  Omega: 'Ω', Theta: 'Θ', R: 'ℝ', C: 'ℂ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', E: '𝔼', dd: 'd', e: 'e', hbar: 'ħ', ell: 'ℓ',
  lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln', exp: 'exp', max: 'max', min: 'min', det: 'det',
  sqrt: '√', ldots: '…', dots: '…', cdots: '⋯', langle: '⟨', rangle: '⟩', lVert: '‖', rVert: '‖', Vert: '‖', mid: '|',
  odot: '⊙', circ: '∘', star: '⋆', ast: '∗', prime: '′',
};

/** Plain text of a Markdown/TeX field, for search indexes, meta descriptions and the map panel. */
export function plain(src: string, lang: Lang = 'en'): string {
  return src
    .replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, (_m, id: string) => resolveTitle(id, lang) ?? id.replace(/-/g, ' '))
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$]+)\$/g, (_m, tex: string) =>
      tex
        .replace(/\\(?:mathbb|mathrm|mathbf|mathsf|operatorname|text|hat|bar|tilde|vec|dot|ddot)\{([^{}]*)\}/g, '$1')
        .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
        .replace(/\\(?:left|right|bigg?|Bigg?|qquad|quad)(?![a-zA-Z])/g, '')
        .replace(/\\[,;!:]/g, ' ')
        .replace(/\\([a-zA-Z]+)/g, (_m, cmd: string) => TEX_UNICODE[cmd] ?? '')
        .replace(/\\([{}|,;!])/g, '$1')
        .replace(/\^\{([^{}]*)\}/g, '^$1')
        .replace(/_\{([^{}]*)\}/g, '_$1')
        .replace(/[{}]/g, ''),
    )
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
