export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
export interface ChatMessage {
    role: ChatRole;
    content: string | any[];
    name?: string;
    tool_call_id?: string;
    tool_calls?: any[];
}
export interface MorfMetadata {
    display?: string;
    provider?: string;
    category?: 'simple' | 'code' | 'complex' | 'vision' | string;
    ttfbMs?: number;
    model?: string;
}
export interface ChatCompletionOptions {
    model?: string;
    messages: ChatMessage[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    stop?: string | string[];
    tools?: any[];
    tool_choice?: any;
    morf?: {
        conversation_id?: string;
        request_id?: string;
        progress?: boolean;
        memory?: boolean | {
            enabled?: boolean;
            scope?: 'project' | 'conversation';
            version?: number;
        };
        routing?: Record<string, unknown>;
        media?: boolean | {
            kind?: 'image' | 'video';
            duration?: number;
            max_cost_usd?: number;
        };
        executor?: {
            type: 'client';
            working_directory: string;
            tools: any[];
            timeout_seconds?: number;
        };
    };
    metadata?: Record<string, string>;
    prompt_cache_key?: string;
    parallel_tool_calls?: boolean;
}
export interface ChatCompletionChoice {
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    _morf?: MorfMetadata;
}
export interface ChatCompletionChunkChoice {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
}
export interface ChatCompletionChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChunkChoice[];
    _morf?: MorfMetadata;
}
export interface MorfClientOptions {
    /**
     * Clave API de Morf AI (Master key o API Key de cliente).
     * Si no se proporciona, se buscará en process.env.MORF_API_KEY.
     */
    apiKey?: string;
    /**
     * URL base del Gateway o proxy.
     * Por defecto: "https://morf.codes/api/morf" o process.env.MORF_BASE_URL.
     */
    baseUrl?: string;
    /**
     * Timeout en milisegundos para las peticiones (por defecto: 60000ms = 60s).
     */
    timeout?: number;
    /**
     * Headers adicionales personalizados.
     */
    headers?: Record<string, string>;
    /**
     * Implementación de fetch personalizada (opcional).
     */
    fetch?: typeof fetch;
}
export interface ModelItem {
    id: string;
    name?: string;
    display?: string;
    provider?: string;
    category?: string;
    context_length?: number;
    vision?: boolean;
    pricing?: {
        prompt?: number;
        completion?: number;
    };
}
export interface ModelListResponse {
    object: 'list';
    data: ModelItem[];
}
export interface GatewayStats {
    requests: number;
    spend: number;
    saved: number;
    tokens_in: number;
    tokens_out: number;
    errors?: number;
    cached?: number;
    by_provider?: Record<string, any>;
}
export interface GatewayStatsResponse {
    stats: GatewayStats;
}
//# sourceMappingURL=types.d.ts.map