export function registerSlashCommands(context, apiPrefix) {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE, toastr } = context;
    if (!SlashCommandParser || !SlashCommand) {
        console.warn('[ST-Toolbox] SlashCommandParser not available.');
        return;
    }

    // Command: /toolbox-status
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'toolbox-status',
        aliases: ['st-toolbox'],
        helpString: 'Displays the current ST-Toolbox environment diagnostics and active whitelist paths.',
        callback: async () => {
            try {
                const res = await fetch(`${apiPrefix}/get_environment`, {
                    method: 'POST',
                    headers: context.getRequestHeaders ? context.getRequestHeaders() : {},
                });
                const env = await res.json();
                const text = `**ST-Toolbox v2.0 Status**:\n- **Platform**: ${env.platform} (${env.arch})\n- **Node Version**: ${env.nodeVersion}\n- **Memory**: ${env.memory.usedMB}MB / ${env.memory.totalMB}MB\n- **Allowed Paths**:\n${(env.allowedPaths || []).map(p => `  - \`${p}\``).join('\n')}`;
                if (toastr) toastr.info(text, 'ST-Toolbox Status', { timeOut: 8000 });
                return text;
            } catch (e) {
                return `Error getting status: ${e.message}`;
            }
        },
    }));

    // Command: /toolbox-test <path>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'toolbox-test',
        helpString: 'Tests if a given path is within the allowed whitelist.',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Path to test',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: async (_, testPath) => {
            try {
                const res = await fetch(`${apiPrefix}/config/test-path`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(context.getRequestHeaders ? context.getRequestHeaders() : {}),
                    },
                    body: JSON.stringify({ testPath }),
                });
                const data = await res.json();
                if (data.valid) {
                    const msg = `✅ Path is valid: ${data.resolvedPath}`;
                    if (toastr) toastr.success(msg);
                    return msg;
                } else {
                    const msg = `❌ Path blocked: ${data.error}`;
                    if (toastr) toastr.error(msg);
                    return msg;
                }
            } catch (e) {
                return `Error: ${e.message}`;
            }
        },
    }));

    console.log('[ST-Toolbox] Registered slash commands: /toolbox-status, /toolbox-test');
}
