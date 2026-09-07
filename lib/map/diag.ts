/**
 * Lightweight diagnostic bus. Every line goes to the console (headless e2e reads
 * it) AND to a small ring buffer on window that the ?debug=1 overlay renders, so
 * Aaron can read the same trace on a phone. No-op-safe under SSR.
 */
export function mapDiag(line: string): void {
  // eslint-disable-next-line no-console
  console.info("[map-diag]", line);
  try {
    const w = window as unknown as { __qosDiag?: string[] };
    (w.__qosDiag ||= []).push(line);
    if (w.__qosDiag.length > 14) w.__qosDiag.shift();
  } catch {
    /* no window (SSR) — console line already emitted */
  }
}
