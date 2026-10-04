/**
 * The knowledge graph, built once per build from the content collections.
 *
 * Nodes are topics. Edges always point from an idea to what builds on it:
 *   - prerequisite edges: P → T for every P in T.prerequisites
 *   - application edges:  T → A for every { to: A } in T.applications (A lives in a computing area)
 *
 * The combined graph must be acyclic; the build fails with the offending cycle otherwise, and also on any reference
 * to an unknown topic, route step or visualization.
 */
import { getCollection } from 'astro:content';
import type { z } from 'astro/zod';
import { CONNECTION_TYPES, LEVELS, type topicSchema } from '../content.config';
import { DEMOS } from './demos';
import { href, type Lang, type Localized } from './i18n';
import { setTitleResolver } from './md';

type TopicData = z.infer<typeof topicSchema>;
export type Level = (typeof LEVELS)[number];
export type ConnectionType = (typeof CONNECTION_TYPES)[number];
export type AreaKind = 'math' | 'computing';

export interface Topic extends TopicData {
  area: string;
  areaKind: AreaKind;
  /** position inside its area */
  index: number;
  difficulty: number;
}

export interface Area {
  id: string;
  kind: AreaKind;
  order: number;
  glyph: string;
  title: Localized;
  summary: Localized;
  intro?: Localized | undefined;
  topics: string[];
}

export interface Route {
  id: string;
  order: number;
  glyph: string;
  title: Localized;
  summary: Localized;
  steps: string[];
}

export interface Edge {
  from: string;
  to: string;
  kind: 'prerequisite' | 'application';
  strength?: number;
  type?: ConnectionType;
  note?: Localized;
}

export interface Reach {
  topic: Topic;
  /** ids from the start node to topic, both included */
  path: string[];
  /** weakest application edge along the path (1–5) */
  strength: number;
  /** type of that weakest application edge */
  type: ConnectionType;
}

const LEVEL_RANK: Record<Level, number> = { fundamental: 0, university: 1, advanced: 2, specialized: 3 };
const DEFAULT_DIFFICULTY: Record<Level, number> = { fundamental: 2, university: 3, advanced: 4, specialized: 5 };
const TYPE_RANK: Record<ConnectionType, number> = { fundamental: 0, frequent: 1, advanced: 2, indirect: 3, historical: 4 };

export class Graph {
  readonly areas: Area[];
  readonly topics: Topic[];
  readonly routes: Route[];
  readonly edges: Edge[];
  private readonly byId = new Map<string, Topic>();
  private readonly areaById = new Map<string, Area>();
  private readonly outE = new Map<string, Edge[]>();
  private readonly inE = new Map<string, Edge[]>();
  /** global topological order (ids) */
  private readonly topo: string[];
  private readonly topoIndex = new Map<string, number>();

  constructor(areas: Area[], topics: Topic[], routes: Route[]) {
    this.areas = areas;
    this.topics = topics;
    this.routes = routes;
    const problems: string[] = [];

    for (const a of areas) this.areaById.set(a.id, a);
    for (const t of topics) {
      if (this.byId.has(t.id)) problems.push(`duplicate topic id "${t.id}" (areas ${this.byId.get(t.id)!.area} and ${t.area})`);
      this.byId.set(t.id, t);
      this.outE.set(t.id, []);
      this.inE.set(t.id, []);
    }

    const edges: Edge[] = [];
    const ref = (from: Topic, id: string, field: string) => {
      if (!this.byId.has(id)) problems.push(`${from.area}/${from.id}: ${field} → unknown topic "${id}"`);
      else if (id === from.id) problems.push(`${from.area}/${from.id}: ${field} → itself`);
      else return true;
      return false;
    };
    for (const t of topics) {
      for (const p of t.prerequisites) if (ref(t, p, 'prerequisites')) edges.push({ from: p, to: t.id, kind: 'prerequisite' });
      for (const r of t.related) ref(t, r, 'related');
      for (const a of t.applications) {
        if (!ref(t, a.to, 'applications')) continue;
        if (this.byId.get(a.to)!.areaKind !== 'computing')
          problems.push(`${t.area}/${t.id}: application → "${a.to}" is not in a computing area (use prerequisites)`);
        edges.push({ from: t.id, to: a.to, kind: 'application', strength: a.strength, type: a.type, note: a.note });
      }
      if (t.demo && !(DEMOS as readonly string[]).includes(t.demo)) problems.push(`${t.area}/${t.id}: unknown demo "${t.demo}"`);
    }
    const seen = new Set<string>();
    for (const e of edges) {
      const k = `${e.from}>${e.to}`;
      if (seen.has(k)) problems.push(`duplicate edge ${e.from} → ${e.to} (both a prerequisite and an application?)`);
      seen.add(k);
      this.outE.get(e.from)!.push(e);
      this.inE.get(e.to)!.push(e);
    }
    this.edges = edges;

    for (const r of routes)
      for (const s of r.steps) if (!this.byId.has(s)) problems.push(`route ${r.id}: unknown step "${s}"`);

    if (problems.length) throw new Error(`Content graph has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);

    this.topo = this.toposort();
    this.topo.forEach((id, i) => this.topoIndex.set(id, i));
    setTitleResolver((id, lang) => this.byId.get(id)?.title[lang]);
  }

  /** Kahn's algorithm with a stable tie-break; throws with the cycle if there is one. */
  private toposort(): string[] {
    const indeg = new Map<string, number>();
    for (const t of this.topics) indeg.set(t.id, this.inE.get(t.id)!.length);
    const ready = this.topics.filter((t) => indeg.get(t.id) === 0);
    const out: string[] = [];
    while (ready.length) {
      ready.sort((a, b) => this.compare(a, b));
      const t = ready.shift()!;
      out.push(t.id);
      for (const e of this.outE.get(t.id)!) {
        const d = indeg.get(e.to)! - 1;
        indeg.set(e.to, d);
        if (d === 0) ready.push(this.byId.get(e.to)!);
      }
    }
    if (out.length !== this.topics.length) throw new Error(`Content graph has a cycle: ${this.findCycle().join(' → ')}`);
    return out;
  }

  private findCycle(): string[] {
    const state = new Map<string, 0 | 1 | 2>();
    const stack: string[] = [];
    const visit = (id: string): string[] | null => {
      state.set(id, 1);
      stack.push(id);
      for (const e of this.outE.get(id)!) {
        const s = state.get(e.to) ?? 0;
        if (s === 1) return [...stack.slice(stack.indexOf(e.to)), e.to];
        if (s === 0) {
          const c = visit(e.to);
          if (c) return c;
        }
      }
      stack.pop();
      state.set(id, 2);
      return null;
    };
    for (const t of this.topics) if (!state.get(t.id)) {
      const c = visit(t.id);
      if (c) return c;
    }
    return [];
  }

  /** Study order: math before computing, then level, then area order, then position in the area. */
  private compare(a: Topic, b: Topic): number {
    const ak = a.areaKind === 'math' ? 0 : 1;
    const bk = b.areaKind === 'math' ? 0 : 1;
    return (
      ak - bk ||
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      this.areaById.get(a.area)!.order - this.areaById.get(b.area)!.order ||
      a.index - b.index
    );
  }

  topic(id: string): Topic {
    const t = this.byId.get(id);
    if (!t) throw new Error(`unknown topic "${id}"`);
    return t;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  area(id: string): Area {
    const a = this.areaById.get(id);
    if (!a) throw new Error(`unknown area "${id}"`);
    return a;
  }

  topicsOf(areaId: string): Topic[] {
    return this.area(areaId).topics.map((id) => this.topic(id));
  }

  url(lang: Lang, id: string): string {
    return href(lang, `topic/${id}/`);
  }

  outgoing(id: string): Edge[] {
    return this.outE.get(id) ?? [];
  }

  incoming(id: string): Edge[] {
    return this.inE.get(id) ?? [];
  }

  /** Direct prerequisites, in study order. */
  prerequisites(id: string): Topic[] {
    return this.topic(id).prerequisites.map((p) => this.topic(p)).sort((a, b) => this.order(a.id) - this.order(b.id));
  }

  /** Topics that list this one as a prerequisite. */
  dependents(id: string): Topic[] {
    return this.outgoing(id)
      .filter((e) => e.kind === 'prerequisite')
      .map((e) => this.topic(e.to))
      .sort((a, b) => this.order(a.id) - this.order(b.id));
  }

  /** Direct application edges out of a topic, strongest first. */
  applications(id: string): Edge[] {
    return this.outgoing(id)
      .filter((e) => e.kind === 'application')
      .sort((a, b) => b.strength! - a.strength! || TYPE_RANK[a.type!] - TYPE_RANK[b.type!]);
  }

  /** For a computing topic: the mathematical topics that declare an application edge into it. */
  mathSources(id: string): Edge[] {
    return this.incoming(id)
      .filter((e) => e.kind === 'application')
      .sort((a, b) => b.strength! - a.strength! || this.order(a.from) - this.order(b.from));
  }

  order(id: string): number {
    return this.topoIndex.get(id)!;
  }

  /** Every topic that leads to `id`, in an order in which they can be studied (excluding `id`). */
  upstream(id: string): Topic[] {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      for (const e of this.incoming(stack.pop()!)) if (!seen.has(e.from)) {
        seen.add(e.from);
        stack.push(e.from);
      }
    }
    return [...seen].sort((a, b) => this.order(a) - this.order(b)).map((x) => this.topic(x));
  }

  /** Every topic reachable from `id` (excluding it). */
  downstream(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      for (const e of this.outgoing(stack.pop()!)) if (!seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
    }
    return seen;
  }

  /**
   * Computing topics reachable from `id`, each with its best path: the one whose weakest application edge is
   * strongest, and among those the shortest. Prerequisite edges do not weaken a path.
   */
  reach(id: string, maxHops = 5): Reach[] {
    type Best = { s: number; type: ConnectionType; len: number; prev: string | null };
    const best = new Map<string, Best>([[id, { s: 6, type: 'fundamental', len: 0, prev: null }]]);
    const order = [...this.downstream(id)].sort((a, b) => this.order(a) - this.order(b));
    for (const v of order) {
      let b: Best | undefined;
      for (const e of this.incoming(v)) {
        const p = best.get(e.from);
        if (!p || p.len >= maxHops) continue;
        const es = e.kind === 'application' ? e.strength! : 6;
        const s = Math.min(p.s, es);
        const type = es <= p.s && e.type ? e.type : p.type;
        const cand = { s, type, len: p.len + 1, prev: e.from };
        if (!b || cand.s > b.s || (cand.s === b.s && cand.len < b.len)) b = cand;
      }
      if (b) best.set(v, b);
    }
    const out: Reach[] = [];
    for (const [v, b] of best) {
      const t = this.byId.get(v)!;
      if (v === id || t.areaKind !== 'computing') continue;
      const path = [v];
      for (let p = b.prev; p; p = best.get(p)!.prev) path.unshift(p);
      out.push({ topic: t, path, strength: Math.min(b.s, 5), type: b.type });
    }
    return out.sort((a, b) => b.strength - a.strength || a.path.length - b.path.length || this.order(a.topic.id) - this.order(b.topic.id));
  }

  /** reach() grouped by computing area, areas in their order. */
  reachByArea(id: string, perArea = 6): { area: Area; items: Reach[]; more: number }[] {
    const groups = new Map<string, Reach[]>();
    for (const r of this.reach(id)) {
      const g = groups.get(r.topic.area) ?? [];
      g.push(r);
      groups.set(r.topic.area, g);
    }
    return [...groups.entries()]
      .map(([a, items]) => ({ area: this.area(a), items: items.slice(0, perArea), more: Math.max(0, items.length - perArea) }))
      .sort((x, y) => (y.items[0]!.strength - x.items[0]!.strength) || x.area.order - y.area.order);
  }

  /** Strongest direct application edge from each math area into each computing area. */
  matrix(): { math: Area[]; computing: Area[]; cell: (m: string, c: string) => Edge | undefined } {
    const cells = new Map<string, Edge>();
    for (const e of this.edges) if (e.kind === 'application') {
      const k = `${this.topic(e.from).area}>${this.topic(e.to).area}`;
      const cur = cells.get(k);
      if (!cur || e.strength! > cur.strength!) cells.set(k, e);
    }
    return {
      math: this.areas.filter((a) => a.kind === 'math'),
      computing: this.areas.filter((a) => a.kind === 'computing'),
      cell: (m, c) => cells.get(`${m}>${c}`),
    };
  }

  routesOf(id: string): Route[] {
    return this.routes.filter((r) => r.steps.includes(id));
  }

  /** "Next topic": the following step of the first route through it, else the next topic of its area, else a dependent. */
  next(id: string): Topic | undefined {
    for (const r of this.routesOf(id)) {
      const i = r.steps.indexOf(id);
      if (i >= 0 && i < r.steps.length - 1) return this.topic(r.steps[i + 1]!);
    }
    const t = this.topic(id);
    const siblings = this.area(t.area).topics;
    if (t.index < siblings.length - 1) return this.topic(siblings[t.index + 1]!);
    return this.dependents(id)[0] ?? this.applications(id).map((e) => this.topic(e.to))[0];
  }

  prev(id: string): Topic | undefined {
    const t = this.topic(id);
    return t.index > 0 ? this.topic(this.area(t.area).topics[t.index - 1]!) : undefined;
  }

  get demoTopics(): Topic[] {
    return this.topics.filter((t) => t.demo).sort((a, b) => this.order(a.id) - this.order(b.id));
  }
}

let cached: Promise<Graph> | undefined;

export function getGraph(): Promise<Graph> {
  cached ??= (async () => {
    const areaEntries = (await getCollection('areas')).sort((a, b) => a.data.order - b.data.order);
    const areas: Area[] = [];
    const topics: Topic[] = [];
    for (const { id, data } of areaEntries) {
      areas.push({
        id,
        kind: data.kind,
        order: data.order,
        glyph: data.glyph,
        title: data.title,
        summary: data.summary,
        intro: data.intro,
        topics: data.topics.map((t) => t.id),
      });
      data.topics.forEach((t, index) =>
        topics.push({ ...t, area: id, areaKind: data.kind, index, difficulty: t.difficulty ?? DEFAULT_DIFFICULTY[t.level] }),
      );
    }
    const routes = (await getCollection('routes')).map(({ id, data }) => ({ id, ...data })).sort((a, b) => a.order - b.order);
    return new Graph(areas, topics, routes);
  })();
  return cached;
}
