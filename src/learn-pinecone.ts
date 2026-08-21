import { pc } from "./db/pinecone";

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

// // connecting to specific index
// const index = pc.index({ name: "my-rag-index" });

// // console.log(index);

// const namespace = index.namespace("documents");
// console.log({ namespace });

const SMALL_INDEX_NAME = "small-index";
const SMALL_DUMMY_NAMESPACE_NAME = "dummy";
// making small dimensioned index to learn
// const smallIndex = await pc.createIndex({
//   name: SMALL_INDEX_NAME,

//   // VERY SMALL DIMENSION JUST FOR LEARNING
//   dimension: 3,

//   metric: "cosine",

//   spec: {
//     serverless: {
//       cloud: "aws",
//       region: "us-east-1",
//     },
//   },
// });

// console.log(smallIndex);

// // listing all indexes
// const indexes = async () => {
//   return await pc.listIndexes();
// };

// indexes().then((response) => {
//   console.log("My indexes: ", response);
// });

// connecting to my small-index
// const smallIndex = pc.index({ name: SMALL_INDEX_NAME });
// console.log(smallIndex);

// new index connection
const dummyIndex = pc.index({
  name: SMALL_INDEX_NAME,
  host: "http://jarvis:5081",
});

try {
  //   const dummyNamespace = smallIndex.namespace(SMALL_DUMMY_NAMESPACE_NAME);
  //   // .upsert({
  //   //   records: [
  //   //     {
  //   //       id: "doc-1",
  //   //       values: [1, 0, 0],
  //   //       metadata: {
  //   //         text: "Cats are small animals",
  //   //         category: "animals",
  //   //         page: 1,
  //   //       },
  //   //     },
  //   //   ],
  //   // });
  //   const data = await dummyNamespace.upsert({
  //     records: [
  //       {
  //         id: "doc-1",
  //         values: [1, 0, 0],
  //         metadata: {
  //           text: "Cats are small animals",
  //           category: "animals",
  //           page: 1,
  //         },
  //       },
  //     ],
  //   });
  //   console.log(data);
  //   INSERT / UPSERT ONE RECORD
  //   await pc
  //     .index({
  //       name: SMALL_INDEX_NAME,
  //       host: "http://jarvis:5081",
  //     })
  //     .namespace(SMALL_DUMMY_NAMESPACE_NAME)
  //     .upsert({
  //       records: [
  //         {
  //           id: "doc-1",
  //           values: [1, 0, 0],
  //           metadata: {
  //             text: "Cats are small animals",
  //             category: "animals",
  //             page: 1,
  //           },
  //         },
  //       ],
  //     });
  //   console.log("Inserted doc-1");
  //
  //    INSERT MULTIPLE RECORDS
  //   await pc
  //     .index({
  //       name: SMALL_INDEX_NAME,
  //       host: "http://jarvis:5081",
  //     })
  //     .namespace(SMALL_DUMMY_NAMESPACE_NAME)
  //     .upsert({
  //       records: [
  //         {
  //           id: "doc-2",
  //           values: [0.9, 0.1, 0],
  //           metadata: {
  //             text: "Dogs are friendly animals",
  //             category: "animals",
  //             page: 2,
  //           },
  //         },
  //         {
  //           id: "doc-3",
  //           values: [0, 1, 0],
  //           metadata: {
  //             text: "Cars have four wheels",
  //             category: "vehicles",
  //             page: 3,
  //           },
  //         },
  //         {
  //           id: "doc-4",
  //           values: [0, 0, 1],
  //           metadata: {
  //             text: "Bananas are yellow fruits",
  //             category: "food",
  //             page: 4,
  //           },
  //         },
  //       ],
  //     });

  //   FETCH BY ID

  const namespace = dummyIndex.namespace(SMALL_DUMMY_NAMESPACE_NAME);

  //   const result = await namespace.fetch({ ids: ["doc-1"] });
  // FETCH MULTIPLE IDS
  //   const result = await namespace.fetch({
  //     ids: ["doc-1", "doc-2", "doc-3"],
  //   });

  // QUERY BY VECTOR
  //   const result = await namespace.query({
  //     vector: [1, 0, 0],
  //     topK: 3,
  //     includeMetadata: true,
  //   });
  // QUERY WITH METADATA FILTER

  //   const result = await namespace.query({
  //     vector: [1, 0, 0],

  //     topK: 10,

  //     includeMetadata: true,

  //     filter: {
  //       category: {
  //         $eq: "animals",
  //       },
  //     },
  //   });
  //  QUERY USING AN ID
  //   const result = await namespace.query({
  //     id: "doc-1",

  //     topK: 3,

  //     includeMetadata: true,
  //   });

  //   console.dir(result, { depth: null });
  //  UPDATE / UPSERT EXISTING RECORD
  //   const id = "doc-1";

  //   // 1. Fetch current data
  //   const before = await namespace.fetch({ ids: [id] });

  //   console.log("=== BEFORE UPDATE ===");
  //   console.dir(before.records[id], { depth: null });

  //   // 2. Update the record
  //   await namespace.upsert({
  //     records: [
  //       {
  //         id,
  //         values: [0.8, 0.2, 0],
  //         metadata: {
  //           text: "Cats are intelligent animals",
  //           category: "animals",
  //           page: 10,
  //         },
  //       },
  //     ],
  //   });

  //   console.log("\nRecord updated successfully");

  //   // 3. Fetch the record again
  //   const after = await namespace.fetch({ ids: [id] });

  //   console.log("\n=== AFTER UPDATE ===");
  //   console.dir(after.records[id], { depth: null });

  // UPDATE ONLY METADATA
  // 1. Fetch current data
  //   const before = await namespace.fetch({ ids: [id] });

  //   console.log("=== BEFORE UPDATE ===");
  //   console.dir(before.records[id], { depth: null });

  //   // 2. Update metadata
  //   await namespace.update({
  //     id,

  //     metadata: {
  //       text: "Cats are intelligent animals",
  //       category: "animals",
  //       page: 20,
  //     },
  //   });

  //   console.log("\nMetadata updated successfully");

  //   // 3. Fetch updated data
  //   const after = await namespace.fetch({ ids: [id] });

  //   console.log("\n=== AFTER UPDATE ===");
  //   console.dir(after.records[id], { depth: null });
  //   DELETE ONE RECORD
  //   await namespace.deleteOne({ id: "doc-4" });

  //   console.log("Deleted doc-4");
  // DELETE MANY RECORDS

  //   await namespace.deleteMany(["doc-2", "doc-3"]);

  //   console.log("Deleted doc-2 and doc-3");
  //   DELETE BY METADATA FILTER
  //   await namespace.deleteMany({
  //     filter: {
  //       category: {
  //         $eq: "animals",
  //       },
  //     },
  //   });
  //   console.log("Deleted records matching filter");

  // DELETE EVERYTHING IN NAMESPACE
  //   await namespace.deleteAll();

  //   console.log("Deleted all records in namespace");

  //   GET INDEX STATS
  //   const stats = await dummyIndex.describeIndexStats();

  //   console.dir(stats, { depth: null });

  // LIST INDEXES
  const result = await pc.listIndexes();

  console.dir(result, { depth: null });

  // VERIFY EMBEDDED PDF INDEX ("pdf-embedded-index")
  const pdfIndexDescription = await pc.describeIndex("pdf-embedded-index");
  const pdfHostPort = pdfIndexDescription.host.split(":")[1];
  const pdfIndex = pc.index({
    name: "pdf-embedded-index",
    host: `http://jarvis:${pdfHostPort}`,
  });
  const pdfStats = await pdfIndex.describeIndexStats();
  console.log("PDF Index Stats:", pdfStats);

  // FETCH SAMPLE RECORDS FROM PDF NAMESPACE
  const pdfNamespace = pdfIndex.namespace("pdf-documents");
  const sampleRecords = await pdfNamespace.fetch({ ids: ["doc-0", "doc-649"] });
  console.dir(sampleRecords, { depth: null });
} catch (error) {
  console.log(error);
}

// console.log(dummyNamespace);

// deleting all the indexes
// const allIndexes = await pc.listIndexes();

// allIndexes.indexes?.forEach(async (index) => {
//   //   console.log(index.name);
//   const res = await pc.deleteIndex(index.name);
//   console.log(res);
// });

// console.log(allIndexes.indexes?.map((i) => i.name));
