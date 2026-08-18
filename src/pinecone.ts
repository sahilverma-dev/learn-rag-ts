import { Pinecone } from "@pinecone-database/pinecone";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// The API key is required by the SDK, but Pinecone Local ignores its value.
export const CONTROLLER_HOST = "http://jarvis:5080";

// Pinecone Local's controller and data plane live on different ports.
// The controller reports each index's host as "0.0.0.0:<port>", which only
// works if the data plane is reachable on the same machine. When running
// Pinecone Local in Docker on a remote host, that host must be rewritten.
// Default to the controller's hostname (jarvis) on the reported data-plane port.
const HOST_OVERRIDE = process.env.PINECONE_INDEX_HOST; // e.g. "http://jarvis:5081"
const API_KEY = "pinecone-local";

// ---------------------------------------------------------------------------
// Testable helpers
// ---------------------------------------------------------------------------
/**
 * Build the data-plane URL for an index so it is reachable from this machine.
 * Pinecone Local reports "0.0.0.0:5081", which points at localhost; when the
 * emulator runs on a different host we substitute the controller's hostname.
 * The returned URL includes the http:// scheme (the SDK otherwise defaults to
 * https, which Pinecone Local does not speak).
 */
export function buildIndexHost(
  reportedHost: string,
  controllerHostUrl: string = CONTROLLER_HOST,
  hostOverride?: string,
): string {
  if (hostOverride) {
    return hostOverride;
  }
  // Use only the hostname portion of the controller URL (strip scheme and
  // port), then replace the loopback address in the reported host with it.
  const controllerHostname = controllerHostUrl
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "");
  const dataPlaneHost = reportedHost.replace(/^0\.0\.0\.0(?=:)/, controllerHostname);
  return `http://${dataPlaneHost}`;
}

/** Create an index, tolerating the case where it already exists. */
export async function ensureIndex(
  pc: Pinecone,
  name: string,
  vectorType: "dense" | "sparse",
  dimension: number,
  metric: "cosine" | "dotproduct",
  controllerHostUrl: string = CONTROLLER_HOST,
): Promise<{ name: string; created: boolean }> {
  const spec = {
    serverless: { cloud: "aws", region: "us-east-1" },
  };

  // The SDK rejects `dimension` for sparse indexes at client side, but
  // Pinecone Local's controller requires the field. Bypass the SDK and call
  // the controller's HTTP API directly for sparse indexes.
  if (vectorType === "sparse") {
    const response = await fetch(`${controllerHostUrl}/indexes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        vector_type: "sparse",
        dimension,
        metric,
        spec,
        deletion_protection: "disabled",
        tags: { environment: "development" },
      }),
    });
    if (response.ok) {
      return { name, created: true };
    }
    const body = await response.text();
    if (response.status === 409 && body.includes("ALREADY_EXISTS")) {
      console.log(`Index "${name}" already exists, reusing it.`);
      return { name, created: false };
    }
    throw new Error(
      `Failed to create index "${name}" via ${controllerHostUrl}: ` +
        `${response.status} ${response.statusText} ${body}`,
    );
  }

  try {
    await pc.createIndex({
      name,
      vectorType,
      dimension,
      metric,
      spec,
      deletionProtection: "disabled",
      tags: { environment: "development" },
    });
    return { name, created: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ALREADY_EXISTS")) {
      console.log(`Index "${name}" already exists, reusing it.`);
      return { name, created: false };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const pc = new Pinecone({
    apiKey: API_KEY,
    controllerHostUrl: CONTROLLER_HOST,
  });

  const denseIndexName = "dense-index";
  const sparseIndexName = "sparse-index";

  // Create the indexes if they don't already exist.
  console.log(`Ensuring indexes exist on ${CONTROLLER_HOST} ...`);
  await ensureIndex(pc, denseIndexName, "dense", 2, "cosine");
  // Pinecone Local requires a dimension field even for sparse indexes, and
  // rejects 0; use a minimal positive value since sparse vectors don't use it.
  await ensureIndex(pc, sparseIndexName, "sparse", 1, "dotproduct");

  // Build reachable data-plane hosts for each index.
  const denseHost = buildIndexHost(
    (await pc.describeIndex(denseIndexName)).host,
    CONTROLLER_HOST,
    HOST_OVERRIDE,
  );
  const sparseHost = buildIndexHost(
    (await pc.describeIndex(sparseIndexName)).host,
    CONTROLLER_HOST,
    HOST_OVERRIDE,
  );

  console.log(`Targeting dense index at ${denseHost}`);
  console.log(`Targeting sparse index at ${sparseHost}`);
  const denseIndex = pc.index({ name: denseIndexName, host: denseHost });
  const sparseIndex = pc.index({ name: sparseIndexName, host: sparseHost });

  // Upsert records into the index (dense)
  await denseIndex.namespace("example-namespace").upsert({
    records: [
      {
        id: "vec1",
        values: [1.0, -2.5],
        metadata: { genre: "drama" },
      },
      {
        id: "vec2",
        values: [3.0, -2.0],
        metadata: { genre: "documentary" },
      },
      {
        id: "vec3",
        values: [0.5, -1.5],
        metadata: { genre: "documentary" },
      },
    ],
  });

  // Upsert records into the index (sparse)
  await sparseIndex.namespace("example-namespace").upsert({
    records: [
      {
        id: "vec1",
        sparseValues: {
          indices: [
            822745112, 1009084850, 1221765879, 1408993854, 1504846510, 1596856843,
            1640781426, 1656251611, 1807131503, 2543655733, 2902766088, 2909307736,
            3246437992, 3517203014, 3590924191,
          ],
          values: [
            1.7958984, 0.41577148, 2.828125, 2.8027344, 2.8691406, 1.6533203,
            5.3671875, 1.3046875, 0.49780273, 0.5722656, 2.71875, 3.0820312,
            2.5019531, 4.4414062, 3.3554688,
          ],
        },
        metadata: {
          chunk_text:
            "AAPL reported a year-over-year revenue increase, expecting stronger Q3 demand for its flagship phones.",
          category: "technology",
          quarter: "Q3",
        },
      },
      {
        id: "vec2",
        sparseValues: {
          indices: [
            131900689, 592326839, 710158994, 838729363, 1304885087, 1640781426,
            1690623792, 1807131503, 2066971792, 2428553208, 2548600401, 2577534050,
            3162218338, 3319279674, 3343062801, 3476647774, 3485013322, 3517203014,
            4283091697,
          ],
          values: [
            0.4362793, 3.3457031, 2.7714844, 3.0273438, 3.3164062, 5.6015625,
            2.4863281, 0.38134766, 1.25, 2.9609375, 0.34179688, 1.4306641, 0.34375,
            3.3613281, 1.4404297, 2.2558594, 2.2597656, 4.8710938, 0.5605469,
          ],
        },
        metadata: {
          chunk_text:
            "Analysts suggest that AAPL's upcoming Q4 product launch event might solidify its position in the premium smartphone market.",
          category: "technology",
          quarter: "Q4",
        },
      },
      {
        id: "vec3",
        sparseValues: {
          indices: [
            8661920, 350356213, 391213188, 554637446, 1024951234, 1640781426,
            1780689102, 1799010313, 2194093370, 2632344667, 2641553256, 2779594451,
            3517203014, 3543799498, 3837503950, 4283091697,
          ],
          values: [
            2.6875, 4.2929688, 3.609375, 3.0722656, 2.1152344, 5.78125, 3.7460938,
            3.7363281, 1.2695312, 3.4824219, 0.7207031, 0.0826416, 4.671875,
            3.7011719, 2.796875, 0.61621094,
          ],
        },
        metadata: {
          chunk_text:
            "AAPL's strategic Q3 partnerships with semiconductor suppliers could mitigate component risks and stabilize iPhone production",
          category: "technology",
          quarter: "Q3",
        },
      },
    ],
  });

  // Check the number of records in each index
  console.log("\nIndex stats (dense):", await denseIndex.describeIndexStats());
  console.log("\nIndex stats (sparse):", await sparseIndex.describeIndexStats());

  // Query the index (dense) with a metadata filter
  const denseQueryResponse = await denseIndex
    .namespace("example-namespace")
    .query({
      vector: [3.0, -2.0],
      filter: {
        genre: { $eq: "documentary" },
      },
      topK: 1,
      includeValues: false,
      includeMetadata: true,
    });

  console.log("\nDense query response:", denseQueryResponse);

  const sparseQueryResponse = await sparseIndex
    .namespace("example-namespace")
    .query({
      // The v8 SDK requires `vector` even for sparse indexes; pass a
      // placeholder dense vector so the sparse query still runs.
      vector: [0],
      sparseVector: {
        indices: [
          767227209, 1640781426, 1690623792, 2021799277, 2152645940, 2295025838,
          2443437770, 2779594451, 2956155693, 3476647774, 3818127854, 4283091697,
        ],
        values: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      },
      topK: 1,
      includeValues: false,
      includeMetadata: true,
    });

  console.log("\nSparse query response:", sparseQueryResponse);

  // Delete the indexes
  await pc.deleteIndex(denseIndexName);
  await pc.deleteIndex(sparseIndexName);
}

main().catch((err: unknown) => {
  console.error("\nScript failed:", err);
  console.error(
    "\nIf the failure mentions reaching Pinecone, the index data plane is not " +
      "reachable. Pinecone Local (jarvis) exposes its controller on :5080 but " +
      "its data plane port is not published. On jarvis, publish the data plane " +
      "port (e.g. docker run -p 5081:5081 -p 5082:5082 ...) or set " +
      "PINECONE_INDEX_HOST to a reachable data-plane URL, e.g. " +
      "PINECONE_INDEX_HOST=http://jarvis:5081 bun run src/pinecone.ts",
  );
  process.exit(1);
});
