# ST Toolbox

[English](#english) | [中文](#中文)

---

# English

A powerful extension that provides **filesystem and shell tools** for AI assistants in SillyTavern.

## Features

- **10 Built-in Tools**: read, write, edit, bash, list_directory, search_files, get_environment, http_request, move_file, delete_file
- **Windows Support**: PowerShell with UTF-8 encoding for proper Chinese/Unicode character display
- **Safe Deletion**: Files are moved to trash by default (recoverable)
- **Path Security**: All file operations are restricted to the SillyTavern project directory
- **AI Tool Calling**: Integrates with SillyTavern's tool calling framework

## Quick Install

### Prerequisites

- SillyTavern v1.12.0 or later
- Git installed on the server machine

### Step 1: Install Client Extension

1. Open SillyTavern in your browser
2. Navigate to the **Extensions** panel (sidebar)
3. Click the **"Install extension"** button (cloud download icon)
4. Enter the Git repository URL: `https://github.com/pianhua/st-toolbox`
5. Click **"Install"** (or "Install just for me" / "Install for all users" for admin users)
6. Wait for installation to complete

### Step 2: Install Server Plugin

1. Download or clone this repository
2. Copy the `server-plugin/` directory to your SillyTavern's `plugins/st-toolbox/` directory
3. The final structure should be:
   ```
   SillyTavern/
   ├── plugins/
   │   └── st-toolbox/
   │       ├── index.js
   │       ├── package.json
   │       └── README.md
   └── public/
       └── scripts/
           └── extensions/
               └── third-party/
                   └── st-toolbox/
                       ├── manifest.json
                       └── index.js
   ```

### Step 3: Enable Server Plugins

Edit your `config.yaml` file in the SillyTavern root directory:

```yaml
enableServerPlugins: true
```

### Step 4: Restart SillyTavern

Restart the SillyTavern server to load the server plugin.

### Step 5: Verify Installation

1. Open SillyTavern in your browser
2. Open browser Developer Tools (F12) → Console
3. Look for `[ST Toolbox]` messages:
   ```
   [ST Toolbox] Initializing client-side extension...
   [ST Toolbox] All 10 tools registered successfully
   ```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `read_file` | Read file content | `filePath`, `offset?`, `limit?` |
| `write_file` | Write content to file | `filePath`, `content` |
| `edit_file` | Replace text in file | `filePath`, `oldText`, `newText` |
| `execute_bash` | Execute shell command | `command`, `timeout?` |
| `list_directory` | List directory contents | `dirPath` |
| `search_files` | Search files with regex | `query`, `path?`, `pattern?` |
| `get_environment` | Get server environment info | None |
| `http_request` | Make HTTP requests | `url`, `method?`, `headers?`, `body?` |
| `move_file` | Move/rename file | `sourcePath`, `destinationPath` |
| `delete_file` | Delete file (safe by default) | `filePath`, `permanent?` |

## Whitelist Directories Configuration

By default, tools can only access files within the SillyTavern project directory. To allow access to additional directories, add them to `config.yaml`:

```yaml
# ST Toolbox configuration
st-toolbox:
  # Additional directories that the tools can access
  # Use absolute paths, one per line
  allowedPaths:
    - "C:\\Users\\YourName\\Desktop"
    - "C:\\Users\\YourName\\Documents"
    - "C:\\Users\\YourName\\Downloads"
    - "D:\\Projects"
```

After editing, restart SillyTavern to apply changes.

## Multi-Swipe Limitation

If "Function Calling" is enabled in SillyTavern settings, the `multi-swipe` feature (n > 1) will be automatically disabled. This is because multi-swipe and tool calling are architecturally incompatible.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not loading | Check browser Console for errors; hard refresh (Ctrl+Shift+R) |
| Tools not appearing | Verify `enableServerPlugins: true` in config.yaml |
| Permission errors | Ensure ST has read/write access to project directory |
| Garbled characters (Windows) | Run `chcp 65001` in PowerShell as Administrator |

## Uninstallation

1. Delete `plugins/st-toolbox/` from SillyTavern
2. Delete `public/scripts/extensions/third-party/st-toolbox/` from SillyTavern
3. Restart SillyTavern

## License

MIT License

---

# 中文

为 SillyTavern AI 助手提供**文件系统和 Shell 工具**的强大扩展。

## 功能特点

- **10 个内置工具**：读取、写入、编辑、执行命令、列出目录、搜索文件、获取环境信息、HTTP 请求、移动文件、删除文件
- **Windows 支持**：使用 PowerShell + UTF-8 编码，正确显示中文字符
- **安全删除**：文件默认移动到回收站（可恢复）
- **路径安全**：所有文件操作限制在 SillyTavern 项目目录内
- **AI 工具调用**：与 SillyTavern 的工具调用框架集成

## 快速安装

### 前置条件

- SillyTavern v1.12.0 或更高版本
- 服务器已安装 Git

### 第一步：安装客户端扩展

1. 在浏览器中打开 SillyTavern
2. 点击左侧边栏的 **Extensions（扩展）** 面板
3. 点击 **"Install extension"（安装扩展）** 按钮（云下载图标）
4. 输入 Git 仓库地址：`https://github.com/pianhua/st-toolbox`
5. 点击 **"Install"（安装）**
6. 等待安装完成

### 第二步：安装服务端插件

1. 下载或克隆本仓库
2. 将 `server-plugin/` 目录复制到 SillyTavern 的 `plugins/st-toolbox/` 目录
3. 最终目录结构如下：
   ```
   SillyTavern/
   ├── plugins/
   │   └── st-toolbox/
   │       ├── index.js
   │       ├── package.json
   │       └── README.md
   └── public/
       └── scripts/
           └── extensions/
               └── third-party/
                   └── st-toolbox/
                       ├── manifest.json
                       └── index.js
   ```

### 第三步：启用服务端插件

编辑 SillyTavern 根目录下的 `config.yaml` 文件：

```yaml
enableServerPlugins: true
```

### 第四步：重启 SillyTavern

重启 SillyTavern 服务以加载服务端插件。

### 第五步：验证安装

1. 在浏览器中打开 SillyTavern
2. 打开浏览器开发者工具（F12）→ Console（控制台）
3. 查看是否有以下日志：
   ```
   [ST Toolbox] Initializing client-side extension...
   [ST Toolbox] All 10 tools registered successfully
   ```

## 可用工具

| 工具 | 说明 | 参数 |
|------|------|------|
| `read_file` | 读取文件内容 | `filePath`, `offset?`, `limit?` |
| `write_file` | 写入文件内容 | `filePath`, `content` |
| `edit_file` | 替换文件中的文本 | `filePath`, `oldText`, `newText` |
| `execute_bash` | 执行 Shell 命令 | `command`, `timeout?` |
| `list_directory` | 列出目录内容 | `dirPath` |
| `search_files` | 使用正则搜索文件 | `query`, `path?`, `pattern?` |
| `get_environment` | 获取服务器环境信息 | 无 |
| `http_request` | 发送 HTTP 请求 | `url`, `method?`, `headers?`, `body?` |
| `move_file` | 移动/重命名文件 | `sourcePath`, `destinationPath` |
| `delete_file` | 删除文件（默认安全模式） | `filePath`, `permanent?` |

## 白名单目录配置

默认情况下，工具只能访问 SillyTavern 项目目录内的文件。要允许访问其他目录，请在 `config.yaml` 中添加白名单：

```yaml
# ST Toolbox 配置
st-toolbox:
  # 允许工具访问的额外目录
  # 使用绝对路径，每行一个
  allowedPaths:
    - "C:\\Users\\你的用户名\\Desktop"
    - "C:\\Users\\你的用户名\\Documents"
    - "C:\\Users\\你的用户名\\Downloads"
    - "D:\\Projects"
```

修改后，重启 SillyTavern 以应用更改。

## Multi-Swipe 限制

如果在 SillyTavern 设置中启用了"函数调用"（Function Calling），`multi-swipe` 功能（n > 1）将被自动禁用。这是因为 multi-swipe 和工具调用在架构上不兼容。

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 扩展加载失败 | 检查浏览器 Console 错误信息；强制刷新（Ctrl+Shift+R） |
| 工具未出现 | 确认 config.yaml 中 `enableServerPlugins: true` |
| 权限错误 | 确保 SillyTavern 对项目目录有读写权限 |
| 中文乱码（Windows） | 以管理员身份运行 PowerShell，执行 `chcp 65001` |

## 卸载方法

1. 删除 SillyTavern 目录下的 `plugins/st-toolbox/`
2. 删除 SillyTavern 目录下的 `public/scripts/extensions/third-party/st-toolbox/`
3. 重启 SillyTavern

## 许可证

MIT 许可证

---

## Support / 支持

For issues or feature requests, please open an issue on the [GitHub repository](https://github.com/pianhua/st-toolbox).

如有问题或功能建议，请在 [GitHub 仓库](https://github.com/pianhua/st-toolbox)提交 Issue。
