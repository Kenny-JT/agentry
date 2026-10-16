# Changelog

Notable changes to Agentry. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
