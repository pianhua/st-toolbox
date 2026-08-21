import fs from 'node:fs';
import path from 'node:path';
import { writeFileSyncAtomic } from '../atomic-write.js';
import { FuzzyPatcher } from '../fuzzy-patcher.js';

export class FileEngine {
    constructor(sandbox, trashManager, configStore, fileLockManager) {
        this.sandbox = sandbox;
        this.trashManager = trashManager;
        this.configStore = configStore;
        this.fileLockManager = fileLockManager;
    }

    /**
     * Inspect file buffer to sniff encoding and detect binary files
     */
    #sniffEncoding(buffer) {
        if (buffer.length >= 2) {
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf16le';
            if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf16be';
        }
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            return 'utf-8';
        }

        // Null byte check in first 512 bytes for binary detection
        const checkLen = Math.min(buffer.length, 512);
        for (let i = 0; i < checkLen; i++) {
            if (buffer[i] === 0) return 'binary';
        }

        return 'utf-8';
    }

    /**
     * Read file content with encoding auto-detection, line slicing, line numbering, and smart truncation
     */
    async readFile({ filePath, offset = 1, limit = 0, showLineNumbers = false, encoding = 'auto', mode = 'slice' }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            // Find possible typo matches in directory
            const parent = path.dirname(target);
            let suggestions = [];
            if (fs.existsSync(parent)) {
                try {
                    const base = path.basename(target).toLowerCase();
                    const files = fs.readdirSync(parent);
                    suggestions = files.filter(f => f.toLowerCase().includes(base) || base.includes(f.toLowerCase())).slice(0, 3);
                } catch (e) {}
            }
            const hint = suggestions.length > 0 ? `\nDid you mean one of these files in ${parent}?\n${suggestions.map(s => `  - ${s}`).join('\n')}` : '';
            throw new Error(`File not found: ${filePath}${hint}`);
        }

        const stats = fs.statSync(target);
        if (!stats.isFile()) {
            throw new Error(`Target is a directory, not a file: ${filePath}`);
        }

        const rawBuffer = fs.readFileSync(target);
        const detectedEncoding = this.#sniffEncoding(rawBuffer);

        if (detectedEncoding === 'binary') {
            return {
                filePath: target,
                isBinary: true,
                sizeBytes: stats.size,
                message: `File is a binary file (${stats.size} bytes). Text reading is disabled for binary files.`,
            };
        }

        const actualEncoding = (encoding && encoding !== 'auto') ? encoding : detectedEncoding;
        let content = rawBuffer.toString(actualEncoding === 'utf16be' ? 'utf16le' : actualEncoding);

        // Normalize line endings
        const lines = content.replace(/\r\n/g, '\n').split('\n');
        const totalLines = lines.length;

        const maxBytes = this.configStore.getSecurityConfig().maxOutputSize || 512 * 1024;
        const startLine = Math.max(1, parseInt(offset) || 1);
        const maxLinesToRead = parseInt(limit) || 0;

        let selectedLines;
        if (maxLinesToRead > 0) {
            selectedLines = lines.slice(startLine - 1, startLine - 1 + maxLinesToRead);
        } else if (startLine > 1) {
            selectedLines = lines.slice(startLine - 1);
        } else {
            selectedLines = lines;
        }

        let formattedOutput;
        if (showLineNumbers) {
            formattedOutput = selectedLines
                .map((line, idx) => `${startLine + idx}: ${line}`)
                .join('\n');
        } else {
            formattedOutput = selectedLines.join('\n');
        }

        let truncated = false;
        if (Buffer.byteLength(formattedOutput, 'utf-8') > maxBytes) {
            formattedOutput = formattedOutput.slice(0, maxBytes) + '\n\n... [Remaining content truncated due to size limit. Use offset and limit to read in chunks.]';
            truncated = true;
        }

        return {
            filePath: target,
            totalLines,
            startLine,
            linesRead: selectedLines.length,
            encoding: actualEncoding,
            sizeBytes: stats.size,
            truncated,
            content: formattedOutput,
        };
    }

    /**
     * Atomic write with concurrency lock and automatic backup snapshot
     */
    async writeFile({ filePath, content, createBackup = true }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;

        return await this.fileLockManager.withLock(target, async () => {
            const parentDir = path.dirname(target);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            let backupCreated = false;
            let backupPath = null;
            if (createBackup && fs.existsSync(target)) {
                const ext = path.extname(target);
                const base = path.basename(target, ext);
                backupPath = path.join(parentDir, `.${base}.bak${ext}`);
                try {
                    fs.copyFileSync(target, backupPath);
                    backupCreated = true;
                } catch (e) {}
            }

            const dataToWrite = content ?? '';
            writeFileSyncAtomic(target, dataToWrite, 'utf-8');

            return {
                success: true,
                filePath: target,
                bytesWritten: Buffer.byteLength(dataToWrite, 'utf-8'),
                backupCreated,
                backupPath,
            };
        });
    }

    /**
     * Industrial search & replace using FuzzyPatcher with multi-tier matching & concurrency locking
     */
    async editFile({ filePath, oldText, newText, expectedReplacements = 1, dryRun = false }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return await this.fileLockManager.withLock(target, async () => {
            const original = fs.readFileSync(target, 'utf-8');
            const patchResult = FuzzyPatcher.replace(original, oldText, newText, expectedReplacements);

            if (!dryRun) {
                writeFileSyncAtomic(target, patchResult.content, 'utf-8');
            }

            return {
                success: true,
                filePath: target,
                strategy: patchResult.strategy,
                confidence: patchResult.confidence || '100%',
                matchedLine: patchResult.matchedLine,
                replacedCount: patchResult.replacedCount,
                dryRun,
            };
        });
    }

    /**
     * Multi-chunk patch or unified diff applier
     */
    async patchFile({ filePath, patches, diff = null }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return await this.fileLockManager.withLock(target, async () => {
            let content = fs.readFileSync(target, 'utf-8');

            // 1. Unified Diff Mode
            if (diff && typeof diff === 'string') {
                const patched = FuzzyPatcher.applyUnifiedDiff(content, diff);
                writeFileSyncAtomic(target, patched, 'utf-8');
                return {
                    success: true,
                    filePath: target,
                    mode: 'unified-diff',
                };
            }

            // 2. Multi-Chunk Mode
            if (!Array.isArray(patches) || patches.length === 0) {
                throw new Error('Either patches array or unified diff string is required');
            }

            let applied = 0;
            for (let i = 0; i < patches.length; i++) {
                const { oldText, newText } = patches[i];
                if (!oldText) continue;
                const chunkResult = FuzzyPatcher.replace(content, oldText, newText, 1);
                content = chunkResult.content;
                applied++;
            }

            writeFileSyncAtomic(target, content, 'utf-8');

            return {
                success: true,
                filePath: target,
                patchesApplied: applied,
            };
        });
    }

    /**
     * Safe copy
     */
    async copyFile({ sourcePath, destinationPath, overwrite = true }) {
        const srcCheck = this.sandbox.validatePath(sourcePath);
        if (!srcCheck.valid) throw new Error(`Source: ${srcCheck.error}`);

        const dstCheck = this.sandbox.validatePath(destinationPath);
        if (!dstCheck.valid) throw new Error(`Destination: ${dstCheck.error}`);

        const src = srcCheck.resolvedPath;
        const dst = dstCheck.resolvedPath;

        if (!fs.existsSync(src)) throw new Error(`Source not found: ${sourcePath}`);
        if (fs.existsSync(dst) && !overwrite) throw new Error(`Destination already exists: ${destinationPath}`);

        return await this.fileLockManager.withLock(dst, async () => {
            const dstDir = path.dirname(dst);
            if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
            fs.cpSync(src, dst, { recursive: true, force: overwrite });

            return {
                success: true,
                from: src,
                to: dst,
            };
        });
    }

    /**
     * Safe move
     */
    async moveFile({ sourcePath, destinationPath, overwrite = true }) {
        const srcCheck = this.sandbox.validatePath(sourcePath);
        if (!srcCheck.valid) throw new Error(`Source: ${srcCheck.error}`);

        const dstCheck = this.sandbox.validatePath(destinationPath);
        if (!dstCheck.valid) throw new Error(`Destination: ${dstCheck.error}`);

        const src = srcCheck.resolvedPath;
        const dst = dstCheck.resolvedPath;

        if (!fs.existsSync(src)) throw new Error(`Source not found: ${sourcePath}`);
        if (fs.existsSync(dst) && !overwrite) throw new Error(`Destination already exists: ${destinationPath}`);

        return await this.fileLockManager.withLock(src, async () => {
            return await this.fileLockManager.withLock(dst, async () => {
                const dstDir = path.dirname(dst);
                if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
                fs.renameSync(src, dst);

                return {
                    success: true,
                    from: src,
                    to: dst,
                };
            });
        });
    }

    /**
     * Safe delete (moves to trash by default)
     */
    async deleteFile({ filePath, permanent = false }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) throw new Error(`File not found: ${filePath}`);

        return await this.fileLockManager.withLock(target, async () => {
            if (permanent) {
                const stats = fs.statSync(target);
                if (stats.isDirectory()) {
                    fs.rmSync(target, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(target);
                }
                return {
                    success: true,
                    deleted: true,
                    permanent: true,
                    filePath: target,
                };
            } else {
                const result = this.trashManager.trash(target);
                return {
                    success: true,
                    deleted: true,
                    permanent: false,
                    trashId: result.trashId,
                    movedTo: result.trashPath,
                    originalPath: result.originalPath,
                };
            }
        });
    }

    async restoreFile({ identifier }) {
        return this.trashManager.restore(identifier);
    }
}
