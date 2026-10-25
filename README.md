<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/logo/agentry-lockup-dark.png">
    <img alt="Agentry" src="design/logo/agentry-lockup-light.png" width="360">
  </picture>
</p>

<p align="center"><b>Draw an AI-agent workflow, run it inside your coding agent, and watch every step live.</b></p>

<p align="center">English · <a href="README.zh-CN.md">简体中文</a></p>

---

Agentry is two pieces that work together:

- **An editor** for multi-agent workflows. Place agents on a canvas, connect what one produces to what the next one reads, and add branches, conditions, loops and parallel steps. The result is a plain `workflow.yaml` that you can read, diff and commit.
- **A runtime plugin for [opencode](https://opencode.ai)** that runs the file. Steps that don't depend on each other run at the same time, each step leaves its output on disk, a checkpoint after every step lets a stopped run continue where it left off, and a live panel shows the run as it happens.

> **Status: 0.2 preview.** Workflows run on opencode, Claude Code, Codex or omo, and any MCP host can edit and start them through the [MCP server](#use-it-from-other-coding-agents-mcp). The YAML format may still change between 0.x versions.

## Demo

Six short clips recorded on a real machine. In each one a trigger starts the workflow by itself, and the live panel is on the right. The run is sped up; a badge in the corner shows the playback speed.

**Review every push.** A push to a pull-request branch starts a workflow that reads the diff, looks for bugs, checks for security problems and runs the tests at the same time, then posts one review on the pull request.

https://github.com/user-attachments/assets/52aa8e28-d228-4792-b281-c18b6ff9b90b

**Sort the inbox.** New mail is sorted as it arrives: urgent mail gets a draft reply, phishing gets a warning label and promotions are archived. The labels and drafts appear in Gmail during the run.

https://github.com/user-attachments/assets/a4604c60-8ff8-4757-abfd-11782e6b856b

**Follow a schedule change.** An email says the midterm moved. The workflow finds the existing calendar event and moves it instead of adding a second one.

https://github.com/user-attachments/assets/430a35ec-1fcc-467e-b6a3-5c9911fd20c9

**Copy deadlines from a course page.** The course website posts a new homework, and its due date appears in the calendar.

https://github.com/user-attachments/assets/00f13dae-d09f-4f7c-af07-32cf228b4ecb

**File downloads.** A file saved as `download.pdf` is read, renamed after its content and moved into the right course folder.

https://github.com/user-attachments/assets/4a6308b7-eef5-43d2-8a85-7900bde0aacb

**Write the weekly report.** On Friday at 5 pm the week's commits, meetings and mail are gathered in parallel, the report is written and revised once, and it waits in Gmail as a draft for a person to send.

https://github.com/user-attachments/assets/0ca33f9b-70fd-4dce-b958-42e703f32c6f

The Gmail and Google Calendar helper tools used in these clips are not part of this repository.

## Features

- **Editor.** A desktop app (Tauri) that also runs in the browser. Edges route around nodes at right angles and follow while you drag. Every node has an inspector; problems such as a broken reference or a required field that nothing produces show up while you edit. Workflows import from and export to YAML, with local history and 15 color themes.
- **Control flow.** Pick one of several next steps from a field of a node's output. Run a step only when an upstream's output matches a condition. Repeat a step until its output says it is done, up to a limit. Continue on the first finished input, or wait for all of them. Pass only some fields along an edge. Embed a whole workflow as a single node.
- **Tool steps.** Steps that run without a model: an HTTP request, reading or writing a file inside the project, or a script. Their output is JSON, so later steps and branches can use its fields.
- **Runtime.** The opencode plugin runs independent steps in parallel, writes each step's output and log under `.agentry/runs/`, resumes from the last checkpoint, opens a live panel in its own window, and can finish a run with a Markdown report of what every step did.
- **Templates.** Starting points for common jobs (review your changes, fix a bug, add tests, research a question, draft release notes, triage GitHub issues, explain a codebase, turn notes into action items) open from the editor's Templates view. The files are in [`workflows/templates`](workflows/templates).
- **Watch runs in the editor.** Point the editor at your project and a run lights up on the same canvas you drew it on.
- **Ask for changes in the editor.** An AI chat beside the canvas asks your local opencode server to edit the workflow. Before anything changes you see the steps and connections it would add, remove or change, and any problems; after you apply it, one click undoes it. For opencode 2, start the server with `OPENCODE_SERVER_PASSWORD` set and `opencode serve --cors <the editor's address>`.
- **Use it from other coding agents.** An MCP server lets Claude Code, Codex, Cursor and other MCP hosts list, check, edit, run and follow the workflows in a project.
- **Triggers.** `agentry-watch` starts a workflow when files land in a folder, at a set time, when a web page or a Gmail inbox changes, or when you push to a git branch.

## Quick start

1. Install [opencode](https://opencode.ai). Agentry is tested on opencode 2.1.2, 1.18.34 and 1.17.20.
2. Add the plugin to your project. It is a single file:

   ```sh
   mkdir -p .opencode/plugins
   curl -fsSL -o .opencode/plugins/agentry.js https://raw.githubusercontent.com/Kenny-JT/agentry/main/.opencode/plugins/agentry.js
   ```

   In Windows PowerShell, type `curl.exe` instead of `curl`. The first time opencode opens the project it installs the plugin's one dependency into `.opencode/`, which takes about a minute.

   Or let opencode install it from npm: put `"plugin": ["opencode-agentry"]` in the project's `opencode.json`.
3. Put a workflow in your project's `workflows/` folder, for example [`workflows/code-review.yaml`](workflows/code-review.yaml) from this repository, or draw one in the editor and export it.
4. Start opencode in the project and ask it to *run `workflows/code-review.yaml` with agentry*. It calls the `agentry_run` tool and the live panel opens.

Installers for the editor (Windows, macOS and Linux) are on the [latest release](https://github.com/Kenny-JT/agentry/releases/latest); you can also run it from source (below).

## A workflow file

```yaml
introduction: Review a change from two angles, then summarize
type: pipeline
input:  { description: "The diff to review" }
output: { description: "One review comment" }
agents:
  find_bugs:
    prompt: List real bugs in the diff. Ignore style.
    agent_mapping: { opencode: explore }
    output: { schema: { bugs: "string[]" } }
  check_security:
    prompt: List security problems in the diff.
    agent_mapping: { opencode: explore }
    output: { schema: { issues: "string[]" } }
  summarize:
    input: { from: [find_bugs, check_security] }
    prompt: Merge both lists into one short review comment.
    agent_mapping: { opencode: build }
    output: { schema: { comment: string } }
workflow: [find_bugs, check_security, summarize]
```

`find_bugs` and `check_security` start together; `summarize` starts once both have finished.

| Key | What it does |
|---|---|
| `agents` | The steps, keyed by id. Each has a `prompt`, the opencode agent that runs it (`agent_mapping.opencode`) and the shape of its answer (`output.schema`). |
| `input.from` | Whose output the step receives. With several ids it waits for all of them; `input.join: any` goes on as soon as the first one is done. |
| `input.select` | Pass only the listed fields of an upstream's output to this step. |
| `trigger.when` | Run the step only if an upstream's output contains or equals a value; otherwise it is skipped. |
| `trigger.loop` | Run the step again until `exit_when` matches, at most `max` times. |
| `input.feedback` | Loop back from a later step: while the output of `from` matches `when`, this step and every step up to `from` run again with that output as feedback, at most `max` extra rounds. A loop also ends when `from` says the same thing twice in a row, and a run with loops stops after 200 step runs. In the editor, draw the edge from the later step back to this one. |
| `type: branch`, `branch_on`, `routes` | Read one field of the step's output and continue on the first route whose condition matches. |
| `type: tool`, `tool` | A step that runs without a model; see [Tool steps](#tool-steps). |
| `type: decision`, `decision` | A step that answers typed questions instead of writing text, and can route on the answers; see [Decision steps](#decision-steps). |
| `on` | Start the workflow by itself: `file`, `schedule`, `web`, `mail` or `git`. |
| `workflow` | Every step id, in display order. A step that is not listed does not run. |

The complete reference is the commented types in [`packages/core/src/workflow.ts`](packages/core/src/workflow.ts).

### Tool steps

A step with `type: tool` does its job without a model. Added to the example above, this one saves the review:

```yaml
  save_review:
    type: tool
    input: { from: summarize }
    tool:
      kind: write_file
      path: reviews/latest.md
      content: "{summarize.comment}"
    output: { schema: { path: string, bytes: number, mode: string } }
```

| `kind` | Fields | Output |
|---|---|---|
| `http` | `url`, `method`, `headers`, `body`, `timeout_s`, `allow_failure` | `status`, `ok`, `content_type`, `body` |
| `read_file` | `path` | `path`, `bytes`, `content`, plus `json` when the file is JSON |
| `write_file` | `path`, `content`, `mode` (`overwrite` or `append`) | `path`, `bytes`, `mode` |
| `script` | `command`, `cwd`, `timeout_s`, `allow_failure` | `exit_code`, `stdout`, `stderr`, plus `result` when stdout is JSON |

- `{step_id}` inserts an upstream step's whole output, `{step_id.field}` one field of it, and `{input}` the run's input. Inside a `url`, inserted values are URL-encoded unless the whole URL is one reference.
- File paths and a script's `cwd` must stay inside the project. A path that points outside fails the step.
- A `command` written as a list runs without a shell, and each item may contain references. A `command` written as a string runs in the shell and is never filled in from upstream output; the script reads the run input and its upstream outputs as JSON on stdin instead. On Windows, `npm`, `pnpm` and `npx` need the string form.
- Scripts run with your own user's permissions, like any script you start yourself.
- An HTTP status outside 2xx or a non-zero exit code fails the step unless `allow_failure: true`. A timeout always fails it; the defaults are 30 s for HTTP and 120 s for scripts. `read_file` reads at most 2 MB; non-JSON HTTP bodies are cut at 256 KB and script output at 64 KB.

### Decision steps

A step with `type: decision` answers typed questions instead of writing text, and can pick the next step from its answers the way a branch does. Added to the examples above, this one decides whether the review is worth keeping, so `save_review` runs only when the answer is `save`:

```yaml
  triage:
    type: decision
    input: { from: summarize }
    decision:
      questions:
        verdict:
          type: choice
          instructions: Is this review worth keeping?
          options: { save: null, skip: "It found nothing that matters" }
        security: { type: yes_no, instructions: The review reports a security problem. }
      min_confidence: 0.6
    branch_on: verdict
    routes:
      - { to: save_review, when: { equals: save } }
```

| Question `type` | Asks | Answer | Confidence field |
|---|---|---|---|
| `choice` | which of the `options` applies; each option is a name with an optional description | the option's name | `<name>_confidence` |
| `yes_no` | whether the statement in `instructions` is true | `true` or `false` | `<name>_p`, the probability of `true` |
| `score` | where it sits on `levels`: 2 to 10 descriptions, lowest first | the expected level: `0` is the first, and it may fall between two | `<name>_confidence` |

- With `TYPESAFE_API_KEY` set, [Jev](https://docs.typesafe.ai) answers with calibrated probabilities (`model`, default `jev-latest`). Without a key, the step's `agent_mapping.opencode` agent (default `general`) is asked for the same probabilities as strict JSON. `AGENTRY_DECISION_BACKEND=jev` or `llm` picks one explicitly.
- The output holds each answer with its confidence field, `unsure` (the questions answered with less confidence than `min_confidence`) and `backend`. The editor fills in this schema from the questions.
- The questions are about the outputs of all upstream steps, keyed by step id. `state` replaces that with text of your own, using the same `{step_id.field}` references as tool steps.
- `for_each` asks the same questions about every item of a JSON array, for example `"{find.items}"`. The output is then `items` (one record per item), `counts` (how many items got each answer) and `unsure` (the indices of items with an unsure answer). A batch decision does not route.

## Start workflows automatically

Add an `on:` block to a workflow:

```yaml
on:
  git: { repo: ., branch: main }               # after you push main
  schedule: { at: "Fri 17:00" }                # every Friday at 5 pm
  file: { path: ~/Downloads, match: "*.pdf" }  # when a PDF lands in Downloads
```

Then keep `agentry-watch` running for the project. It hands the event (the new files, the new commits, the new mail) to the workflow's first steps, and runs the workflow on the opencode server at `127.0.0.1:4096`, starting one if none is running:

```sh
npx -y agentry-watch --dir path/to/your/project
```

From a clone of this repository, `pnpm --filter @agentry/trigger build` and then `node packages/trigger/dist/agentry-watch.mjs` does the same.

The `mail` trigger reads Gmail and needs a Google OAuth client: run `agentry-watch auth google --client client.json` once.

## Use it from other coding agents (MCP)

[`packages/mcp`](packages/mcp) is an MCP server for one project. Through it, Claude Code, Codex, Cursor, opencode or any other MCP host can list, read, validate, edit and save workflows, start a run, follow it and stop it. A run executes on opencode through the plugin from the quick start, or, with `runtime: claude`, `codex` or `omo`, inside the MCP server itself: every step is one headless `claude -p`, `codex exec` or `omo -p` in the project, on your own account. Without the plugin, a run started from Claude Code, Codex or omo uses that host's CLI by default. A step's `agent_mapping.claude_code` names a Claude Code subagent, `agent_mapping.codex` a Codex profile and `agent_mapping.omo` an omo model; without them the CLI's default agent (or model) runs it.

```sh
claude mcp add agentry --scope project -- npx -y agentry-mcp --dir .
```

On Windows, write `cmd /c npx -y agentry-mcp --dir .` after the `--`. The same command runs one workflow from a terminal and waits for it: `npx -y agentry-mcp run review.yaml --runtime claude`. From a clone, `pnpm --filter @agentry/mcp build` writes the server to `packages/mcp/dist/agentry-mcp.mjs`, which runs with plain `node`.

[`packages/mcp/README.md`](packages/mcp/README.md) has the setup for Codex, Cursor, opencode and Claude Desktop, plus a skill file that teaches an agent the workflow format.

## Run from source

Node 22.6 or newer and pnpm 11. The desktop window also needs Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install
pnpm dev          # the editor in the browser, http://localhost:5173
pnpm tauri dev    # the editor in the desktop window
pnpm verify       # everything CI checks
```

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers the layout, pull requests and releases.

## Repository

| Path | What |
|---|---|
| `packages/core` | The `workflow.yaml` types, validation and run semantics, shared by everything else |
| `packages/canvas` | The node canvas, used by the editor and the live panel |
| `packages/app` | The editor (Vite + React, wrapped by Tauri) |
| `packages/plugin` | The opencode plugin, built into `.opencode/plugins/agentry.js` |
| `packages/trigger` | `agentry-watch` |
| `packages/mcp` | `agentry-mcp`, the MCP server |
| `packages/design` | Design tokens and color themes |
| `workflows/` | Example workflows |

## Notes on the opencode plugin

- The plugin never writes to the terminal, because that would draw over opencode's screen. It logs to opencode's own log file (`opencode debug paths` shows the folder); search for `[agentry]`.
- Branch routing and field filters need JSON answers. The plugin asks for JSON in the prompt and retries once, instead of using opencode's `format` option, which forces a tool call that some models reject.

## License

[MIT](LICENSE)
