import { Pinecone } from "@pinecone-database/pinecone";

const API_KEY = "pinecone-local";
const CONTROLLER_HOST = "http://jarvis:5080";

export const pc = new Pinecone({
  apiKey: API_KEY,
  controllerHostUrl: CONTROLLER_HOST,
});

/**
 * The emulator reports each index as `<host>:<port>`; turn that back into a
 * base URL for the per-index client. If host is 0.0.0.0 or 127.0.0.1, replace
 * it with the hostname from CONTROLLER_HOST so remote LAN clients can reach it.
 */
export function resolveIndexHostUrl(host: string): string {
  const cleanHost = host.replace(/^https?:\/\//, "");
  const [hostname, port] = cleanHost.split(":");
  if (!hostname || !port) {
    throw new Error(
      `Could not parse a host and port out of the Pinecone index host "${host}".`,
    );
  }
  let targetHost = hostname;
  if (hostname === "0.0.0.0" || hostname === "127.0.0.1") {
    try {
      const url = new URL(CONTROLLER_HOST);
      targetHost = url.hostname;
    } catch {
      targetHost = "localhost";
    }
  }
  return `http://${targetHost}:${port}`;
}
