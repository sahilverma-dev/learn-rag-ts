import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { pc } from "./db/pinecone";

async function loadLocalPDF() {
  // 1. Supply the path to your local file
  const pdfPath = path.join(import.meta.dir, "data/BNS.pdf");
  const loader = new PDFLoader(pdfPath, {
    splitPages: true, // true (default) splits pages into separate documents
  });

  // 2. Parse the PDF into LangChain Documents
  const docs = await loader.load();

  // 3. View the results
  console.log(`Loaded ${docs.length} pages.`);
  console.log("First page content snippet:", docs[0]!.pageContent);
  //   console.log("Metadata of first page:", docs[0]!.metadata);
}

// loadLocalPDF();

/*

The important pieces are:

- **Index** → your vector database/index
    
- **Namespace** → logical partition inside an index
    
- **Record/vector** → one embedded piece of information
    
- **Metadata** → additional searchable information
    
- **Query** → similarity search
    
*/
// creating index on pinecone db
// const ragIndex = await pc.createIndex({
//   name: "my-rag-index",
//   dimension: 1536,
//   metric: "cosine",
//   spec: {
//     serverless: {
//       cloud: "aws",
//       region: "us-east-1",
//     },
//   },
// });
// console.log(ragIndex);

// listing all indexes
// const indexes = async () => {
//   return await pc.listIndexes();
// };

// indexes().then((response) => {
//   console.log("My indexes: ", response);
// });

// connecting to specific index
const index = pc.index({ name: "my-rag-index" });

// console.log(index);

const namespace = index.namespace("documents");
console.log({ namespace });
