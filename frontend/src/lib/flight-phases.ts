/**
 * Find TOC (Top of Climb) and TOD (Top of Descent) indices in a waypoint array.
 *
 * Strategy: use SimBrief's actual TOC/TOD waypoints by ident if present,
 * otherwise fall back to the 90%-of-max-altitude threshold heuristic.
 */
export function findTocTod(wps: { ident: string; altitude: number | null }[]): {
  tocIndex: number;
  todIndex: number;
} {
  if (wps.length < 2) return { tocIndex: 0, todIndex: wps.length - 1 };

  // 1. Try to find by ident (SimBrief injects TOC/TOD as actual waypoints)
  const tocByIdent = wps.findIndex((w) => /^T[\/]?O[\/]?C$/i.test(w.ident));
  const todByIdent = wps.length - 1 - [...wps].reverse().findIndex((w) => /^T[\/]?O[\/]?D$/i.test(w.ident));
  // findIndex returns -1 if not found; reverse search yields wps.length if not found
  const hasToc = tocByIdent >= 0;
  const hasTod = todByIdent < wps.length;

  if (hasToc && hasTod) return { tocIndex: tocByIdent, todIndex: todByIdent };

  // 2. Fallback: altitude threshold
  const maxAlt = Math.max(...wps.map((w) => w.altitude ?? 0));
  const threshold = maxAlt * 0.90;

  let tocFallback = 0;
  let todFallback = wps.length - 1;
  for (let i = 0; i < wps.length; i++) {
    if ((wps[i].altitude ?? 0) >= threshold) { tocFallback = i; break; }
  }
  for (let i = wps.length - 1; i >= 0; i--) {
    if ((wps[i].altitude ?? 0) >= threshold) { todFallback = i; break; }
  }

  return {
    tocIndex: hasToc ? tocByIdent : tocFallback,
    todIndex: hasTod ? todByIdent : todFallback,
  };
}

/** Check if a waypoint ident is a TOC or TOD marker. */
export function isTocTod(ident: string): boolean {
  return /^T[\/]?O[\/]?[CD]$/i.test(ident);
}
