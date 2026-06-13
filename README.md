# ST Toolbox

<div align="center">

**让 SillyTavern AI 助手拥有文件系统和 Shell 工具能力**

[English](#english-version) | [中文](#中文版本)

</div>

---

# 中文版本

## 简介

**ST Toolbox** 是一个 SillyTavern 扩展，让 AI 助手能够：

- 读取、写入、编辑你的文件
- 列出目录、搜索文件内容
- 执行 Shell/PowerShell 命令
- 发送 HTTP 请求
- 移动、删除文件

所有文件操作都受**白名单目录**限制，避免 AI 随意访问整个系统。

> 如果你不想用扩展，而想直接修改 SillyTavern 核心代码，可以用备份版本：[st-toolbox-core](https://github.com/pianhua/st-toolbox-core)

---

## 功能特性

- **10 个内置工具**：read_file、write_file、edit_file、execute_bash、list_directory、search_files、get_environment、http_request、move_file、delete_file
- **白名单保护**：只允许访问 SillyTavern 项目目录和配置中允许的目录
- **网页设置界面**：在 Extensions 面板直接配置白名单，无需手动编辑 YAML
- **安全删除**：默认将文件移入 `data/.trash`，可恢复
- **Windows 优化**：PowerShell + UTF-8，中文不乱码
- **双语言界面**：设置面板为中文

---

## 安装教程

### 前置条件

- SillyTavern v1.12.0 或更高版本
- 服务器已安装 Git
- Node.js 环境（SillyTavern 本身需要）

### 方法一：自动安装（推荐）

SillyTavern 支持从 Git URL 直接安装扩展：

1. 在浏览器中打开 SillyTavern
2. 点击左侧边栏的 **Extensions（扩展）** 面板
3. 点击 **"Install extension"（安装扩展）** 按钮（云下载图标）
4. 输入 Git 仓库地址：
   ```
   https://github.com/pianhua/st-toolbox
   ```
5. 点击 **"Install"（安装）** 或 **"Install just for me"**
6. 等待安装完成

⚠️ **注意**：自动安装只会安装客户端扩展，服务端插件需要手动安装（见下一步）。

### 方法二：手动安装

#### 第 1 步：下载本仓库

```bash
# 下载 ZIP 或用 git 克隆
git clone https://github.com/pianhua/st-toolbox.git
```

#### 第 2 步：安装客户端扩展

将 `client-extension/` 目录下的所有文件复制到：

```
SillyTavern/public/scripts/extensions/third-party/st-toolbox/
```

复制后结构如下：

```
SillyTavern/public/scripts/extensions/third-party/st-toolbox/
├── manifest.json
├── index.js
└── settings.html
```

#### 第 3 步：安装服务端插件

将 `server-plugin/` 目录下的所有文件复制到：

```
SillyTavern/plugins/st-toolbox/
```

复制后结构如下：

```
SillyTavern/plugins/st-toolbox/
├── index.js
└── package.json
```

#### 第 4 步：启用服务端插件

编辑 SillyTavern 根目录下的 `config.yaml`，添加：

```yaml
enableServerPlugins: true
```

#### 第 5 步：重启 SillyTavern

```bash
# Windows
node server.js

# 或使用 Start.bat
```

---

## 使用方法

### 1. 配置白名单

1. 打开 SillyTavern 网页
2. 进入 **Extensions（扩展）** 面板
3. 找到 **ST Toolbox 设置**
4. 在 **白名单目录** 文本框中输入允许访问的目录，每行一个：
   ```
   C:\Users\你的用户名\Desktop
   C:\Users\你的用户名\Documents
   D:\Projects
   ```
5. 点击 **保存**

默认情况下，工具只能访问 SillyTavern 项目目录内的文件。

### 2. 启用工具调用

1. 打开任意聊天
2. 点击聊天输入框下方的 **工具图标**（或进入角色/全局设置）
3. 启用 **Function Calling / 工具调用**
4. 选择支持工具调用的模型（如 GPT-4、Claude 等）

### 3. 让 AI 使用工具

在聊天中直接告诉 AI 你的需求，例如：

> "帮我查看一下桌面有哪些文件"

AI 会自动调用 `list_directory` 工具，读取结果后会继续回复你。

---

## 可用工具

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `read_file` | 读取文件内容 | `filePath`, `offset?`, `limit?` |
| `write_file` | 写入/创建文件 | `filePath`, `content` |
| `edit_file` | 替换文件中的文本 | `filePath`, `oldText`, `newText` |
| `execute_bash` | 执行 Shell/PowerShell 命令 | `command`, `timeout?` |
| `list_directory` | 列出目录内容 | `dirPath` |
| `search_files` | 搜索文件内容 | `query`, `path?`, `pattern?` |
| `get_environment` | 获取服务器环境信息 | 无 |
| `http_request` | 发送 HTTP 请求 | `url`, `method?`, `headers?`, `body?` |
| `move_file` | 移动/重命名文件 | `sourcePath`, `destinationPath` |
| `delete_file` | 删除文件（默认安全删除） | `filePath`, `permanent?` |

---

## 目录结构

```
st-toolbox/
├── client-extension/          # 客户端扩展（浏览器端）
│   ├── manifest.json         # 扩展元数据
│   ├── index.js              # 扩展主逻辑
│   └── settings.html         # 设置界面（中文）
├── server-plugin/             # 服务端插件
│   ├── index.js              # 插件主逻辑
│   └── package.json          # 插件包信息
└── README.md                  # 本文件
```

---

## 常见问题

### 扩展加载失败，控制台报错

1. 强制刷新浏览器：`Ctrl + Shift + R`
2. 检查是否正确安装了服务端插件
3. 检查 `config.yaml` 中是否有 `enableServerPlugins: true`

### 工具没有出现

1. 确认使用的 AI 模型支持 Function Calling
2. 确认在 SillyTavern 设置中启用了工具调用
3. 服务端插件是否已加载（看服务器日志 `[ST Toolbox] initialized`）

### 文件访问被拒绝

1. 检查文件路径是否在白名单内
2. 检查 SillyTavern 进程是否有该目录的读写权限
3. 在 ST Toolbox 设置中添加目录到白名单

### 多 swipe 功能被禁用

工具调用和 multi-swipe（n > 1）在架构上不兼容。启用工具调用时，系统会自动禁用 multi-swipe。这是 SillyTavern 本身的限制，扩展无法绕过。

### 中文乱码（Windows）

本扩展已使用 UTF-8 编码执行 PowerShell。如果仍出现乱码：

```powershell
# 以管理员身份运行 PowerShell
chcp 65001
```

---

## 安全说明

- 所有文件操作都受白名单限制
- 删除文件默认移入 `data/.trash`，不是永久删除
- `execute_bash` 可以执行任意命令，请只在可信环境中使用
- 建议不要向不可信的 AI 服务暴露本扩展

---

## 卸载方法

1. 删除 `SillyTavern/plugins/st-toolbox/`
2. 删除 `SillyTavern/public/scripts/extensions/third-party/st-toolbox/`
3. 删除 `config.yaml` 中的 `st-toolbox` 配置（可选）
4. 重启 SillyTavern

---

## License

MIT License

---

# English Version

## Introduction

**ST Toolbox** is a SillyTavern extension that gives your AI assistant the ability to:

- Read, write, and edit files
- List directories and search file contents
- Execute Shell/PowerShell commands
- Send HTTP requests
- Move and delete files

All file operations are restricted by a **whitelist directory** system to prevent unauthorized access.

> If you prefer modifying SillyTavern core code instead of using an extension, check the backup version: [st-toolbox-core](https://github.com/pianhua/st-toolbox-core)

---

## Features

- **10 Built-in Tools**: read_file, write_file, edit_file, execute_bash, list_directory, search_files, get_environment, http_request, move_file, delete_file
- **Whitelist Protection**: Only access SillyTavern project directory and configured whitelist directories
- **Web Settings UI**: Configure whitelist directly in the Extensions panel, no YAML editing required
- **Safe Deletion**: Files are moved to `data/.trash` by default (recoverable)
- **Windows Optimized**: PowerShell with UTF-8 encoding for proper Chinese/Unicode display
- **Bilingual UI**: Settings panel in Chinese

---

## Installation

### Prerequisites

- SillyTavern v1.12.0 or later
- Git installed on the server machine
- Node.js environment (required by SillyTavern)

### Method 1: Automatic Install (Recommended)

SillyTavern supports installing extensions directly from a Git URL:

1. Open SillyTavern in your browser
2. Click the **Extensions** panel in the left sidebar
3. Click the **"Install extension"** button (cloud download icon)
4. Enter the Git repository URL:
   ```
   https://github.com/pianhua/st-toolbox
   ```
5. Click **"Install"** or **"Install just for me"**
6. Wait for installation to complete

⚠️ **Note**: Automatic install only installs the client extension. You still need to manually install the server plugin (see next step).

### Method 2: Manual Install

#### Step 1: Download this repository

```bash
# Download ZIP or clone with git
git clone https://github.com/pianhua/st-toolbox.git
```

#### Step 2: Install client extension

Copy all files from `client-extension/` to:

```
SillyTavern/public/scripts/extensions/third-party/st-toolbox/
```

Result structure:

```
SillyTavern/public/scripts/extensions/third-party/st-toolbox/
├── manifest.json
├── index.js
└── settings.html
```

#### Step 3: Install server plugin

Copy all files from `server-plugin/` to:

```
SillyTavern/plugins/st-toolbox/
```

Result structure:

```
SillyTavern/plugins/st-toolbox/
├── index.js
└── package.json
```

#### Step 4: Enable server plugins

Edit `config.yaml` in SillyTavern root directory:

```yaml
enableServerPlugins: true
```

#### Step 5: Restart SillyTavern

```bash
# Windows
node server.js

# Or use Start.bat
```

---

## Usage

### 1. Configure whitelist

1. Open SillyTavern web UI
2. Go to the **Extensions** panel
3. Find **ST Toolbox Settings**
4. Enter allowed directories in the **Whitelist Directories** textarea, one per line:
   ```
   C:\Users\YourName\Desktop
   C:\Users\YourName\Documents
   D:\Projects
   ```
5. Click **Save**

By default, tools can only access files within the SillyTavern project directory.

### 2. Enable tool calling

1. Open any chat
2. Click the **tool icon** below the chat input (or go to character/global settings)
3. Enable **Function Calling / Tool Calling**
4. Select a model that supports function calling (e.g., GPT-4, Claude)

### 3. Let AI use tools

Simply tell the AI what you need, for example:

> "Show me what files are on my desktop"

The AI will automatically call the `list_directory` tool and continue based on the result.

---

## Available Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `read_file` | Read file content | `filePath`, `offset?`, `limit?` |
| `write_file` | Write/create file | `filePath`, `content` |
| `edit_file` | Replace text in file | `filePath`, `oldText`, `newText` |
| `execute_bash` | Execute Shell/PowerShell command | `command`, `timeout?` |
| `list_directory` | List directory contents | `dirPath` |
| `search_files` | Search file contents | `query`, `path?`, `pattern?` |
| `get_environment` | Get server environment info | None |
| `http_request` | Send HTTP request | `url`, `method?`, `headers?`, `body?` |
| `move_file` | Move/rename file | `sourcePath`, `destinationPath` |
| `delete_file` | Delete file (safe by default) | `filePath`, `permanent?` |

---

## Directory Structure

```
st-toolbox/
├── client-extension/          # Client extension (browser side)
│   ├── manifest.json         # Extension metadata
│   ├── index.js              # Extension main logic
│   └── settings.html         # Settings UI (Chinese)
├── server-plugin/             # Server plugin
│   ├── index.js              # Plugin main logic
│   └── package.json          # Plugin package info
└── README.md                  # This file
```

---

## Troubleshooting

### Extension fails to load with console errors

1. Hard refresh browser: `Ctrl + Shift + R`
2. Check if server plugin is installed correctly
3. Check `config.yaml` for `enableServerPlugins: true`

### Tools not appearing

1. Confirm your AI model supports Function Calling
2. Confirm tool calling is enabled in SillyTavern settings
3. Check if server plugin loaded (server log: `[ST Toolbox] initialized`)

### File access denied

1. Check if the path is in the whitelist
2. Check if SillyTavern process has read/write permission for that directory
3. Add the directory to whitelist in ST Toolbox settings

### Multi-swipe disabled

Tool calling and multi-swipe (n > 1) are architecturally incompatible. When tool calling is enabled, multi-swipe is automatically disabled. This is a SillyTavern limitation that the extension cannot bypass.

### Garbled characters (Windows)

This extension uses UTF-8 encoding when executing PowerShell. If you still see garbled text:

```powershell
# Run PowerShell as Administrator
chcp 65001
```

---

## Security Notes

- All file operations are restricted by whitelist
- File deletion moves files to `data/.trash` by default, not permanently deleted
- `execute_bash` can run arbitrary commands, only use in trusted environments
- Do not expose this extension to untrusted AI services

---

## Uninstallation

1. Delete `SillyTavern/plugins/st-toolbox/`
2. Delete `SillyTavern/public/scripts/extensions/third-party/st-toolbox/`
3. Remove `st-toolbox` config from `config.yaml` (optional)
4. Restart SillyTavern

---

## License

MIT License
