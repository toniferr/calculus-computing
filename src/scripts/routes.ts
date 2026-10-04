// Route progress lives in this browser only (localStorage), as a per-viewer convenience.
const key = (route: string) => `cc-route-${route}`;

export function readProgress(route: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(route));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function writeProgress(route: string, done: Set<string>): void {
  try {
    localStorage.setItem(key(route), JSON.stringify([...done]));
  } catch {
    /* storage unavailable: progress lasts for this page view only */
  }
}
