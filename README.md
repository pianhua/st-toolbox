# ST Toolbox (Pi 极简版 / Pi Edition)

<div align="center">

**致敬极简终端 AI 编程框架 Pi (pi-mono) —— 专为 SillyTavern 打造的高性能 4 大核心工具套件**

[English](#english-version) | [中文说明](#中文说明)

</div>

---

# 中文说明

## 💡 为什么选择 Pi 极简设计？

在旧版设计中，内置 10~15 个重复冗余的工具不仅会让 LLM 产生选择混淆，还会使每个回合的 Prompt 上下文凭空消耗 **3000+ Token**。

借鉴极简终端 AI 助手框架 **Pi (`pi-mono`)** 的设计哲学，ST Toolbox 精炼出**最核心、最强大的 4 个基础工具**，将上下文消耗压缩至 **~300 Token（节省 90% 提示词消耗）**，让 AI 更加专注、敏捷、精准：

1. **`read_file` (读)**：读取文件内容，支持分块 (`offset`/`limit`)、按行读取与行号显示。
2. **`write_file` (写)**：原子创建与覆盖写入文件，自动递归创建目录并创建备份快照。
3. **`edit_file` (改)**：基于 4 层级智能模糊容错算法（精确、行尾/缩进容错、Levenshtein 编辑距离、自愈诊断）的代码精准替换。
4. **`execute_bash` (执行)**：跨平台 Shell / PowerShell 执行器，Windows 自动注入 UTF-8 防中文乱码。**AI 可通过 Bash 自由执行 `ls`、`grep`、`find`、`git`、`curl` 等一切系统任务，无需堆砌几十个冗余工具！**

---

## 🚀 解决酒馆安装“文件夹层级差一级”问题

旧版本仓库将客户端和服务端分别存放在 `client-extension/` 和 `server-plugin/` 子目录中。
当用户在 SillyTavern 网页的 **"Install Extension"** 输入 Git URL 安装时，SillyTavern 会克隆到 `public/scripts/extensions/third-party/st-toolbox` 并在**仓库根目录**寻找 `manifest.json`。因为旧版文件在子目录中，导致酒馆报错 `Manifest not found` 并自动清空删除了文件夹。

**ST Toolbox v2.0 已完成单仓库扁平化重构**：
- `manifest.json`、`index.js`、`settings.html` 直接位于**仓库根目录**。
- 支持在酒馆后台直接输入 Git URL 一键克隆安装，**100% 完美识别加载**！

---

## 🛠️ 安装与使用教程

### 方法一：酒馆内一键安装 (推荐)

1. 打开 SillyTavern 网页，点击左侧边栏的 **Extensions（扩展）** 面板。
2. 点击 **"Install extension"（安装扩展）** 图标。
3. 输入仓库地址：
   ```
   https://github.com/pianhua/st-toolbox.git
   ```
4. 点击 **Install**，酒馆会自动识别并安装完成！
5. 在 `SillyTavern/plugins` 目录中建立关联（或直接双击运行插件根目录的 `install.bat` 完成服务端挂载）。

### 方法二：手动安装

1. **安装客户端扩展**：
   克隆或复制本仓库到：
   `SillyTavern/public/scripts/extensions/third-party/st-toolbox/`

2. **挂载服务端插件**：
   复制本仓库（或通过软链接 `mklink /J`）到：
   `SillyTavern/plugins/st-toolbox/`

3. **开启服务端插件支持**：
   在 SillyTavern 根目录的 `config.yaml` 中设置：
   ```yaml
   enableServerPlugins: true
   ```

4. **启动 SillyTavern**：
   ```bash
   node server.js
   # 或运行 Start.bat
   ```

---

## 🛡️ 安全白名单配置

1. 打开 SillyTavern，进入 **Extensions** 面板中的 **ST Toolbox** 设置抽屉。
2. 在 **白名单目录** 中添加允许 AI 访问的目录（例如 `~/Desktop` 或 `D:\Projects`），点击 **保存配置**。
3. 对话中启用支持 **Function Calling** 的模型（如 Claude 3.5 Sonnet、GPT-4o、DeepSeek-V3 等），即可开始与 AI 协同编程！

---

# English Version

## 💡 The Pi-Mono Philosophy: 4 Minimalist Tools

ST Toolbox adopts the minimalist philosophy of the **Pi Coding Agent (`pi-mono`)**, stripping away bloated, redundant tools and focusing on **4 core atomic capabilities**:

1. **`read_file`**: Read file content with line ranges, line numbers, and encoding detection.
2. **`write_file`**: Atomic write with backup snapshots.
3. **`edit_file`**: Precise search & replace powered by multi-tier fuzzy matching and Levenshtein distance.
4. **`execute_bash`**: Shell/PowerShell command execution with UTF-8 console output on Windows. (AI can freely execute `ls`, `grep`, `find`, `curl`, `git` via bash!).

This reduces prompt token overhead from **~3,500 tokens down to ~300 tokens (90% savings)**.

## 🛠️ Direct Installation
- `manifest.json`, `index.js`, and `server.js` are positioned directly at the repository root, eliminating the legacy subdirectory hierarchy mismatch when installing via SillyTavern's Web UI.

## 📄 License
MIT License.
