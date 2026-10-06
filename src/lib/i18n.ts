export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = { en: string; es: string };

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Site-relative URL for a page in a language: href('es', 'topic/derivative/') → /calculus-computing/es/topic/derivative/ */
export function href(lang: Lang, path = ''): string {
  return BASE + (lang === 'en' ? '' : `${lang}/`) + path.replace(/^\//, '');
}

/** Path of the current page without base and language prefix, used for the language switch. */
export function stripLang(pathname: string): string {
  let p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
  for (const l of LANGS) if (l !== 'en' && (p === l || p.startsWith(`${l}/`))) p = p.slice(l.length + 1);
  return p;
}

export function asset(path: string): string {
  return BASE + path.replace(/^\//, '');
}

export function other(lang: Lang): Lang {
  return lang === 'en' ? 'es' : 'en';
}

const ui = {
  siteName: { en: 'Calculus × Computing', es: 'Calculus × Computing' },
  tagline: {
    en: 'A navigable map of how calculus becomes technology',
    es: 'Un mapa navegable de cómo el cálculo se convierte en tecnología',
  },
  description: {
    en: 'An interactive knowledge map of university calculus — from limits to vector calculus, ODEs and Fourier — and where each idea shows up in AI, graphics, simulation, robotics and scientific computing.',
    es: 'Un mapa de conocimiento interactivo del cálculo universitario —de los límites al cálculo vectorial, las EDO y Fourier— y de dónde aparece cada idea en IA, gráficos, simulación, robótica y computación científica.',
  },
  'nav.overview': { en: 'Overview', es: 'Panorama' },
  'nav.map': { en: 'Map', es: 'Mapa' },
  'nav.syllabus': { en: 'Syllabus', es: 'Temario' },
  'nav.routes': { en: 'Routes', es: 'Rutas' },
  'nav.lab': { en: 'Lab', es: 'Laboratorio' },
  'nav.exercises': { en: 'Exercises', es: 'Ejercicios' },
  'nav.method': { en: 'Method', es: 'Método' },
  'nav.search': { en: 'Search', es: 'Buscar' },
  'nav.menu': { en: 'Menu', es: 'Menú' },
  'theme.toggle': { en: 'Toggle light/dark theme', es: 'Cambiar tema claro/oscuro' },
  'lang.switch': { en: 'Leer en español', es: 'Read in English' },
  'lang.short': { en: 'ES', es: 'EN' },
  skip: { en: 'Skip to content', es: 'Saltar al contenido' },

  'level.fundamental': { en: 'Fundamental', es: 'Fundamental' },
  'level.university': { en: 'University', es: 'Universitario' },
  'level.advanced': { en: 'Advanced', es: 'Avanzado' },
  'level.specialized': { en: 'Specialization', es: 'Especialización' },
  'level.label': { en: 'Level', es: 'Nivel' },
  'difficulty.label': { en: 'Difficulty', es: 'Dificultad' },

  'kind.concept': { en: 'Concept', es: 'Concepto' },
  'kind.theorem': { en: 'Theorem', es: 'Teorema' },
  'kind.method': { en: 'Method', es: 'Método' },
  'kind.application': { en: 'Application', es: 'Aplicación' },

  'conn.fundamental': { en: 'fundamental', es: 'fundamental' },
  'conn.frequent': { en: 'frequent', es: 'frecuente' },
  'conn.advanced': { en: 'advanced', es: 'avanzada' },
  'conn.indirect': { en: 'indirect', es: 'indirecta' },
  'conn.historical': { en: 'historical', es: 'histórica' },

  'ex.computation': { en: 'Computation', es: 'Cálculo directo' },
  'ex.proof': { en: 'Proof', es: 'Demostración' },
  'ex.graphical': { en: 'Graphical', es: 'Interpretación gráfica' },
  'ex.applied': { en: 'Applied', es: 'Problema aplicado' },
  'ex.computing': { en: 'Computing', es: 'Informática' },
  'ex.ai': { en: 'AI', es: 'IA' },
  'ex.hint': { en: 'Hint', es: 'Pista' },
  'ex.solution': { en: 'Solution', es: 'Solución' },

  'area.math': { en: 'Mathematics', es: 'Matemáticas' },
  'area.computing': { en: 'Computing', es: 'Computación' },

  // Topic page sections (the fixed structure of section 30)
  'sec.prereqs': { en: 'Prerequisites', es: 'Prerrequisitos' },
  'sec.noPrereqs': { en: 'None — a good place to start.', es: 'Ninguno: buen punto de partida.' },
  'sec.fullPath': { en: 'Full path to this topic', es: 'Ruta completa hasta este concepto' },
  'sec.fullPathHint': {
    en: 'Every topic this one builds on, in an order you can study them:',
    es: 'Todos los conceptos en los que se apoya este, en un orden en que se pueden estudiar:',
  },
  'sec.what': { en: 'What is it?', es: '¿Qué es?' },
  'sec.why': { en: 'Why does it exist?', es: '¿Por qué existe?' },
  'sec.intuition': { en: 'Intuition', es: 'Intuición' },
  'sec.formal': { en: 'Formal definition', es: 'Definición formal' },
  'sec.statement': { en: 'Statement', es: 'Enunciado' },
  'sec.proofIdea': { en: 'Idea of the proof', es: 'Idea de la demostración' },
  'sec.proof': { en: 'Proof', es: 'Demostración' },
  'sec.formulas': { en: 'Formulas', es: 'Fórmulas' },
  'sec.compute': { en: 'How is it computed?', es: '¿Cómo se calcula?' },
  'sec.example': { en: 'Example', es: 'Ejemplo' },
  'sec.demo': { en: 'Interactive visualization', es: 'Visualización interactiva' },
  'sec.matters': { en: 'Why does it matter?', es: '¿Por qué importa?' },
  'sec.inComputing': { en: 'Where it shows up in computing', es: 'Aplicaciones en informática' },
  'sec.inAI': { en: 'Where it shows up in AI', es: 'Dónde aparece en IA' },
  'sec.usedBy': { en: 'Where is it used?', es: '¿Dónde se utiliza?' },
  'sec.usedByHint': {
    en: 'Computing topics reachable from here, through the chain of ideas that leads to them:',
    es: 'Temas de informática a los que se llega desde aquí, con la cadena de ideas que lleva a ellos:',
  },
  'sec.dependents': { en: 'What depends on it', es: 'Qué depende de él' },
  'sec.mathSources': { en: 'The mathematics behind it', es: 'Las matemáticas que hay detrás' },
  'sec.related': { en: 'Related topics', es: 'Conceptos relacionados' },
  'sec.exercises': { en: 'Exercises', es: 'Ejercicios' },
  'sec.next': { en: 'Next topic', es: 'Siguiente concepto' },
  'sec.links': { en: 'Further reading', es: 'Para seguir' },
  'sec.inRoutes': { en: 'In the routes', es: 'En las rutas' },
  'sec.pending': {
    en: 'This page has the essentials. A fuller treatment (intuition, formal definition, worked example) is on the way.',
    es: 'Esta página tiene lo esencial. Un desarrollo más completo (intuición, definición formal, ejemplo resuelto) está en camino.',
  },
  'sec.onThisPage': { en: 'On this page', es: 'En esta página' },
  'sec.openInMap': { en: 'Open in the map', es: 'Ver en el mapa' },
  'sec.via': { en: 'via', es: 'vía' },
  'sec.direct': { en: 'direct', es: 'directa' },
  'sec.none': { en: 'Nothing yet.', es: 'Nada todavía.' },

  // Area page
  'area.topics': { en: 'Topics', es: 'Conceptos' },
  'area.feeds': { en: 'Where this area leads in computing', es: 'A dónde lleva esta área en informática' },
  'area.fedBy': { en: 'The mathematics this domain runs on', es: 'Las matemáticas sobre las que funciona este dominio' },
  'area.strength': { en: 'strongest link', es: 'conexión más fuerte' },

  // Syllabus
  'syl.title': { en: 'The complete syllabus', es: 'El temario completo' },
  'syl.lead': {
    en: 'Every topic in the portal, area by area: the calculus syllabus first, then the computing domains it feeds.',
    es: 'Todos los conceptos del portal, área por área: primero el temario de cálculo y después los dominios de la informática que alimenta.',
  },
  'syl.mathBlock': { en: 'Calculus and its neighbours', es: 'El cálculo y sus vecinos' },
  'syl.compBlock': { en: 'Computing domains', es: 'Dominios de la informática' },
  'syl.count': { en: 'topics', es: 'conceptos' },
  'syl.filter': { en: 'Filter by level', es: 'Filtrar por nivel' },
  'syl.all': { en: 'All', es: 'Todos' },

  // Map
  'map.title': { en: 'Knowledge map', es: 'Mapa de conocimiento' },
  'map.lead': {
    en: 'Every topic is a node; arrows go from an idea to what builds on it. Mathematics sits on the left, computing on the right. Drag to pan, scroll or pinch to zoom, click a node to explore.',
    es: 'Cada concepto es un nodo; las flechas van de una idea a lo que se construye sobre ella. Las matemáticas a la izquierda, la informática a la derecha. Arrastra para moverte, rueda o pellizca para hacer zoom, pulsa un nodo para explorarlo.',
  },
  'map.core': { en: 'Core only', es: 'Solo el núcleo' },
  'map.all': { en: 'Everything', es: 'Todo' },
  'map.upstream': { en: 'Where does it come from?', es: '¿De dónde sale?' },
  'map.downstream': { en: 'Where is it used?', es: '¿Dónde se usa?' },
  'map.clear': { en: 'Clear', es: 'Limpiar' },
  'map.open': { en: 'Open page', es: 'Abrir página' },
  'map.find': { en: 'Find a topic…', es: 'Buscar un concepto…' },
  'map.reset': { en: 'Reset view', es: 'Recentrar' },
  'map.legend.prereq': { en: 'builds on', es: 'se apoya en' },
  'map.legend.app': { en: 'applied in (thicker = stronger)', es: 'se aplica en (más grueso = más fuerte)' },
  'map.legend.weak': { en: 'indirect or historical', es: 'indirecta o histórica' },
  'map.noscript': {
    en: 'The interactive map needs JavaScript. The syllabus lists the same topics.',
    es: 'El mapa interactivo necesita JavaScript. El temario lista los mismos conceptos.',
  },
  'map.levels': { en: 'Levels', es: 'Niveles' },

  // Routes
  'routes.title': { en: 'Learning routes', es: 'Rutas de aprendizaje' },
  'routes.lead': {
    en: 'Curated paths through the map. Tick off topics as you go; progress is saved in this browser only.',
    es: 'Recorridos seleccionados por el mapa. Marca los conceptos a medida que avanzas; el progreso se guarda solo en este navegador.',
  },
  'routes.steps': { en: 'steps', es: 'pasos' },
  'routes.done': { en: 'done', es: 'hecho' },
  'routes.start': { en: 'Start the route', es: 'Empezar la ruta' },
  'routes.reset': { en: 'Reset progress', es: 'Reiniciar progreso' },
  'routes.step': { en: 'Step', es: 'Paso' },
  'routes.mark': { en: 'Mark as studied', es: 'Marcar como estudiado' },

  // Exercises
  'exs.title': { en: 'Exercises', es: 'Ejercicios' },
  'exs.lead': {
    en: 'Every exercise in the portal, with hints and worked solutions. Filter by type or level.',
    es: 'Todos los ejercicios del portal, con pistas y soluciones resueltas. Filtra por tipo o por nivel.',
  },
  'exs.type': { en: 'Type', es: 'Tipo' },
  'exs.from': { en: 'From', es: 'De' },

  // Lab
  'lab.title': { en: 'Lab', es: 'Laboratorio' },
  'lab.lead': {
    en: 'All the interactive visualizations in one place. Each one also lives on the page of its topic.',
    es: 'Todas las visualizaciones interactivas en un sitio. Cada una vive también en la página de su concepto.',
  },
  'lab.open': { en: 'Open the topic', es: 'Abrir el concepto' },

  // Method
  'method.title': { en: 'Method', es: 'Método' },

  // Search
  'search.placeholder': { en: 'Search topics, applications, notation…', es: 'Busca conceptos, aplicaciones, notación…' },
  'search.empty': { en: 'No matches.', es: 'Sin resultados.' },
  'search.related': { en: 'Connected to the top result', es: 'Conectado con el primer resultado' },
  'search.hint': { en: 'to navigate', es: 'para navegar' },
  'search.close': { en: 'Close', es: 'Cerrar' },

  // Home
  'home.explore': { en: 'Explore the map', es: 'Explorar el mapa' },
  'home.syllabus': { en: 'Browse the syllabus', es: 'Ver el temario' },
  'home.bigmap': { en: 'From mathematics to computing', es: 'De las matemáticas a la computación' },
  'home.thesis': { en: 'The thesis of this portal', es: 'La tesis de este portal' },
  'home.routes': { en: 'Pick a route', es: 'Elige una ruta' },
  'home.demos': { en: 'Try it', es: 'Pruébalo' },
  'home.areas': { en: 'All areas', es: 'Todas las áreas' },
  'home.stats.topics': { en: 'topics', es: 'conceptos' },
  'home.stats.links': { en: 'connections', es: 'conexiones' },
  'home.stats.areas': { en: 'areas', es: 'áreas' },
  'home.stats.demos': { en: 'interactive figures', es: 'figuras interactivas' },
  'overview.description': {
    en: 'An overview of Calculus × Computing: the big map, the thesis, two questions, routes, interactive figures and every area.',
    es: 'Un panorama de Calculus × Computing: el gran mapa, la tesis, dos preguntas, rutas, figuras interactivas y todas las áreas.',
  },

  // Home: the title screen (one curve, four ideas of calculus at work on it)
  'splash.eyebrow': { en: 'An interactive knowledge map', es: 'Un mapa de conocimiento interactivo' },
  'splash.lead': {
    en: 'All of university calculus and where every idea lands in AI, graphics, simulation, robotics and scientific computing. Behind this text, four of those ideas at work on a single curve: the slope, the area, the approximation and the way downhill.',
    es: 'Todo el cálculo universitario y dónde aterriza cada idea en IA, gráficos, simulación, robótica y computación científica. Detrás de este texto, cuatro de esas ideas trabajando sobre una sola curva: la pendiente, el área, la aproximación y el camino cuesta abajo.',
  },
  'splash.start': { en: 'Start with the overview', es: 'Empezar por el panorama' },
  'splash.hint': {
    en: 'Move the pointer over the curve to steer each idea; in gradient descent, click to drop a ball.',
    es: 'Mueve el puntero sobre la curva para guiar cada idea; en el descenso de gradiente, haz clic para soltar una bola.',
  },
  'splash.label': {
    en: 'A curve on which four ideas play in turn: a tangent line slides along it (the derivative), rectangles under it grow thinner until they fill the area (the integral), polynomials of rising degree hug it around a point (Taylor series), and balls hop downhill to its valleys (gradient descent).',
    es: 'Una curva sobre la que se suceden cuatro ideas: una recta tangente la recorre (la derivada), unos rectángulos bajo ella se afinan hasta llenar el área (la integral), polinomios de grado creciente se pegan a ella alrededor de un punto (serie de Taylor) y unas bolas bajan a saltos hasta sus valles (descenso de gradiente).',
  },
  'splash.act.derivative': { en: 'Derivative', es: 'Derivada' },
  'splash.act.integral': { en: 'Integral', es: 'Integral' },
  'splash.act.taylor': { en: 'Taylor series', es: 'Serie de Taylor' },
  'splash.act.descent': { en: 'Gradient descent', es: 'Descenso de gradiente' },
  'splash.text.derivative': {
    en: 'the slope of the tangent, the limit of ever-shorter secants. Computers take millions of them a second.',
    es: 'la pendiente de la tangente, el límite de secantes cada vez más cortas. Los ordenadores calculan millones por segundo.',
  },
  'splash.text.integral': {
    en: 'add up thinner and thinner rectangles and the sum closes in on the exact area. Most integrals in computing are never solved, only approximated like this.',
    es: 'suma rectángulos cada vez más finos y la suma se acerca al área exacta. Casi todas las integrales de la computación no se resuelven: se aproximan así.',
  },
  'splash.text.taylor': {
    en: 'near a point, a polynomial built from the derivatives there hugs the curve, and each extra degree hugs it further out. The idea behind how a machine that only adds and multiplies computes sin x.',
    es: 'cerca de un punto, un polinomio hecho con las derivadas en ese punto se pega a la curva, y cada grado más se pega más lejos. La idea con la que una máquina que solo suma y multiplica calcula sen x.',
  },
  'splash.text.descent': {
    en: 'step against the slope, x ← x − η f′(x), until the ground is flat. Where you start decides which valley you end in.',
    es: 'da pasos contra la pendiente, x ← x − η f′(x), hasta que el suelo es plano. Dónde empiezas decide en qué valle acabas.',
  },
  'splash.uses': { en: 'Used in', es: 'Se usa en' },
  'splash.degree': { en: 'degree', es: 'grado' },
  'splash.step': { en: 'step', es: 'paso' },
  'splash.local': { en: 'local minimum', es: 'mínimo local' },
  'splash.global': { en: 'global minimum', es: 'mínimo global' },
  'splash.next': { en: 'Next idea', es: 'Siguiente idea' },
  'splash.pause': { en: 'Pause', es: 'Pausa' },
  'splash.play': { en: 'Play', es: 'Seguir' },

  'footer.siblings': { en: 'Sister sites', es: 'Webs hermanas' },
  'footer.source': { en: 'Source code', es: 'Código fuente' },
  'footer.note': {
    en: 'Static site: no cookies, no analytics, no tracking.',
    es: 'Sitio estático: sin cookies, sin analítica, sin rastreo.',
  },

  '404.title': { en: 'Page not found', es: 'Página no encontrada' },
  '404.lead': {
    en: 'This limit does not exist. Try the map or the search.',
    es: 'Este límite no existe. Prueba con el mapa o con el buscador.',
  },
} satisfies Record<string, Localized>;

export type UIKey = keyof typeof ui;

export function t(lang: Lang, key: UIKey): string {
  return ui[key][lang];
}

/** Pick the language from a localized field. */
export function l(lang: Lang, value: Localized): string;
export function l(lang: Lang, value: Localized | undefined): string | undefined;
export function l(lang: Lang, value: Localized | undefined): string | undefined {
  return value?.[lang];
}
