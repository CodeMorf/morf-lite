"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Morf = exports.MorfClient = exports.MorfError = void 0;
const stream_1 = require("./stream");
const session_1 = require("./session");
class MorfError extends Error {
    status;
    data;
    constructor(message, status, data) {
        super(message);
        this.name = 'MorfError';
        this.status = status;
        this.data = data;
    }
}
exports.MorfError = MorfError;
class MorfClient {
    apiKey;
    baseUrl;
    timeout;
    customHeaders;
    fetchImpl;
    constructor(options) {
        // Lectura limpia de variables de entorno si están disponibles en Node
        const envApiKey = typeof process !== 'undefined' && process.env ? process.env.MORF_API_KEY : undefined;
        const envBaseUrl = typeof process !== 'undefined' && process.env ? process.env.MORF_BASE_URL : undefined;
        this.apiKey = options?.apiKey || envApiKey || '';
        this.baseUrl = (options?.baseUrl || envBaseUrl || 'https://morf.codes/api/morf').replace(/\/+$/, '');
        this.timeout = options?.timeout ?? 60000;
        this.customHeaders = options?.headers || {};
        this.fetchImpl = options?.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
        if (!this.fetchImpl) {
            throw new MorfError('No se encontró una implementación global de fetch. En Node < 18 proporcione una función fetch.');
        }
    }
    async request(path, init) {
        const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = {
            'Content-Type': 'application/json',
            ...this.customHeaders,
            ...(init?.headers || {}),
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
        }
        catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new MorfError(`La petición hacia ${url} excedió el tiempo límite de ${this.timeout}ms`, 408);
            }
            throw new MorfError(`Error de conexión con Morf Gateway: ${err.message || err}`);
        }
    }
    // --- Namespace Chat ---
    async json(path, body) {
        const response = await this.request(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok)
            throw new MorfError(data?.error?.message || data?.error?.code || `HTTP ${response.status}`, response.status, data);
        return data;
    }
    memory = {
        snapshot: (morf = {}) => this.json('/memory/snapshot', { morf }),
        delete: (morf = {}) => this.json('/memory/delete', { morf }),
    };
    capabilities = {
        list: () => this.json('/capabilities'),
        execute: (name, arguments_) => this.json('/capabilities/execute', { name, arguments: arguments_ }),
    };
    runs = {
        create: (params) => this.json('/runs', params),
        get: (runId) => this.json(`/runs/${encodeURIComponent(runId)}`),
        cancel: (runId) => this.json(`/runs/${encodeURIComponent(runId)}/cancel`, {}),
        toolRequest: (runId, callId) => this.json(`/runs/${encodeURIComponent(runId)}/tools/${encodeURIComponent(callId)}`),
        toolResult: (runId, callId, result) => this.json(`/runs/${encodeURIComponent(runId)}/tools/${encodeURIComponent(callId)}/result`, result),
        events: async (runId, after = 0) => {
            const response = await this.request(`/runs/${encodeURIComponent(runId)}/events?after=${Math.max(0, after)}`);
            if (!response.ok || !response.body)
                throw new MorfError('No se pudo abrir el flujo de eventos', response.status);
            return (0, stream_1.parseRunEvents)(response.body, this.timeout);
        },
        work: async (runId, executor, onEvent) => {
            const pending = new Set();
            let terminal;
            for await (const event of await this.runs.events(runId)) {
                onEvent?.(event);
                if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type))
                    terminal = event;
                if (event.type !== 'tool.requested')
                    continue;
                const work = (async () => {
                    const task = await this.runs.toolRequest(runId, event.call_id);
                    let result;
                    try {
                        result = { content: await executor(task.tool_name, task.arguments) };
                    }
                    catch (error) {
                        result = { content: String(error?.message || error), is_error: true };
                    }
                    await this.runs.toolResult(runId, event.call_id, result);
                })();
                pending.add(work);
                work.then(() => pending.delete(work), () => { });
            }
            await Promise.all(pending);
            if (terminal?.type !== 'run.completed')
                throw new MorfError(terminal?.error || 'El run no se completo', 502, terminal);
        },
    };
    chat = {
        completions: {
            create: (async (params) => {
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
                    let errData;
                    try {
                        errData = await res.json();
                    }
                    catch {
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
                    return (0, stream_1.parseEventStream)(res.body, this.timeout);
                }
                return (await res.json());
            }),
        },
        /**
         * Crea una nueva sesión conversacional multi-turno con retención de contexto.
         */
        createSession: (options) => {
            return new session_1.MorfSession(this, options);
        },
    };
    // --- Namespace Models ---
    models = {
        list: async () => {
            const res = await this.request('/models', { method: 'GET' });
            if (!res.ok) {
                throw new MorfError(`Error al consultar modelos (HTTP ${res.status})`, res.status);
            }
            return (await res.json());
        },
    };
    // --- Namespace Stats & Cluster Health ---
    async stats() {
        const res = await this.request('/stats', { method: 'GET' });
        if (!res.ok) {
            throw new MorfError(`Error al consultar estadísticas (HTTP ${res.status})`, res.status);
        }
        return (await res.json());
    }
    async health() {
        try {
            const res = await this.request('/health', { method: 'GET' });
            return { status: res.statusText || 'OK', ok: res.ok };
        }
        catch (err) {
            return { status: err.message, ok: false };
        }
    }
}
exports.MorfClient = MorfClient;
exports.Morf = MorfClient;
//# sourceMappingURL=client.js.map