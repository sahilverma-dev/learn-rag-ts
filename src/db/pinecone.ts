import { Pinecone } from "@pinecone-database/pinecone";
const API_KEY = "pinecone-local";
export const CONTROLLER_HOST = "http://jarvis:5080";

export const pc = new Pinecone({
  apiKey: API_KEY,
  controllerHostUrl: CONTROLLER_HOST,
});
