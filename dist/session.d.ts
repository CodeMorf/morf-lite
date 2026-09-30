import { ChatMessage, ChatCompletionOptions, ChatRole, MorfMetadata } from './types';
import type { MorfClient } from './client';
export interface SessionOptions {
    model?: string;
    systemPrompt?: string;
    max_tokens?: number;
    temperature?: number;
    initialMessages?: ChatMessage[];
}
export interface SessionResponse {
    content: string;
    metadata?: MorfMetadata;
}
/**
 * Gestor de sesiones conversacionales multi-turno.
 * Mantiene el historial en memoria para garantizar que el modelo
 * conserve el contexto completo turno tras turno.
 */
export declare class MorfSession {
    private client;
    private model;
    private messages;
    private defaultOptions;
    constructor(client: MorfClient, options?: SessionOptions);
    /**
     * Envía un mensaje y recibe la respuesta del asistente acumulando el contexto.
     */
    sendMessage(text: string, options?: Partial<ChatCompletionOptions>): Promise<SessionResponse>;
    /**
     * Envía un mensaje y transmite la respuesta en streaming acumulando el contexto al finalizar.
     */
    sendMessageStream(text: string, options?: Partial<ChatCompletionOptions>): AsyncGenerator<{
        delta: string;
        metadata?: MorfMetadata;
    }, void, unknown>;
    /**
     * Agrega un mensaje arbitrario al historial.
     */
    addMessage(role: ChatRole, content: string | any[]): void;
    /**
     * Obtiene una copia del historial actual.
     */
    getHistory(): ChatMessage[];
    /**
     * Limpia el historial conservando opcionalmente el system prompt.
     */
    clear(keepSystemPrompt?: boolean): void;
    /**
     * Cambia el modelo activo para los siguientes turnos de la sesión.
     */
    setModel(model: string): void;
}
//# sourceMappingURL=session.d.ts.map