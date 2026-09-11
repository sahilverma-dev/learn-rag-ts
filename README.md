# ⚡ Learn Full Stack RAG TypeScript (`lear-rag-ts`)

A full-stack Retrieval-Augmented Generation (RAG) system built with a high-performance **Hono/Bun** backend, **LangChain**, **Pinecone Vector DB / Local Ollama**, and a modern **React 19 / Vite / TailwindCSS v4** client UI based on beautiful-ui design primitives.

---

## 🎯 Overview

`rag-ts` allows users to query legal corpora (such as the _Bharatiya Nyaya Sanhita (BNS)_ and the _Constitution of India_) using both hosted LLM providers (Google Gemini) and completely offline, local LLM/embedding models (via Ollama & Local Pinecone Emulator).

Key features:

- **Structure-Aware Legal Chunker**: Preserves whole sections and articles instead of arbitrary page/character splits.
- **Multi-Query Expansion**: Rewrites user questions into multiple query variations to maximize semantic retrieval.
- **Dual Pipeline Support**:
  - **Cloud / Hosted RAG**: Google Gemini (`gemini-embedding-2` + `gemini-2.5-flash` / OpenCode Zen API).
  - **Local LAN RAG**: Local Ollama embeddings (`bge-small-en-v1.5`) & Local Reasoning models (`deepseek-r1`, `qwen2.5`) with no external API calls.
- **Modern React Chat UI**:
  - Built with TailwindCSS v4 and Harness tokens (`oklch` theme).
  - Interactive **Context Cards** showing exact character counts, source badges, and PDF provisions.
  - Streaming markdown responses with caret animations and reasoning drawers for thinking models.
  - Fully responsive mobile drawer navigation & scroll-bypass protection.

---

## 📂 Project Structure

```text
rag-ts/
├── client/                      # React 19 Frontend App (Vite, Tailwind v4)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   └── context-cards.tsx   # Beautiful-ui Context Cards component
│   │   │   ├── AssistantReply.tsx       # StreamText & reasoning drawer wrapper
│   │   │   ├── ChatShell.tsx            # Main Chat interface & layout
│   │   │   ├── PromptBar.tsx            # Floating message input
│   │   │   └── SidebarNav.tsx           # Collapsible workspace navigation
│   │   ├── hooks/                       # Chat & local health state hooks
│   │   ├── lib/                         # SSE parser & API client utilities
│   │   └── index.css                    # Design tokens & markdown keyframes
│   ├── package.json
│   └── vite.config.ts
├── server/                      # Hono & Bun Backend Server
│   ├── src/
│   │   ├── data/                        # PDF documents (e.g. BNS.pdf)
│   │   ├── db/
│   │   │   ├── legal-chunker.ts         # Section & Article structure-aware chunker
│   │   │   ├── pinecone.ts              # Pinecone DB client initialization
│   │   │   └── retrieving-pipeline.ts   # Multi-query RAG search & Gemini LLM
│   │   ├── embedding-pipeline.ts        # Cloud PDF ingestion & vector embedding
│   │   ├── local-embedding-pipeline.ts  # Local Ollama embedding pipeline
│   │   └── server.ts                    # Hono web server & SSE stream endpoints
│   ├── package.json
│   └── README.md                        # Detailed server technical documentation
└── README.md                    # Root setup & project overview guide
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v4, Phosphor Icons.
- **Backend**: Bun runtime, Hono framework, LangChain (`@langchain/google-genai`, `@langchain/pinecone`), Pinecone Vector DB, Ollama.
- **Protocol**: Server-Sent Events (SSE) streaming (`status`, `sources`, `token`, `thinking`, `done`).

---

## 🚀 Setup Guide

### 1. Prerequisites

- [Bun](https://bun.sh/) (v1.1+) installed on your machine.
- (Optional) [Ollama](https://ollama.com/) if you want to run local embeddings and offline LLMs.

---

### 2. Backend Setup (`server`)

1. Open terminal and navigate to the server directory:

   ```bash
   cd server
   ```

2. Install backend dependencies:

   ```bash
   bun install
   ```

3. Create a `.env` file in the `server/` directory:

   ```env
   # Hosted Provider Keys (Optional if running local-only)
   GOOGLE_API_KEY=your_google_gemini_api_key_here
   PINECONE_DB_API_KEY=your_pinecone_api_key_here

   # Local Ollama & Local Vector DB Configuration
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
   OLLAMA_LLM_MODEL=deepseek-r1:1.5b
   LOCAL_INDEX_NAME=pdf-embedded-index-local
   LOCAL_NAMESPACE=pdf-documents-local

   # Retrieval settings
   LOCAL_TOP_K=3
   LOCAL_MAX_CONTEXT=8
   LOCAL_MAX_UNIT_CHARS=1800
   ```

4. Ingest & embed document chunks:
   - For **Hosted Gemini RAG**:
     ```bash
     bun src/embedding-pipeline.ts
     ```
   - For **Local Offline Ollama RAG**:
     ```bash
     bun src/local-embedding-pipeline.ts
     ```

5. Start the backend development server:
   ```bash
   bun run --watch ./src/server.ts
   ```
   The backend API server will start on `http://localhost:8000`.

---

### 3. Frontend Setup (`client`)

1. Open a new terminal tab and navigate to the client directory:

   ```bash
   cd client
   ```

2. Install frontend dependencies:

   ```bash
   bun install
   ```

3. Start the Vite development server:
   ```bash
   bun dev
   ```
   Open your browser at `http://localhost:3000`.

---

## ⚡ API Endpoints Summary

| Endpoint                       | Method | Description                                                 |
| ------------------------------ | ------ | ----------------------------------------------------------- |
| `GET /chat?question=...`       | SSE    | Streams response using Gemini hosted models                 |
| `GET /local/chat?question=...` | SSE    | Streams response using local Ollama model + thinking events |
| `GET /local/health`            | JSON   | Returns health & readiness of local models and index        |

---

## 📄 License

MIT
