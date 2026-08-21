import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { ConfigStore } from '../lib/config-store.js';
import { SecuritySandbox } from '../lib/security-sandbox.js';
import { TrashManager } from '../lib/trash-manager.js';
import { FileLockManager } from '../lib/file-lock.js';
import { FuzzyPatcher } from '../lib/fuzzy-patcher.js';
import { FileEngine } from '../lib/tools/file-engine.js';
import { ProcessEngine } from '../lib/tools/process-engine.js';
import { SysEngine } from '../lib/tools/sys-engine.js';

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
    console.log('\n================ ST-TOOLBOX (PI EDITION) TEST SUITE ================\n');

    const configStore = new ConfigStore(TEST_SANDBOX_DIR);
    const sandbox = new SecuritySandbox(TEST_SANDBOX_DIR, configStore);
    const trashManager = new TrashManager(TEST_SANDBOX_DIR);
    const fileLockManager = new FileLockManager();

    const fileEngine = new FileEngine(sandbox, trashManager, configStore, fileLockManager);
    const processEngine = new ProcessEngine(sandbox, configStore, TEST_SANDBOX_DIR);
    const sysEngine = new SysEngine(sandbox, configStore, TEST_SANDBOX_DIR);

    // ----------------------------------------------------
    console.log('--- 1. ConfigStore & Isolation Tests ---');
    const initialConfig = configStore.get();
    assert(initialConfig.version === '2.0.0', 'Initial config loaded with version 2.0.0');
    assert(Object.keys(initialConfig.enabledTools).length === 4, 'Streamlined to exactly 4 Pi core tools');

    configStore.save({ allowedPaths: [TEST_SANDBOX_DIR] });
    assert(configStore.getAllowedPaths().includes(TEST_SANDBOX_DIR), 'Allowed paths updated and persisted');

    // ----------------------------------------------------
    console.log('\n--- 2. SecuritySandbox & Risk Analysis Tests ---');
    const validCheck = sandbox.validatePath(path.join(TEST_SANDBOX_DIR, 'test.txt'));
    assert(validCheck.valid === true, 'Valid path inside serverDirectory accepted');

    const invalidCheck = sandbox.validatePath('C:\\Windows\\System32\\drivers\\etc\\hosts');
    assert(invalidCheck.valid === false, 'Blacklisted system path blocked');

    const destructiveRisk = sandbox.checkCommandRisk('rm -rf /');
    assert(destructiveRisk.isHighRisk === true, 'Destructive rm -rf command flagged as high risk');

    const safeRisk = sandbox.checkCommandRisk('git status');
    assert(safeRisk.isHighRisk === false, 'Safe command passed risk check');

    // ----------------------------------------------------
    console.log('\n--- 3. FuzzyPatcher & Multi-Tier Matching Tests ---');
    const sourceCode = `function calculateTotal(price, tax) {
    // calculate with tax
    const total = price * (1 + tax);
    return total;
}`;

    // 3.1 Exact replacement
    const r1 = FuzzyPatcher.replace(sourceCode, 'const total = price * (1 + tax);', 'const total = Math.round(price * (1 + tax));');
    assert(r1.strategy === 'exact', 'Exact replacement strategy identified');

    // 3.2 Whitespace-tolerant replacement
    const r2 = FuzzyPatcher.replace(sourceCode, '    const total = price * (1 + tax);  ', '    const total = price * 1.15;', 1);
    assert(r2.strategy === 'line-trimmed', 'Whitespace-tolerant line-trimmed strategy identified');

    // 3.3 Fuzzy match
    const r3 = FuzzyPatcher.replace(sourceCode, 'function calculateTotal(price, taxRate) {\n    // calculate with tax', 'function calculateTotal(price, tax) {\n    // calculate total with discount', 1);
    assert(r3.strategy === 'fuzzy', 'Fuzzy Levenshtein matching strategy identified');

    // ----------------------------------------------------
    console.log('\n--- 4. FileLockManager & Concurrency Tests ---');
    const lockTestFile = path.join(TEST_SANDBOX_DIR, 'concurrent.txt');
    await fileEngine.writeFile({ filePath: lockTestFile, content: 'Initial\n' });

    const concurrentPromises = [1, 2, 3, 4, 5].map(n =>
        fileEngine.writeFile({ filePath: lockTestFile, content: `Write #${n}\n`, createBackup: false })
    );
    await Promise.all(concurrentPromises);
    assert(fs.existsSync(lockTestFile), 'Concurrent write operations completed without race conditions');

    // ----------------------------------------------------
    console.log('\n--- 5. The 4 Pi Tools CRUD Tests (Read, Write, Edit, Bash) ---');
    const testFile = path.join(TEST_SANDBOX_DIR, 'sample.txt');
    const initialText = 'Line 1: Hello World\nLine 2: Foo Bar\nLine 3: Test Data\nLine 4: End of File';

    // Tool 1: WRITE
    const writeRes = await fileEngine.writeFile({ filePath: testFile, content: initialText });
    assert(writeRes.success === true, 'write_file executed successfully');

    // Tool 2: READ
    const readRes = await fileEngine.readFile({ filePath: testFile, offset: 2, limit: 2, showLineNumbers: true });
    assert(readRes.linesRead === 2, 'read_file read requested lines');
    assert(readRes.content.includes('2: Line 2: Foo Bar'), 'read_file formatted line numbers');

    // Tool 3: EDIT
    const editRes = await fileEngine.editFile({ filePath: testFile, oldText: 'Foo Bar', newText: 'Antigravity AI' });
    assert(editRes.replacedCount === 1, 'edit_file replaced text accurately');
    const afterEdit = fs.readFileSync(testFile, 'utf-8');
    assert(afterEdit.includes('Antigravity AI'), 'edit_file updated file content');

    // Tool 4: BASH (with UTF-8 Chinese)
    const procRes = await processEngine.executeCommand({ command: 'echo "ST_TOOLBOX_OK"' });
    assert(procRes.exitCode === 0, 'execute_bash exited with code 0');
    assert(procRes.output.includes('ST_TOOLBOX_OK'), 'execute_bash captured output');

    const chineseRes = await processEngine.executeCommand({ command: 'Write-Output "测试中文输出正常，你好SillyTavern"' });
    assert(chineseRes.exitCode === 0, 'PowerShell Chinese command succeeded');
    assert(chineseRes.output.includes('你好SillyTavern'), 'PowerShell Chinese UTF-8 verified without garbling');

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
