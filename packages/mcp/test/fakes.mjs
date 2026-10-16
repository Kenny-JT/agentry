// Stand-ins for what run_workflow talks to: an opencode server (health + `?directory=` wake)
// and an Agentry panel (/health, /api/run, /api/stop, /events) that writes the run directory
// the way the plugin does (checkpoint.json, <node>.output.json, log.md).
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)))

export async function fakeOpencode() {
  const hits = []
  const hooks = { onRequest: () => {} }
  const server = http.createServer((req, res) => {
    hits.push(req.url)
    hooks.onRequest(req.url)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
  })
  const port = await listen(server)
  return { url: `http://127.0.0.1:${port}`, hits, hooks, close: () => new Promise((r) => server.close(r)) }
}

export async function fakePanel(projectDir, { token = "t0k3n", finishAfterMs = 1200, nodes = ["explore_code", "write_summary"], publish = true } = {}) {
  const state = { busy: false, runId: "", events: [], timer: null }
  const runDir = (id) => path.join(projectDir, ".agentry", "runs", id)
  const checkpoint = (id, nodeStates) =>
    fs.writeFileSync(path.join(runDir(id), "checkpoint.json"), JSON.stringify({ runId: id, workflow: "hero", nodes: nodeStates, completed: Object.keys(nodeStates).filter((n) => nodeStates[n] === "done"), iterations: {}, updatedAt: new Date().toISOString() }))
  const emit = (event) => state.events.push({ ...event, runId: state.runId, at: new Date().toISOString() })

  const start = (id) => {
    state.busy = true
    state.runId = id
    state.events = []
    fs.mkdirSync(runDir(id), { recursive: true })
    checkpoint(id, Object.fromEntries(nodes.map((n, i) => [n, i === 0 ? "running" : "pending"])))
    emit({ type: "run.started", workflow: "hero", nodeIds: nodes })
    emit({ type: "node.state", nodeId: nodes[0], state: "running", agent: "explore" })
    state.timer = setTimeout(() => finish(id), finishAfterMs)
  }
  const finish = (id) => {
    for (const [i, n] of nodes.entries()) {
      fs.writeFileSync(path.join(runDir(id), `${n}.output.json`), JSON.stringify({ nodeId: n, agent: "build", result: `output of ${n} `.repeat(40), elapsed_ms: 100 * (i + 1), iteration: 1, schemaWarnings: [] }))
    }
    fs.writeFileSync(path.join(runDir(id), "log.md"), "# Run report\n\nAll good.\n")
    checkpoint(id, Object.fromEntries(nodes.map((n) => [n, "done"])))
    emit({ type: "run.finished", status: "ok" })
    state.busy = false
  }
  const stop = () => {
    clearTimeout(state.timer)
    if (!state.busy) return
    checkpoint(state.runId, Object.fromEntries(nodes.map((n) => [n, "pending"])))
    emit({ type: "run.finished", status: "cancelled" })
    state.busy = false
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1")
    const json = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === "/health") return json(200, { app: "agentry", port, runId: state.runId, pid: process.pid, busy: state.busy })
    if (url.pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream" })
      for (const event of state.events) res.write(`data: ${JSON.stringify(event)}\n\n`)
      return
    }
    if (url.pathname === "/api/run" && req.method === "POST") {
      if (req.headers["x-agentry-token"] !== token) return json(401, { ok: false, error: "bad token" })
      if (state.busy) return json(409, { ok: false, error: "busy", runId: state.runId })
      const id = `run_${Date.now()}`
      start(id)
      return json(202, { ok: true, runId: id })
    }
    if (url.pathname === "/api/stop" && req.method === "POST") {
      stop()
      return json(200, { ok: true })
    }
    json(404, { ok: false })
  })
  const port = await listen(server)
  const publishPanelFile = () => {
    fs.mkdirSync(path.join(projectDir, ".agentry"), { recursive: true })
    fs.writeFileSync(path.join(projectDir, ".agentry", "panel.json"), JSON.stringify({ port, runId: "", pid: process.pid, startedAt: new Date().toISOString(), token }))
  }
  if (publish) publishPanelFile()
  return {
    port,
    state,
    publish: publishPanelFile,
    close: () => {
      clearTimeout(state.timer)
      server.closeAllConnections()
      return new Promise((r) => server.close(r))
    },
  }
}
