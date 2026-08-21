import { spawn } from 'node:child_process';
import path from 'node:path';

export class ProcessEngine {
    constructor(sandbox, configStore, serverDirectory) {
        this.sandbox = sandbox;
        this.configStore = configStore;
        this.serverDirectory = serverDirectory;
        this.isWindows = process.platform === 'win32';
    }

    /**
     * Execute shell command with safety timeout, UTF-8 fix, and whitelist cwd
     */
    async executeCommand({ command, args = [], cwd = null, timeout = null, shell = null }) {
        if (!command || typeof command !== 'string') {
            throw new Error('Command parameter is required');
        }

        // Validate working directory
        let workingDir = this.serverDirectory;
        if (cwd) {
            const check = this.sandbox.validatePath(cwd);
            if (!check.valid) {
                throw new Error(`Invalid working directory: ${check.error}`);
            }
            workingDir = check.resolvedPath;
        }

        const secConfig = this.configStore.getSecurityConfig();
        const maxBytes = secConfig.maxOutputSize || 512 * 1024;
        const execTimeout = parseInt(timeout) || secConfig.defaultTimeout || 30000;

        return new Promise((resolve) => {
            const stdoutChunks = [];
            const stderrChunks = [];
            let totalBytes = 0;
            let timedOut = false;
            let child;

            const fullArgs = Array.isArray(args) ? args.filter(a => typeof a === 'string') : [];

            if (this.isWindows) {
                const requestedShell = (shell || 'powershell').toLowerCase();
                if (requestedShell === 'cmd') {
                    const fullCmd = fullArgs.length > 0 ? `${command} ${fullArgs.join(' ')}` : command;
                    child = spawn('cmd.exe', ['/c', fullCmd], {
                        cwd: workingDir,
                        windowsHide: true,
                        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
                    });
                } else {
                    // PowerShell with UTF-8 encoding fix
                    const fullCmd = fullArgs.length > 0 ? `${command} ${fullArgs.join(' ')}` : command;
                    const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; ${fullCmd}`;
                    child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], {
                        cwd: workingDir,
                        windowsHide: true,
                        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
                    });
                }
            } else {
                const fullCmd = fullArgs.length > 0 ? `${command} ${fullArgs.join(' ')}` : command;
                child = spawn('bash', ['-c', fullCmd], {
                    cwd: workingDir,
                    windowsHide: true,
                    env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
                });
            }

            const timer = setTimeout(() => {
                timedOut = true;
                try {
                    child.kill('SIGTERM');
                } catch (e) {
                    // Ignore kill error
                }
            }, execTimeout);

            child.stdout.on('data', (chunk) => {
                if (totalBytes < maxBytes) {
                    const str = chunk.toString('utf-8');
                    stdoutChunks.push(str);
                    totalBytes += chunk.length;
                }
            });

            child.stderr.on('data', (chunk) => {
                if (totalBytes < maxBytes) {
                    const str = chunk.toString('utf-8');
                    stderrChunks.push(str);
                    totalBytes += chunk.length;
                }
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    exitCode: 1,
                    output: `Process execution error: ${err.message}`,
                    stdout: '',
                    stderr: err.message,
                    timedOut: false,
                    truncated: false,
                    cwd: workingDir,
                });
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                const stdoutStr = stdoutChunks.join('');
                const stderrStr = stderrChunks.join('');
                let combined = stdoutStr;
                if (stderrStr) {
                    combined += (combined ? '\n[STDERR]\n' : '') + stderrStr;
                }

                resolve({
                    exitCode: code,
                    output: combined || (code === 0 ? '(Process completed with no output)' : `(Process exited with code ${code})`),
                    stdout: stdoutStr,
                    stderr: stderrStr,
                    timedOut,
                    truncated: totalBytes >= maxBytes,
                    cwd: workingDir,
                });
            });
        });
    }
}
