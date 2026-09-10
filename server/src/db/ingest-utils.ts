import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";

export const DEFAULT_CHUNK_SIZE = 1000;
export const DEFAULT_CHUNK_OVERLAP = 200;

/**
 * Loads a PDF and splits it into chunks. Shared by every ingestion pipeline so
 * hosted and local embeddings are produced from identical chunk boundaries.
 */
export async function loadPdfChunks(
  pdfPath: string,
  options: { chunkSize?: number; chunkOverlap?: number } = {},
): Promise<Document[]> {
  const loader = new PDFLoader(pdfPath, { splitPages: true });
  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
    chunkOverlap: options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
  });

  return textSplitter.splitDocuments(docs);
}

/** Flattens document metadata into the scalar types Pinecone accepts. */
export function sanitizeMetadata(
  metadata: Record<string, any>,
): Record<string, string | number | boolean | string[]> {
  const cleaned: Record<string, string | number | boolean | string[]> = {};
  for (const [key, val] of Object.entries(metadata)) {
    if (val == null) continue;
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    ) {
      cleaned[key] = val;
    } else if (
      Array.isArray(val) &&
      val.every((item) => typeof item === "string")
    ) {
      cleaned[key] = val;
    } else {
      cleaned[key] = JSON.stringify(val);
    }
  }
  return cleaned;
}
