import { ChatCompletionChunk } from './types';
/**
 * Transforma un ReadableStream binario de Server-Sent Events (SSE)
 * en un AsyncIterable de objetos ChatCompletionChunk tipados.
 */
export declare function parseEventStream(stream: ReadableStream<Uint8Array>, idleTimeoutMs?: number): AsyncGenerator<ChatCompletionChunk, void, unknown>;
export declare function parseRunEvents(stream: ReadableStream<Uint8Array>, idleTimeoutMs?: number): AsyncGenerator<Record<string, any>>;
//# sourceMappingURL=stream.d.ts.map