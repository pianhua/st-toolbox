import os from 'node:os';
import process from 'node:process';

export class SysEngine {
    constructor(sandbox, configStore, serverDirectory) {
        this.sandbox = sandbox;
        this.configStore = configStore;
        this.serverDirectory = serverDirectory;
    }

    /**
     * Collect system metrics and diagnostic environment
     */
    async getEnvironment() {
        const cpus = os.cpus() || [];
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = process.memoryUsage();

        return {
            platform: process.platform,
            arch: process.arch,
            osRelease: os.release(),
            osType: os.type(),
            hostname: os.hostname(),
            cpuModel: cpus[0]?.model || 'Unknown',
            cpuCores: cpus.length,
            memory: {
                totalMB: Math.round(totalMem / (1024 * 1024)),
                freeMB: Math.round(freeMem / (1024 * 1024)),
                usedMB: Math.round((totalMem - freeMem) / (1024 * 1024)),
                processHeapUsedMB: Math.round(memUsage.heapUsed / (1024 * 1024)),
            },
            nodeVersion: process.version,
            serverDirectory: this.serverDirectory,
            cwd: process.cwd(),
            processUptimeSeconds: Math.round(process.uptime()),
            systemUptimeSeconds: Math.round(os.uptime()),
            allowedPaths: this.sandbox.getAllowedPaths(),
            enabledTools: this.configStore.getEnabledTools(),
        };
    }
}
