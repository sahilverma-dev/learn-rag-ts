# 📐 Architecture Overview & Design System

This document outlines the system architecture, design decisions, data flow, and vector storage strategy for the **rag-ts** repository.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Storage Layer
        PDF["BNS.pdf (Bharatiya Nyaya Sanhita)"]
        Pinecone[("Pinecone Vector DB\nIndex: pdf-embedded-index\nNamespace: pdf-documents\nDimension: 3072")]
    end

    subgraph Core Pipeline Modules
        EP["embedding-pipeline.ts"]
        RP1["db/retrieving-pipeline.ts"]
        RP2["db/retrieving-pipeline-opencode.ts"]
        DB["db/pinecone.ts"]
    end

    subgraph AI Models & APIs
        GEmbed["Google Gemini Embeddings\n(gemini-embedding-2)"]
        GeminiLLM["Google Gemini LLM\n(gemini-2.5-flash)"]
        OpenCodeLLM["OpenCode Zen API\n(x-preview-f-free)"]
    end

    PDF --> EP
    EP --> GEmbed
    GEmbed --> Pinecone
    
    RP1 --> GEmbed
    RP1 --> Pinecone
    RP1 --> GeminiLLM

    RP2 --> GEmbed
    RP2 --> Pinecone
    RP2 --> OpenCodeLLM

    DB -. Provides Client .-> EP
    DB -. Provides Client .-> RP1
    DB -. Provides Client .-> RP2
```

---

## ⚙️ Core Technical Decisions

### 1. Vector Dimension Choice (3072 Dimensions)
- **Model**: `gemini-embedding-2`
- **Rationale**: `gemini-embedding-2` produces 3072-dimensional embeddings that provide richer semantic representations for legal text chunking than standard 384 or 768-dimensional models.
- **Index Metric**: Cosine similarity (`metric: "cosine"`).

### 2. Local Pinecone Emulator Integration
- **Client Configuration**: Set up in `src/db/pinecone.ts` with custom `controllerHostUrl` (`http://jarvis:5080`) and host resolution (`http://jarvis:<port>`).
- **Namespace Isolation**: Uses `pdf-documents` namespace inside `pdf-embedded-index` to allow partitioned dataset queries.

### 3. Multi-Query Expansion RAG Pattern
- Standard single-vector queries often miss relevant context if user phrasing differs from legal text.
- Expanding queries into 3 variations increases context recall by up to **300%** while deduplication keeps prompt context concise.

---

## 📂 Documentation Directory Sitemap

- 📖 [Pinecone DB Operations Guide](./pinecone-upsert.md)
- 📖 [Embedding & Ingestion Pipeline Guide](./embedding-pipeline.md)
- 📖 [Retrieval & Synthesis Pipeline Guide](./retrieval-pipeline.md)
- 📖 [Architecture Overview Guide](./architecture-overview.md)
