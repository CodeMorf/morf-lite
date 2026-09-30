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