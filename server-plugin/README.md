# ST Toolbox - SillyTavern Extension

A powerful extension that provides filesystem and shell tools for AI assistants in SillyTavern.

## Features

- **10 Built-in Tools**: read, write, edit, bash, list_directory, search_files, get_environment, http_request, move_file, delete_file
- **Windows Support**: PowerShell with UTF-8 encoding for proper Chinese character display
- **Safe Deletion**: Files are moved to trash by default (recoverable)
- **Path Security**: All file operations are restricted to the SillyTavern project directory

## Installation

### Prerequisites

- SillyTavern v1.12.0 or later
- Node.js 18+ (for server-side plugin)

### Step 1: Enable Server Plugins

Edit your `config.yaml` file:

```yaml
enableServerPlugins: true
enableServerPluginsAutoUpdate: true
```

### Step 2: Install the Extension

1. Copy the `plugins/st-toolbox/` directory to your SillyTavern installation
2. Copy the `public/scripts/extensions/st-toolbox/` directory to your SillyTavern installation
3. Restart SillyTavern

### Step 3: Verify Installation

1. Open SillyTavern in your browser
2. Open browser Developer Tools (F12)
3. Check the Console for `[ST Toolbox]` messages
4. The extension should appear in the Extensions settings

## Available Tools

### 1. read_file
Reads the content of a file from the server.

**Parameters:**
- `filePath` (required): Absolute path to the file to read
- `offset` (optional): Line number to start reading from (1-based)
- `limit` (optional): Maximum number of lines to read

### 2. write_file
Writes content to a file on the server. Overwrites the file if it exists.

**Parameters:**
- `filePath` (required): Absolute path to the file to write
- `content` (required): Content to write to the file

### 3. edit_file
Edits a file on the server by replacing oldText with newText.

**Parameters:**
- `filePath` (required): Absolute path to the file to edit
- `oldText` (required): Text to find and replace
- `newText` (required): Text to replace oldText with

### 4. execute_bash
Executes a bash command on the server.

**Parameters:**
- `command` (required): Bash command to execute
- `timeout` (optional): Timeout in milliseconds (default: 30000)

### 5. list_directory
Lists all files and directories in a given path.

**Parameters:**
- `dirPath` (required): Path to the directory to list

### 6. search_files
Searches for text patterns within files using regular expressions.

**Parameters:**
- `query` (required): Regular expression pattern to search for
- `path` (optional): Directory path to search in
- `pattern` (optional): File name pattern to filter by (e.g., "*.js")

### 7. get_environment
Retrieves information about the server environment.

**Parameters:** None

### 8. http_request
Makes HTTP/HTTPS requests to external APIs or websites.

**Parameters:**
- `url` (required): URL to request
- `method` (optional): HTTP method (GET, POST, PUT, DELETE)
- `headers` (optional): Custom headers as key-value pairs
- `body` (optional): Request body for POST/PUT

### 9. move_file
Moves or renames a file or directory.

**Parameters:**
- `sourcePath` (required): Source file or directory path
- `destinationPath` (required): Destination path

### 10. delete_file
Safely deletes a file or directory.

**Parameters:**
- `filePath` (required): Path to file or directory to delete
- `permanent` (optional): Set to true for permanent deletion (default: false)

**Note:** By default, files are moved to trash (recoverable). Use `permanent: true` for permanent deletion.

## Multi-Swipe Limitation

**Important:** If you have "Function Calling" enabled in SillyTavern settings, the `multi-swipe` feature (n > 1) will be automatically disabled. This is because multi-swipe and tool calling are architecturally incompatible.

**Workaround:** If you need multi-swipe, disable "Function Calling" in settings.

## Troubleshooting

### Tools not appearing

1. Check if `enableServerPlugins: true` is set in `config.yaml`
2. Check browser console for `[ST Toolbox]` messages
3. Verify both `plugins/st-toolbox/` and `public/scripts/extensions/st-toolbox/` directories exist

### Permission errors

1. Ensure the SillyTavern process has read/write permissions to the project directory
2. Check if the file path is within the project directory (security restriction)

### PowerShell encoding issues (Windows)

The extension automatically uses PowerShell with UTF-8 encoding. If you still see garbled characters:

1. Open PowerShell as Administrator
2. Run: `chcp 65001`
3. Restart SillyTavern

## Uninstallation

1. Delete `plugins/st-toolbox/` directory
2. Delete `public/scripts/extensions/st-toolbox/` directory
3. Set `enableServerPlugins: false` in `config.yaml` (optional)
4. Restart SillyTavern

## Backup and Recovery

If you need to revert to the core implementation:

```bash
git checkout backup/tool-calling-core
```

This will restore the original tool calling implementation that was integrated into the core code.

## License

MIT License - feel free to modify and distribute.

## Support

For issues or feature requests, please open an issue on the GitHub repository.
