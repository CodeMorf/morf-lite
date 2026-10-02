"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEventStream = parseEventStream;
exports.parseRunEvents = parseRunEvents;
/**
 * Transforma un ReadableStream binario de Server-Sent Events (SSE)
 * en un AsyncIterable de objetos ChatCompletionChunk tipados.
 */
async function* parseEventStream(stream, idleTimeoutMs = 60000) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '';
    let completed = false;
    let hasOutput = false;
    try {
        while (true) {
            const { done, value } = await readWithTimeout(reader, idleTimeoutMs);
            if (done) {
                buffer += decoder.decode();
                break;
            }
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
                        if (!hasOutput)
                            throw new Error('Stream returned no visible output or tool calls');
                        if (!completed)
                            throw new Error('Stream ended without completion');
                        return;
                    }
                    let parsed;
                    try {
                        parsed = JSON.parse(data);
                    }
                    catch {
                        throw new Error('Invalid JSON in event stream');
                    }
                    if (parsed.error)
                        throw new Error(parsed.error.message || parsed.error.type || 'El flujo fallo');
                    completed ||= (parsed.choices || []).some((choice) => Boolean(choice.finish_reason));
                    hasOutput ||= (parsed.choices || []).some((choice) => Boolean((choice.delta?.content || '').trim()) || Boolean(choice.delta?.tool_calls?.length));
                    yield parsed;
                }
            }
        }
        if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data !== '[DONE]') {
                    let parsed;
                    try {
                        parsed = JSON.parse(data);
                    }
                    catch {
                        throw new Error('Invalid JSON in event stream');
                    }
                    if (parsed?.error)
                        throw new Error(parsed.error.message || parsed.error.type || 'Stream failed');
                    if (parsed) {
                        completed ||= (parsed.choices || []).some((choice) => Boolean(choice.finish_reason));
                        hasOutput ||= (parsed.choices || []).some((choice) => Boolean((choice.delta?.content || '').trim()) || Boolean(choice.delta?.tool_calls?.length));
                        yield parsed;
                    }
                }
            }
        }
        if (!completed || !hasOutput)
            throw new Error('Stream ended without completion or output');
    }
    finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
async function readWithTimeout(reader, timeout) {
    let timer;
    try {
        return await Promise.race([reader.read(), new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('El flujo dejo de recibir datos')), timeout);
            })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function* parseRunEvents(stream, idleTimeoutMs = 60000) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await readWithTimeout(reader, idleTimeoutMs);
            if (done)
                throw new Error('Run event stream ended before completion; resume from the last event');
            buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
                if (!data || data === '[DONE]')
                    continue;
                let event;
                try {
                    event = JSON.parse(data);
                }
                catch {
                    throw new Error('Invalid JSON in run event stream; resume from the last event');
                }
                yield event;
                if (['run.completed', 'run.failed', 'run.cancelled'].includes(String(event.type)))
                    return;
            }
        }
    }
    finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
//# sourceMappingURL=stream.js.map