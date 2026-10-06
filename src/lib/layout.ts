import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { Graph } from './graph';

export type SimNode = { id: string; i: number; x: number; y: number; r: number; area: string };

/**
 * Deterministic force layout of the whole graph, computed at build time: every area has an anchor (mathematics on
 * the left, computing on the right) and its topics settle around it. Shared by the map and the home page.
 */
export function forceLayout(g: Graph) {
  const math = g.areas.filter((a) => a.kind === 'math');
  const comp = g.areas.filter((a) => a.kind === 'computing');
  const anchor = new Map<string, { x: number; y: number }>();
  math.forEach((a, i) => anchor.set(a.id, { x: -1450 + (i % 4) * 400, y: -760 + Math.floor(i / 4) * 340 }));
  comp.forEach((a, i) => anchor.set(a.id, { x: 450 + (i % 3) * 380, y: -480 + Math.floor(i / 3) * 420 }));

  const degree = new Map<string, number>();
  for (const e of g.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const nodes: SimNode[] = g.topics.map((tp, i) => {
    const a = anchor.get(tp.area)!;
    const r = 4 + Math.sqrt(degree.get(tp.id) ?? 0) * 1.7 + (tp.core ? 2 : 0);
    return { id: tp.id, i, x: a.x + (rand() - 0.5) * 80, y: a.y + (rand() - 0.5) * 80, r, area: tp.area };
  });
  const index = new Map(nodes.map((n) => [n.id, n]));
  const links = g.edges.map((e) => ({
    source: index.get(e.from)!,
    target: index.get(e.to)!,
    same: g.topic(e.from).area === g.topic(e.to).area,
  }));
  forceSimulation(nodes)
    .randomSource(rand)
    .force('link', forceLink(links).distance((l) => (l.same ? 50 : 200)).strength((l) => (l.same ? 0.35 : 0.004)))
    .force('charge', forceManyBody().strength(-55).distanceMax(220))
    .force('collide', forceCollide<SimNode>((n) => n.r + 16))
    .force('x', forceX<SimNode>((n) => anchor.get(n.area)!.x).strength(0.3))
    .force('y', forceY<SimNode>((n) => anchor.get(n.area)!.y).strength(0.3))
    .stop()
    .tick(400);
  return { nodes, index, math, comp };
}
