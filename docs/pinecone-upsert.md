# Pinecone DB Operations & Cheat Sheet Guide (TypeScript SDK v4+)

This guide covers all key operations in Pinecone Vector Database using the latest `@pinecone-database/pinecone` SDK syntax, matching the implementation in `src/embedding-pipeline.ts`.

---

## 1. Initializing the Client & Connecting to an Index

### Pinecone Client Setup
```typescript
import { Pinecone } from "@pinecone-database/pinecone";

// For Local Pinecone Container (Docker)
export const pc = new Pinecone({
  apiKey: "pinecone-local",
  controllerHostUrl: "http://jarvis:5080",
});

// For Pinecone Cloud
// export const pc = new Pinecone({ apiKey: process.env.PINECONE_DB_API_KEY! });
```

### Index Connection (Modern Object Syntax)
```typescript
const SMALL_INDEX_NAME = "small-index";
const SMALL_DUMMY_NAMESPACE_NAME = "dummy";

const dummyIndex = pc.index({
  name: SMALL_INDEX_NAME,
  host: "http://jarvis:5081", // Explicit host override for local emulator
});

const namespace = dummyIndex.namespace(SMALL_DUMMY_NAMESPACE_NAME);
```

---

## 2. CRUD Operations Cheat Sheet

### A. Insert / Upsert Records
Upsert creates records if they don't exist, or overwrites them if they do.

#### Single Record:
```typescript
await namespace.upsert({
  records: [
    {
      id: "doc-1",
      values: [1, 0, 0],
      metadata: {
        text: "Cats are small animals",
        category: "animals",
        page: 1,
      },
    },
  ],
});
```

#### Multiple Records:
```typescript
await namespace.upsert({
  records: [
    {
      id: "doc-2",
      values: [0.9, 0.1, 0],
      metadata: { text: "Dogs are friendly animals", category: "animals", page: 2 },
    },
    {
      id: "doc-3",
      values: [0, 1, 0],
      metadata: { text: "Cars have four wheels", category: "vehicles", page: 3 },
    },
    {
      id: "doc-4",
      values: [0, 0, 1],
      metadata: { text: "Bananas are yellow fruits", category: "food", page: 4 },
    },
  ],
});
```

---

### B. Fetching Records by ID
Retrieve full records by their unique IDs without vector searching.

```typescript
// Fetch single or multiple records by ID
const result = await namespace.fetch({
  ids: ["doc-1", "doc-2", "doc-3"],
});
console.dir(result, { depth: null });
```

---

### C. Querying / Similarity Search

#### 1. Query by Vector Embedding:
```typescript
const result = await namespace.query({
  vector: [1, 0, 0],
  topK: 3,
  includeMetadata: true,
});
```

#### 2. Query with Metadata Filter (`$eq`, `$in`, `$gt`, etc.):
```typescript
const result = await namespace.query({
  vector: [1, 0, 0],
  topK: 10,
  includeMetadata: true,
  filter: {
    category: {
      $eq: "animals",
    },
  },
});
```

#### 3. Query using existing Record ID (Find vectors similar to doc-1):
```typescript
const result = await namespace.query({
  id: "doc-1",
  topK: 3,
  includeMetadata: true,
});
```

---

### D. Updating Records

#### 1. Full Update (Vector + Metadata via `upsert`):
```typescript
await namespace.upsert({
  records: [
    {
      id: "doc-1",
      values: [0.8, 0.2, 0], // Updated vector
      metadata: {
        text: "Cats are intelligent animals",
        category: "animals",
        page: 10,
      },
    },
  ],
});
```

#### 2. Update Only Metadata (without re-embedding vectors):
```typescript
await namespace.update({
  id: "doc-1",
  metadata: {
    text: "Cats are intelligent animals",
    category: "animals",
    page: 20,
  },
});
```

---

### E. Deleting Records

#### 1. Delete One Record:
```typescript
await namespace.deleteOne({ id: "doc-4" });
```

#### 2. Delete Many Records by IDs:
```typescript
await namespace.deleteMany(["doc-2", "doc-3"]);
```

#### 3. Delete Records by Metadata Filter:
```typescript
await namespace.deleteMany({
  filter: {
    category: {
      $eq: "animals",
    },
  },
});
```

#### 4. Delete All Records in a Namespace:
```typescript
await namespace.deleteAll();
```

---

## 3. Index Management & Metrics

### Describe Index Stats (Count & Fullness)
```typescript
const stats = await dummyIndex.describeIndexStats();
console.dir(stats, { depth: null });
```

### List All Indexes
```typescript
const indexList = await pc.listIndexes();
console.dir(indexList, { depth: null });
```

---

## 4. Operation Summary Matrix

| Operation | SDK Method | Purpose |
| :--- | :--- | :--- |
| **Insert / Upsert** | `namespace.upsert({ records })` | Insert or replace vector records |
| **Fetch** | `namespace.fetch({ ids })` | Get exact records by ID |
| **Similarity Query**| `namespace.query({ vector, topK })` | Vector similarity search (Cosine / Euclidean) |
| **Filtered Query** | `namespace.query({ vector, filter })` | Similarity search filtered by metadata |
| **Query by ID** | `namespace.query({ id, topK })` | Search vectors similar to an existing ID |
| **Update Metadata** | `namespace.update({ id, metadata })` | Update metadata without sending vector values |
| **Delete One** | `namespace.deleteOne({ id })` | Delete a single record |
| **Delete Many** | `namespace.deleteMany([...ids])` | Delete multiple records by ID list |
| **Delete by Filter**| `namespace.deleteMany({ filter })` | Bulk delete matching metadata filter |
| **Delete All** | `namespace.deleteAll()` | Clear all records in the namespace |
| **Describe Stats** | `index.describeIndexStats()` | Check vector counts, namespaces, and dimensions |
| **List Indexes** | `pc.listIndexes()` | List all created indexes in the Pinecone account |
