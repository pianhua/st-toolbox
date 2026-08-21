import fs from 'node:fs';
import path from 'node:path';

/**
 * Zero-dependency Atomic file write utility using temp file + rename
 */
export function writeFileSyncAtomic(targetFile, data, encoding = 'utf-8') {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const tempFile = path.join(
        dir,
        `.${path.basename(targetFile)}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`,
    );

    try {
        fs.writeFileSync(tempFile, data, encoding);
        fs.renameSync(tempFile, targetFile);
    } catch (err) {
        // Fallback to direct write if rename fails (e.g. Windows file lock)
        try {
            fs.writeFileSync(targetFile, data, encoding);
        } catch (fallbackErr) {
            throw err;
        } finally {
            if (fs.existsSync(tempFile)) {
                try { fs.unlinkSync(tempFile); } catch (e) {}
            }
        }
    }
}
