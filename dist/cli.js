"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCliExecutor = createCliExecutor;
function createCliExecutor(options) {
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const { spawn } = require('node:child_process');
    const cwd = fs.realpathSync(options.workingDirectory);
    if (!fs.statSync(cwd).isDirectory())
        throw new Error('workingDirectory must be a directory');
    const names = Object.keys(options.executables);
    if (!names.length || names.some(name => !['codex', 'claude', 'grok', 'opencode'].includes(name)))
        throw new Error('Select an installed CLI');
    const base = (options.baseUrl || 'https://morf.codes/api/morf').replace(/\/+$/, '');
    const timeout = Math.min(170000, Math.max(1000, options.timeoutMs ?? 120000));
    const tools = [{ type: 'function', function: {
                name: 'run_cli', description: 'Hand off a bounded project task to an installed coding CLI. Include previous agent findings in the prompt. Returns actual process output.',
                parameters: { type: 'object', properties: { cli: { type: 'string', enum: names }, prompt: { type: 'string' } }, required: ['cli', 'prompt'], additionalProperties: false },
            } }];
    return {
        executor: { type: 'client', working_directory: cwd, timeout_seconds: Math.ceil(timeout / 1000) + 5, tools },
        async execute(name, arguments_) {
            if (name !== 'run_cli')
                throw new Error('Unknown CLI worker tool');
            const cli = arguments_.cli;
            const executable = options.executables[cli];
            if (!executable || !names.includes(cli))
                throw new Error('CLI was not authorized');
            const prompt = String(arguments_.prompt || '');
            if (!prompt.trim() || prompt.length > 30000)
                throw new Error('Invalid CLI prompt');
            const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'morf-cli-'));
            const env = { ...process.env, MORF_API_KEY: options.apiKey };
            let args;
            let stdin = '';
            if (cli === 'codex') {
                args = ['-a', 'never', 'exec', '--skip-git-repo-check', '--json', '--sandbox', options.allowWrite ? 'workspace-write' : 'read-only',
                    '--model', 'morf-ai-auto', '-c', 'model_provider="morf"', '-c', 'model_providers.morf.name="Morf Ultra AI"',
                    '-c', `model_providers.morf.base_url=${JSON.stringify(base)}`, '-c', 'model_providers.morf.wire_api="responses"',
                    '-c', 'model_providers.morf.env_key="MORF_API_KEY"', '-'];
                stdin = prompt;
            }
            else if (cli === 'claude') {
                Object.assign(env, { ANTHROPIC_BASE_URL: base.replace(/\/v1$/, ''), ANTHROPIC_AUTH_TOKEN: options.apiKey, ANTHROPIC_API_KEY: options.apiKey,
                    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'morf-ai-auto', ANTHROPIC_DEFAULT_SONNET_MODEL: 'morf-ai-auto', ANTHROPIC_DEFAULT_OPUS_MODEL: 'morf-ai-auto' });
                const allowed = options.allowWrite ? 'Read,Glob,Grep,Edit,Write' : 'Read,Glob,Grep';
                args = ['-p', prompt, '--model', 'morf-ai-auto', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk',
                    '--tools', allowed, '--allowedTools', allowed, '--max-turns', '4', '--no-session-persistence'];
            }
            else if (cli === 'grok') {
                env.GROK_HOME = temp;
                fs.writeFileSync(path.join(temp, 'config.toml'), `[model.morf]\nmodel="morf-ai-auto"\nbase_url=${JSON.stringify(base)}\nenv_key="MORF_API_KEY"\napi_backend="chat_completions"\ncontext_window=60000\n`, { mode: 0o600 });
                const promptFile = path.join(temp, 'prompt.txt');
                fs.writeFileSync(promptFile, prompt, { mode: 0o600 });
                args = ['--prompt-file', promptFile, '-m', 'morf', '--cwd', cwd, '--permission-mode', 'dontAsk', '--no-subagents', '--no-plan', '--max-turns', '4', '--output-format', 'streaming-json'];
                args.push('--allow', 'Read', '--allow', 'Grep');
                if (!options.allowWrite)
                    args.push('--disallowed-tools', 'write_file,search_replace,run_terminal_cmd');
            }
            else {
                env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ enabled_providers: ['morf'], model: 'morf/morf-ai-auto',
                    permission: { '*': 'deny', read: 'allow', glob: 'allow', grep: 'allow', ...(options.allowWrite ? { edit: 'allow' } : {}) },
                    provider: { morf: { npm: '@ai-sdk/openai-compatible', name: 'Morf Ultra AI', options: { baseURL: base, apiKey: '{env:MORF_API_KEY}' },
                            models: { 'morf-ai-auto': { name: 'Morf Ultra AI', limit: { context: 60000, output: 8192 } } } } } });
                args = ['run', '--format', 'json', '--model', 'morf/morf-ai-auto', prompt];
            }
            try {
                return await new Promise((resolve, reject) => {
                    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
                    let output = '', stderr = '', stopped = false;
                    const timer = setTimeout(() => { stopped = true; child.kill(); }, timeout);
                    child.stdout.on('data', (chunk) => {
                        const text = chunk.toString('utf8');
                        output += text;
                        // Stream chunks can split a credential. Redact only after assembling
                        // complete output; callbacks receive status rather than raw secrets.
                        options.onOutput?.(cli, `Received ${chunk.length} bytes`);
                        if (output.length > 100000) {
                            stopped = true;
                            child.kill();
                        }
                    });
                    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-6000); });
                    child.on('error', error => { clearTimeout(timer); reject(error); });
                    child.on('close', code => {
                        clearTimeout(timer);
                        const clean = (value) => value.split(options.apiKey).join('[REDACTED]');
                        if (stopped)
                            reject(new Error('CLI exceeded its time or output budget'));
                        else if (code !== 0)
                            reject(new Error(clean(`CLI failed (${code}): ${stderr || output.slice(-3000)}`)));
                        else if (!output.trim())
                            reject(new Error('CLI returned no output'));
                        else
                            resolve(clean(output));
                    });
                    child.stdin.end(stdin);
                });
            }
            finally {
                fs.rmSync(temp, { recursive: true, force: true });
            }
        },
    };
}
//# sourceMappingURL=cli.js.map