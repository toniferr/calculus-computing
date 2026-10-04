/** Interactive visualizations available to topics via `demo: <id>` (components in src/components/demos). */
export const DEMOS = ['tangent', 'riemann', 'taylor', 'gradient-descent', 'newton', 'neuron'] as const;
export type DemoId = (typeof DEMOS)[number];
