import {
  llm,
  GENERATE_RESPONSE_PROMPT,
  QUERY_TRANSFORMATION_PROMPT,
  generateQueries,
  retrieveAndDedupe,
  buildResponsePromptContext,
} from "./rag-helpers";

// Re-export helpers used by other modules (open-code pipeline, server)
export { queryVectorDB, formatDocumentsAsString } from "./rag-helpers";

import fs from "fs";
import path from "path";

// 5. Main RAG Retrieval & Generation Pipeline
export async function runRetrievalPipeline(query: string) {
  console.log(`🔍 Original Query: "${query}"\n`);

  // Step A: Transform query into multiple semantic variations
  console.log("🔄 Generating alternative queries...");
  const queryTransformationPromptText = await QUERY_TRANSFORMATION_PROMPT.format({
    question: query,
  });

  const queries = await generateQueries(query);

  console.log("Generated Rewritten Queries:");
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  console.log("\n📥 Retrieving relevant context from Pinecone...");

  // Step B: Multi-Query Retrieval from Vector DB
  const uniqueDocs = await retrieveAndDedupe(queries);

  console.log(`Found ${uniqueDocs.length} unique context documents.`);

  // Step C: Format context and generate final response
  const { contextText, finalPromptText } = await buildResponsePromptContext(
    query,
    uniqueDocs,
  );

  const responseChain = GENERATE_RESPONSE_PROMPT.pipe(llm);

  console.log("🤖 Generating response with Gemini LLM...\n");
  const aiResponse = await responseChain.invoke({
    question: query,
    context: contextText,
  });

  const answer = String(aiResponse.content);

  console.log("==================== ANSWER ====================");
  console.log(answer);
  console.log("================================================");

  // Save full retrieval details to Markdown file
  const logsDir = path.join(import.meta.dir, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-");
  const sanitizedQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  const filename = `${dateStr}_${sanitizedQuery}.md`;
  const filepath = path.join(logsDir, filename);

  const mdContent = `# RAG Retrieval Log

- **Timestamp**: ${new Date().toISOString()}
- **Original Query**: \`${query}\`

---

## 1. Original Prompt & Query Transformation

### Query Transformation Prompt
\`\`\`text
${queryTransformationPromptText}
\`\`\`

### Enhanced / Rewritten Queries
${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

---

## 2. Retrieved Chunks (${uniqueDocs.length} Unique Documents)

${uniqueDocs
  .map(
    (doc, i) => `### Chunk ${i + 1}
- **Metadata**: \`${JSON.stringify(doc.metadata)}\`

\`\`\`text
${doc.pageContent}
\`\`\`
`
  )
  .join("\n\n")}

---

## 3. Final Prompt Sent to LLM

\`\`\`text
${finalPromptText}
\`\`\`

---

## 4. LLM Response

${answer}
`;

  fs.writeFileSync(filepath, mdContent, "utf-8");
  console.log(`\n💾 Saved retrieval details to: ${filepath}`);

  return answer;
}

// Execute sample query if script is run directly
if (import.meta.main) {
  const sampleQuery = "What offenses are defined in the Bharatiya Nyaya Sanhita?";
  runRetrievalPipeline(sampleQuery).catch(console.error);
}
