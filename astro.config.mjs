// @ts-check
import { defineConfig } from 'astro/config';

// Published as a GitHub Pages project site: https://toniferr.github.io/calculus-computing/
export default defineConfig({
  site: 'https://toniferr.github.io',
  base: '/calculus-computing',
  trailingSlash: 'always',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  // Markdown fields are rendered by src/lib/md.ts; no code blocks need Shiki (whose inline styles break the CSP).
  markdown: { syntaxHighlight: false },
  build: {
    format: 'directory',
    // Everything external: the CSP below never needs 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
  security: {
    // Astro adds a <meta http-equiv="content-security-policy"> with hashes for its own scripts/styles.
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        'upgrade-insecure-requests',
      ],
    },
  },
});
