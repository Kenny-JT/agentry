# @agentry/mcp — `agentry-mcp`

A stdio [MCP](https://modelcontextprotocol.io) server over one Agentry project. Register it in any MCP host — Claude Code, Codex CLI, Cursor, opencode, Claude Desktop, Marvis — and that host's agent can list, read, validate, edit, save, run and watch the project's `workflows/*.yaml` without the desktop editor or a plugin of its own.

```
npx -y agentry-mcp --dir <project>
```

`--dir` defaults to the current directory (or `AGENTRY_PROJECT_DIR`). The npm package is one file that runs on plain `node`: the same `agentry-mcp.mjs` that is attached to every GitHub release next to `agentry-watch.mjs`, and that `pnpm --filter @agentry/mcp build` writes to `dist/agentry-mcp.mjs`. stdout is the protocol; the server's own messages go to stderr.

## Tools

File arguments are paths under `<project>/workflows/` — `workflows/review.yaml` or just `review.yaml`; `..`, absolute paths and other extensions are refused. Results are compact JSON in a text block; refusals and faults come back as `isError` results with the reason.

| Tool | What it does |
|---|---|
| `list_workflows` | every `*.yaml` / `*.yml` under `workflows/` (recursive): file, introduction, node count, `on:` triggers |
| `get_workflow {file}` | the YAML text + a node summary (id, type, agent, upstreams, branch routes, trigger) + current validation issues |
| `validate_workflow {file? \| yaml?}` | the runner's structural gate (`checkRunnable`) + the editor's static checks (`validateWorkflow`); `errors > 0` means the runner would refuse it |
| `save_workflow {file, yaml, overwrite?, force?}` | write a complete YAML; refuses an existing file unless `overwrite`, refuses errors unless `force` |
| `edit_workflow {file, operations[], force?}` | atomic patch: `add_node`, `remove_node` (drops every reference), `update_node`, `connect`, `disconnect`, `rename_node` (rewrites references and `{id.field}` prompt tokens), `set_branch`, `set_workflow_io`; nothing is written if an operation fails or the result has errors (unless `force`) |
| `run_workflow {file, input?, runtime?}` | start a run on opencode, Claude Code, Codex or omo and return `{run_id, runtime}` at once — the run goes on by itself |
| `get_run {run_id?}` | status (`running` / `done` / `failed` / `cancelled`), every node's state, agent, iteration, duration, output preview (or the error of a failed one), and the documenter's report; live from the panel while running, from `.agentry/runs/<id>` afterwards |
| `wait_for_run {run_id, timeout_s?}` | poll until the run ends or the timeout (default 45 s, max 50) passes, then answer like `get_run` — call again while `running` |
| `list_runs {limit?}` | newest first: run_id, status, workflow, start time |
| `cancel_run {run_id?}` | `POST /api/stop` on the live panel; says so when nothing is running |

### Where runs execute

`run_workflow` takes `runtime`: `opencode`, `claude`, `codex`, `omo`, or `auto` (the default). `auto` uses `AGENTRY_RUNTIME` when it is set. Otherwise a project with the Agentry plugin runs on opencode, and any other project runs on the CLI of the host that calls (Claude Code → `claude`, Codex → `codex`, omo → `omo`), or on opencode when the host is another one.

**opencode** needs the Agentry plugin (`.opencode/plugins/agentry.js`) in the project. `run_workflow` dispatches exactly like `agentry-watch`: probes the opencode server at `AGENTRY_OPENCODE_URL` (default `http://127.0.0.1:4096`, Basic auth user `opencode` / `OPENCODE_SERVER_PASSWORD`), starts one when nothing listens there (`AGENTRY_OPENCODE_AUTOSTART=0` to refuse, `AGENTRY_OPENCODE_START` / `AGENTRY_OPENCODE_BIN` to start it your own way), wakes the project so the plugin's panel comes up, then posts the run with the token from `.agentry/panel.json`. An opencode 2 server refuses API requests without credentials, so start it with `OPENCODE_SERVER_PASSWORD` set and give `agentry-mcp` the same value.

**claude**, **codex** and **omo** need neither: the scheduler runs inside this server, and each model step is one headless CLI call in the project directory, on your own account and its limits. The prompt goes in on stdin. The run's live panel comes up inside the server too, so `get_run`, `wait_for_run` and `cancel_run` work the same way. One run at a time.

| | Claude Code | Codex | omo |
|---|---|---|---|
| Each step runs | `claude -p --output-format json`, with no MCP servers | `codex exec` | `omo -p --mode json` without a session file, AGENTS.md, skills, rules or the project's own `.omo` files (so an `agentry` server registered there does not start inside every step) |
| Permissions | `--permission-mode acceptEdits`. A step whose opencode agent or `tech_stack.agent` is `explore` or `plan` runs read-only: `--permission-mode dontAsk --tools Read,Glob,Grep,WebFetch,WebSearch`. Commands that would ask for approval are refused | `--sandbox workspace-write`, or `read-only` for those same steps | only the tools `read`, `grep`, `find`, `ls`, `web_search`, `webfetch`, `edit`, `write` and `bash` (plus `powershell` on Windows); those same steps get the first six |
| A step's agent | `agent_mapping.claude_code` → `--agent <name>` | `agent_mapping.codex` → `--profile <name>` | `agent_mapping.omo` → `--model <pattern>`: a model such as `sonnet` |
| Overrides | `AGENTRY_CLAUDE_BIN`, `AGENTRY_CLAUDE_MODEL`, `AGENTRY_CLAUDE_PERMISSION_MODE` | `AGENTRY_CODEX_BIN`, `AGENTRY_CODEX_MODEL`, `AGENTRY_CODEX_SANDBOX` | `AGENTRY_OMO_BIN`, `AGENTRY_OMO_MODEL` (the model of steps that name none) |

When this server runs under omo, a step's `omo` does not inherit the variables that tie a process to that omo session (`PI_SESSION_*`, `PI_GOAL_*`, `PI_MODEL`, `PI_PROVIDER`, `PI_REASONING_LEVEL`), so it cannot report into or retitle the session that started the run.

Progress is never streamed back through MCP (hosts drop or cut long calls): start, poll with `wait_for_run`, cancel.

### From a terminal

```
node <path>/agentry-mcp.mjs run <file> [--dir <project>] [--runtime opencode|claude|codex|omo] [--input <text>] [--json]
```

starts one run with the same rules as `run_workflow`, waits for it, and prints every step's state, agent, time and output (or why it failed); `--json` prints the `get_run` report instead. The exit code is 0 when the run ends done.

## Registering the server

Replace `<path>` with the folder that holds `agentry-mcp.mjs` and run the host from the project directory (or pass `--dir <project>` instead of `.`). `npx -y agentry-mcp` works in place of `node <path>/agentry-mcp.mjs`; on Windows, a host that starts the command without a shell needs `cmd /c npx -y agentry-mcp`.

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

### omo

`~/.omo/agent/mcp.json`, or the project's `.omo/mcp.json` (project-local files load only when omo trusts the project, for example `omo -a`):

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

omo finds the tools with `tool_search` (`mcp_agentry_list_workflows`, `mcp_agentry_run_workflow`, …). A run started from omo runs on omo unless the project has the opencode plugin.

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

### Tencent Marvis

工具箱 → 连接 (MCP/CLI) → 我的连接 → 自定义连接: a local command (stdio) connection, command `node`, arguments `<path>/agentry-mcp.mjs --dir <project>`. Tested on Marvis 1.60.30.10; [plugins/marvis](../../plugins/marvis/README.md) has the details.

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
