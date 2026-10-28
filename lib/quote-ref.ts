/**
 * Customer-facing quote reference, e.g. "IV-3BC1F0FE". Uses the stored
 * quote_number when one exists, otherwise the first 8 chars of the quote's
 * UUID — stable for the life of the quote and searchable in /admin/quotes.
 */
export function quoteRef(q: { id: string; quoteNumber?: string | null }): string {
  return q.quoteNumber ?? `IV-${q.id.slice(0, 8).toUpperCase()}`;
}

/** Turns "IV-3BC1F0FE" / "3bc1f0fe" into a lowercase UUID prefix, or null. */
export function refToIdPrefix(input: string): string | null {
  const m = input.trim().match(/^(?:IV-|FP-)?([0-9a-f]{8})$/i);
  return m ? m[1].toLowerCase() : null;
}
