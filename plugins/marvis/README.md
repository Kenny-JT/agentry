# Agentry for Tencent Marvis (马维斯)

[English](#english) · [中文](#中文)

## 中文

[马维斯（Marvis）](https://marvis.qq.com)可以通过「自定义连接（MCP）」使用 Agentry：列出、检查、修改、运行项目里的 workflow，并跟踪运行进度。workflow 的每一步由 opencode 执行，所以电脑上要装好 opencode，项目里要有 Agentry 的 opencode 插件（见主 README 的快速开始）。

> **状态：已在马维斯 1.60.30.10（Windows）上实测。** 按下面的步骤建好连接后，马维斯列出了项目里的 workflow，运行了一个 workflow 并等到了结果。

### 1. 准备 Agentry 的 MCP 服务

从[最新 Release](https://github.com/Kenny-JT/agentry/releases/latest) 下载 `agentry-mcp.mjs`，放到一个固定位置，例如 `C:\Tools\agentry\agentry-mcp.mjs`。需要 Node.js 22 或更新版本。

### 2. 在马维斯里添加连接

工具箱 → 连接（MCP/CLI）→ 我的连接 → **+ 自定义连接**：

| 字段 | 填写 |
|---|---|
| 名称 | `agentry` |
| 类型 | 本地命令（stdio） |
| 命令 | `node` |
| 参数 | `C:\Tools\agentry\agentry-mcp.mjs --dir D:\你的项目` |
| 环境变量（可选） | `OPENCODE_SERVER_PASSWORD`：你的 opencode 服务设了密码时填上 |

如果界面要求粘贴 JSON 配置：

```json
{
  "mcpServers": {
    "agentry": {
      "command": "node",
      "args": ["C:\\Tools\\agentry\\agentry-mcp.mjs", "--dir", "D:\\你的项目"]
    }
  }
}
```

### 3. 导入技能（可选）

把仓库里的 [`packages/mcp/skill/SKILL.md`](../../packages/mcp/skill/SKILL.md) 作为自定义技能导入。这样马维斯知道 `workflow.yaml` 怎么写、什么时候该调用这些工具。

### 4. 试一下

对马维斯说：「用 agentry 列出这个项目里的 workflow」，然后说「用 agentry 运行 workflows/code-review.yaml，跑完告诉我结果」。

### 注意

- 马维斯以管理员权限运行，所以它启动的 `agentry-mcp`，以及 workflow 的每一步，也都以管理员权限运行。
- 项目里没有 opencode 插件时，可以在连接的环境变量里加 `AGENTRY_RUNTIME`（`claude`、`codex` 或 `omo`），让每一步改在对应的 CLI 上跑（0.1.0 之后的版本才有）。实测用的是 `AGENTRY_RUNTIME=omo`。
- 装完以后双击 `MarvisLauncher.exe` 没反应：多半是安装程序 `marvis_setup.exe` 还没退出，在任务管理器里结束它再打开。

## English

Marvis, Tencent's desktop AI assistant, can use Agentry through a custom MCP connection: it can list, check, edit and run the project's workflows and follow a run. Steps execute on opencode, so opencode must be installed and the project needs Agentry's opencode plugin (see the quick start in the main README).

> **Status: tested on Marvis 1.60.30.10 (Windows).** With the connection set up as below, Marvis listed the project's workflows, ran one and waited for its result.

1. Download `agentry-mcp.mjs` from the [latest release](https://github.com/Kenny-JT/agentry/releases/latest) and keep it somewhere fixed. Node.js 22 or newer is required.
2. In Marvis: 工具箱 (Toolbox) → 连接 (MCP/CLI) → 我的连接 (My connections) → **+ 自定义连接** (custom connection). Use a local command (stdio) connection: command `node`, arguments `<path>\agentry-mcp.mjs --dir <your project>`, plus `OPENCODE_SERVER_PASSWORD` in the environment if your opencode server has a password. If Marvis asks for JSON, use the `mcpServers` block above.
3. Optionally import [`packages/mcp/skill/SKILL.md`](../../packages/mcp/skill/SKILL.md) as a custom skill.
4. Ask Marvis to list the workflows with agentry, then to run one.

Marvis runs as administrator, so `agentry-mcp` and every step of a run do too. Without the opencode plugin in the project, set `AGENTRY_RUNTIME` (`claude`, `codex` or `omo`) in the connection's environment to run the steps on that CLI instead (versions after 0.1.0). If `MarvisLauncher.exe` does nothing right after installing, the installer (`marvis_setup.exe`) is probably still running: end it in Task Manager and try again.
