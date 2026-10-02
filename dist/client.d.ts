import { MorfClientOptions, ChatCompletionOptions, ChatCompletionResponse, ChatCompletionChunk, ModelListResponse, GatewayStatsResponse } from './types';
import { MorfSession, SessionOptions } from './session';
export declare class MorfError extends Error {
    status?: number;
    data?: any;
    constructor(message: string, status?: number, data?: any);
}
export declare class MorfClient {
    private apiKey?;
    private baseUrl;
    private timeout;
    private customHeaders;
    private fetchImpl;
    constructor(options?: MorfClientOptions);
    private request;
    private json;
    readonly memory: {
        snapshot: (morf?: ChatCompletionOptions["morf"]) => Promise<any>;
        delete: (morf?: ChatCompletionOptions["morf"]) => Promise<any>;
    };
    readonly capabilities: {
        list: () => Promise<any>;
        execute: (name: string, arguments_: Record<string, unknown>) => Promise<any>;
    };
    readonly runs: {
        create: (params: Omit<ChatCompletionOptions, "stream"> & {
            max_agents?: number;
        }) => Promise<any>;
        get: (runId: string) => Promise<any>;
        cancel: (runId: string) => Promise<any>;
        toolRequest: (runId: string, callId: string) => Promise<any>;
        toolResult: (runId: string, callId: string, result: {
            content: unknown;
            is_error?: boolean;
        }) => Promise<any>;
        events: (runId: string, after?: number) => Promise<AsyncIterable<Record<string, any>>>;
        work: (runId: string, executor: (name: string, args: Record<string, unknown>) => Promise<unknown>, onEvent?: (event: Record<string, any>) => void) => Promise<void>;
    };
    readonly chat: {
        completions: {
            create: {
                (params: ChatCompletionOptions & {
                    stream: true;
                }): Promise<AsyncIterable<ChatCompletionChunk>>;
                (params: ChatCompletionOptions & {
                    stream?: false;
                }): Promise<ChatCompletionResponse>;
                (params: ChatCompletionOptions): Promise<ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>>;
            };
        };
        /**
         * Crea una nueva sesión conversacional multi-turno con retención de contexto.
         */
        createSession: (options?: SessionOptions) => MorfSession;
    };
    readonly models: {
        list: () => Promise<ModelListResponse>;
    };
    stats(): Promise<GatewayStatsResponse>;
    health(): Promise<{
        status: string;
        ok: boolean;
    }>;
}
export { MorfClient as Morf };
//# sourceMappingURL=client.d.ts.map