import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export class SecuritySandbox {
    constructor(serverDirectory, configStore) {
        this.serverDirectory = path.normalize(path.resolve(serverDirectory));
        this.configStore = configStore;
        this.isWindows = process.platform === 'win32';
    }

    /**
     * Expand path variables (~ and environment variables)
     */
    expandPath(rawPath) {
        if (!rawPath || typeof rawPath !== 'string') return '';
        let expanded = rawPath.trim();

        if (expanded.startsWith('~')) {
            expanded = path.join(os.homedir(), expanded.slice(1));
        }

        // Expand %VAR% on Windows or $VAR on Unix
        if (this.isWindows) {
            expanded = expanded.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
        } else {
            expanded = expanded.replace(/\$([a-zA-Z0-9_]+)/g, (_, n) => process.env[n] || '');
        }

        return expanded;
    }

    /**
     * Get all active allowed paths including serverDirectory
     */
    getAllowedPaths() {
        const customPaths = this.configStore.getAllowedPaths() || [];
        const normalized = [this.serverDirectory];

        for (const p of customPaths) {
            if (!p || typeof p !== 'string') continue;
            const expanded = this.expandPath(p);
            if (expanded) {
                normalized.push(path.normalize(path.resolve(expanded)));
            }
        }

        return normalized;
    }

    /**
     * Check if path matches dangerous system-level blacklist
     */
    isBlacklisted(normalizedPath) {
        const lower = normalizedPath.toLowerCase();

        const dangerousPatterns = [
            /\\windows\\system32/i,
            /\\windows\\syswow64/i,
            /\/etc\/shadow/i,
            /\/etc\/sudoers/i,
            /\/etc\/passwd/i,
            /\.ssh[\\\/](id_rsa|id_ed25519|id_ecdsa|id_dsa)$/i,
            /\.git[\\\/]config$/i,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(lower)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolves and verifies that a path is strictly inside allowed whitelist directories
     * @param {string} inputPath
     * @param {object} options
     * @returns {{ valid: boolean, resolvedPath?: string, error?: string }}
     */
    validatePath(inputPath, options = {}) {
        if (!inputPath || typeof inputPath !== 'string') {
            return { valid: false, error: 'Path parameter is required and must be a string' };
        }

        const expanded = this.expandPath(inputPath);
        let resolved = path.isAbsolute(expanded)
            ? path.resolve(expanded)
            : path.resolve(this.serverDirectory, expanded);

        resolved = path.normalize(resolved);

        // Check if file exists and resolve real symlink if present to prevent symlink traversal
        if (fs.existsSync(resolved)) {
            try {
                resolved = path.normalize(fs.realpathSync(resolved));
            } catch (e) {
                // Keep normalized path if realpath fails
            }
        }

        // Check blacklist
        if (this.isBlacklisted(resolved)) {
            return {
                valid: false,
                error: `Security Alert: Path '${inputPath}' is a sensitive system resource and access is blocked.`,
            };
        }

        // Check whitelist
        const allowedPaths = this.getAllowedPaths();
        let allowed = false;

        for (const allowedPath of allowedPaths) {
            const normAllowed = path.normalize(allowedPath);
            if (this.isWindows) {
                if (
                    resolved.toLowerCase() === normAllowed.toLowerCase() ||
                    resolved.toLowerCase().startsWith(normAllowed.toLowerCase() + path.sep)
                ) {
                    allowed = true;
                    break;
                }
            } else {
                if (
                    resolved === normAllowed ||
                    resolved.startsWith(normAllowed + path.sep)
                ) {
                    allowed = true;
                    break;
                }
            }
        }

        if (!allowed) {
            return {
                valid: false,
                error: `Access Denied: Path '${inputPath}' is not within any allowed whitelist directory.\nActive Whitelist:\n${allowedPaths.map(p => `  - ${p}`).join('\n')}\nAdd this directory in ST-Toolbox settings if you want to allow access.`,
            };
        }

        return { valid: true, resolvedPath: resolved };
    }

    /**
     * Check if a shell command contains catastrophic destructive actions
     */
    checkCommandRisk(command) {
        if (!command || typeof command !== 'string') return { isHighRisk: false };

        const highRiskPatterns = [
            /\brm\s+-rf\s+[\/\\]/i,
            /\bmkfs\b/i,
            /\bformat\s+[a-z]:/i,
            /\bdiskpart\b/i,
            /\bdel\s+\/[sfq]\s+c:\\/i,
            /\bshutdown\b/i,
            /\bdrop\s+database\b/i,
        ];

        for (const pattern of highRiskPatterns) {
            if (pattern.test(command)) {
                return {
                    isHighRisk: true,
                    reason: `Command matches critical destructive pattern: ${pattern.toString()}`,
                };
            }
        }

        return { isHighRisk: false };
    }
}
