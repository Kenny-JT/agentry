# Agentry for Tencent Marvis (马维斯)

[English](#english) · [中文](#中文)

## 中文

[马维斯（Marvis）](https://marvis.qq.com)可以通过「自定义连接（MCP）」使用 Agentry：列出、检查、修改、运行项目里的 workflow，并跟踪运行进度。workflow 的每一步由 opencode 执行，所以电脑上要装好 opencode，项目里要有 Agentry 的 opencode 插件（见主 README 的快速开始）。

> **状态：尚未实测。** 马维斯没有公开自定义连接的字段说明，下面的名称以你看到的界面为准。

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

## English

Marvis, Tencent's desktop AI assistant, can use Agentry through a custom MCP connection: it can list, check, edit and run the project's workflows and follow a run. Steps execute on opencode, so opencode must be installed and the project needs Agentry's opencode plugin (see the quick start in the main README).

> **Status: not tested yet.** Marvis does not document the fields of a custom connection; the names below may differ in your version.

1. Download `agentry-mcp.mjs` from the [latest release](https://github.com/Kenny-JT/agentry/releases/latest) and keep it somewhere fixed. Node.js 22 or newer is required.
2. In Marvis: 工具箱 (Toolbox) → 连接 (MCP/CLI) → 我的连接 (My connections) → **+ 自定义连接** (custom connection). Use a local command (stdio) connection: command `node`, arguments `<path>\agentry-mcp.mjs --dir <your project>`, plus `OPENCODE_SERVER_PASSWORD` in the environment if your opencode server has a password. If Marvis asks for JSON, use the `mcpServers` block above.
3. Optionally import [`packages/mcp/skill/SKILL.md`](../../packages/mcp/skill/SKILL.md) as a custom skill.
4. Ask Marvis to list the workflows with agentry, then to run one.
