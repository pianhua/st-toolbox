import fs from 'node:fs';
import path from 'node:path';
import { writeFileSyncAtomic } from '../atomic-write.js';

export class FileEngine {
    constructor(sandbox, trashManager, configStore) {
        this.sandbox = sandbox;
        this.trashManager = trashManager;
        this.configStore = configStore;
    }

    /**
     * Read file content with line offset/limit, line numbering, and safety truncation
     */
    async readFile({ filePath, offset = 1, limit = 0, showLineNumbers = false, encoding = 'utf-8' }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(target);
        if (!stats.isFile()) {
            throw new Error(`Target is a directory, not a file: ${filePath}`);
        }

        const maxBytes = this.configStore.getSecurityConfig().maxOutputSize || 512 * 1024;
        let content = fs.readFileSync(target, { encoding: encoding === 'auto' ? 'utf-8' : encoding });

        const lines = content.split(/\r?\n/);
        const totalLines = lines.length;

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
            formattedOutput = formattedOutput.slice(0, maxBytes) + '\n... [Output Truncated due to size limit]';
            truncated = true;
        }

        return {
            filePath: target,
            totalLines,
            startLine,
            linesRead: selectedLines.length,
            truncated,
            content: formattedOutput,
        };
    }

    /**
     * Write or overwrite file with atomic protection
     */
    async writeFile({ filePath, content, createBackup = true }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        const parentDir = path.dirname(target);

        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        let backupPath = null;
        if (createBackup && fs.existsSync(target)) {
            const ext = path.extname(target);
            const base = path.basename(target, ext);
            backupPath = path.join(parentDir, `.${base}.bak${ext}`);
            try {
                fs.copyFileSync(target, backupPath);
            } catch (e) {
                // Ignore backup fail
            }
        }

        writeFileSyncAtomic(target, content ?? '', 'utf-8');

        return {
            success: true,
            filePath: target,
            bytesWritten: Buffer.byteLength(content ?? '', 'utf-8'),
            backupCreated: !!backupPath,
        };
    }

    /**
     * Exact string search and replace with match count safety
     */
    async editFile({ filePath, oldText, newText, expectedReplacements = 1, dryRun = false }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

        if (oldText === undefined || oldText === null) {
            throw new Error('oldText parameter is required for edit_file');
        }

        const original = fs.readFileSync(target, 'utf-8');
        const matchCount = original.split(oldText).length - 1;

        if (matchCount === 0) {
            throw new Error(`Target text (oldText) not found in file: ${filePath}`);
        }

        if (expectedReplacements > 0 && matchCount !== expectedReplacements) {
            throw new Error(
                `Replacement safety error: Expected ${expectedReplacements} occurrence(s) of oldText, but found ${matchCount}. Specify more unique context.`,
            );
        }

        const replaced = original.replaceAll(oldText, newText ?? '');

        if (!dryRun) {
            writeFileSyncAtomic(target, replaced, 'utf-8');
        }

        return {
            success: true,
            filePath: target,
            replacedCount: matchCount,
            dryRun,
        };
    }

    /**
     * Apply multi-block patch or diff to a file
     */
    async patchFile({ filePath, patches }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

        if (!Array.isArray(patches) || patches.length === 0) {
            throw new Error('patches array is required (each with oldText and newText)');
        }

        let content = fs.readFileSync(target, 'utf-8');
        let applied = 0;

        for (let i = 0; i < patches.length; i++) {
            const { oldText, newText } = patches[i];
            if (!oldText) continue;
            if (!content.includes(oldText)) {
                throw new Error(`Patch chunk #${i + 1} failed: target text not found in file`);
            }
            content = content.replace(oldText, newText ?? '');
            applied++;
        }

        writeFileSyncAtomic(target, content, 'utf-8');

        return {
            success: true,
            filePath: target,
            patchesApplied: applied,
        };
    }

    /**
     * Safe copy file or directory
     */
    async copyFile({ sourcePath, destinationPath, overwrite = true }) {
        const srcCheck = this.sandbox.validatePath(sourcePath);
        if (!srcCheck.valid) throw new Error(`Source: ${srcCheck.error}`);

        const dstCheck = this.sandbox.validatePath(destinationPath);
        if (!dstCheck.valid) throw new Error(`Destination: ${dstCheck.error}`);

        const src = srcCheck.resolvedPath;
        const dst = dstCheck.resolvedPath;

        if (!fs.existsSync(src)) {
            throw new Error(`Source not found: ${sourcePath}`);
        }

        if (fs.existsSync(dst) && !overwrite) {
            throw new Error(`Destination already exists and overwrite is false: ${destinationPath}`);
        }

        const dstDir = path.dirname(dst);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }

        fs.cpSync(src, dst, { recursive: true, force: overwrite });

        return {
            success: true,
            from: src,
            to: dst,
        };
    }

    /**
     * Safe move/rename file or directory
     */
    async moveFile({ sourcePath, destinationPath, overwrite = true }) {
        const srcCheck = this.sandbox.validatePath(sourcePath);
        if (!srcCheck.valid) throw new Error(`Source: ${srcCheck.error}`);

        const dstCheck = this.sandbox.validatePath(destinationPath);
        if (!dstCheck.valid) throw new Error(`Destination: ${dstCheck.error}`);

        const src = srcCheck.resolvedPath;
        const dst = dstCheck.resolvedPath;

        if (!fs.existsSync(src)) {
            throw new Error(`Source not found: ${sourcePath}`);
        }

        if (fs.existsSync(dst) && !overwrite) {
            throw new Error(`Destination already exists: ${destinationPath}`);
        }

        const dstDir = path.dirname(dst);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }

        fs.renameSync(src, dst);

        return {
            success: true,
            from: src,
            to: dst,
        };
    }

    /**
     * Safe delete with trash bin support or permanent deletion
     */
    async deleteFile({ filePath, permanent = false }) {
        const check = this.sandbox.validatePath(filePath);
        if (!check.valid) throw new Error(check.error);

        const target = check.resolvedPath;
        if (!fs.existsSync(target)) {
            throw new Error(`File not found: ${filePath}`);
        }

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
    }

    /**
     * Restore file from trash bin
     */
    async restoreFile({ identifier }) {
        if (!identifier) {
            throw new Error('identifier parameter (trashId or originalPath) is required for restore_file');
        }
        return this.trashManager.restore(identifier);
    }
}
