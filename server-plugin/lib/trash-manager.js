import path from 'node:path';
import fs from 'node:fs';
import { writeFileSyncAtomic } from './atomic-write.js';

export class TrashManager {
    constructor(serverDirectory) {
        this.serverDirectory = serverDirectory;
        this.trashDir = path.join(this.serverDirectory, 'data', '.trash');
        this.metaFile = path.join(this.trashDir, 'trash-metadata.json');
        this.metadata = this.#loadMetadata();
    }

    #loadMetadata() {
        try {
            if (!fs.existsSync(this.trashDir)) {
                fs.mkdirSync(this.trashDir, { recursive: true });
            }
            if (fs.existsSync(this.metaFile)) {
                return JSON.parse(fs.readFileSync(this.metaFile, 'utf-8'));
            }
        } catch (e) {
            console.error('[ST-Toolbox TrashManager] Error loading trash metadata:', e);
        }
        return {};
    }

    #saveMetadata() {
        try {
            if (!fs.existsSync(this.trashDir)) {
                fs.mkdirSync(this.trashDir, { recursive: true });
            }
            writeFileSyncAtomic(this.metaFile, JSON.stringify(this.metadata, null, 2), 'utf-8');
        } catch (e) {
            console.error('[ST-Toolbox TrashManager] Error saving trash metadata:', e);
        }
    }

    /**
     * Move file or directory to safe trash
     */
    trash(targetPath) {
        if (!fs.existsSync(targetPath)) {
            throw new Error(`File not found: ${targetPath}`);
        }

        if (!fs.existsSync(this.trashDir)) {
            fs.mkdirSync(this.trashDir, { recursive: true });
        }

        const stats = fs.statSync(targetPath);
        const fileName = path.basename(targetPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const trashId = `${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
        const trashFileName = `${trashId}_${fileName}`;
        const trashPath = path.join(this.trashDir, trashFileName);

        fs.renameSync(targetPath, trashPath);

        this.metadata[trashId] = {
            trashId,
            originalPath: targetPath,
            trashPath,
            fileName,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            trashedAt: new Date().toISOString(),
        };

        this.#saveMetadata();

        return {
            success: true,
            trashId,
            fileName,
            originalPath: targetPath,
            trashPath,
            trashedAt: this.metadata[trashId].trashedAt,
        };
    }

    /**
     * Restore file from trash
     */
    restore(identifier) {
        // identifier can be trashId, fileName, or originalPath
        let record = this.metadata[identifier];

        if (!record) {
            // Find by filename or original path
            const entries = Object.values(this.metadata);
            record = entries.find(r => r.trashPath === identifier || r.originalPath === identifier || r.fileName === identifier || r.trashId === identifier);
        }

        if (!record) {
            throw new Error(`Trash record not found for: ${identifier}`);
        }

        if (!fs.existsSync(record.trashPath)) {
            delete this.metadata[record.trashId];
            this.#saveMetadata();
            throw new Error(`Trashed file no longer exists at ${record.trashPath}`);
        }

        // Ensure target directory exists
        const targetDir = path.dirname(record.originalPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Rename back
        fs.renameSync(record.trashPath, record.originalPath);

        delete this.metadata[record.trashId];
        this.#saveMetadata();

        return {
            success: true,
            restoredPath: record.originalPath,
            fileName: record.fileName,
        };
    }

    list() {
        return Object.values(this.metadata).sort((a, b) => new Date(b.trashedAt) - new Date(a.trashedAt));
    }
}
