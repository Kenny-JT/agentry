# @agentry/mcp — `agentry-mcp`

A stdio [MCP](https://modelcontextprotocol.io) server over one Agentry project. Register it in any MCP host — Claude Code, Codex CLI, Cursor, opencode, Claude Desktop, Marvis — and that host's agent can list, read, validate, edit, save, run and watch the project's `workflows/*.yaml` without the desktop editor or a plugin of its own.

```
node packages/mcp/dist/agentry-mcp.mjs --dir <project>
```

`--dir` defaults to the current directory (or `AGENTRY_PROJECT_DIR`). One file, plain `node`, nothing to install: `pnpm --filter @agentry/mcp build` writes `dist/agentry-mcp.mjs` (it is also attached to every GitHub release next to `agentry-watch.mjs`). stdout is the protocol; the server's own messages go to stderr.

## Tools

File arguments are paths under `<project>/workflows/` — `workflows/review.yaml` or just `review.yaml`; `..`, absolute paths and other extensions are refused. Results are compact JSON in a text block; refusals and faults come back as `isError` results with the reason.

| Tool | What it does |
|---|---|
| `list_workflows` | every `*.yaml` / `*.yml` under `workflows/` (recursive): file, introduction, node count, `on:` triggers |
| `get_workflow {file}` | the YAML text + a node summary (id, type, agent, upstreams, branch routes, trigger) + current validation issues |
| `validate_workflow {file? \| yaml?}` | the runner's structural gate (`checkRunnable`) + the editor's static checks (`validateWorkflow`); `errors > 0` means the runner would refuse it |
| `save_workflow {file, yaml, overwrite?, force?}` | write a complete YAML; refuses an existing file unless `overwrite`, refuses errors unless `force` |
| `edit_workflow {file, operations[], force?}` | atomic patch: `add_node`, `remove_node` (drops every reference), `update_node`, `connect`, `disconnect`, `rename_node` (rewrites references and `{id.field}` prompt tokens), `set_branch`, `set_workflow_io`; nothing is written if an operation fails or the result has errors (unless `force`) |
| `run_workflow {file, input?}` | start a run and return `{run_id}` at once — the run goes on by itself |
| `get_run {run_id?}` | status (`running` / `done` / `failed` / `cancelled`), every node's state, agent, iteration, duration, output preview, and the documenter's report; live from the panel while running, from `.agentry/runs/<id>` afterwards |
| `wait_for_run {run_id, timeout_s?}` | poll until the run ends or the timeout (default 45 s, max 50) passes, then answer like `get_run` — call again while `running` |
| `list_runs {limit?}` | newest first: run_id, status, workflow, start time |
| `cancel_run {run_id?}` | `POST /api/stop` on the live panel; says so when nothing is running |

`run_workflow` needs **opencode and the Agentry plugin** (`.opencode/plugins/agentry.js`) in the project. It dispatches exactly like `agentry-watch`: probes the opencode server at `AGENTRY_OPENCODE_URL` (default `http://127.0.0.1:4096`, Basic auth user `opencode` / `OPENCODE_SERVER_PASSWORD`), starts one when nothing listens there (`AGENTRY_OPENCODE_AUTOSTART=0` to refuse, `AGENTRY_OPENCODE_START` / `AGENTRY_OPENCODE_BIN` to start it your own way), wakes the project so the plugin's panel comes up, then posts the run with the token from `.agentry/panel.json`. Progress is never streamed back through MCP (hosts drop or cut long calls): start, poll with `wait_for_run`, cancel.

## Registering the server

Replace `<path>` with the folder that holds `agentry-mcp.mjs` and run the host from the project directory (or pass `--dir <project>` instead of `.`).

### Claude Code

```
claude mcp add agentry --scope project -- node <path>/agentry-mcp.mjs --dir .
```

or in the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "agentry": {
      "command": "node",
      "args": ["<path>/agentry-mcp.mjs", "--dir", "."]
    }
  }
}
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.agentry]
command = "node"
args = ["<path>/agentry-mcp.mjs", "--dir", "."]
tool_timeout_sec = 120
```

### opencode

`opencode.json` (project or global):

```json
{
  "mcp": {
    "agentry": {
      "type": "local",
      "command": ["node", "<path>/agentry-mcp.mjs", "--dir", "."]
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentry": {
      "command": "node",
      "args": ["<path>/agentry-mcp.mjs", "--dir", "<project>"]
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "agentry": {
      "command": "node",
      "args": ["<path>/agentry-mcp.mjs", "--dir", "<project>"]
    }
  }
}
```

### Tencent Marvis (untested)

工具箱 → 连接 (MCP/CLI) → 我的连接 → 自定义连接: pick a stdio / command connection, command `node`, arguments `<path>/agentry-mcp.mjs --dir <project>`. Marvis does not document its field names; this has not been verified against a real Marvis install.

## Skill

`skill/SKILL.md` is an agent skill (`name: agentry`) that teaches a host's model when to reach for these tools and how to write a valid `workflow.yaml`. Copy or symlink the `skill/` folder into the host's skills directory (Claude Code: `.claude/skills/agentry/`).

## Development

```
pnpm --filter @agentry/mcp build       # dist/agentry-mcp.mjs
pnpm --filter @agentry/mcp typecheck
pnpm --filter @agentry/mcp test        # builds, then drives the bundle over stdio with the MCP client
```

Smoke test with the inspector:

```
npx -y @modelcontextprotocol/inspector --cli node packages/mcp/dist/agentry-mcp.mjs --dir . --method tools/list
npx -y @modelcontextprotocol/inspector --cli node packages/mcp/dist/agentry-mcp.mjs --dir . --method tools/call --tool-name validate_workflow --tool-arg file=workflows/code-review.yaml
```
