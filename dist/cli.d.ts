/** Node-only worker: CLIs run on the customer's host in an explicit project. */
export type CliName = 'codex' | 'claude' | 'grok' | 'opencode';
export interface CliExecutorOptions {
    workingDirectory: string;
    apiKey: string;
    baseUrl?: string;
    executables: Partial<Record<CliName, string>>;
    timeoutMs?: number;
    allowWrite?: boolean;
    onOutput?: (cli: CliName, text: string) => void;
}
export declare function createCliExecutor(options: CliExecutorOptions): {
    executor: {
        type: "client";
        working_directory: string;
        timeout_seconds: number;
        tools: {
            type: "function";
            function: {
                name: string;
                description: string;
                parameters: {
                    type: string;
                    properties: {
                        cli: {
                            type: string;
                            enum: CliName[];
                        };
                        prompt: {
                            type: string;
                        };
                    };
                    required: string[];
                    additionalProperties: boolean;
                };
            };
        }[];
    };
    execute(name: string, arguments_: Record<string, unknown>): Promise<string>;
};
//# sourceMappingURL=cli.d.ts.map