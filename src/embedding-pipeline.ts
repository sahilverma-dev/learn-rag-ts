import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

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
  console.log(
    "First page content snippet:",
    docs[0]!.pageContent.slice(0, 100),
  );
  console.log("Metadata of first page:", docs[0]!.metadata);
}

loadLocalPDF();
