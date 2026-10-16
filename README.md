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

> **Status: 0.1 preview.** Workflows run on opencode today. The YAML format may still change between 0.x versions.

## Features

- **Editor.** A desktop app (Tauri) that also runs in the browser. Edges route around nodes at right angles and follow while you drag. Every node has an inspector; problems such as a broken reference or a required field that nothing produces show up while you edit. Workflows import from and export to YAML, with local history and 15 color themes.
- **Control flow.** Pick one of several next steps from a field of a node's output. Run a step only when an upstream's output matches a condition. Repeat a step until its output says it is done, up to a limit. Continue on the first finished input, or wait for all of them. Pass only some fields along an edge. Embed a whole workflow as a single node.
- **Runtime.** The opencode plugin runs independent steps in parallel, writes each step's output and log under `.agentry/runs/`, resumes from the last checkpoint, opens a live panel in its own window, and can finish a run with a Markdown report of what every step did.
- **Watch runs in the editor.** Point the editor at your project and a run lights up on the same canvas you drew it on.
- **Triggers.** `agentry-watch` starts a workflow when files land in a folder, at a set time, when a web page or a Gmail inbox changes, or when you push to a git branch.

## Quick start

1. Install [opencode](https://opencode.ai). Agentry is tested on opencode 1.18.34 and 1.17.20.
2. Add the plugin to your project. It is a single file:

   ```sh
   mkdir -p .opencode/plugins
   curl -fsSL -o .opencode/plugins/agentry.js https://raw.githubusercontent.com/Kenny-JT/agentry/main/.opencode/plugins/agentry.js
   ```

   In Windows PowerShell, type `curl.exe` instead of `curl`. The first time opencode opens the project it installs the plugin's one dependency into `.opencode/`, which takes about a minute.
3. Put a workflow in your project's `workflows/` folder, for example [`workflows/code-review.yaml`](workflows/code-review.yaml) from this repository, or draw one in the editor and export it.
4. Start opencode in the project and ask it to *run `workflows/code-review.yaml` with agentry*. It calls the `agentry_run` tool and the live panel opens.

Installers for the editor come with the first release. Until then, run it from source (below).

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
| `type: branch`, `branch_on`, `routes` | Read one field of the step's output and continue on the first route whose condition matches. |
| `on` | Start the workflow by itself: `file`, `schedule`, `web`, `mail` or `git`. |
| `workflow` | Every step id, in display order. A step that is not listed does not run. |

The complete reference is the commented types in [`packages/core/src/workflow.ts`](packages/core/src/workflow.ts).

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
pnpm --filter @agentry/trigger build
node packages/trigger/dist/agentry-watch.mjs --dir path/to/your/project
```

The `mail` trigger reads Gmail and needs a Google OAuth client: run `agentry-watch auth google --client client.json` once.

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
| `packages/design` | Design tokens and color themes |
| `workflows/` | Example workflows |

## Notes on the opencode plugin

- The plugin never writes to the terminal, because that would draw over opencode's screen. It logs to opencode's own log file (`opencode debug paths` shows the folder); search for `[agentry]`.
- Branch routing and field filters need JSON answers. The plugin asks for JSON in the prompt and retries once, instead of using opencode's `format` option, which forces a tool call that some models reject.

## License

[MIT](LICENSE)
