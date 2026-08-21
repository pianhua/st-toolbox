import fs from 'node:fs';
import path from 'node:path';

const ALWAYS_IGNORES = new Set([
    'node_modules',
    '.git',
    '.trash',
    '.svn',
    '.hg',
    '.DS_Store',
    'dist',
    'build',
    'coverage',
    '.vscode',
    '.idea',
]);

export class SearchEngine {
    constructor(sandbox, configStore) {
        this.sandbox = sandbox;
        this.configStore = configStore;
    }

    /**
     * Check if buffer contains null bytes (binary file check)
     */
    isBinaryBuffer(buffer) {
        const checkLen = Math.min(buffer.length, 512);
        for (let i = 0; i < checkLen; i++) {
            if (buffer[i] === 0) return true;
        }
        return false;
    }

    /**
     * Asynchronous recursive directory listing
     */
    async listDirectory({ dirPath = '.', depth = 1, recursive = false, includeHidden = false }) {
        const check = this.sandbox.validatePath(dirPath);
        if (!check.valid) throw new Error(check.error);

        const rootPath = check.resolvedPath;
        if (!fs.existsSync(rootPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }

        const rootStats = await fs.promises.stat(rootPath);
        if (!rootStats.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }

        const maxDepth = recursive ? (parseInt(depth) || 5) : 1;
        const items = [];

        const scan = async (currentDir, currentDepth) => {
            if (currentDepth > maxDepth) return;

            let entries;
            try {
                entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                if (!includeHidden && entry.name.startsWith('.') && entry.name !== '.') {
                    continue;
                }
                if (ALWAYS_IGNORES.has(entry.name)) {
                    continue;
                }

                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(rootPath, fullPath) || entry.name;

                try {
                    const stats = await fs.promises.stat(fullPath);
                    const isDir = entry.isDirectory();

                    items.push({
                        name: entry.name,
                        relativePath: relPath,
                        type: isDir ? 'directory' : 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        depth: currentDepth,
                    });

                    if (isDir && currentDepth < maxDepth) {
                        await scan(fullPath, currentDepth + 1);
                    }
                } catch (e) {
                    // Ignore inaccessible items
                }
            }
        };

        await scan(rootPath, 1);

        return {
            dirPath: rootPath,
            totalItems: items.length,
            items,
        };
    }

    /**
     * Asynchronous multi-file content search (ripgrep-style)
     */
    async searchFiles({ query, path: searchDir = '.', pattern = '*', caseSensitive = false, isRegex = false, maxResults = 50 }) {
        if (!query || typeof query !== 'string') {
            throw new Error('Search query parameter is required');
        }

        const check = this.sandbox.validatePath(searchDir);
        if (!check.valid) throw new Error(check.error);

        const rootPath = check.resolvedPath;
        if (!fs.existsSync(rootPath)) {
            throw new Error(`Search directory not found: ${searchDir}`);
        }

        let regex;
        try {
            const flags = caseSensitive ? 'g' : 'gi';
            regex = isRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch (e) {
            throw new Error(`Invalid search pattern: ${e.message}`);
        }

        const globPattern = pattern && pattern !== '*'
            ? new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
            : null;

        const results = [];
        let totalMatches = 0;
        const maxHits = parseInt(maxResults) || 50;

        const searchInDir = async (currentDir) => {
            if (results.length >= maxHits) return;

            let entries;
            try {
                entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                if (results.length >= maxHits) break;
                if (ALWAYS_IGNORES.has(entry.name)) continue;

                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory()) {
                    await searchInDir(fullPath);
                } else if (entry.isFile()) {
                    if (globPattern && !globPattern.test(entry.name)) continue;

                    try {
                        const buffer = await fs.promises.readFile(fullPath);
                        if (this.isBinaryBuffer(buffer)) continue;

                        const content = buffer.toString('utf-8');
                        const lines = content.split(/\r?\n/);
                        const fileMatches = [];

                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            regex.lastIndex = 0;
                            if (regex.test(line)) {
                                totalMatches++;
                                if (fileMatches.length < 10) {
                                    fileMatches.push({
                                        line: i + 1,
                                        content: line.trim().slice(0, 300),
                                    });
                                }
                            }
                        }

                        if (fileMatches.length > 0) {
                            results.push({
                                file: path.relative(rootPath, fullPath),
                                fullPath,
                                matchCount: fileMatches.length,
                                snippets: fileMatches,
                            });
                        }
                    } catch (e) {
                        // Skip unreadable files
                    }
                }
            }
        };

        await searchInDir(rootPath);

        return {
            query,
            searchPath: rootPath,
            totalFilesMatched: results.length,
            totalMatches,
            results,
        };
    }

    /**
     * Fast Glob Search
     */
    async findByName({ pattern = '*', path: searchDir = '.', type = 'any', maxDepth = 10, maxResults = 50 }) {
        const check = this.sandbox.validatePath(searchDir);
        if (!check.valid) throw new Error(check.error);

        const rootPath = check.resolvedPath;
        if (!fs.existsSync(rootPath)) {
            throw new Error(`Directory not found: ${searchDir}`);
        }

        const globRegex = new RegExp(
            '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
            'i',
        );

        const matches = [];
        const limit = parseInt(maxResults) || 50;
        const depthLimit = parseInt(maxDepth) || 10;

        const scan = async (currentDir, currentDepth) => {
            if (currentDepth > depthLimit || matches.length >= limit) return;

            let entries;
            try {
                entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                if (matches.length >= limit) break;
                if (ALWAYS_IGNORES.has(entry.name)) continue;

                const fullPath = path.join(currentDir, entry.name);
                const isDir = entry.isDirectory();
                const isFile = entry.isFile();

                let matchesType = true;
                if (type === 'file' && !isFile) matchesType = false;
                if (type === 'directory' && !isDir) matchesType = false;

                if (matchesType && globRegex.test(entry.name)) {
                    matches.push({
                        name: entry.name,
                        relativePath: path.relative(rootPath, fullPath),
                        fullPath,
                        type: isDir ? 'directory' : 'file',
                    });
                }

                if (isDir && currentDepth < depthLimit) {
                    await scan(fullPath, currentDepth + 1);
                }
            }
        };

        await scan(rootPath, 1);

        return {
            pattern,
            searchPath: rootPath,
            totalMatches: matches.length,
            matches,
        };
    }
}
