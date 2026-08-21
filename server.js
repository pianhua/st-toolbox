import path from 'node:path';
import { ConfigStore } from './lib/config-store.js';
import { SecuritySandbox } from './lib/security-sandbox.js';
import { TrashManager } from './lib/trash-manager.js';
import { FileLockManager } from './lib/file-lock.js';
import { FileEngine } from './lib/tools/file-engine.js';
import { ProcessEngine } from './lib/tools/process-engine.js';
import { SysEngine } from './lib/tools/sys-engine.js';

// Resolve serverDirectory defensively
let serverDirectory = process.cwd();
try {
    const serverDirModule = await import('../../src/server-directory.js');
    if (serverDirModule?.serverDirectory) {
        serverDirectory = serverDirModule.serverDirectory;
    }
} catch (e) {
    // Fallback to process.cwd()
}

export const info = {
    id: 'st-toolbox',
    name: 'ST Toolbox (Pi Edition)',
    description: 'Minimalist, industrial-grade AI tool calling suite (Read, Write, Edit, Bash) for SillyTavern.',
};

export async function init(router) {
    console.log('[ST-Toolbox] Initializing Pi-minimalist server plugin in:', serverDirectory);

    const configStore = new ConfigStore(serverDirectory);
    const sandbox = new SecuritySandbox(serverDirectory, configStore);
    const trashManager = new TrashManager(serverDirectory);
    const fileLockManager = new FileLockManager();

    const fileEngine = new FileEngine(sandbox, trashManager, configStore, fileLockManager);
    const processEngine = new ProcessEngine(sandbox, configStore, serverDirectory);
    const sysEngine = new SysEngine(sandbox, configStore, serverDirectory);

    // ================= CONFIG & DIAGNOSTICS =================
    router.get('/config', async (req, res) => {
        try {
            res.json(configStore.get());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/config', async (req, res) => {
        try {
            const updated = configStore.save(req.body);
            res.json({ success: true, config: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/config/test-path', async (req, res) => {
        try {
            const { testPath } = req.body;
            const validation = sandbox.validatePath(testPath);
            res.json(validation);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/get_environment', async (req, res) => {
        try {
            const result = await sysEngine.getEnvironment();
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ================= THE 4 PI CORE TOOLS =================
    // 1. READ
    router.post('/read', async (req, res) => {
        try {
            const result = await fileEngine.readFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // 2. WRITE
    router.post('/write', async (req, res) => {
        try {
            const result = await fileEngine.writeFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // 3. EDIT (Intelligent Fuzzy Patcher)
    router.post('/edit', async (req, res) => {
        try {
            const result = await fileEngine.editFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // 4. BASH (PowerShell UTF-8 / Bash)
    router.post('/bash', async (req, res) => {
        try {
            const result = await processEngine.executeCommand(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    console.log('[ST-Toolbox] Pi-Edition server plugin loaded with 4 core tool endpoints.');
}

export async function exit() {
    console.log('[ST-Toolbox] Server plugin shutting down.');
}
