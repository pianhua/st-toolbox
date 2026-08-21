import fs from 'node:fs';
import path from 'node:path';
import { writeFileSyncAtomic } from './atomic-write.js';

const DEFAULT_CONFIG = {
    version: '2.0.0',
    allowedPaths: [],
    enabledTools: {
        read_file: true,
        write_file: true,
        edit_file: true,
        patch_file: true,
        copy_file: true,
        move_file: true,
        delete_file: true,
        restore_file: true,
        list_directory: true,
        search_files: true,
        find_by_name: true,
        execute_bash: true,
        http_request: true,
        fetch_webpage: true,
        get_environment: true,
    },
    security: {
        allowPermanentDelete: true,
        maxOutputSize: 512 * 1024, // 512 KB
        defaultTimeout: 30000,     // 30s
        maxSearchDepth: 10,
        maxSearchResults: 100,
        enableAutoBackupOnOverwrite: true,
    },
};

export class ConfigStore {
    constructor(serverDirectory) {
        this.serverDirectory = serverDirectory;
        this.configDir = path.join(this.serverDirectory, 'data', 'st-toolbox');
        this.configFile = path.join(this.configDir, 'config.json');
        this.config = this.#load();
    }

    #load() {
        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            if (fs.existsSync(this.configFile)) {
                const raw = fs.readFileSync(this.configFile, 'utf-8');
                const parsed = JSON.parse(raw);
                return {
                    ...DEFAULT_CONFIG,
                    ...parsed,
                    enabledTools: {
                        ...DEFAULT_CONFIG.enabledTools,
                        ...(parsed.enabledTools || {}),
                    },
                    security: {
                        ...DEFAULT_CONFIG.security,
                        ...(parsed.security || {}),
                    },
                };
            }
        } catch (error) {
            console.error('[ST-Toolbox ConfigStore] Error loading config, using defaults:', error);
        }

        // Save default config
        this.save(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
    }

    get() {
        return this.config;
    }

    getAllowedPaths() {
        return this.config.allowedPaths || [];
    }

    getEnabledTools() {
        return this.config.enabledTools || {};
    }

    getSecurityConfig() {
        return this.config.security || DEFAULT_CONFIG.security;
    }

    save(newConfig) {
        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            this.config = {
                ...this.config,
                ...newConfig,
                enabledTools: {
                    ...(this.config?.enabledTools || DEFAULT_CONFIG.enabledTools),
                    ...(newConfig.enabledTools || {}),
                },
                security: {
                    ...(this.config?.security || DEFAULT_CONFIG.security),
                    ...(newConfig.security || {}),
                },
            };

            writeFileSyncAtomic(
                this.configFile,
                JSON.stringify(this.config, null, 2),
                'utf-8',
            );
            return this.config;
        } catch (error) {
            console.error('[ST-Toolbox ConfigStore] Error saving config:', error);
            throw error;
        }
    }
}
