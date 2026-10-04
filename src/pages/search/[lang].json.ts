import type { APIRoute, GetStaticPaths } from 'astro';
import { getGraph } from '../../lib/graph';
import { LANGS, other, t, type Lang } from '../../lib/i18n';
import { plain } from '../../lib/md';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const o = other(lang);
  const g = await getGraph();
  const docs = g.topics.map((tp) => {
    const neighbours = [
      ...g.incoming(tp.id).map((e) => e.from),
      ...g.outgoing(tp.id).map((e) => e.to),
      ...tp.related,
    ];
    return {
      id: tp.id,
      t: tp.title[lang],
      a: [...tp.aliases[lang], tp.title[o], ...tp.aliases[o], tp.id.replace(/-/g, ' ')].join(' · '),
      s: plain(tp.summary[lang], lang).slice(0, 220),
      ar: g.area(tp.area).title[lang],
      c: tp.areaKind,
      lv: tp.level,
      lvl: t(lang, `level.${tp.level}`),
      n: [...new Set(neighbours)],
    };
  });
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json' } });
};
