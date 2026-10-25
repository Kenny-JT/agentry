# Changelog

Notable changes to Agentry. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-25

### Added

- Feedback loops: `input.feedback: { from, when, max }` sends a later step's output back to an earlier step and runs the steps in between again while that output still matches `when`, for at most `max` extra rounds (default 3, up to 10). A loop also ends when its output repeats, a run fails before it would pass 200 step runs, and the run summary says why each loop ended. The editor draws loop-back edges and edits their limits.
- Decision steps (`type: decision`) answer typed questions (`choice`, `yes_no`, `score`) about the upstream outputs and can route on the answers the way a branch does. With `TYPESAFE_API_KEY` set, TypeSafe's Jev answers with calibrated probabilities; without it, the step's opencode agent is asked for the same probabilities. `for_each` asks the same questions about every item of a list. The editor adds and edits decision steps.
- Eight workflow templates in `workflows/templates` (review your changes, fix a bug, add tests, research a question, draft release notes, triage GitHub issues, explain a codebase, turn notes into action items) and a Templates view in the editor that opens one as a new workflow.
- An AI chat beside the canvas: describe a change, and a local opencode server (opencode 1 or 2) answers with a complete workflow. The proposal shows the steps and connections it adds, removes or changes, its validation problems and the YAML; Apply puts it on the canvas and Undo puts the previous workflow back. The chat's notes on the file format cover feedback loops, decision steps and the Claude Code, Codex and omo mappings.
- `agentry-mcp` runs workflows on Claude Code or Codex as well as opencode. `run_workflow` takes `runtime` (`opencode`, `claude`, `codex` or `auto`); on Claude Code and Codex each model step is one headless `claude -p` or `codex exec` on your own account, and read-only roles run read-only. `auto` follows `AGENTRY_RUNTIME`, keeps a project that has the opencode plugin on opencode, and otherwise uses the CLI of the MCP client that connected. `agentry-mcp run <workflow>` runs one from a terminal, and in the editor a step can name a Claude Code agent and a Codex profile.
- `runtime: omo` runs each model step as one headless `omo -p` on your own account: read-only roles get only omo's read tools, the others a short list (read, search, web, edit, write, shell), and a step started from an omo session does not touch that session. `agent_mapping.omo` picks a step's model and `AGENTRY_OMO_MODEL` the default; `auto` recognizes omo as the MCP client that connected.
- npm packages: `agentry-mcp`, `agentry-watch` and the opencode plugin as `opencode-agentry`. `npx -y agentry-mcp` and `npx -y agentry-watch` run the latest release, and each release is published there by CI through npm trusted publishing.

### Fixed

- The opencode plugin loads and runs on opencode 2 (checked on 2.1.2) and keeps working on opencode 1. On opencode 2, which gives plugins no log, progress goes to `.agentry/agentry.log`.
- `agentry-watch` and `agentry-mcp` wake projects on opencode 2 servers, and a server that wants a password says to start it with `OPENCODE_SERVER_PASSWORD`.
- `agentry-watch` and `run_workflow` wait up to 5 minutes for a project's first start, while opencode installs the plugin's dependency, and a timeout says what was happening.
- A model step that fails writes its log with the reason, as tool steps do, and `get_run` reports the error for that step.

## [0.1.0] - 2026-10-16

First public version. Everything below is what the project contains so far.

### Added

- Visual workflow editor, as a desktop app (Tauri) and in the browser: drag agents onto a canvas, wire them, export or import `workflow.yaml`, keep local history.
- Edges route around nodes with right-angle paths, fork at shared pins and keep updating while you drag; nodes cannot be dropped on top of each other.
- Node types: agent, branch, reporter, documenter, sub-workflow, and one workflow input and output.
- Control flow in `workflow.yaml`: fan-in, branch routing on an output field (first matching route wins), `trigger.when` gates, self-loops, `join: any`, per-edge field filters (`input.select`) and embedded sub-workflows.
- Live checks while editing: unknown references, missing required output fields, more than one documenter, disconnected nodes.
- opencode plugin that runs a workflow: parallel waves, a checkpoint after every step so a run can resume, a live panel in its own window, and a Markdown run report from the documenter node.
- Triggers (`on:` file, schedule, web page, mailbox, git push) and `agentry-watch`, which starts opencode when needed and runs the workflow.
- 15 color themes, shared by the editor and the live panel.
- The node inspector can pop out into a floating panel over the canvas, be hidden, or be resized when docked, and both side panels have toolbar toggles with shortcuts (Ctrl+B, Ctrl+Alt+B).
- `agentry-mcp`, an MCP server (stdio) so Claude Code, Codex, Cursor, opencode or any other MCP host can list, read, validate, edit, save, run and watch a project's workflows; ships with an `agentry` agent skill.
- Release tooling: CI on every pull request, one version for every package, and a tag-driven release workflow.
- Tool nodes (`type: tool`): HTTP request, read file, write file and run script steps that run without a model, with `{upstream.field}` templating, project-confined paths and the same artifacts, events and control flow as agent nodes.
