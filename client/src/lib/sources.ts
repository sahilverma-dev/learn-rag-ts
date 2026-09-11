/** Reads display fields from chunk metadata across both ingestion schemes. */

/**
 * Structure-aware local ingestion writes `source_page`; the older page-chunk
 * scheme wrote `page`; and the hosted Gemini index stores a JSON blob under
 * `loc`. All three are supported because one panel serves every route.
 */
export function sourcePage(
  metadata: Record<string, unknown> | undefined,
): number | null {
  const direct = metadata?.source_page ?? metadata?.page;
  if (typeof direct === "number" && direct > 0) return direct;

  const loc = metadata?.loc;
  if (typeof loc === "string") {
    try {
      const parsed = JSON.parse(loc) as { pageNumber?: unknown };
      if (typeof parsed?.pageNumber === "number") return parsed.pageNumber;
    } catch {
      /* metadata that is not the JSON we expect */
    }
  }
  return null;
}

/** Short document label for the source badge, e.g. "BNS". */
export function sourceLabel(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const citation = metadata?.citation;
  if (typeof citation === "string" && citation) return citation;
  return null;
}

/** Provision reference, e.g. "Article 21" or "Section 304". */
export function sourceArticle(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const article = metadata?.article;
  if (typeof article === "string" && article) return article;
  return null;
}

/** Provision title, e.g. "Protection of life and personal liberty". */
export function sourceTitle(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const title = metadata?.title;
  if (typeof title === "string" && title) return title;
  return null;
}
