export function createToolDefinitions(apiPrefix, getHeaders, logCallback) {
    const callApi = async (endpoint, payload) => {
        const startTime = Date.now();
        try {
            const response = await fetch(`${apiPrefix}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(getHeaders ? getHeaders() : {}),
                },
                body: JSON.stringify(payload || {}),
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
                if (logCallback) logCallback(endpoint, payload, errorMsg, duration, false);
                throw new Error(errorMsg);
            }

            if (logCallback) logCallback(endpoint, payload, data, duration, true);
            return data;
        } catch (err) {
            const duration = Date.now() - startTime;
            if (logCallback) logCallback(endpoint, payload, err.message, duration, false);
            throw err;
        }
    };

    return [
        // 1. READ
        {
            name: 'read_file',
            displayName: 'Read File',
            description: 'Reads content from a file within allowed directories. Supports line offset, limit, and line numbers.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to read (absolute or relative)' },
                    offset: { type: 'number', description: '1-based line number to start reading from' },
                    limit: { type: 'number', description: 'Maximum number of lines to read' },
                    showLineNumbers: { type: 'boolean', description: 'Whether to prefix each line with its line number' },
                },
                required: ['filePath'],
            },
            action: async (args) => {
                const res = await callApi('/read', args);
                return typeof res.content === 'string' ? res.content : JSON.stringify(res, null, 2);
            },
            formatMessage: (args) => `Reading file: ${args.filePath}`,
        },

        // 2. WRITE
        {
            name: 'write_file',
            displayName: 'Write File',
            description: 'Creates or overwrites a file with content atomically. Automatically creates parent directories.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to write' },
                    content: { type: 'string', description: 'Content to write to the file' },
                },
                required: ['filePath', 'content'],
            },
            action: async (args) => {
                const res = await callApi('/write', args);
                return `File written successfully (${res.bytesWritten} bytes written).`;
            },
            formatMessage: (args) => `Writing file: ${args.filePath}`,
        },

        // 3. EDIT
        {
            name: 'edit_file',
            displayName: 'Edit File',
            description: 'Replaces exact target text in a file with new text using intelligent whitespace-tolerant fuzzy matching.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to edit' },
                    oldText: { type: 'string', description: 'Exact string or code snippet to find and replace' },
                    newText: { type: 'string', description: 'New string or code snippet to insert in place of oldText' },
                },
                required: ['filePath', 'oldText', 'newText'],
            },
            action: async (args) => {
                const res = await callApi('/edit', args);
                return `File edited successfully (${res.replacedCount} replacement(s) made).`;
            },
            formatMessage: (args) => `Editing file: ${args.filePath}`,
        },

        // 4. BASH
        {
            name: 'execute_bash',
            displayName: 'Execute Command',
            description: 'Executes shell / PowerShell commands on the host. Automatically configured with UTF-8 encoding on Windows.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Shell / PowerShell command to execute' },
                    cwd: { type: 'string', description: 'Working directory (must be inside allowed whitelist directories)' },
                    timeout: { type: 'number', description: 'Execution timeout in milliseconds (default: 30000)' },
                },
                required: ['command'],
            },
            action: async (args) => {
                const res = await callApi('/bash', args);
                let out = res.output || '';
                if (res.exitCode !== 0) out += `\n[Process exited with code ${res.exitCode}]`;
                if (res.timedOut) out += '\n[Process timed out]';
                if (res.truncated) out += '\n[Output truncated due to size limit]';
                return out;
            },
            formatMessage: (args) => `Executing command: ${args.command}`,
        },
    ];
}
