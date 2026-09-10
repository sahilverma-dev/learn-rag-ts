import { Pinecone } from "@pinecone-database/pinecone";

const API_KEY = "pinecone-local";
const CONTROLLER_HOST = "http://jarvis:5080";

export const pc = new Pinecone({
  apiKey: API_KEY,
  controllerHostUrl: CONTROLLER_HOST,
});

/**
 * The emulator reports each index as `<host>:<port>`; turn that back into a
 * base URL for the per-index client.
 */
export function resolveIndexHostUrl(host: string): string {
  const [hostname, port] = host.replace(/^https?:\/\//, "").split(":");
  if (!hostname || !port) {
    throw new Error(
      `Could not parse a host and port out of the Pinecone index host "${host}".`,
    );
  }
  return `http://${hostname}:${port}`;
}
