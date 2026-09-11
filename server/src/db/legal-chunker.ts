/**
 * Structure-aware chunking for legal documents.
 *
 * Legal text is authored as numbered units (articles, sections), and that is the
 * unit a question is actually about ("what does Article 21 say?"). Splitting on
 * a fixed character count instead cuts articles in half and returns fragments of
 * neighbouring provisions, so we split on the unit first and only fall back to
 * size-based splitting when a single unit is too long to embed.
 *
 * Two document quirks drive the design:
 *
 *  1. A long table of contents precedes the body, and its entries look almost
 *     identical to real provision headings ("21. Protection of life..."). We
 *     therefore locate the body once via an enacting-formula anchor and only
 *     parse provisions after it. The contents block is still useful for BNS,
 *     whose body omits inline titles, so we read titles from it.
 *
 *  2. Extracted PDF text carries page numbers, running headers, amendment
 *     footnotes, and tab-based justification. All of that is noise that dilutes
 *     the embedding, so it is stripped before chunking.
 */
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export type PdfLine = { page: number; text: string };

export type LegalChunk = {
  /** Stable, document-scoped id, e.g. `constitution-021`. */
  id: string;
  text: string;
  metadata: {
    document: string;
    documentId: string;
    /** Short label for citations and UI badges, e.g. "BNS". */
    citation: string;
    part: string;
    article: string;
    articleNumber: string;
    title: string;
    source_page: number;
    document_version: string;
    chunkIndex: number;
  };
};

export type LegalDocumentSpec = {
  id: string;
  /** Full name used as the `document` metadata value. */
  label: string;
  /** Short label used when citing, e.g. "[BNS, p.93]". */
  citation: string;
  fileName: string;
  version: string;
  /** Unit noun, used to build labels like "Article 21" / "Section 304". */
  unitNoun: string;
  /**
   * Regex matching the line that begins the body, after the contents block.
   * Must match exactly one line — it is the anchor for the whole split.
   */
  bodyStart: RegExp;
  /** Matches a provision start, capturing the number and the rest of the line. */
  unit: RegExp;
  /** Matches a part/chapter heading line, capturing it for the `part` field. */
  partHeading: RegExp;
  /** Highest plausible provision number; guards against footnote false hits. */
  maxUnitNumber: number;
  /**
   * Whether the body repeats the title inline ("21. Title.—text"). When false,
   * titles are taken from the contents block instead.
   */
  inlineTitles: boolean;
};

export const LEGAL_DOCUMENTS: LegalDocumentSpec[] = [
  {
    id: "constitution",
    label: "Constitution of India",
    citation: "Constitution",
    fileName: "constitution.pdf",
    version: "2024",
    unitNoun: "Article",
    bodyStart: /WE,\s+THE\s+PEOPLE\s+OF\s+INDIA/i,
    unit: /^\s*(\d{1,3}[A-Z]?)\.\s+(\S.*)$/,
    partHeading: /^\s*PART\s+([IVXLC]+)\b(.*)$/,
    maxUnitNumber: 400,
    inlineTitles: true,
  },
  {
    id: "bns",
    label: "Bharatiya Nyaya Sanhita, 2023",
    citation: "BNS",
    fileName: "BNS.pdf",
    version: "2023",
    unitNoun: "Section",
    // The BNS PDF is a bill: the enacting formula is "B E it enacted by Parliament".
    bodyStart: /B\s*E\s+it\s+enacted\s+by\s+Parliament/i,
    unit: /^\s*(\d{1,3}[A-Z]?)\.\s+(\S.*)$/,
    partHeading: /^\s*CHAPTER\s+([IVXLC]+)\s*$/,
    maxUnitNumber: 400,
    inlineTitles: false,
  },
];

export function findLegalDocument(id: string): LegalDocumentSpec | undefined {
  return LEGAL_DOCUMENTS.find((entry) => entry.id === id);
}

export function legalDocumentPath(spec: LegalDocumentSpec): string {
  return path.join(import.meta.dir, "..", "data", spec.fileName);
}

/** Longest unit kept intact; beyond this a unit is split for the embedder.
 *  mxbai-embed-large truncates around 512 tokens, so ~450 tokens (~1.8k chars)
 *  is a safe ceiling — longer units would be silently cut. */
export const MAX_UNIT_CHARS = Number(process.env.LOCAL_MAX_UNIT_CHARS ?? 1800);

const UNIT_OVERLAP_CHARS = 150;

/** Page numbers, running heads, and amendment footnotes carry no legal meaning. */
const NOISE_LINE_PATTERNS: RegExp[] = [
  /^\s*[\d\s]{1,8}\s*$/, // "80", "4 0"
  /^\s*(?:AS\s+INTRODUCED\s+IN\s+(?:LOK\s+SABHA|RAJYA\s+SABHA))\s*$/i,
  /^\s*Bill\s+No\.?\s*\d+\s+of\s+\d{4}\s*$/i,
  /^\s*\[\s*$/, // stray amendment brackets
  /^\s*\]\s*$/,
  // Amendment footnotes, e.g. "1. Subs. by the Constitution (Seventh
  // Amendment) Act, 1956." These must be dropped *before* provision detection:
  // a footnote numbered "1." otherwise opens a unit and, because numbers are
  // deduplicated, causes the real article 1 to be discarded.
  /^\s*\d*[.\])]*\s*\[?\s*(?:Subs|Ins|Added|Omitted|Renumbered|Repealed|Substituted|Inserted|Amendment|w\.e\.f|with\s+retrospective\s+effect)\b/i,
];

/** Legal PDFs justify text with tabs, so tabs (not single spaces) separate words. */
export function normalizeLine(line: string): string {
  return line.replace(/\t+/g, " ").replace(/\s+$/g, "");
}

export function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Reads a PDF into per-page lines, preserving the printed page number. */
export async function loadPdfLines(filePath: string): Promise<PdfLine[]> {
  const loader = new PDFLoader(filePath, { splitPages: true });
  const docs = await loader.load();
  const lines: PdfLine[] = [];

  docs.forEach((doc, index) => {
    let page = index + 1;
    const loc = (doc.metadata as Record<string, unknown> | undefined)?.loc;
    if (typeof loc === "string") {
      try {
        const parsed = JSON.parse(loc) as { pageNumber?: unknown };
        if (typeof parsed?.pageNumber === "number") page = parsed.pageNumber;
      } catch {
        /* keep the sequential fallback */
      }
    }
    for (const line of doc.pageContent.split("\n")) lines.push({ page, text: line });
  });

  return lines;
}

/**
 * Builds a provision-number -> title map from the contents block.
 *
 * Titles routinely wrap onto following lines, so a title keeps absorbing lines
 * until the next numbered entry begins.
 */
export function extractTocTitles(
  lines: PdfLine[],
  spec: LegalDocumentSpec,
): Map<string, string> {
  const titles = new Map<string, string>();
  const bodyStart = lines.findIndex((line) => spec.bodyStart.test(line.text));
  const end = bodyStart === -1 ? lines.length : bodyStart;

  let current: { number: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const title = current.parts
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\.\s*$/, "")
      .trim();
    if (title && !titles.has(current.number)) titles.set(current.number, title);
    current = null;
  };

  for (let i = 0; i < end; i++) {
    const line = lines[i];
    if (!line) continue;
    const text = normalizeLine(line.text).trim();
    if (!text || isNoiseLine(text)) continue;

    const match = spec.unit.exec(text);
    const number = match?.[1];
    if (match && number && Number(number.replace(/[A-Z]/g, "")) <= spec.maxUnitNumber) {
      flush();
      current = { number, parts: [match[2] ?? ""] };
      continue;
    }

    // Continuation of a wrapped title.
    if (current) {
      if (text.length <= 120) current.parts.push(text);
      else flush();
    }
  }
  flush();

  return titles;
}

/**
 * Splits an over-long provision into ordered pieces. The split is a fallback:
 * it only runs for units that would otherwise be truncated by the embedder.
 */
async function splitOversized(text: string): Promise<string[]> {
  if (text.length <= MAX_UNIT_CHARS) return [text];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: MAX_UNIT_CHARS,
    chunkOverlap: UNIT_OVERLAP_CHARS,
  });

  return splitter.splitText(text);
}

/**
 * Chunks one document into per-provision units with citation metadata.
 * Pure with respect to `lines`, so it can be tested from a fixture.
 */
export async function chunkLegalDocument(
  lines: PdfLine[],
  spec: LegalDocumentSpec,
): Promise<LegalChunk[]> {
  const bodyStart = lines.findIndex((line) => spec.bodyStart.test(line.text));
  if (bodyStart === -1) {
    throw new Error(
      `Could not find the body of "${spec.label}" — the anchor ${spec.bodyStart} did not match. ` +
        `The PDF format may have changed.`,
    );
  }

  const tocTitles = spec.inlineTitles
    ? new Map<string, string>()
    : extractTocTitles(lines, spec);

  const chunks: LegalChunk[] = [];
  let current: { number: string; title: string; page: number; body: string[] } | null = null;
  let currentPart = "";
  // Provision numbers are reused by amendment footnotes and cross-references
  // ("see article 21"), so each number may only open one unit.
  const seenNumbers = new Set<string>();

  const flush = async () => {
    const unit = current;
    if (!unit) return;

    const raw = unit.body
      .map((line) => normalizeLine(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (raw) {
      const pieces = await splitOversized(raw);
      // Titles frequently wrap onto the next line, so the em dash that ends the
      // title is often not on the provision's first line. Deriving it from the
      // joined text catches both shapes; extracting from the first line alone
      // leaves every wrapped title empty.
      const title =
        spec.inlineTitles && !unit.title ? extractInlineTitle(raw) : unit.title;
      const numeric = unit.number.replace(/[A-Z]/g, "");
      const suffix = unit.number.slice(numeric.length);
      const base = `${spec.id}-${numeric.padStart(3, "0")}${suffix}`;

      pieces.forEach((piece, pieceIndex) => {
        chunks.push({
          id: pieces.length > 1 ? `${base}-p${pieceIndex + 1}` : base,
          text: piece,
          metadata: {
            document: spec.label,
            documentId: spec.id,
            citation: spec.citation,
            part: currentPart,
            article: `${spec.unitNoun} ${unit.number}`,
            articleNumber: unit.number,
            title,
            source_page: unit.page,
            document_version: spec.version,
            chunkIndex: chunks.length,
          },
        });
      });
    }
    current = null;
  };

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const raw = line.text;
    if (isNoiseLine(raw)) continue;

    const text = normalizeLine(raw).trim();

    const partMatch = spec.partHeading.exec(text);
    if (partMatch && !spec.unit.test(text)) {
      await flush();
      const heading = `${spec.id === "constitution" ? "Part" : "Chapter"} ${partMatch[1] ?? ""}`.trim();
      const rest = (partMatch[2] ?? "").replace(/[.\s]+$/, "").trim();
      currentPart = rest ? `${heading} — ${rest}` : heading;
      continue;
    }

    const unitMatch = spec.unit.exec(text);
    const number = unitMatch?.[1];
    if (unitMatch && number) {
      const numeric = Number(number.replace(/[A-Z]/g, ""));
      if (numeric <= spec.maxUnitNumber && !seenNumbers.has(number)) {
        await flush();
        seenNumbers.add(number);
        // Inline titles are resolved in flush() once the whole unit text is
        // known; documents without inline titles use the contents block.
        current = {
          number,
          title: spec.inlineTitles ? "" : (tocTitles.get(number) ?? ""),
          page: line.page,
          body: [unitMatch[2] ?? ""],
        };
        continue;
      }
    }

    if (current) current.body.push(text);
  }
  await flush();

  return chunks;
}

/**
 * Pulls the title out of a provision heading, whose shape is
 * "Protection of life and personal liberty.—No person shall be…".
 *
 * Operates on the joined body text rather than one line, because long titles
 * wrap. The search is limited to the opening characters and the result length is
 * capped, so body prose that happens to contain a period-em-dash does not
 * produce a bogus title.
 */
export function extractInlineTitle(
  text: string,
  maxTitleChars = 140,
  searchChars = 320,
): string {
  const head = text.replace(/\s+/g, " ").slice(0, searchChars);
  const match = /^(.*?)\.—/.exec(head);
  if (!match) return "";

  const title = (match[1] ?? "").trim().replace(/\.$/, "");
  return title.length > 0 && title.length <= maxTitleChars ? title : "";
}
