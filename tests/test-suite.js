import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { ConfigStore } from '../server-plugin/lib/config-store.js';
import { SecuritySandbox } from '../server-plugin/lib/security-sandbox.js';
import { TrashManager } from '../server-plugin/lib/trash-manager.js';
import { FileEngine } from '../server-plugin/lib/tools/file-engine.js';
import { SearchEngine } from '../server-plugin/lib/tools/search-engine.js';
import { ProcessEngine } from '../server-plugin/lib/tools/process-engine.js';
import { NetEngine } from '../server-plugin/lib/tools/net-engine.js';
import { SysEngine } from '../server-plugin/lib/tools/sys-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temporary test environment sandbox
const TEST_SANDBOX_DIR = path.join(__dirname, 'sandbox_temp');
if (fs.existsSync(TEST_SANDBOX_DIR)) {
    fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_SANDBOX_DIR, { recursive: true });

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`  ❌ FAILED: ${message}`);
        failed++;
        throw new Error(message);
    } else {
        console.log(`  ✅ PASSED: ${message}`);
        passed++;
    }
}

async function runTests() {
    console.log('\n================ ST-TOOLBOX v2.0 TEST SUITE ================\n');

    const configStore = new ConfigStore(TEST_SANDBOX_DIR);
    const sandbox = new SecuritySandbox(TEST_SANDBOX_DIR, configStore);
    const trashManager = new TrashManager(TEST_SANDBOX_DIR);
    const fileEngine = new FileEngine(sandbox, trashManager, configStore);
    const searchEngine = new SearchEngine(sandbox, configStore);
    const processEngine = new ProcessEngine(sandbox, configStore, TEST_SANDBOX_DIR);
    const netEngine = new NetEngine(configStore);
    const sysEngine = new SysEngine(sandbox, configStore, TEST_SANDBOX_DIR);

    // ----------------------------------------------------
    console.log('--- 1. ConfigStore Tests ---');
    const initialConfig = configStore.get();
    assert(initialConfig.version === '2.0.0', 'Initial config loaded with version 2.0.0');

    configStore.save({ allowedPaths: [TEST_SANDBOX_DIR] });
    assert(configStore.getAllowedPaths().includes(TEST_SANDBOX_DIR), 'Allowed paths updated and persisted');

    // ----------------------------------------------------
    console.log('\n--- 2. SecuritySandbox Tests ---');
    const validCheck = sandbox.validatePath(path.join(TEST_SANDBOX_DIR, 'test.txt'));
    assert(validCheck.valid === true, 'Valid path inside serverDirectory accepted');

    const invalidCheck = sandbox.validatePath('C:\\Windows\\System32\\drivers\\etc\\hosts');
    assert(invalidCheck.valid === false, 'Blacklisted system path blocked');

    // ----------------------------------------------------
    console.log('\n--- 3. FileEngine CRUD & Patch Tests ---');
    const testFile = path.join(TEST_SANDBOX_DIR, 'sample.txt');
    const initialText = 'Line 1: Hello World\nLine 2: Foo Bar\nLine 3: Test Data\nLine 4: End of File';

    // Write file
    const writeRes = await fileEngine.writeFile({ filePath: testFile, content: initialText });
    assert(writeRes.success === true, 'writeFile executed successfully');
    assert(fs.existsSync(testFile), 'File physically created on disk');

    // Read file with line numbers & offset
    const readRes = await fileEngine.readFile({ filePath: testFile, offset: 2, limit: 2, showLineNumbers: true });
    assert(readRes.linesRead === 2, 'readFile read correct slice');
    assert(readRes.content.includes('2: Line 2: Foo Bar'), 'readFile formatted line numbers');

    // Edit file (exact replace)
    const editRes = await fileEngine.editFile({ filePath: testFile, oldText: 'Foo Bar', newText: 'Antigravity AI' });
    assert(editRes.replacedCount === 1, 'editFile replaced 1 occurrence');
    const afterEdit = fs.readFileSync(testFile, 'utf-8');
    assert(afterEdit.includes('Antigravity AI'), 'File content updated after edit');

    // Patch file (multi-chunk)
    const patchRes = await fileEngine.patchFile({
        filePath: testFile,
        patches: [
            { oldText: 'Hello World', newText: 'Hello SillyTavern' },
            { oldText: 'End of File', newText: 'End of Stream' },
        ],
    });
    assert(patchRes.patchesApplied === 2, 'patchFile applied 2 chunks');
    const afterPatch = fs.readFileSync(testFile, 'utf-8');
    assert(afterPatch.includes('Hello SillyTavern') && afterPatch.includes('End of Stream'), 'All patches successfully applied');

    // Copy file
    const copyTarget = path.join(TEST_SANDBOX_DIR, 'sample_copy.txt');
    await fileEngine.copyFile({ sourcePath: testFile, destinationPath: copyTarget });
    assert(fs.existsSync(copyTarget), 'copyFile created duplicate');

    // Move file
    const moveTarget = path.join(TEST_SANDBOX_DIR, 'sample_moved.txt');
    await fileEngine.moveFile({ sourcePath: copyTarget, destinationPath: moveTarget });
    assert(!fs.existsSync(copyTarget) && fs.existsSync(moveTarget), 'moveFile successfully relocated file');

    // ----------------------------------------------------
    console.log('\n--- 4. TrashManager & Restore Tests ---');
    const deleteRes = await fileEngine.deleteFile({ filePath: moveTarget, permanent: false });
    assert(deleteRes.deleted === true && !deleteRes.permanent, 'deleteFile safely moved file to trash');
    assert(!fs.existsSync(moveTarget), 'Original file removed from source path');

    const restoreRes = await fileEngine.restoreFile({ identifier: deleteRes.trashId });
    assert(restoreRes.success === true, 'restoreFile successfully restored file');
    assert(fs.existsSync(moveTarget), 'Restored file exists back at original path');

    // ----------------------------------------------------
    console.log('\n--- 5. SearchEngine Tests ---');
    const listRes = await searchEngine.listDirectory({ dirPath: TEST_SANDBOX_DIR });
    assert(listRes.totalItems >= 2, 'listDirectory returned items in directory');

    const grepRes = await searchEngine.searchFiles({ query: 'SillyTavern', path: TEST_SANDBOX_DIR });
    assert(grepRes.totalFilesMatched >= 1, 'searchFiles found matching occurrences');

    const findRes = await searchEngine.findByName({ pattern: '*.txt', path: TEST_SANDBOX_DIR });
    assert(findRes.totalMatches >= 2, 'findByName matched glob pattern');

    // ----------------------------------------------------
    console.log('\n--- 6. ProcessEngine & UTF-8 Tests ---');
    const procRes = await processEngine.executeCommand({ command: 'echo "ST_TOOLBOX_OK"' });
    assert(procRes.exitCode === 0, 'executeCommand exited with code 0');
    assert(procRes.output.includes('ST_TOOLBOX_OK'), 'executeCommand captured stdout output');

    const chineseRes = await processEngine.executeCommand({ command: 'Write-Output "测试中文无乱码，你好SillyTavern"' });
    assert(chineseRes.exitCode === 0, 'executeCommand Chinese echo exited with code 0');
    assert(chineseRes.output.includes('你好SillyTavern'), 'PowerShell Chinese UTF-8 verified without garbled text');

    // ----------------------------------------------------
    console.log('\n--- 7. NetEngine Tests ---');
    assert(typeof netEngine.httpRequest === 'function', 'NetEngine httpRequest available');
    assert(typeof netEngine.fetchWebpage === 'function', 'NetEngine fetchWebpage available');

    // ----------------------------------------------------
    console.log('\n--- 8. SysEngine Tests ---');
    const env = await sysEngine.getEnvironment();
    assert(env.platform === process.platform, 'SysEngine retrieved current platform');
    assert(env.memory.totalMB > 0, 'SysEngine retrieved memory metrics');
    assert(Array.isArray(env.allowedPaths), 'SysEngine retrieved allowed paths');

    // ----------------------------------------------------
    // Cleanup temporary test sandbox
    try {
        fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
    } catch (e) {}

    console.log(`\n================ TEST SUMMARY ================`);
    console.log(`Total Passed: ${passed}`);
    console.log(`Total Failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unhandled test failure:', err);
    process.exit(1);
});
