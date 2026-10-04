# Calculus × Computing

A navigable knowledge map of university calculus and of where every idea shows up in computing — AI, graphics,
simulation, robotics, signal processing, scientific computing. Published at
**https://toniferr.github.io/calculus-computing/** in English and Spanish ([/es/](https://toniferr.github.io/calculus-computing/es/)).

It is not a list of topics but a graph: start from a mathematical concept and follow it to the technology that uses it
(*where is the derivative used?*), or start from a technology and walk back to the mathematics behind it (*where does
backpropagation come from?*).

| | |
| --- | --- |
| **Syllabus** | 17 mathematical areas — foundations, sequences and limits, continuity, derivatives, fundamental theorems, optimization, numerical methods, Taylor, integrals, series, multivariable and vector calculus, ODEs, dynamical systems and chaos, transforms, probability — plus a linear-algebra bridge |
| **Computing domains** | AI and machine learning, scientific computing, graphics, robotics and control, physics and simulation, signals and vision, optimization and systems, cryptography, quantum |
| **Topic pages** | the same structure everywhere: level, prerequisites (and the full computed path), what it is, why it exists, intuition, formal definition, formulas, how it is computed, example, interactive figure, why it matters, applications in computing and in AI, what depends on it, exercises with solutions |
| **Knowledge map** | every topic and connection, zoomable, with upstream / downstream exploration |
| **Routes** | recover university calculus · mathematics for AI · computer graphics · simulation · computational physics |
| **Interactive figures** | tangent and secant, Riemann sums, Taylor polynomials, gradient descent on 2D landscapes, Newton's method, backpropagation through one neuron |

## Principles

- **Content is data.** Every topic lives in `src/content/areas/<area>.yaml`; components only render it. Adding a topic
  is adding an entry.
- **No invented connections.** Every edge from mathematics to computing has a strength (1–5 stars), a type
  (fundamental, frequent, advanced, indirect, historical) and a note saying what exactly is used.
- **The build is the test.** It fails on an unknown topic reference, a prerequisite cycle, a missing translation, an
  unknown visualization or a formula that does not compile.
- **Static and private.** Astro static output on GitHub Pages; no backend, no cookies, no analytics; a strict Content
  Security Policy with no inline scripts or styles; fonts and libraries served from the site itself.
- **Maths at build time.** TeX is rendered to MathML by KaTeX during the build (STIX Two Math font).

## Running locally

Requires Node.js 22.12+ (developed with Node 24 LTS).

```sh
npm ci
npm run dev        # http://localhost:4321/calculus-computing/
npm run build      # static site in dist/ (validates all content)
npm run preview    # serve dist/
npm run check      # TypeScript and Astro diagnostics
```

## Structure

```text
src/
├── content.config.ts          the content model (zod schemas): areas, topics, routes
├── content/
│   ├── areas/<area>.yaml      one area (math or computing) with its ordered topics
│   └── routes.yaml            learning routes
├── lib/
│   ├── graph.ts               builds and validates the knowledge graph; upstream, downstream, reach, matrix
│   ├── md.ts                  Markdown + TeX → HTML/MathML, [[topic-id]] links
│   ├── i18n.ts                interface strings and URL helpers (en at the root, es under /es/)
│   └── demos.ts               registry of interactive figures
├── components/
│   ├── pages/                 one component per page type, rendered for both languages
│   └── demos/                 interactive figures (Astro markup + scripts/demos/*.ts)
├── scripts/                   client code: search, map, filters, route progress, demos
├── pages/                     thin routes for en (root) and es (/es/)
└── styles/global.css          dark-first theme
```

## Writing a topic

```yaml
- id: gradient
  level: university            # fundamental | university | advanced | specialized
  core: true                   # part of the core map
  prerequisites: [partial-derivatives, vectors]
  applications:
    - to: gradient-descent     # a topic in a computing area
      strength: 5
      type: fundamental
      note: {en: '…', es: '…'}
  demo: gradient-descent       # optional interactive figure
  title: {en: 'Gradient', es: 'Gradiente'}
  summary: {en: '…', es: '…'}  # also: why, intuition, formal, proofIdea, proof, compute, example, matters
  formulas:
    - tex: '\nabla f = (\partial_1 f, \dots, \partial_n f)'
  exercises:
    - type: ai                 # computation | proof | graphical | applied | computing | ai
      prompt: {en: '…', es: '…'}
      solution: {en: '…', es: '…'}
```

Text fields are Markdown with `$TeX$`, `$$display$$` and links to other topics as `[[topic-id]]` or
`[[topic-id|label]]`. Macros available in every formula: `\R \C \N \Z \Q \dd \e \E \Var \norm{} \abs{} \pd{}{}`.

## Sister sites

[Math of AI](https://toniferr.github.io/math-of-ai/) · [Math of Quantum](https://toniferr.github.io/math-of-quantum/)

## License

MIT. The fonts (Inter, Source Serif 4, JetBrains Mono, STIX Two Math) are under the SIL Open Font License.
