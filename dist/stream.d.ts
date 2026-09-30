import { ChatCompletionChunk } from './types';
/**
 * Transforma un ReadableStream binario de Server-Sent Events (SSE)
 * en un AsyncIterable de objetos ChatCompletionChunk tipados.
 */
export declare function parseEventStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<ChatCompletionChunk, void, unknown>;
//# sourceMappingURL=stream.d.ts.map