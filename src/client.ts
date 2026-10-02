import {
  MorfClientOptions,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelListResponse,
  GatewayStatsResponse,
} from './types';
import { parseEventStream, parseRunEvents } from './stream';
import { MorfSession, SessionOptions } from './session';

export class MorfError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'MorfError';
    this.status = status;
    this.data = data;
  }
}

export class MorfClient {
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;
  private customHeaders: Record<string, string>;
  private fetchImpl: typeof fetch;

  constructor(options?: MorfClientOptions) {
    // Lectura limpia de variables de entorno si están disponibles en Node
    const envApiKey = typeof process !== 'undefined' && process.env ? process.env.MORF_API_KEY : undefined;
    const envBaseUrl = typeof process !== 'undefined' && process.env ? process.env.MORF_BASE_URL : undefined;

    this.apiKey = options?.apiKey || envApiKey || '';
    this.baseUrl = (options?.baseUrl || envBaseUrl || 'https://morf.codes/api/morf').replace(/\/+$/, '');
    this.timeout = options?.timeout ?? 60000;
    this.customHeaders = options?.headers || {};
    this.fetchImpl = options?.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (undefined as any));

    if (!this.fetchImpl) {
      throw new MorfError('No se encontró una implementación global de fetch. En Node < 18 proporcione una función fetch.');
    }
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
      ...(init?.headers as Record<string, string> || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new MorfError(`La petición hacia ${url} excedió el tiempo límite de ${this.timeout}ms`, 408);
      }
      throw new MorfError(`Error de conexión con Morf Gateway: ${err.message || err}`);
    }
  }

  // --- Namespace Chat ---
  private async json(path: string, body?: unknown): Promise<any> {
    const response = await this.request(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new MorfError(data?.error?.message || data?.error?.code || `HTTP ${response.status}`, response.status, data);
    return data;
  }

  readonly memory = {
    snapshot: (morf: ChatCompletionOptions['morf'] = {}) => this.json('/memory/snapshot', { morf }),
    delete: (morf: ChatCompletionOptions['morf'] = {}) => this.json('/memory/delete', { morf }),
  };

  readonly capabilities = {
    list: () => this.json('/capabilities'),
    execute: (name: string, arguments_: Record<string, unknown>) => this.json('/capabilities/execute', { name, arguments: arguments_ }),
  };

  readonly runs = {
    create: (params: Omit<ChatCompletionOptions, 'stream'> & { max_agents?: number }) => this.json('/runs', params),
    get: (runId: string) => this.json(`/runs/${encodeURIComponent(runId)}`),
    cancel: (runId: string) => this.json(`/runs/${encodeURIComponent(runId)}/cancel`, {}),
    toolRequest: (runId: string, callId: string) => this.json(`/runs/${encodeURIComponent(runId)}/tools/${encodeURIComponent(callId)}`),
    toolResult: (runId: string, callId: string, result: { content: unknown; is_error?: boolean }) => this.json(`/runs/${encodeURIComponent(runId)}/tools/${encodeURIComponent(callId)}/result`, result),
    events: async (runId: string, after = 0): Promise<AsyncIterable<Record<string, any>>> => {
      const response = await this.request(`/runs/${encodeURIComponent(runId)}/events?after=${Math.max(0, after)}`);
      if (!response.ok || !response.body) throw new MorfError('No se pudo abrir el flujo de eventos', response.status);
      return parseRunEvents(response.body, this.timeout);
    },
    work: async (runId: string, executor: (name: string, args: Record<string, unknown>) => Promise<unknown>, onEvent?: (event: Record<string, any>) => void): Promise<void> => {
      const pending = new Set<Promise<void>>();
      let terminal: Record<string, any> | undefined;
      for await (const event of await this.runs.events(runId)) {
        onEvent?.(event);
        if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) terminal = event;
        if (event.type !== 'tool.requested') continue;
        const work = (async () => {
          const task = await this.runs.toolRequest(runId, event.call_id);
          let result: { content: unknown; is_error?: boolean };
          try { result = { content: await executor(task.tool_name, task.arguments) }; }
          catch (error: any) { result = { content: String(error?.message || error), is_error: true }; }
          await this.runs.toolResult(runId, event.call_id, result);
        })();
        pending.add(work);
        work.then(() => pending.delete(work), () => {});
      }
      await Promise.all(pending);
      if (terminal?.type !== 'run.completed') throw new MorfError(terminal?.error || 'El run no se completo', 502, terminal);
    },
  };

  readonly chat = {
    completions: {
      create: (async (params: ChatCompletionOptions): Promise<ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>> => {
        const payload = {
          model: params.model || 'morf-ai-auto',
          messages: params.messages,
          stream: Boolean(params.stream),
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          top_p: params.top_p,
          presence_penalty: params.presence_penalty,
          frequency_penalty: params.frequency_penalty,
          stop: params.stop,
          tools: params.tools,
          tool_choice: params.tool_choice,
          morf: params.morf,
          metadata: params.metadata,
          prompt_cache_key: params.prompt_cache_key,
          parallel_tool_calls: params.parallel_tool_calls,
        };

        const res = await this.request('/chat/completions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let errData: any;
          try {
            errData = await res.json();
          } catch {
            errData = await res.text();
          }
          const message = typeof errData === 'object' && errData?.error?.message
            ? errData.error.message
            : `Fallo en /chat/completions (HTTP ${res.status})`;
          throw new MorfError(message, res.status, errData);
        }

        if (params.stream) {
          if (!res.body) {
            throw new MorfError('La respuesta del servidor no tiene cuerpo legible para streaming', res.status);
          }
          return parseEventStream(res.body as unknown as ReadableStream<Uint8Array>, this.timeout);
        }

        return (await res.json()) as ChatCompletionResponse;
      }) as {
        (params: ChatCompletionOptions & { stream: true }): Promise<AsyncIterable<ChatCompletionChunk>>;
        (params: ChatCompletionOptions & { stream?: false }): Promise<ChatCompletionResponse>;
        (params: ChatCompletionOptions): Promise<ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>>;
      },
    },

    /**
     * Crea una nueva sesión conversacional multi-turno con retención de contexto.
     */
    createSession: (options?: SessionOptions): MorfSession => {
      return new MorfSession(this, options);
    },
  };

  // --- Namespace Models ---
  readonly models = {
    list: async (): Promise<ModelListResponse> => {
      const res = await this.request('/models', { method: 'GET' });
      if (!res.ok) {
        throw new MorfError(`Error al consultar modelos (HTTP ${res.status})`, res.status);
      }
      return (await res.json()) as ModelListResponse;
    },
  };

  // --- Namespace Stats & Cluster Health ---
  async stats(): Promise<GatewayStatsResponse> {
    const res = await this.request('/stats', { method: 'GET' });
    if (!res.ok) {
      throw new MorfError(`Error al consultar estadísticas (HTTP ${res.status})`, res.status);
    }
    return (await res.json()) as GatewayStatsResponse;
  }

  async health(): Promise<{ status: string; ok: boolean }> {
    try {
      const res = await this.request('/health', { method: 'GET' });
      return { status: res.statusText || 'OK', ok: res.ok };
    } catch (err: any) {
      return { status: err.message, ok: false };
    }
  }
}

// Alias para facilidad de importación
export { MorfClient as Morf };
