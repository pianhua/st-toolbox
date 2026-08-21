import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { createToolDefinitions } from './src/tool-definitions.js';
import { SettingsController } from './src/settings-controller.js';
import { registerSlashCommands } from './src/slash-commands.js';

const EXTENSION_NAME = 'third-party/st-toolbox';
const API_PREFIX = '/api/plugins/st-toolbox';

let context;
let ToolManager;
let settingsController;
let allTools = [];
const registeredToolNames = new Set();

/**
 * Register or unregister tools based on user configuration
 */
function syncRegisteredTools(config) {
    if (!ToolManager) return;

    const enabledMap = config?.enabledTools || {};

    allTools.forEach(tool => {
        const isEnabled = enabledMap[tool.name] !== false; // Default true

        if (isEnabled && !registeredToolNames.has(tool.name)) {
            ToolManager.registerFunctionTool(tool);
            registeredToolNames.add(tool.name);
            console.log(`[${EXTENSION_NAME}] Registered tool: ${tool.name}`);
        } else if (!isEnabled && registeredToolNames.has(tool.name)) {
            ToolManager.unregisterFunctionTool(tool.name);
            registeredToolNames.delete(tool.name);
            console.log(`[${EXTENSION_NAME}] Unregistered tool: ${tool.name}`);
        }
    });
}

/**
 * Main initialization entry point
 */
export async function init() {
    console.log(`[${EXTENSION_NAME}] Initializing ST-Toolbox (Pi Edition)...`);

    context = getContext();
    ToolManager = context.ToolManager;

    if (!ToolManager) {
        console.error(`[${EXTENSION_NAME}] ToolManager is not available in current ST environment.`);
        return;
    }

    // Instantiate settings controller
    settingsController = new SettingsController(
        API_PREFIX,
        context.getRequestHeaders,
        ToolManager,
        (updatedConfig) => syncRegisteredTools(updatedConfig),
    );

    // Create 4 Pi core tool definitions
    allTools = createToolDefinitions(
        API_PREFIX,
        context.getRequestHeaders,
        (endpoint, payload, result, duration, isSuccess) => {
            settingsController.addLog(endpoint, payload, result, duration, isSuccess);
        },
    );

    // Register slash commands (/toolbox-status, /toolbox-test)
    registerSlashCommands(context, API_PREFIX);

    // Load HTML settings template from extension root
    try {
        const templateHtml = await renderExtensionTemplateAsync(EXTENSION_NAME, 'settings');
        const container = $('#extensions_settings').length ? $('#extensions_settings') : $('#extensions_settings2');

        if (container.length > 0) {
            container.append(templateHtml);
            await settingsController.init();
            console.log(`[${EXTENSION_NAME}] Settings UI loaded.`);
        } else {
            console.warn(`[${EXTENSION_NAME}] Extensions settings container not found in DOM.`);
        }
    } catch (err) {
        console.error(`[${EXTENSION_NAME}] Error loading settings template:`, err);
    }

    console.log(`[${EXTENSION_NAME}] ST-Toolbox (Pi Edition) initialized successfully with ${allTools.length} core tools.`);
}
