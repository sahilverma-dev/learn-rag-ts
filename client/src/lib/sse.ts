export type SSEFrame = {
  event: string;
  data: string;
};

/**
 * Parses one complete SSE frame (the text between two blank-line boundaries).
 *
 * A `data` value containing newlines is framed by the server as several `data:`
 * lines, so the payload must be rebuilt by joining ALL of them. Accumulating
 * with a falsy check instead (`data = data ? ... : payload`) silently drops a
 * newline whenever the running value is empty — which is exactly what happens
 * for a token that begins with a newline, merging markdown list items onto one
 * line.
 */
export function parseSSEFrame(block: string): SSEFrame {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // Tolerate both "data: x" and the bare "data:" form for empty values.
      dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
    }
  }

  return { event, data: dataLines.join("\n") };
}
