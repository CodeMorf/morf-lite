import { ChatMessage, ChatCompletionOptions, ChatRole, MorfMetadata, ChatCompletionResponse, ChatCompletionChunk } from './types';
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
export class MorfSession {
  private client: MorfClient;
  private model: string;
  private messages: ChatMessage[] = [];
  private defaultOptions: Partial<ChatCompletionOptions>;

  constructor(client: MorfClient, options?: SessionOptions) {
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
  async sendMessage(text: string, options?: Partial<ChatCompletionOptions>): Promise<SessionResponse> {
    this.messages.push({ role: 'user', content: text });

    const completion = (await this.client.chat.completions.create({
      model: options?.model || this.model,
      messages: this.messages,
      stream: false,
      ...this.defaultOptions,
      ...options,
    })) as ChatCompletionResponse;

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
  async *sendMessageStream(
    text: string,
    options?: Partial<ChatCompletionOptions>
  ): AsyncGenerator<{ delta: string; metadata?: MorfMetadata }, void, unknown> {
    this.messages.push({ role: 'user', content: text });

    const stream = (await this.client.chat.completions.create({
      model: options?.model || this.model,
      messages: this.messages,
      stream: true,
      ...this.defaultOptions,
      ...options,
    })) as AsyncIterable<ChatCompletionChunk>;

    let fullReply = '';
    let meta: MorfMetadata | undefined;

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
  addMessage(role: ChatRole, content: string | any[]): void {
    this.messages.push({ role, content });
  }

  /**
   * Obtiene una copia del historial actual.
   */
  getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Limpia el historial conservando opcionalmente el system prompt.
   */
  clear(keepSystemPrompt: boolean = true): void {
    if (keepSystemPrompt) {
      this.messages = this.messages.filter(m => m.role === 'system');
    } else {
      this.messages = [];
    }
  }

  /**
   * Cambia el modelo activo para los siguientes turnos de la sesión.
   */
  setModel(model: string): void {
    this.model = model;
  }
}
