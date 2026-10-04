/**
 * Content model. Everything the portal shows lives in data, not in components:
 *
 *   src/content/areas/<area>.yaml   one area of the map (a block of the syllabus, or a computing domain)
 *                                   with its ordered list of topics
 *   src/content/routes.yaml         learning routes (ordered lists of topic ids)
 *
 * Every user-facing string is localized as { en, es }; the schema rejects a missing translation.
 * Long text fields are Markdown with $TeX$ and [[topic-id]] / [[topic-id|label]] links (see src/lib/md.ts).
 * Cross-references between topics are validated when the graph is built (src/lib/graph.ts).
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const L = z.object({ en: z.string().min(1), es: z.string().min(1) });
const Lists = z.object({ en: z.array(z.string()).default([]), es: z.array(z.string()).default([]) });

export const LEVELS = ['fundamental', 'university', 'advanced', 'specialized'] as const;
export const KINDS = ['concept', 'theorem', 'method', 'application'] as const;
/** How a mathematical topic relates to a computing topic (section 38 of the spec). */
export const CONNECTION_TYPES = ['fundamental', 'frequent', 'advanced', 'indirect', 'historical'] as const;
export const EXERCISE_TYPES = ['computation', 'proof', 'graphical', 'applied', 'computing', 'ai'] as const;

const application = z.object({
  /** id of a topic in a computing area */
  to: z.string(),
  /** 1–5 stars: how much the target really depends on this topic */
  strength: z.number().int().min(1).max(5),
  type: z.enum(CONNECTION_TYPES),
  /** one or two sentences: what exactly is used, and how */
  note: L,
});

const formula = z.object({
  /** one TeX string, or { en, es } when the formula contains words */
  tex: z.union([z.string().min(1), L]),
  label: L.optional(),
});

const exercise = z.object({
  type: z.enum(EXERCISE_TYPES),
  prompt: L,
  hint: L.optional(),
  solution: L,
});

const link = z.object({ href: z.url(), label: L });

export const topicSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  kind: z.enum(KINDS).default('concept'),
  level: z.enum(LEVELS),
  /** 1–5; defaults from the level when omitted */
  difficulty: z.number().int().min(1).max(5).optional(),
  /** part of the core map of section 29 */
  core: z.boolean().default(false),
  prerequisites: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  applications: z.array(application).default([]),
  /** id of an interactive visualization in src/components/demos */
  demo: z.string().optional(),

  title: L,
  /** extra search terms (synonyms, English/Spanish names, notation) */
  aliases: Lists.default({ en: [], es: [] }),
  /** ¿Qué es? — one short paragraph */
  summary: L,
  /** ¿Por qué existe? ¿Qué problema resuelve? */
  why: L.optional(),
  /** Intuición e interpretación geométrica */
  intuition: L.optional(),
  /** Definición formal, or the statement for a theorem */
  formal: L.optional(),
  /** Theorems: idea of the proof */
  proofIdea: L.optional(),
  /** Theorems: formal proof (folded by default) */
  proof: L.optional(),
  formulas: z.array(formula).default([]),
  /** ¿Cómo se calcula? — procedure or algorithm */
  compute: L.optional(),
  example: L.optional(),
  /** ¿Por qué importa? */
  matters: L.optional(),
  exercises: z.array(exercise).default([]),
  /** further reading: sister sites, classic references */
  links: z.array(link).default([]),
});

const areas = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/areas' }),
  schema: z.object({
    kind: z.enum(['math', 'computing']),
    order: z.number(),
    /** short symbol shown on cards and in the map */
    glyph: z.string(),
    title: L,
    summary: L,
    /** optional long introduction shown on the area page (Markdown) */
    intro: L.optional(),
    topics: z.array(topicSchema).min(1),
  }),
});

const routes = defineCollection({
  loader: file('./src/content/routes.yaml'),
  schema: z.object({
    order: z.number(),
    glyph: z.string(),
    title: L,
    summary: L,
    steps: z.array(z.string()).min(2),
  }),
});

export const collections = { areas, routes };
