"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEventStream = parseEventStream;
/**
 * Transforma un ReadableStream binario de Server-Sent Events (SSE)
 * en un AsyncIterable de objetos ChatCompletionChunk tipados.
 */
async function* parseEventStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith(':')) {
                    // Comentario SSE o línea vacía
                    continue;
                }
                if (line.startsWith('data:')) {
                    const data = line.slice(5).trim();
                    if (data === '[DONE]') {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        yield parsed;
                    }
                    catch {
                        // Chunk incompleto o no JSON, ignorar
                    }
                }
            }
        }
        if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data !== '[DONE]') {
                    try {
                        const parsed = JSON.parse(data);
                        yield parsed;
                    }
                    catch { }
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
//# sourceMappingURL=stream.js.map