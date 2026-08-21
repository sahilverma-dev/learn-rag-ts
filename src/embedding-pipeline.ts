import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import cliProgress from "cli-progress";
import { pc } from "./db/pinecone";

async function loadLocalPDF() {
  // 1. Supply the path to your local file
  const pdfPath = path.join(import.meta.dir, "data/BNS.pdf");
  const loader = new PDFLoader(pdfPath, {
    splitPages: true, // true (default) splits pages into separate documents
  });

  // 2. Parse the PDF into LangChain Documents
  const docs = await loader.load();

  // 3. Split into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`Created ${splitDocs.length} chunks.`);

  return splitDocs;
}

async function indexPdfToPinecone() {
  const INDEX_NAME = "pdf-embedded-index";

  // Check if index exists, create if not
  const indexList = await pc.listIndexes();
  const exists = indexList.indexes?.some((idx) => idx.name === INDEX_NAME);

  if (!exists) {
    console.log(`Creating index "${INDEX_NAME}" with 768 dimensions...`);
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: 768, // Dimension for Google Gemini text-embedding-004
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
  }

  // Get index details to resolve host port for local emulator
  const indexDescription = await pc.describeIndex(INDEX_NAME);
  const hostPort = indexDescription.host.split(":")[1];
  const hostUrl = `http://jarvis:${hostPort}`;

  const pineconeIndex = pc.index({
    name: INDEX_NAME,
    host: hostUrl,
  });

  const splitDocs = await loadLocalPDF();

  // 4. Initialize Google Gemini embedding model (text-embedding-004)
  console.log("Loading Google Gemini embedding model (text-embedding-004)...");
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  // 5. Generate embeddings and store in Pinecone with progress bar
  console.log(
    `Embedding and upserting ${splitDocs.length} chunks to Pinecone...`,
  );

  const progressBar = new cliProgress.SingleBar({
    format: "Embedding |{bar}| {percentage}% | {value}/{total} Chunks | ETA: {eta}s",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(splitDocs.length, 0);

  const vectorStore = new PineconeStore(embeddings, {
    pineconeIndex,
    namespace: "pdf-documents",
  });

  const BATCH_SIZE = 50;
  for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
    const batch = splitDocs.slice(i, i + BATCH_SIZE);
    await vectorStore.addDocuments(batch);
    progressBar.update(Math.min(i + BATCH_SIZE, splitDocs.length));
  }

  progressBar.stop();
  console.log("Upsert completed successfully.");
}

indexPdfToPinecone().catch(console.error);
