import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { OLLAMA_EMBEDDING_MODEL, embedWithOllama } from "./ollama";

export interface OllamaEmbeddingsParams extends EmbeddingsParams {
  model?: string;
  /** How many texts are sent to /api/embed per request. */
  batchSize?: number;
}

/**
 * LangChain `Embeddings` implementation backed by a local Ollama server, so it
 * can be handed to `PineconeStore` exactly like the hosted providers.
 */
export class OllamaEmbeddings extends Embeddings {
  readonly model: string;
  readonly batchSize: number;

  constructor(params: OllamaEmbeddingsParams = {}) {
    super(params);
    this.model = params.model ?? OLLAMA_EMBEDDING_MODEL;
    this.batchSize = params.batchSize ?? 32;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const vectors: number[][] = [];

    for (let i = 0; i < documents.length; i += this.batchSize) {
      const batch = documents.slice(i, i + this.batchSize);
      vectors.push(...(await embedWithOllama(batch, { model: this.model })));
    }

    return vectors;
  }

  async embedQuery(document: string): Promise<number[]> {
    const [vector] = await embedWithOllama(document, { model: this.model });
    if (!vector?.length) {
      throw new Error(
        `Ollama returned no embedding for model "${this.model}". Query embedding failed.`,
      );
    }
    return vector;
  }
}
