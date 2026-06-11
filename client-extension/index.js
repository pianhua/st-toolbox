import { getContext } from '../../extensions.js';

const EXTENSION_NAME = 'st-toolbox';
const API_PREFIX = '/api/plugins/st-toolbox';

let context;
let ToolManager;
let getRequestHeaders;

/**
 * Initialize the extension
 */
export async function init() {
    console.log(`[${EXTENSION_NAME}] Initializing client-side extension...`);

    context = getContext();
    ToolManager = context.ToolManager;
    getRequestHeaders = context.getRequestHeaders;

    if (!ToolManager) {
        console.error(`[${EXTENSION_NAME}] ToolManager not available`);
        return;
    }

    // Register all 10 tools
    registerReadFileTool();
    registerWriteFileTool();
    registerEditFileTool();
    registerExecuteBashTool();
    registerListDirectoryTool();
    registerSearchFilesTool();
    registerGetEnvironmentTool();
    registerHttpRequestTool();
    registerMoveFileTool();
    registerDeleteFileTool();

    console.log(`[${EXTENSION_NAME}] All 10 tools registered successfully`);
}

/**
 * Register read_file tool
 */
function registerReadFileTool() {
    ToolManager.registerFunctionTool({
        name: 'read_file',
        displayName: 'Read File',
        description: 'Reads the content of a file from the server. Optionally specify offset (1-based line number) and limit (max lines to read).',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Absolute path to the file to read' },
                offset: { type: 'number', description: 'Optional line number to start reading from (1-based)' },
                limit: { type: 'number', description: 'Optional maximum number of lines to read' },
            },
            required: ['filePath'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/read`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    filePath: args.filePath,
                    offset: args.offset,
                    limit: args.limit,
                }),
            });
            if (!response.ok) throw new Error(`read_file failed: ${response.statusText}`);
            const data = await response.json();
            return typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
        },
    });
}

/**
 * Register write_file tool
 */
function registerWriteFileTool() {
    ToolManager.registerFunctionTool({
        name: 'write_file',
        displayName: 'Write File',
        description: 'Writes content to a file on the server. Overwrites the file if it exists.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Absolute path to the file to write' },
                content: { type: 'string', description: 'Content to write to the file' },
            },
            required: ['filePath', 'content'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/write`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    filePath: args.filePath,
                    content: args.content,
                }),
            });
            if (!response.ok) throw new Error(`write_file failed: ${response.statusText}`);
            return 'File written successfully.';
        },
    });
}

/**
 * Register edit_file tool
 */
function registerEditFileTool() {
    ToolManager.registerFunctionTool({
        name: 'edit_file',
        displayName: 'Edit File',
        description: 'Edits a file on the server by replacing oldText with newText.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Absolute path to the file to edit' },
                oldText: { type: 'string', description: 'Text to find and replace' },
                newText: { type: 'string', description: 'Text to replace oldText with' },
            },
            required: ['filePath', 'oldText', 'newText'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/edit`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    filePath: args.filePath,
                    oldText: args.oldText,
                    newText: args.newText,
                }),
            });
            if (!response.ok) throw new Error(`edit_file failed: ${response.statusText}`);
            return 'File edited successfully.';
        },
    });
}

/**
 * Register execute_bash tool
 */
function registerExecuteBashTool() {
    ToolManager.registerFunctionTool({
        name: 'execute_bash',
        displayName: 'Execute Bash',
        description: 'Executes a bash command on the server. Optionally specify a timeout in milliseconds.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Bash command to execute' },
                timeout: { type: 'number', description: 'Optional timeout in milliseconds' },
            },
            required: ['command'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/bash`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    command: args.command,
                    timeout: args.timeout,
                }),
            });
            if (!response.ok) throw new Error(`execute_bash failed: ${response.statusText}`);
            const data = await response.json();
            let result = data.output || '';
            if (data.exitCode !== 0) result += `\nExit code: ${data.exitCode}`;
            if (data.timedOut) result += '\nCommand timed out.';
            if (data.truncated) result += '\nOutput was truncated.';
            return result;
        },
    });
}

/**
 * Register list_directory tool
 */
function registerListDirectoryTool() {
    ToolManager.registerFunctionTool({
        name: 'list_directory',
        displayName: 'List Directory',
        description: 'Lists all files and directories in a given path with their types, sizes, and modification dates.',
        parameters: {
            type: 'object',
            properties: {
                dirPath: { type: 'string', description: 'Path to the directory to list' },
            },
            required: ['dirPath'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/list_directory`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    dirPath: args.dirPath,
                }),
            });
            if (!response.ok) throw new Error(`list_directory failed: ${response.statusText}`);
            const data = await response.json();
            return JSON.stringify(data, null, 2);
        },
    });
}

/**
 * Register search_files tool
 */
function registerSearchFilesTool() {
    ToolManager.registerFunctionTool({
        name: 'search_files',
        displayName: 'Search Files',
        description: 'Searches for text patterns within files using regular expressions. Returns matching files with line numbers and context.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Regular expression pattern to search for' },
                path: { type: 'string', description: 'Directory path to search in' },
                pattern: { type: 'string', description: 'File name pattern to filter by (e.g., "*.js")' },
            },
            required: ['query'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/search_files`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    query: args.query,
                    path: args.path,
                    pattern: args.pattern,
                }),
            });
            if (!response.ok) throw new Error(`search_files failed: ${response.statusText}`);
            const data = await response.json();
            return JSON.stringify(data, null, 2);
        },
    });
}

/**
 * Register get_environment tool
 */
function registerGetEnvironmentTool() {
    ToolManager.registerFunctionTool({
        name: 'get_environment',
        displayName: 'Get Environment',
        description: 'Retrieves information about the server environment including OS, Node.js version, project path, and architecture.',
        parameters: {
            type: 'object',
            properties: {},
        },
        action: async () => {
            const response = await fetch(`${API_PREFIX}/get_environment`, {
                method: 'POST',
                headers: getRequestHeaders(),
            });
            if (!response.ok) throw new Error(`get_environment failed: ${response.statusText}`);
            const data = await response.json();
            return JSON.stringify(data, null, 2);
        },
    });
}

/**
 * Register http_request tool
 */
function registerHttpRequestTool() {
    ToolManager.registerFunctionTool({
        name: 'http_request',
        displayName: 'HTTP Request',
        description: 'Makes HTTP/HTTPS requests to external APIs or websites. Supports GET, POST, PUT, DELETE methods with custom headers and body.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to request' },
                method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
                headers: { type: 'object', description: 'Custom headers as key-value pairs' },
                body: { type: 'string', description: 'Request body for POST/PUT' },
            },
            required: ['url'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/http_request`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    url: args.url,
                    method: args.method,
                    headers: args.headers,
                    body: args.body,
                }),
            });
            if (!response.ok) throw new Error(`http_request failed: ${response.statusText}`);
            const data = await response.json();
            let result = `Status: ${data.statusCode}\n`;
            if (data.truncated) result += '[Response truncated]\n';
            result += data.body;
            return result;
        },
    });
}

/**
 * Register move_file tool
 */
function registerMoveFileTool() {
    ToolManager.registerFunctionTool({
        name: 'move_file',
        displayName: 'Move File',
        description: 'Moves or renames a file or directory from one location to another within the project.',
        parameters: {
            type: 'object',
            properties: {
                sourcePath: { type: 'string', description: 'Source file or directory path' },
                destinationPath: { type: 'string', description: 'Destination path' },
            },
            required: ['sourcePath', 'destinationPath'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/move_file`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    sourcePath: args.sourcePath,
                    destinationPath: args.destinationPath,
                }),
            });
            if (!response.ok) throw new Error(`move_file failed: ${response.statusText}`);
            const data = await response.json();
            return `File moved from ${data.from} to ${data.to}`;
        },
    });
}

/**
 * Register delete_file tool
 */
function registerDeleteFileTool() {
    ToolManager.registerFunctionTool({
        name: 'delete_file',
        displayName: 'Delete File',
        description: 'Safely deletes a file or directory. By default moves to trash (recoverable). Use permanent=true for permanent deletion (requires explicit confirmation).',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Path to file or directory to delete' },
                permanent: { type: 'boolean', description: 'Set to true for permanent deletion (cannot be undone)' },
            },
            required: ['filePath'],
        },
        action: async (args) => {
            const response = await fetch(`${API_PREFIX}/delete_file`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    filePath: args.filePath,
                    permanent: args.permanent,
                }),
            });
            if (!response.ok) throw new Error(`delete_file failed: ${response.statusText}`);
            const data = await response.json();
            if (data.deleted) {
                return `Permanently deleted: ${data.file}`;
            } else {
                return `Moved to trash: ${data.file} (recoverable at ${data.movedTo})`;
            }
        },
    });
}
