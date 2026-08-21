# ST Toolbox

A minimalist, production-ready AI Tool Calling extension for SillyTavern.

Inspired by the Unix philosophy and minimalist terminal coding agents (such as `pi-mono`), ST Toolbox replaces bloated tool suites with **4 essential atomic tools**, reducing prompt token overhead by over 90% while providing full filesystem and execution capabilities.

---

## Features

- **Minimalist Toolset**: Exactly 4 core tools (`read_file`, `write_file`, `edit_file`, `execute_bash`) consuming only ~300 prompt tokens per turn.
- **Intelligent Diff & Fuzzy Match**: Multi-tier text replacement engine (exact, line-trimmed, and Levenshtein sliding window) to tolerate minor indentation or line-ending mismatches.
- **Race Condition Protection**: Path-based asynchronous Mutex locking (`FileLockManager`) ensures safe concurrent tool executions.
- **Windows UTF-8 Console**: Automatically configures PowerShell console encoding to prevent garbled Chinese/Unicode text in output.
- **Sandboxed Security**: Directory whitelist enforcement with path traversal defense (`../`), symlink resolution, and sensitive system directory blacklisting.
- **Zero External Dependencies**: Implemented in pure native Node.js ES modules.

---

## Tool Reference

| Tool | Parameters | Description |
|---|---|---|
| `read_file` | `filePath`, `offset?`, `limit?`, `showLineNumbers?` | Reads file content with optional line slicing and line numbering. |
| `write_file` | `filePath`, `content` | Atomically creates or overwrites a file with parent directory auto-creation. |
| `edit_file` | `filePath`, `oldText`, `newText` | Replaces target code block using whitespace-tolerant fuzzy matching. |
| `execute_bash` | `command`, `cwd?`, `timeout?` | Executes shell / PowerShell commands with UTF-8 console output. |

> **Note**: System tasks such as listing directories (`ls`/`dir`), searching code (`grep`/`findstr`), and Git version control can be performed directly via `execute_bash`.

---

## Installation

### Method 1: Web UI Install (Recommended)

1. Open SillyTavern, go to **Extensions** panel.
2. Click **Install Extension** and paste:
   ```
   https://github.com/pianhua/st-toolbox.git
   ```
3. Click **Install**.
4. Run `install.bat` (Windows) or `bash install.sh` (Linux/macOS) in the installed folder to link the server plugin, or manually symlink to `plugins/st-toolbox`.
5. Ensure `enableServerPlugins: true` is enabled in `config.yaml`.

### Method 2: Manual Installation

```bash
# Clone to client extensions directory
git clone https://github.com/pianhua/st-toolbox.git public/scripts/extensions/third-party/st-toolbox

# Link or copy to server plugins directory
# Windows (cmd as Administrator):
mklink /J plugins\st-toolbox public\scripts\extensions\third-party\st-toolbox

# Linux / macOS:
ln -s ../public/scripts/extensions/third-party/st-toolbox plugins/st-toolbox
```

---

## Configuration

1. In SillyTavern, open the **ST Toolbox** drawer in the Extensions panel.
2. Add your allowed directories to the **Allowed Paths** list (e.g., `~/Desktop`, `D:\Projects`).
3. Click **Save Config**.

---

## Development & Testing

Run the automated test suite:

```bash
npm test
```

---

## License

[MIT](LICENSE)
