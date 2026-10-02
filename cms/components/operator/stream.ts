import { createNdjsonParser, type OperatorEvent } from "@/lib/operator/events";

/** Læser en NDJSON-respons og kalder onEvent for hver gyldig hændelse. Rent (kun Web Streams), testbart uden DOM. */
export async function readEventStream(body: ReadableStream<Uint8Array>, onEvent: (event: OperatorEvent) => void): Promise<{ invalid: number }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createNdjsonParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (value) for (const event of parser.push(decoder.decode(value, { stream: true }))) onEvent(event);
    if (done) break;
  }
  for (const event of parser.push(decoder.decode())) onEvent(event);
  for (const event of parser.flush()) onEvent(event);
  return { invalid: parser.invalidCount };
}
