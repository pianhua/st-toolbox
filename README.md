# ST Toolbox v2.0

<div align="center">

**为 SillyTavern AI 助手打造的高性能、企业级工具调用套件 (Tool Calling Suite)**

[English](#english-version) | [中文说明](#中文说明)

</div>

---

# 中文说明

## 🚀 简介

**ST Toolbox v2.0** 是专为 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 打造的高性能 AI Function Calling（工具调用）扩展与服务端插件。

它赋予 AI 助手完整且安全的主机交互能力，包括：**沙箱化文件读写、代码精准编辑与多块补丁 (Patch)、极速全文与文件名检索、跨平台多 Shell 执行（彻底解决 Windows 中文乱码）、网页内容智能抓取转 Markdown，以及系统硬件/环境诊断**。

---

## ✨ 核心特性

- 🛡️ **严格安全沙箱**：基于路径白名单与敏感系统目录黑名单拦截（自动防护 Windows System32、Linux /etc、.ssh 等系统核心区域），防御路径逃逸。
- ⚡ **14 个高阶 AI 工具**：
  - **文件操作**：`read_file`（分块与行号）、`write_file`（原子写入与自动备份）、`edit_file`（精准替换与匹配校验）、`patch_file`（多块代码补丁）、`copy_file`、`move_file`、`delete_file`（安全回收站）、`restore_file`（一键还原）。
  - **搜索发现**：`list_directory`（深度与元数据控制）、`search_files`（高性能正则/全文检索，自动过滤二进制与 ignore 目录）、`find_by_name`（Glob 通配符快速找文件）。
  - **终端执行**：`execute_bash`（PowerShell / CMD / Bash，自动注入 UTF-8 编码防中文乱码，支持在白名单目录切换工作目录 `cwd`，支持执行超时与输出截断保护）。
  - **网络与解析**：`http_request`（通用 REST API 请求）、`fetch_webpage`（抓取网页并智能剥离广告/样式/脚本，提取干净 Markdown 供 AI 阅读）。
  - **系统诊断**：`get_environment`（CPU、内存、Node 版本、ST 路径与系统指标）。
- 🎛️ **细粒度权限控制**：支持在前端设置面板独立开启/关闭任意工具，未启用的工具对 LLM 完全不可见。
- 💾 **独立持久化配置**：采用独立 JSON 配置存储引擎，彻底解决新版 ST 中 `setConfigValue` 废弃导致的配置丢失问题。
- 🎨 **现代化中文控制台**：内置白名单管理、路径有效性实时检测、回收站一键还原以及最近调用实时日志追踪。

---

## 📦 可用工具列表 (14 Tools)

| 类别 | 工具名称 | 功能描述 | 主要参数 |
|---|---|---|---|
| **文件读写** | `read_file` | 读取文件内容（支持指定起始行、读取行数与行号标注） | `filePath`, `offset?`, `limit?`, `showLineNumbers?` |
| | `write_file` | 原子写入文件（自动递归创建父目录，支持覆盖前自动备份） | `filePath`, `content`, `createBackup?` |
| | `edit_file` | 精确文本搜索替换（支持匹配计数校验） | `filePath`, `oldText`, `newText`, `expectedReplacements?` |
| | `patch_file` | 多块代码补丁与替换 | `filePath`, `patches: [{oldText, newText}]` |
| | `copy_file` | 安全复制文件或目录 | `sourcePath`, `destinationPath`, `overwrite?` |
| | `move_file` | 移动或重命名文件/目录 | `sourcePath`, `destinationPath`, `overwrite?` |
| | `delete_file` | 安全删除（默认移入 `data/.trash/`）或永久删除 | `filePath`, `permanent?` |
| | `restore_file` | 从安全回收站中还原文件 | `identifier` (trashId 或 originalPath) |
| **检索发现** | `list_directory` | 列出目录树与文件大小/修改时间 | `dirPath?`, `depth?`, `recursive?`, `includeHidden?` |
| | `search_files` | 全文或正则搜索（自动跳过 `node_modules` 与二进制） | `query`, `path?`, `pattern?`, `isRegex?`, `caseSensitive?` |
| | `find_by_name` | Glob 通配符快速查找文件/目录 | `pattern`, `path?`, `type?`, `maxDepth?` |
| **命令执行** | `execute_bash` | 执行 Shell/PowerShell 命令（强制 UTF-8） | `command`, `args?`, `cwd?`, `timeout?`, `shell?` |
| **网络抓取** | `http_request` | 发送 HTTP/HTTPS 请求 (GET, POST, PUT, DELETE, PATCH) | `url`, `method?`, `headers?`, `body?`, `timeout?` |
| | `fetch_webpage` | 抓取网页并提取纯净 Markdown 文本 | `url`, `maxLength?`, `timeout?` |
| **系统诊断** | `get_environment` | 获取系统硬件、内存占用、ST 目录与运行环境指标 | 无 |

---

## 🛠️ 安装与配置指南

### 1. 部署客户端扩展
将 `client-extension/` 目录复制到 SillyTavern 扩展目录：
```
SillyTavern/public/scripts/extensions/third-party/st-toolbox/
```

### 2. 部署服务端插件
将 `server-plugin/` 目录复制到 SillyTavern 插件目录：
```
SillyTavern/plugins/st-toolbox/
```

### 3. 启用服务端插件
编辑 SillyTavern 根目录下的 `config.yaml`（若无则创建），确保开启：
```yaml
enableServerPlugins: true
```

### 4. 启动 SillyTavern
```bash
node server.js
# 或使用 Start.bat
```

### 5. 配置白名单与启用工具
1. 在浏览器打开 SillyTavern，点击左侧边栏 **Extensions（扩展）** 面板。
2. 展开 **ST Toolbox v2.0 AI 工具箱**。
3. 在 **白名单路径** 中添加允许 AI 访问的目录（例如 `~/Desktop` 或 `D:\Projects`），点击 **保存配置**。
4. 确保在聊天界面启用支持 **Function Calling** 的模型（如 Claude 3.5 Sonnet、GPT-4o、DeepSeek-V3 等）。

---

# English Version

## 🚀 Overview

**ST Toolbox v2.0** is an enterprise-grade, zero-core-modification tool calling extension and server plugin for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

It equips LLMs with a sandboxed file system, multi-block diff patching, fast text search (ripgrep-style), cross-platform shell execution (UTF-8 fixed on Windows), clean webpage-to-markdown extraction, and host system diagnostics.

## ✨ Highlights
- **Security Sandbox**: Whitelist path protection, sensitive OS system directory blacklisting, and path traversal defense.
- **14 Advanced Tools**: Full file CRUD, diff patching, fast search, multi-shell execution, HTTP requests, webpage scraping, system diagnostics.
- **Zero External Dependencies**: Uses native Node.js ES modules and native atomic file writing.
- **Independent JSON Storage**: Self-contained persistent config storage (`data/st-toolbox/config.json`).
- **Interactive UI**: Responsive drawer with tabs for Whitelist, Tool Toggles, Trash Recovery, and Execution Logs.

## 📄 License
MIT License.
