"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MorfSession = void 0;
/**
 * Gestor de sesiones conversacionales multi-turno.
 * Mantiene el historial en memoria para garantizar que el modelo
 * conserve el contexto completo turno tras turno.
 */
class MorfSession {
    client;
    model;
    messages = [];
    defaultOptions;
    constructor(client, options) {
        this.client = client;
        this.model = options?.model || 'morf-ai-auto';
        this.defaultOptions = {
            max_tokens: options?.max_tokens,
            temperature: options?.temperature,
        };
        if (options?.systemPrompt) {
            this.messages.push({
                role: 'system',
                content: options.systemPrompt,
            });
        }
        if (options?.initialMessages?.length) {
            this.messages.push(...options.initialMessages);
        }
    }
    /**
     * Envía un mensaje y recibe la respuesta del asistente acumulando el contexto.
     */
    async sendMessage(text, options) {
        this.messages.push({ role: 'user', content: text });
        const completion = (await this.client.chat.completions.create({
            model: options?.model || this.model,
            messages: this.messages,
            stream: false,
            ...this.defaultOptions,
            ...options,
        }));
        const reply = completion.choices?.[0]?.message?.content;
        const content = typeof reply === 'string' ? reply : JSON.stringify(reply || '');
        // Guardar respuesta del asistente en el historial
        this.messages.push({ role: 'assistant', content });
        return {
            content,
            metadata: completion._morf,
        };
    }
    /**
     * Envía un mensaje y transmite la respuesta en streaming acumulando el contexto al finalizar.
     */
    async *sendMessageStream(text, options) {
        this.messages.push({ role: 'user', content: text });
        const stream = (await this.client.chat.completions.create({
            model: options?.model || this.model,
            messages: this.messages,
            stream: true,
            ...this.defaultOptions,
            ...options,
        }));
        let fullReply = '';
        let meta;
        for await (const chunk of stream) {
            if (!meta && chunk._morf) {
                meta = chunk._morf;
            }
            const rawDelta = chunk.choices?.[0]?.delta?.content;
            const delta = typeof rawDelta === 'string' ? rawDelta : (rawDelta ? JSON.stringify(rawDelta) : '');
            if (delta) {
                fullReply += delta;
                yield { delta, metadata: meta };
            }
        }
        // Guardar en el historial
        this.messages.push({ role: 'assistant', content: fullReply });
    }
    /**
     * Agrega un mensaje arbitrario al historial.
     */
    addMessage(role, content) {
        this.messages.push({ role, content });
    }
    /**
     * Obtiene una copia del historial actual.
     */
    getHistory() {
        return [...this.messages];
    }
    /**
     * Limpia el historial conservando opcionalmente el system prompt.
     */
    clear(keepSystemPrompt = true) {
        if (keepSystemPrompt) {
            this.messages = this.messages.filter(m => m.role === 'system');
        }
        else {
            this.messages = [];
        }
    }
    /**
     * Cambia el modelo activo para los siguientes turnos de la sesión.
     */
    setModel(model) {
        this.model = model;
    }
}
exports.MorfSession = MorfSession;
//# sourceMappingURL=session.js.map