import { spawn } from 'node:child_process';
import path from 'node:path';

export class ProcessEngine {
    constructor(sandbox, configStore, serverDirectory) {
        this.sandbox = sandbox;
        this.configStore = configStore;
        this.serverDirectory = serverDirectory;
        this.isWindows = process.platform === 'win32';
        this.tasks = new Map(); // taskId -> { child, outputChunks, startedAt, isDaemon, exitCode, status }
    }

    /**
     * Execute shell command with safety timeout, UTF-8 fix, whitelist cwd, and background daemon support
     */
    async executeCommand({ command, args = [], cwd = null, timeout = null, shell = null, isDaemon = false, stdinInput = null }) {
        if (!command || typeof command !== 'string') {
            throw new Error('Command parameter is required');
        }

        // Check high-risk destructive commands
        const risk = this.sandbox.checkCommandRisk(command);
        if (risk.isHighRisk) {
            throw new Error(`Execution Blocked by Safety Guard: ${risk.reason}`);
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
        const taskId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const fullArgs = Array.isArray(args) ? args.filter(a => typeof a === 'string') : [];
        let child;

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

        const taskRecord = {
            taskId,
            command,
            cwd: workingDir,
            child,
            stdoutChunks: [],
            stderrChunks: [],
            totalBytes: 0,
            startedAt: new Date().toISOString(),
            status: 'running',
            isDaemon,
            exitCode: null,
        };
        this.tasks.set(taskId, taskRecord);

        child.stdout.on('data', (chunk) => {
            if (taskRecord.totalBytes < maxBytes) {
                taskRecord.stdoutChunks.push(chunk.toString('utf-8'));
                taskRecord.totalBytes += chunk.length;
            }
        });

        child.stderr.on('data', (chunk) => {
            if (taskRecord.totalBytes < maxBytes) {
                taskRecord.stderrChunks.push(chunk.toString('utf-8'));
                taskRecord.totalBytes += chunk.length;
            }
        });

        child.on('close', (code) => {
            taskRecord.status = code === 0 ? 'completed' : 'failed';
            taskRecord.exitCode = code;
        });

        child.on('error', (err) => {
            taskRecord.status = 'error';
            taskRecord.error = err.message;
        });

        if (stdinInput && typeof stdinInput === 'string' && child.stdin) {
            child.stdin.write(stdinInput);
            child.stdin.end();
        }

        // If daemon / background process, return immediately
        if (isDaemon) {
            return {
                taskId,
                status: 'running_background',
                command,
                cwd: workingDir,
                message: `Command launched in background as task [${taskId}]. Use manage_task or status to monitor.`,
            };
        }

        // Synchronous execution wait with timeout
        return new Promise((resolve) => {
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                taskRecord.status = 'timed_out';
                try {
                    child.kill('SIGTERM');
                } catch (e) {}
            }, execTimeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                const stdoutStr = taskRecord.stdoutChunks.join('');
                const stderrStr = taskRecord.stderrChunks.join('');
                let combined = stdoutStr;
                if (stderrStr) {
                    combined += (combined ? '\n[STDERR]\n' : '') + stderrStr;
                }

                resolve({
                    taskId,
                    exitCode: code,
                    output: combined || (code === 0 ? '(Process completed with no output)' : `(Process exited with code ${code})`),
                    stdout: stdoutStr,
                    stderr: stderrStr,
                    timedOut,
                    truncated: taskRecord.totalBytes >= maxBytes,
                    cwd: workingDir,
                });
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    taskId,
                    exitCode: 1,
                    output: `Process execution error: ${err.message}`,
                    stdout: '',
                    stderr: err.message,
                    timedOut: false,
                    truncated: false,
                    cwd: workingDir,
                });
            });
        });
    }

    /**
     * Get task status and output
     */
    getTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        return {
            taskId: task.taskId,
            command: task.command,
            cwd: task.cwd,
            status: task.status,
            startedAt: task.startedAt,
            exitCode: task.exitCode,
            stdout: task.stdoutChunks.join(''),
            stderr: task.stderrChunks.join(''),
        };
    }

    /**
     * Terminate running process task
     */
    killTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        if (task.child && task.status === 'running') {
            try {
                task.child.kill('SIGKILL');
                task.status = 'killed';
                return { success: true, message: `Task [${taskId}] terminated.` };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return { success: true, message: `Task [${taskId}] is not running (status: ${task.status}).` };
    }

    listTasks() {
        return Array.from(this.tasks.values()).map(t => ({
            taskId: t.taskId,
            command: t.command,
            cwd: t.cwd,
            status: t.status,
            startedAt: t.startedAt,
            exitCode: t.exitCode,
        }));
    }
}
