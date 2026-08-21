export function registerSlashCommands(context, apiPrefix) {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE, toastr } = context;
    if (!SlashCommandParser || !SlashCommand) {
        return;
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'toolbox-status',
        aliases: ['st-toolbox'],
        helpString: 'Displays current ST-Toolbox diagnostics and active whitelist paths.',
        callback: async () => {
            try {
                const res = await fetch(`${apiPrefix}/get_environment`, {
                    method: 'POST',
                    headers: context.getRequestHeaders ? context.getRequestHeaders() : {},
                });
                const env = await res.json();
                const text = `**ST-Toolbox Status (Pi Edition)**:\n- **Platform**: ${env.platform} (${env.arch})\n- **Memory**: ${env.memory.usedMB}MB / ${env.memory.totalMB}MB\n- **Allowed Paths**:\n${(env.allowedPaths || []).map(p => `  - \`${p}\``).join('\n')}`;
                if (toastr) toastr.info(text, 'ST-Toolbox Status', { timeOut: 6000 });
                return text;
            } catch (e) {
                return `Error: ${e.message}`;
            }
        },
    }));

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
                const msg = data.valid ? `✅ Path is valid: ${data.resolvedPath}` : `❌ Path blocked: ${data.error}`;
                if (toastr) {
                    if (data.valid) toastr.success(msg);
                    else toastr.error(msg);
                }
                return msg;
            } catch (e) {
                return `Error: ${e.message}`;
            }
        },
    }));
}
