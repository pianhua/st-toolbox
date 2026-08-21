import path from 'node:path';
import { ConfigStore } from './lib/config-store.js';
import { SecuritySandbox } from './lib/security-sandbox.js';
import { TrashManager } from './lib/trash-manager.js';
import { FileEngine } from './lib/tools/file-engine.js';
import { SearchEngine } from './lib/tools/search-engine.js';
import { ProcessEngine } from './lib/tools/process-engine.js';
import { NetEngine } from './lib/tools/net-engine.js';
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
    name: 'ST Toolbox v2.0',
    description: 'High-performance AI Tool Calling suite with sandboxed filesystem, diff patching, fast search, shell execution, webpage scraping, and system diagnostics for SillyTavern.',
};

export async function init(router) {
    console.log('[ST-Toolbox v2.0] Initializing server plugin in:', serverDirectory);

    const configStore = new ConfigStore(serverDirectory);
    const sandbox = new SecuritySandbox(serverDirectory, configStore);
    const trashManager = new TrashManager(serverDirectory);

    const fileEngine = new FileEngine(sandbox, trashManager, configStore);
    const searchEngine = new SearchEngine(sandbox, configStore);
    const processEngine = new ProcessEngine(sandbox, configStore, serverDirectory);
    const netEngine = new NetEngine(configStore);
    const sysEngine = new SysEngine(sandbox, configStore, serverDirectory);

    // ================= CONFIG & MANAGEMENT =================
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

    // ================= TRASH MANAGEMENT =================
    router.get('/trash', async (req, res) => {
        try {
            res.json(trashManager.list());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/trash/restore', async (req, res) => {
        try {
            const { identifier } = req.body;
            const result = trashManager.restore(identifier);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ================= 1. FILE OPERATIONS =================
    router.post('/read', async (req, res) => {
        try {
            const result = await fileEngine.readFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/write', async (req, res) => {
        try {
            const result = await fileEngine.writeFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/edit', async (req, res) => {
        try {
            const result = await fileEngine.editFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/patch', async (req, res) => {
        try {
            const result = await fileEngine.patchFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/copy', async (req, res) => {
        try {
            const result = await fileEngine.copyFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/move', async (req, res) => {
        try {
            const result = await fileEngine.moveFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/delete', async (req, res) => {
        try {
            const result = await fileEngine.deleteFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/restore', async (req, res) => {
        try {
            const result = await fileEngine.restoreFile(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ================= 2. SEARCH & DISCOVERY =================
    router.post('/list_directory', async (req, res) => {
        try {
            const result = await searchEngine.listDirectory(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/search_files', async (req, res) => {
        try {
            const result = await searchEngine.searchFiles(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/find_by_name', async (req, res) => {
        try {
            const result = await searchEngine.findByName(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ================= 3. SHELL & PROCESS =================
    router.post('/bash', async (req, res) => {
        try {
            const result = await processEngine.executeCommand(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ================= 4. NETWORK & WEBPAGE =================
    router.post('/http_request', async (req, res) => {
        try {
            const result = await netEngine.httpRequest(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/fetch_webpage', async (req, res) => {
        try {
            const result = await netEngine.fetchWebpage(req.body);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ================= 5. SYSTEM DIAGNOSTICS =================
    router.post('/get_environment', async (req, res) => {
        try {
            const result = await sysEngine.getEnvironment();
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    console.log('[ST-Toolbox v2.0] Plugin loaded with 15 endpoints.');
}

export async function exit() {
    console.log('[ST-Toolbox v2.0] Server plugin shutting down.');
}
