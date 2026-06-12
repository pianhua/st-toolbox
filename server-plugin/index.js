import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';

import { sync as writeFileSyncAtomic } from 'write-file-atomic';
import { getConfigValue } from '../../src/util.js';

// Import serverDirectory from the correct path
// Note: This path may need adjustment based on ST's plugin loading mechanism
let serverDirectory;
try {
    const serverDirModule = await import('../../src/server-directory.js');
    serverDirectory = serverDirModule.serverDirectory;
} catch (error) {
    // Fallback: use process.cwd() if import fails
    serverDirectory = process.cwd();
    console.warn('[ST Toolbox] Could not import serverDirectory, using process.cwd()');
}

export const info = {
    id: 'st-toolbox',
    name: 'ST Toolbox',
    description: 'Filesystem and shell tools for SillyTavern - provides read, write, edit, bash, list_directory, search_files, get_environment, http_request, move_file, delete_file tools',
};

const MAX_OUTPUT_SIZE = 256 * 1024;
const DEFAULT_TIMEOUT = 30000;

// Load allowed paths from config.yaml
function getAllowedPaths() {
    try {
        const config = getConfigValue('st-toolbox', {});
        const allowedPaths = config.allowedPaths || [];
        // Normalize all paths
        return allowedPaths.map(p => path.normalize(path.resolve(p)));
    } catch (error) {
        console.warn('[ST Toolbox] Could not load allowedPaths config:', error.message);
        return [];
    }
}

function validatePath(filePath) {
    if (!filePath) {
        return { error: 'No path specified' };
    }

    let resolvedPath;
    if (path.isAbsolute(filePath)) {
        // If absolute path, resolve it directly
        resolvedPath = path.resolve(filePath);
    } else {
        // If relative path, join with serverDirectory
        resolvedPath = path.resolve(path.join(serverDirectory, filePath));
    }

    // Normalize for comparison (handle Windows path separators)
    const normalizedResolved = path.normalize(resolvedPath);
    const normalizedServerDir = path.normalize(serverDirectory);

    // Check if path is within serverDirectory
    if (normalizedResolved.startsWith(normalizedServerDir)) {
        return { resolvedPath };
    }

    // Check if path is within any allowed path
    const allowedPaths = getAllowedPaths();
    for (const allowedPath of allowedPaths) {
        if (normalizedResolved.startsWith(allowedPath)) {
            return { resolvedPath };
        }
    }

    return { error: 'Invalid path: access denied' };
}

export async function init(router) {
    console.log('[ST Toolbox] Initializing server-side plugin...');

    router.post('/read', async (request, response) => {
        try {
            const { filePath } = request.body;
            const validation = validatePath(filePath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (!fs.existsSync(validation.resolvedPath)) {
                return response.status(404).send('File not found');
            }

            const stats = fs.statSync(validation.resolvedPath);
            if (!stats.isFile()) {
                return response.status(400).send('Path is not a file');
            }

            const offset = parseInt(request.body.offset) || 0;
            const limit = parseInt(request.body.limit) || 0;

            if (offset > 0 || limit > 0) {
                const fd = fs.openSync(validation.resolvedPath, 'r');
                try {
                    const bufferSize = limit > 0 ? limit : stats.size - offset;
                    const buffer = Buffer.alloc(bufferSize);
                    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, offset);
                    return response.send(buffer.toString('utf-8', 0, bytesRead));
                } finally {
                    fs.closeSync(fd);
                }
            }

            const content = fs.readFileSync(validation.resolvedPath, 'utf-8');
            return response.json({ content });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/write', async (request, response) => {
        try {
            const { filePath, content } = request.body;
            const validation = validatePath(filePath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (content === undefined) {
                return response.status(400).send('No content specified');
            }

            const parentDir = path.dirname(validation.resolvedPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            writeFileSyncAtomic(validation.resolvedPath, content, 'utf-8');
            return response.json({ success: true });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/edit', async (request, response) => {
        try {
            const { filePath, oldText, newText } = request.body;
            const validation = validatePath(filePath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (!fs.existsSync(validation.resolvedPath)) {
                return response.status(404).send('File not found');
            }

            if (oldText === undefined) {
                return response.status(400).send('No oldText specified');
            }

            const fileContent = fs.readFileSync(validation.resolvedPath, 'utf-8');
            if (!fileContent.includes(oldText)) {
                return response.status(400).send('oldText not found in file');
            }

            const newContent = fileContent.replace(oldText, newText || '');
            writeFileSyncAtomic(validation.resolvedPath, newContent, 'utf-8');
            return response.json({ success: true });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/bash', async (request, response) => {
        try {
            const { command, args = [], timeout = DEFAULT_TIMEOUT } = request.body;
            if (!command) {
                return response.status(400).send('No command specified');
            }

            const outputChunks = [];
            let outputSize = 0;
            let killed = false;

            const isWindows = process.platform === 'win32';
            let child;

            if (isWindows) {
                // Use PowerShell with UTF-8 encoding to fix Chinese character garbling
                const fullCommand = args.length > 0
                    ? `${command} ${args.join(' ')}`
                    : command;
                const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${fullCommand}`;
                child = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
                    cwd: serverDirectory,
                    windowsHide: true,
                });
            } else {
                child = spawn(command, args, {
                    cwd: serverDirectory,
                    shell: true,
                    windowsHide: true,
                });
            }

            const timeoutId = setTimeout(() => {
                killed = true;
                child.kill();
            }, timeout);

            child.stdout.on('data', (data) => {
                if (outputSize < MAX_OUTPUT_SIZE) {
                    const remaining = MAX_OUTPUT_SIZE - outputSize;
                    outputChunks.push(data.toString('utf-8', 0, Math.min(data.length, remaining)));
                    outputSize += Math.min(data.length, remaining);
                }
            });

            child.stderr.on('data', (data) => {
                if (outputSize < MAX_OUTPUT_SIZE) {
                    const remaining = MAX_OUTPUT_SIZE - outputSize;
                    outputChunks.push(data.toString('utf-8', 0, Math.min(data.length, remaining)));
                    outputSize += Math.min(data.length, remaining);
                }
            });

            child.on('close', (code) => {
                clearTimeout(timeoutId);
                return response.send({
                    exitCode: code,
                    output: outputChunks.join(''),
                    truncated: outputSize >= MAX_OUTPUT_SIZE,
                    timedOut: killed,
                });
            });

            child.on('error', (error) => {
                clearTimeout(timeoutId);
                console.error(error);
                return response.status(500).send({ error: error.message });
            });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/list_directory', async (request, response) => {
        try {
            const { dirPath = '.' } = request.body;
            const validation = validatePath(dirPath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (!fs.existsSync(validation.resolvedPath)) {
                return response.status(404).send('Directory not found');
            }

            const stats = fs.statSync(validation.resolvedPath);
            if (!stats.isDirectory()) {
                return response.status(400).send('Path is not a directory');
            }

            const entries = fs.readdirSync(validation.resolvedPath, { withFileTypes: true });
            const items = entries.map(entry => {
                const entryPath = path.join(validation.resolvedPath, entry.name);
                const entryStats = fs.statSync(entryPath);
                return {
                    name: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: entryStats.size,
                    modified: entryStats.mtime.toISOString(),
                };
            });

            return response.json({ path: validation.resolvedPath, items });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/search_files', async (request, response) => {
        try {
            const { query, path: searchPath = '.', pattern = '*' } = request.body;
            if (!query) {
                return response.status(400).send('No query specified');
            }

            const validation = validatePath(searchPath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (!fs.existsSync(validation.resolvedPath)) {
                return response.status(404).send('Search path not found');
            }

            const regex = new RegExp(query, 'g');
            const results = [];

            function searchInDir(dir, basePath) {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(basePath, fullPath);

                    if (entry.isDirectory()) {
                        if (!entry.name.startsWith('.') && !entry.name.startsWith('node_modules')) {
                            searchInDir(fullPath, basePath);
                        }
                    } else if (entry.isFile()) {
                        if (pattern !== '*' && !entry.name.match(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))) {
                            continue;
                        }
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const lines = content.split('\n');
                            let matchCount = 0;
                            const matches = [];
                            for (let i = 0; i < lines.length; i++) {
                                if (regex.test(lines[i])) {
                                    matchCount++;
                                    if (matchCount <= 5) {
                                        matches.push({ line: i + 1, text: lines[i].trim() });
                                    }
                                }
                            }
                            if (matchCount > 0) {
                                results.push({
                                    file: relativePath,
                                    matches: matchCount,
                                    lines: matches,
                                });
                            }
                        } catch (e) {
                            // Skip files that can't be read as text
                        }
                    }
                }
            }

            searchInDir(validation.resolvedPath, validation.resolvedPath);
            return response.json({ query, results, totalFiles: results.length });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/get_environment', async (request, response) => {
        try {
            const envInfo = {
                os: process.platform,
                nodeVersion: process.version,
                cwd: serverDirectory,
                projectRoot: serverDirectory,
                arch: process.arch,
                uptime: process.uptime(),
            };
            return response.json(envInfo);
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/http_request', async (request, response) => {
        try {
            const { url, method = 'GET', headers = {}, body } = request.body;
            if (!url) {
                return response.status(400).send('No URL specified');
            }

            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method.toUpperCase(),
                headers: {
                    'User-Agent': 'SillyTavern-Tool/1.0',
                    ...headers,
                },
            };

            if (body && typeof body === 'string') {
                options.headers['Content-Length'] = Buffer.byteLength(body);
            }

            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    response.json({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data.substring(0, MAX_OUTPUT_SIZE),
                        truncated: data.length > MAX_OUTPUT_SIZE,
                    });
                });
            });

            req.on('error', (error) => {
                response.status(500).json({ error: error.message });
            });

            if (body && typeof body === 'string') {
                req.write(body);
            }
            req.end();
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/move_file', async (request, response) => {
        try {
            const { sourcePath, destinationPath } = request.body;
            if (!sourcePath || !destinationPath) {
                return response.status(400).send('Source and destination paths required');
            }

            const sourceValidation = validatePath(sourcePath);
            const destValidation = validatePath(destinationPath);

            if (sourceValidation.error) {
                return response.status(400).send(`Source: ${sourceValidation.error}`);
            }
            if (destValidation.error) {
                return response.status(400).send(`Destination: ${destValidation.error}`);
            }

            if (!fs.existsSync(sourceValidation.resolvedPath)) {
                return response.status(404).send('Source file not found');
            }

            const parentDir = path.dirname(destValidation.resolvedPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            fs.renameSync(sourceValidation.resolvedPath, destValidation.resolvedPath);
            return response.json({ success: true, from: sourceValidation.resolvedPath, to: destValidation.resolvedPath });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    router.post('/delete_file', async (request, response) => {
        try {
            const { filePath, permanent = false } = request.body;
            const validation = validatePath(filePath);
            if (validation.error) {
                return response.status(400).send(validation.error);
            }

            if (!fs.existsSync(validation.resolvedPath)) {
                return response.status(404).send('File not found');
            }

            const stats = fs.statSync(validation.resolvedPath);
            const fileName = path.basename(validation.resolvedPath);

            if (permanent) {
                if (stats.isDirectory()) {
                    fs.rmdirSync(validation.resolvedPath, { recursive: true });
                } else {
                    fs.unlinkSync(validation.resolvedPath);
                }
                return response.json({ success: true, deleted: true, file: fileName });
            } else {
                const trashDir = path.join(serverDirectory, 'data', '.trash');
                if (!fs.existsSync(trashDir)) {
                    fs.mkdirSync(trashDir, { recursive: true });
                }
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const trashPath = path.join(trashDir, `${timestamp}_${fileName}`);
                fs.renameSync(validation.resolvedPath, trashPath);
                return response.json({ success: true, deleted: false, movedTo: trashPath, originalPath: validation.resolvedPath });
            }
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    console.log('[ST Toolbox] Server-side plugin initialized with 10 endpoints');
}

export async function exit() {
    console.log('[ST Toolbox] Server-side plugin shutting down...');
}
