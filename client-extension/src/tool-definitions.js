export function createToolDefinitions(apiPrefix, getHeaders, logCallback, configProvider) {
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
        // ================= 1. FILE OPERATIONS =================
        {
            name: 'read_file',
            displayName: 'Read File',
            description: 'Reads content from a file within allowed directories. Supports line offset, limit, line numbers, and encoding detection.',
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
        {
            name: 'write_file',
            displayName: 'Write File',
            description: 'Writes or overwrites content to a file atomically. Automatically creates parent directories and backup snapshot.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to write' },
                    content: { type: 'string', description: 'Text content to write to the file' },
                    createBackup: { type: 'boolean', description: 'Whether to create a backup file if target exists (default: true)' },
                },
                required: ['filePath', 'content'],
            },
            action: async (args) => {
                const res = await callApi('/write', args);
                return `File written successfully (${res.bytesWritten} bytes written). Backup created: ${res.backupCreated}`;
            },
            formatMessage: (args) => `Writing file: ${args.filePath}`,
        },
        {
            name: 'edit_file',
            displayName: 'Edit File',
            description: 'Replaces target text within a file using intelligent fuzzy matching and whitespace tolerance. Validates match count to prevent accidental replacement.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to edit' },
                    oldText: { type: 'string', description: 'Exact string or code block to find and replace' },
                    newText: { type: 'string', description: 'New string or code block to insert in place of oldText' },
                    expectedReplacements: { type: 'number', description: 'Expected number of occurrences to replace (default: 1)' },
                },
                required: ['filePath', 'oldText', 'newText'],
            },
            action: async (args) => {
                const res = await callApi('/edit', args);
                return `File edited successfully (${res.replacedCount} replacement(s) made using ${res.strategy} strategy, confidence: ${res.confidence}).`;
            },
            formatMessage: (args) => `Editing file: ${args.filePath}`,
        },
        {
            name: 'patch_file',
            displayName: 'Patch File',
            description: 'Applies multiple targeted chunk replacements or a unified diff to a file in a single atomic operation.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file to patch' },
                    patches: {
                        type: 'array',
                        description: 'List of patch chunks to apply in sequence',
                        items: {
                            type: 'object',
                            properties: {
                                oldText: { type: 'string', description: 'Exact code/text block to replace' },
                                newText: { type: 'string', description: 'Replacement code/text block' },
                            },
                            required: ['oldText', 'newText'],
                        },
                    },
                    diff: { type: 'string', description: 'Optional Unified Diff string (starting with @@ -line,count +line,count @@)' },
                },
                required: ['filePath'],
            },
            action: async (args) => {
                const res = await callApi('/patch', args);
                return `File patched successfully (${res.patchesApplied || 1} patch(es) applied).`;
            },
            formatMessage: (args) => `Patching file: ${args.filePath}`,
        },
        {
            name: 'copy_file',
            displayName: 'Copy File',
            description: 'Copies a file or entire directory to a new location within allowed directories.',
            parameters: {
                type: 'object',
                properties: {
                    sourcePath: { type: 'string', description: 'Path to the source file or directory' },
                    destinationPath: { type: 'string', description: 'Path to the destination' },
                    overwrite: { type: 'boolean', description: 'Whether to overwrite destination if it exists (default: true)' },
                },
                required: ['sourcePath', 'destinationPath'],
            },
            action: async (args) => {
                const res = await callApi('/copy', args);
                return `Copied from ${res.from} to ${res.to}`;
            },
            formatMessage: (args) => `Copying: ${args.sourcePath} -> ${args.destinationPath}`,
        },
        {
            name: 'move_file',
            displayName: 'Move File',
            description: 'Moves or renames a file or directory within allowed directories.',
            parameters: {
                type: 'object',
                properties: {
                    sourcePath: { type: 'string', description: 'Path to the source file or directory' },
                    destinationPath: { type: 'string', description: 'Destination path' },
                    overwrite: { type: 'boolean', description: 'Whether to overwrite destination if it exists (default: true)' },
                },
                required: ['sourcePath', 'destinationPath'],
            },
            action: async (args) => {
                const res = await callApi('/move', args);
                return `Moved from ${res.from} to ${res.to}`;
            },
            formatMessage: (args) => `Moving: ${args.sourcePath} -> ${args.destinationPath}`,
        },
        {
            name: 'delete_file',
            displayName: 'Delete File',
            description: 'Deletes a file or directory. By default safely moves to .trash folder for recovery.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Path to the file or directory to delete' },
                    permanent: { type: 'boolean', description: 'Set true to permanently delete (cannot be undone)' },
                },
                required: ['filePath'],
            },
            action: async (args) => {
                const res = await callApi('/delete', args);
                if (res.permanent) {
                    return `Permanently deleted: ${res.filePath}`;
                }
                return `Safely moved to trash: ${res.originalPath} (Trash ID: ${res.trashId}). Can be restored using restore_file.`;
            },
            formatMessage: (args) => `Deleting: ${args.filePath}${args.permanent ? ' (permanent)' : ''}`,
        },
        {
            name: 'restore_file',
            displayName: 'Restore File',
            description: 'Restores a previously trashed file or folder from the .trash directory back to its original location.',
            parameters: {
                type: 'object',
                properties: {
                    identifier: { type: 'string', description: 'The trash ID or original path of the trashed item' },
                },
                required: ['identifier'],
            },
            action: async (args) => {
                const res = await callApi('/restore', args);
                return `Restored file to: ${res.restoredPath}`;
            },
            formatMessage: (args) => `Restoring trashed item: ${args.identifier}`,
        },

        // ================= 2. SEARCH & DISCOVERY =================
        {
            name: 'list_directory',
            displayName: 'List Directory',
            description: 'Lists files and folders in a directory with size, type, modified time, and depth limit.',
            parameters: {
                type: 'object',
                properties: {
                    dirPath: { type: 'string', description: 'Directory path to list (default: .)' },
                    depth: { type: 'number', description: 'Depth of directory traversal (default: 1)' },
                    recursive: { type: 'boolean', description: 'Whether to list subdirectories recursively (default: false)' },
                    includeHidden: { type: 'boolean', description: 'Whether to include hidden files (starting with .)' },
                },
            },
            action: async (args) => {
                const res = await callApi('/list_directory', args);
                return JSON.stringify(res, null, 2);
            },
            formatMessage: (args) => `Listing directory: ${args.dirPath || '.'}`,
        },
        {
            name: 'search_files',
            displayName: 'Search Files',
            description: 'High-speed ripgrep-style search for text or regex patterns across files in a directory, returning matched lines and line numbers.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Text or regex pattern to search for' },
                    path: { type: 'string', description: 'Root directory to search within (default: .)' },
                    pattern: { type: 'string', description: 'File name glob filter (e.g. *.js, *.py)' },
                    isRegex: { type: 'boolean', description: 'Whether query is a regular expression (default: false)' },
                    caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default: false)' },
                    maxResults: { type: 'number', description: 'Maximum matching files to return (default: 50)' },
                },
                required: ['query'],
            },
            action: async (args) => {
                const res = await callApi('/search_files', args);
                return JSON.stringify(res, null, 2);
            },
            formatMessage: (args) => `Searching files for: "${args.query}"`,
        },
        {
            name: 'find_by_name',
            displayName: 'Find By Name',
            description: 'Finds files or directories matching a glob pattern (e.g. "*.json", "test_*").',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Glob pattern to search for (e.g. *.ts, *.json)' },
                    path: { type: 'string', description: 'Starting directory path (default: .)' },
                    type: { type: 'string', enum: ['file', 'directory', 'any'], description: 'Filter by item type (default: any)' },
                    maxDepth: { type: 'number', description: 'Maximum scan depth (default: 10)' },
                },
                required: ['pattern'],
            },
            action: async (args) => {
                const res = await callApi('/find_by_name', args);
                return JSON.stringify(res, null, 2);
            },
            formatMessage: (args) => `Finding files matching pattern: ${args.pattern}`,
        },

        // ================= 3. COMMAND & PROCESS =================
        {
            name: 'execute_bash',
            displayName: 'Execute Command',
            description: 'Executes shell/PowerShell commands on the host. Automatically handles UTF-8 encoding on Windows and supports background daemon execution.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Command to execute' },
                    args: { type: 'array', items: { type: 'string' }, description: 'Command arguments array' },
                    cwd: { type: 'string', description: 'Working directory (must be inside allowed whitelist directories)' },
                    timeout: { type: 'number', description: 'Execution timeout in milliseconds (default: 30000)' },
                    shell: { type: 'string', enum: ['powershell', 'cmd', 'bash'], description: 'Specific shell to use' },
                    isDaemon: { type: 'boolean', description: 'Set true to run in background as a task without waiting' },
                },
                required: ['command'],
            },
            action: async (args) => {
                const res = await callApi('/bash', args);
                if (res.status === 'running_background') {
                    return res.message;
                }
                let out = res.output || '';
                if (res.exitCode !== 0) out += `\n[Process exited with code ${res.exitCode}]`;
                if (res.timedOut) out += '\n[Process timed out]';
                if (res.truncated) out += '\n[Output truncated due to size limit]';
                return out;
            },
            formatMessage: (args) => `Executing command: ${args.command}`,
        },
        {
            name: 'manage_task',
            displayName: 'Manage Task',
            description: 'Manages background process tasks (status, kill, list).',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['list', 'status', 'kill'], description: 'Action to perform' },
                    taskId: { type: 'string', description: 'Task ID (required for status and kill)' },
                },
                required: ['action'],
            },
            action: async (args) => {
                if (args.action === 'list') {
                    const res = await fetch(`${apiPrefix}/tasks`, {
                        headers: getHeaders ? getHeaders() : {},
                    });
                    const list = await res.json();
                    return JSON.stringify(list, null, 2);
                } else if (args.action === 'kill') {
                    const res = await callApi('/task/kill', { taskId: args.taskId });
                    return JSON.stringify(res, null, 2);
                } else {
                    const res = await callApi('/task/status', { taskId: args.taskId });
                    return JSON.stringify(res, null, 2);
                }
            },
            formatMessage: (args) => `Managing task: ${args.action} ${args.taskId || ''}`,
        },

        // ================= 4. NETWORK & WEBPAGE =================
        {
            name: 'http_request',
            displayName: 'HTTP Request',
            description: 'Sends custom HTTP/HTTPS requests (GET, POST, PUT, DELETE, PATCH) with custom headers and body.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'Target URL' },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'], description: 'HTTP method (default: GET)' },
                    headers: { type: 'object', description: 'Key-value pairs of request headers' },
                    body: { type: 'string', description: 'Request body string or JSON payload' },
                    timeout: { type: 'number', description: 'Request timeout in ms (default: 30000)' },
                },
                required: ['url'],
            },
            action: async (args) => {
                const res = await callApi('/http_request', args);
                let out = `Status: ${res.statusCode} ${res.statusMessage || ''}\n`;
                if (res.truncated) out += '[Response body truncated]\n';
                out += res.body;
                return out;
            },
            formatMessage: (args) => `HTTP ${args.method || 'GET'}: ${args.url}`,
        },
        {
            name: 'fetch_webpage',
            displayName: 'Fetch Webpage Content',
            description: 'Fetches a webpage URL, strips navigation/ads/scripts, and extracts clean, readable Markdown content.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'Webpage URL to fetch and parse' },
                    maxLength: { type: 'number', description: 'Maximum character length of returned markdown (default: 30000)' },
                },
                required: ['url'],
            },
            action: async (args) => {
                const res = await callApi('/fetch_webpage', args);
                let out = res.content || '';
                if (res.truncated) out += '\n\n[Content truncated]';
                return out;
            },
            formatMessage: (args) => `Fetching webpage content: ${args.url}`,
        },

        // ================= 5. SYSTEM DIAGNOSTICS =================
        {
            name: 'get_environment',
            displayName: 'Get System Environment',
            description: 'Retrieves system diagnostic metrics including OS, CPU, RAM, Node version, ST directory, and active whitelist paths.',
            parameters: {
                type: 'object',
                properties: {},
            },
            action: async () => {
                const res = await callApi('/get_environment', {});
                return JSON.stringify(res, null, 2);
            },
            formatMessage: () => 'Inspecting system environment & diagnostics',
        },
    ];
}
