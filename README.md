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
- Git installed on the server machine

### Step 1: Install Client Extension

1. Open SillyTavern in your browser
2. Navigate to the **Extensions** panel (sidebar)
3. Click the **"Install extension"** button (cloud download icon)
4. Enter the Git repository URL: `https://github.com/st-toolbox/st-toolbox`
5. Click **"Install"** (or "Install just for me" / "Install for all users" for admin users)
6. Wait for installation to complete
7. **Reload the page** to activate the extension

### Step 2: Install Server Plugin

The server plugin provides the actual file system and shell operations. You need to install it manually:

1. Copy the `server-plugin/` directory to your SillyTavern installation's `plugins/` directory
2. The final structure should be:
   ```
   SillyTavern/
   ├── plugins/
   │   └── st-toolbox/
   │       ├── index.js
   │       ├── package.json
   │       └── README.md
   └── ...
   ```

### Step 3: Enable Server Plugins

Edit your `config.yaml` file in the SillyTavern root directory:

```yaml
enableServerPlugins: true
enableServerPluginsAutoUpdate: true
```

### Step 4: Restart SillyTavern

Restart the SillyTavern server to load the server plugin.

### Step 5: Verify Installation

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
3. Verify both client extension and server plugin are installed
4. Restart SillyTavern after installing the server plugin

### Permission errors

1. Ensure the SillyTavern process has read/write permissions to the project directory
2. Check if the file path is within the project directory (security restriction)

### PowerShell encoding issues (Windows)

The extension automatically uses PowerShell with UTF-8 encoding. If you still see garbled characters:

1. Open PowerShell as Administrator
2. Run: `chcp 65001`
3. Restart SillyTavern

## Uninstallation

### Remove Client Extension

1. Open SillyTavern Extensions panel
2. Find "ST Toolbox" in the list
3. Click the delete button (trash icon)
4. Confirm deletion

### Remove Server Plugin

1. Delete the `plugins/st-toolbox/` directory from your SillyTavern installation
2. Set `enableServerPlugins: false` in `config.yaml` (optional)
3. Restart SillyTavern

## Directory Structure

```
st-toolbox/
├── client-extension/          # Client-side extension (install via Git URL)
│   ├── manifest.json
│   └── index.js
├── server-plugin/             # Server-side plugin (manual installation)
│   ├── index.js
│   ├── package.json
│   └── README.md
└── README.md                  # This file
```

## Development

### Building from Source

1. Clone this repository
2. Copy `client-extension/` to `public/scripts/extensions/third-party/st-toolbox/`
3. Copy `server-plugin/` to `plugins/st-toolbox/`
4. Enable server plugins in `config.yaml`
5. Restart SillyTavern

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to modify and distribute.

## Support

For issues or feature requests, please open an issue on the GitHub repository.
