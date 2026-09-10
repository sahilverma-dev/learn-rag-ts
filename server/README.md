# 🚀 RAG TypeScript (rag-ts)

A high-performance, TypeScript-based Retrieval-Augmented Generation (RAG) system built with **Bun**, **LangChain**, **Google Gemini AI**, and **Pinecone Vector Database**.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    subgraph Ingestion["1. Document Embedding Pipeline"]
        PDF["📄 PDF Document (BNS.pdf)"] --> Loader["PDFLoader (LangChain)"]
        Loader --> Splitter["RecursiveCharacterTextSplitter"]
        Splitter --> Embedder["GoogleGenerativeAIEmbeddings (gemini-embedding-2)"]
        Embedder --> Sanitizer["Metadata Sanitizer & Batching"]
        Sanitizer --> PineconeIndex[("Pinecone Vector DB (3072 Dim)")]
    end

    subgraph Retrieval["2. Multi-Query Retrieval & Synthesis Pipeline"]
        UserQuery["❓ User Question"] --> QueryRewriter["Query Rewriter (LLM)"]
        QueryRewriter --> Q1["Query Variation 1"]
        QueryRewriter --> Q2["Query Variation 2"]
        QueryRewriter --> Q3["Query Variation 3"]
        
        Q1 --> PineconeSearch["Pinecone Vector Search"]
        Q2 --> PineconeSearch
        Q3 --> PineconeSearch
        
        PineconeSearch --> ContextDedupe["Context Aggregation & Deduplication"]
        ContextDedupe --> SynthesisLLM["LLM Answer Synthesis (Gemini / OpenCode Zen)"]
        SynthesisLLM --> FinalAnswer["💡 Final Grounded Response"]
    end
```

---

## 📦 Technology Stack

- **Runtime & Package Manager**: [Bun](https://bun.com) (`v1.3+`)
- **Language**: TypeScript (`v5+`)
- **Orchestration**: [LangChain](https://js.langchain.com/) (`@langchain/core`, `@langchain/google-genai`, `@langchain/pinecone`)
- **Embeddings Model**: Google Gemini (`gemini-embedding-2` – 3072 dimensions)
- **Generative LLM Models**:
  - `gemini-2.5-flash` via `@langchain/google-genai`
  - `x-preview-f-free` via OpenCode Zen API (`https://opencode.ai/zen/v1/chat/completions`)
- **Vector Database**: [Pinecone](https://www.pinecone.io/) (SDK `v8+`)
- **CLI & Utilities**: `cli-progress`, `zod`, `@langchain/community`

---

## 📂 Project Structure

```text
server/
├── src/
│   ├── data/
│   │   └── BNS.pdf                  # Knowledge base source PDF document
│   ├── db/
│   │   ├── pinecone.ts              # Pinecone client initialization
│   │   ├── retrieving-pipeline.ts   # Main RAG Pipeline (Google Gemini LLM)
│   │   └── retrieving-pipeline-opencode.ts # Alternative RAG Pipeline (OpenCode Zen API)
│   ├── embedding-pipeline.ts        # PDF Chunking, Embedding & Progress-bar Upsert
│   └── learn-pinecone.ts            # Pinecone CRUD cheat sheet & verification script
├── docs/
│   └── pinecone-upsert.md           # Comprehensive Pinecone SDK v8 operations guide
├── .env                             # Environment configuration (API Keys)
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

---

## ⚡ Quick Start

### 1. Prerequisites & Environment Setup

Ensure you have **Bun** installed on your system.

Create a `.env` file in the root directory:

```env
GOOGLE_API_KEY=your_google_gemini_api_key_here
PINECONE_DB_API_KEY=your_pinecone_api_key_here

# Optional — local Ollama models on your network
OLLAMA_BASE_URL=http://jarvis:11434
OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
OLLAMA_LLM_MODEL=deepseek-r1:1.5b
LOCAL_INDEX_NAME=pdf-embedded-index-local
LOCAL_NAMESPACE=pdf-documents-local
```

### 2. Install Dependencies

```bash
bun install
```

---

## 🛠️ Usage

### A. Run Document Embedding Pipeline

Splits `BNS.pdf`, generates 3072-dimensional Gemini embeddings, and upserts them into Pinecone with a CLI progress bar:

```bash
bun src/embedding-pipeline.ts
```

**Key Features:**
- **Automatic Index Management**: Creates or recreates `pdf-embedded-index` if dimension mismatches occur.
- **Pinecone SDK v8 Compliance**: Uses `{ records }` structured payloads.
- **Metadata Sanitization**: Automatically flattens and converts nested document metadata into Pinecone-compliant types.
- **Rate-Limit Resilience**: Includes exponential backoff retries and fallback to `embedQuery()` for 100% chunk coverage.

---

### B. Run Retrieval & Response Pipeline (Gemini 2.5 Flash)

Executes multi-query transformation, retrieves relevant context chunks from Pinecone, and synthesizes answers using Google Gemini:

```bash
bun src/db/retrieving-pipeline.ts
```

---

### C. Run Alternative Retrieval Pipeline (OpenCode Zen API)

Executes multi-query retrieval and synthesizes answers using the OpenCode Zen API endpoint (`x-preview-f-free` model):

```bash
bun src/db/retrieving-pipeline-opencode.ts
```

---

### D. Verify Vector Index & Stored Records

Run index statistics and fetch sample document records:

```bash
bun -e 'import { pc } from "./src/db/pinecone"; const idx = pc.index({ name: "pdf-embedded-index", host: "http://jarvis:5080" }); console.log(await idx.describeIndexStats());'
```

---

## 🔌 HTTP API

The server exposes two SSE streaming RAG endpoints:

| Route | Models | Notes |
|---|---|---|
| `GET /chat` | Google Gemini / OpenCode Zen | Hosted providers, index `pdf-embedded-index` (3072-dim) |
| `GET /local/chat` | Local Ollama | Local network models, independent index (auto-sized) |

Both stream the same SSE events: `status`, `sources`, `token`, `done`, `error`.
`/local/chat` additionally emits `thinking` events, so the reasoning output of
models like `deepseek-r1` never leaks into the answer.

```bash
curl -N "http://localhost:8000/local/chat?question=What%20is%20theft%3F"
curl -s "http://localhost:8000/local/health"
```

`GET /local/health` reports whether the Ollama host is reachable, which models
are available, and whether the local vector index has been populated.

---

## 🖥️ Local Models (Ollama)

Runs the whole retrieval + generation path on models served from your own
network, with no hosted API keys involved.

### 1. Prepare Ollama

Ollama must accept connections from other machines on the LAN:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
ollama pull BAAI/bge-small-en-v1.5
ollama pull deepseek-r1:1.5b
```

Verify from the machine running this server:

```bash
curl http://jarvis:11434/api/tags
```

### 2. Embed the knowledge base locally

Embeds `data/BNS.pdf` with the Ollama embedding model into
`LOCAL_INDEX_NAME`. The index dimension is probed from the model itself and the
index is created (or recreated) to match, so no dimension is hardcoded:

```bash
bun src/local-embedding-pipeline.ts
```

### 3. Test local retrieval

Verify embeddings and vector search on their own — no LLM involved:

```bash
bun src/test-local-retrieval.ts "What is the punishment for theft?"
```

Then run the full retrieval + generation pipeline from the CLI:

```bash
bun src/db/retrieving-pipeline-local.ts "What is the punishment for theft?"
bun src/db/retrieving-pipeline-local.ts "What is theft?" --no-generate
```

`--no-generate` stops after retrieval, which is useful for checking recall
without waiting on the model. The script prints the expanded queries, the
retrieved chunks with metadata, the streamed answer, and the reasoning output
separately.

### 4. Run the server

```bash
bun src/server.ts
```

Then query `GET /local/chat?question=...`.

**Local scripts at a glance**

| Script | Purpose |
|---|---|
| `src/local-embedding-pipeline.ts` | Embed the PDF into the local index |
| `src/test-local-retrieval.ts` | Embedding + vector search only (fast) |
| `src/db/retrieving-pipeline-local.ts` | Full retrieval + streamed generation |
| `GET /local/health` | Runtime readiness check for models + index |
| `GET /local/chat?question=…` | SSE RAG endpoint used by the client |

**Request routing (before retrieval)**

`GET /local/chat` routes each message, so unnecessary work is skipped:

| Message | Behaviour | Cost |
|---|---|---|
| `hi`, `thanks`, `bye`, `who are you` | Canned reply, scope stated | No model, no retrieval (0ms) |
| Off-topic (`What is the capital of France?`) | Declined with an explanation | One short classifier call, no retrieval |
| In-scope question | Full RAG: expand → search → answer | Normal |

Small-talk matching is anchored on the whole message, so `hello, what is the
punishment for theft?` is treated as a question and still retrieves. The
off-topic gate fails open: if the classifier times out or answers unusably, the
question proceeds normally rather than being wrongly blocked.

Set the domain and gate behaviour with env vars:

```env
RAG_SCOPE_DESCRIPTION="the Bharatiya Nyaya Sanhita (BNS), India's criminal law statute"
LOCAL_SCOPE_GUARD=on          # "off" disables the off-topic gate
```

**Notes**
- The hosted and local pipelines use separate indexes/namespaces on purpose:
  embeddings from different models are not comparable, and the two models have
  different vector dimensions.
- Local query expansion always keeps the user's original wording, so a small
  model cannot reduce recall below a plain single-query search.
- Routing is currently wired into `/local/chat` only; `/chat` (Gemini) is
  unchanged.

---

## 📚 Documentation & Guides

For detailed code snippets and operations on Pinecone SDK v8 (upsert, query, metadata filter, delete, update), refer to:
- 📖 [Pinecone DB Operations Guide](docs/pinecone-upsert.md)
