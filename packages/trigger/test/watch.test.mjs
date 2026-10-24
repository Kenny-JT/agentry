// Drives the BUILT watcher (dist/agentry-watch.mjs): each `on:` watcher against a real folder,
// page, repo or a scripted mailbox, and the dispatcher against a stand-in Agentry panel.
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const { Dispatcher, visibleLines, watchClock, watchFolder, watchMailbox, watchPage, watchRepo } =
  await import(pathToFileURL(path.join(here, "..", "dist", "agentry-watch.mjs")).href)

const temps = []
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentry-watch-"))
  temps.push(dir)
  return dir
}
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }) })

const memory = (initial) => {
  let value = initial
  return { get: () => value, set: (v) => { value = v } }
}
const quiet = () => {}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function collect() {
  const events = []
  const fire = (event) => events.push(event)
  const next = async (count = 1, timeoutMs = 6000) => {
    const until = Date.now() + timeoutMs
    while (events.length < count) {
      if (Date.now() > until) throw new Error(`expected ${count} event(s), got ${events.length}`)
      await sleep(25)
    }
    return events[count - 1]
  }
  return { events, fire, next }
}

test("file: what was already there is baseline; a finished download fires once, partials never", async () => {
  const dir = tempDir()
  fs.writeFileSync(path.join(dir, "old.pdf"), "already here")
  const { events, fire, next } = collect()
  const state = memory(undefined)
  const watcher = watchFolder({ path: dir, settle: "300ms" }, dir, fire, state, quiet)
  try {
    await sleep(300)
    fs.writeFileSync(path.join(dir, "Syllabus.pdf.crdownload"), "half")
    await sleep(900)
    assert.equal(events.length, 0, "an in-progress download must not fire")
    fs.renameSync(path.join(dir, "Syllabus.pdf.crdownload"), path.join(dir, "Syllabus.pdf"))
    fs.writeFileSync(path.join(dir, "invoice.pdf"), "money")
    const event = await next()
    assert.equal(event.trigger, "file")
    assert.deepEqual(event.files.map((f) => path.basename(f)).sort(), ["Syllabus.pdf", "invoice.pdf"]) // one batch
    await sleep(1200)
    assert.equal(events.length, 1)

    fs.renameSync(path.join(dir, "invoice.pdf"), path.join(dir, "..", `moved-${path.basename(dir)}.pdf`))
    await sleep(700)
    fs.writeFileSync(path.join(dir, "invoice.pdf"), "money again") // came back → news again
    assert.deepEqual((await next(2)).files.map((f) => path.basename(f)), ["invoice.pdf"])
  } finally {
    watcher.stop()
    fs.rmSync(path.join(dir, "..", `moved-${path.basename(dir)}.pdf`), { force: true })
  }
})

test("file: with memory from an earlier run, files that arrived while down fire on start", async () => {
  const dir = tempDir()
  fs.writeFileSync(path.join(dir, "seen.pdf"), "x")
  fs.writeFileSync(path.join(dir, "missed.pdf"), "y")
  const { fire, next } = collect()
  const watcher = watchFolder({ path: dir, settle: "200ms", match: "*.pdf" }, dir, fire, memory({ known: ["seen.pdf"] }), quiet)
  try {
    assert.deepEqual((await next()).files.map((f) => path.basename(f)), ["missed.pdf"])
  } finally {
    watcher.stop()
  }
})

test("schedule: an interval fires repeatedly", async () => {
  const { fire, next } = collect()
  const watcher = watchClock({ every: "150ms" }, fire)
  try {
    const second = await next(2, 2000)
    assert.equal(second.trigger, "schedule")
    assert.equal(second.spec, "every 150ms")
  } finally {
    watcher.stop()
  }
})

test("web: visible text only; first sight is baseline unless initial; changes report added/removed lines", async () => {
  assert.deepEqual(
    visibleLines("<html><head><style>p{}</style><script>x()</script></head><body><h1>CS 225</h1><table><tr><td>HW1</td><td>Sep 5</td></tr></table><p>a&amp;b<br>c</p></body></html>"),
    ["CS 225", "HW1 | Sep 5", "a&b", "c"],
  )
  let page = "<h1>CS 225</h1><table><tr><td>HW1</td><td>Sep 5</td></tr></table>"
  const server = http.createServer((_req, res) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(page) })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const url = `http://127.0.0.1:${server.address().port}/cs225`
  const quietWatch = collect()
  const firstSight = collect()
  const a = watchPage({ url, every: "5s" }, quietWatch.fire, memory(undefined), quiet)
  const b = watchPage({ url, every: "5s", initial: true }, firstSight.fire, memory(undefined), quiet)
  try {
    const first = await firstSight.next()
    assert.equal(first.first, true)
    assert.deepEqual(first.added, ["CS 225", "HW1 | Sep 5"])
    await sleep(200)
    assert.equal(quietWatch.events.length, 0)
  } finally {
    a.stop()
    b.stop()
  }
  const state = memory(undefined)
  const changes = collect()
  const c = watchPage({ url, every: "5s" }, changes.fire, state, quiet)
  await sleep(300) // baseline poll
  c.stop()
  page = "<h1>CS 225</h1><table><tr><td>HW1</td><td>Sep 5</td></tr><tr><td>HW2</td><td>Sep 12</td></tr></table>"
  const d = watchPage({ url, every: "5s" }, changes.fire, state, quiet)
  try {
    const changed = await changes.next()
    assert.equal(changed.first, false)
    assert.deepEqual(changed.added, ["HW2 | Sep 12"])
    assert.deepEqual(changed.removed, [])
  } finally {
    d.stop()
    server.close()
  }
})

const gitIn = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

test("git: a push to a watched branch fires with its commits; other branches do not", async () => {
  const remote = tempDir()
  const work = tempDir()
  gitIn(remote, "init", "--bare", "-q", "-b", "main")
  gitIn(work, "init", "-q", "-b", "main")
  gitIn(work, "config", "user.email", "t@example.com")
  gitIn(work, "config", "user.name", "Tester")
  gitIn(work, "remote", "add", "origin", remote)
  fs.writeFileSync(path.join(work, "a.txt"), "1")
  gitIn(work, "add", ".")
  gitIn(work, "commit", "-q", "-m", "first")
  gitIn(work, "push", "-q", "origin", "main")
  const { events, fire, next } = collect()
  const watcher = watchRepo({ repo: work, branch: "main" }, work, fire, memory(undefined), quiet)
  try {
    await sleep(600) // baseline
    fs.writeFileSync(path.join(work, "a.txt"), "2")
    gitIn(work, "commit", "-q", "-am", "fix the cart total")
    await sleep(2500)
    assert.equal(events.length, 0, "a local commit is not a push")
    gitIn(work, "push", "-q", "origin", "main")
    const event = await next(1, 6000)
    assert.equal(event.ref, "main")
    assert.deepEqual(event.commits.map((c) => c.subject), ["fix the cart total"])
    gitIn(work, "checkout", "-q", "-b", "wip")
    gitIn(work, "push", "-q", "origin", "wip")
    await sleep(2500)
    assert.equal(events.length, 1, "wip is not watched")
  } finally {
    watcher.stop()
  }
})

test("mail: baseline first; then only arrived inbox mail matching the query fires; an expired history point re-baselines", async () => {
  let history = "100"
  const added = []
  const messages = {
    m1: { id: "m1", threadId: "t1", from: "Prof. Chen <chen@uni.edu>", to: "alex@example.com", subject: "Midterm moved", date: "", body: "Oct 28", labels: ["INBOX", "UNREAD"] },
    m2: { id: "m2", threadId: "t2", from: "me", to: "x", subject: "Re: hi", date: "", body: "", labels: ["DRAFT"] },
    m3: { id: "m3", threadId: "t3", from: "shop", to: "me", subject: "SALE", date: "", body: "", labels: ["INBOX", "CATEGORY_PROMOTIONS"] },
  }
  let expired = false
  const api = {
    historyId: async () => history,
    added: async () => (expired ? "expired" : { historyId: history, ids: added.splice(0) }),
    message: async (id) => messages[id],
    search: async () => new Set(["m1", "m2"]),
  }
  const state = memory(undefined)
  const { events, fire, next } = collect()
  const watcher = watchMailbox({ query: "-category:promotions", every: "5s" }, api, fire, state, quiet)
  try {
    await sleep(100)
    assert.deepEqual(state.get(), { historyId: "100" })
    watcher.stop()
    history = "105"
    added.push("m1", "m2", "m3")
    const again = watchMailbox({ query: "-category:promotions", every: "5s" }, api, fire, state, quiet)
    const event = await next()
    again.stop()
    assert.deepEqual(event.messages.map((m) => m.subject), ["Midterm moved"])
    assert.equal("labels" in event.messages[0], false)
    assert.deepEqual(state.get(), { historyId: "105" })
    expired = true
    history = "999"
    const third = watchMailbox({ every: "5s" }, api, fire, state, quiet)
    await sleep(100)
    third.stop()
    assert.deepEqual(state.get(), { historyId: "999" })
    assert.equal(events.length, 1)

    // mail landing over two polls (a batch sent together) fires once, with all of it
    expired = false
    history = "1000"
    state.set({ historyId: "999" })
    added.push("m1")
    const fourth = watchMailbox({ every: "5s" }, api, fire, state, quiet)
    await sleep(300)
    messages.m4 = { ...messages.m1, id: "m4", subject: "Exam moved" }
    added.push("m4")
    const batch = await next(2, 6000)
    fourth.stop()
    assert.deepEqual(batch.messages.map((m) => m.subject), ["Midterm moved", "Exam moved"])
    await sleep(2500)
    assert.equal(events.length, 2)
  } finally {
    watcher.stop()
  }
})

test("dispatch: hands the run to the project's live panel with its token, waiting out a busy panel", async () => {
  const project = tempDir()
  const requests = []
  let busyAnswers = 1
  let running = false
  const server = http.createServer((req, res) => {
    let body = ""
    req.on("data", (c) => { body += c })
    req.on("end", () => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ app: "agentry", busy: running }))
        if (running) running = false // the "current run" ends after one more look
        return
      }
      requests.push({ url: req.url, token: req.headers["x-agentry-token"], body: JSON.parse(body) })
      res.writeHead(busyAnswers > 0 ? 409 : 202, { "Content-Type": "application/json" })
      if (busyAnswers-- > 0) {
        running = true
        res.end(JSON.stringify({ ok: false, error: "busy", runId: "run_1" }))
      } else {
        res.end(JSON.stringify({ ok: true, runId: "run_2" }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  fs.mkdirSync(path.join(project, ".agentry"))
  fs.writeFileSync(path.join(project, ".agentry", "panel.json"), JSON.stringify({ port: server.address().port, runId: "", token: "secret-token" }))
  const dispatcher = new Dispatcher({ projectDir: project, serverUrl: "http://127.0.0.1:9", autostart: false, log: quiet })
  try {
    const { runId, port } = await dispatcher.run("workflows/x.yaml", '{"trigger":"manual"}')
    assert.equal(runId, "run_2")
    assert.equal(requests.length, 2)
    assert.deepEqual(requests.map((r) => r.token), ["secret-token", "secret-token"])
    assert.deepEqual(requests[1].body, { workflow: "workflows/x.yaml", input: '{"trigger":"manual"}' })
    assert.equal(await dispatcher.waitUntilIdle(port), "idle")
    server.close()
    server.closeAllConnections()
    assert.equal(await dispatcher.waitUntilIdle(port), "gone") // the server died mid-run: report it, never "finished"
  } finally {
    server.close()
  }
  fs.rmSync(path.join(project, ".agentry", "panel.json"))
  await assert.rejects(dispatcher.run("workflows/x.yaml", ""), /no opencode server on http:\/\/127\.0\.0\.1:9 \(autostart is off\)/)
})

/** Stand-in for the panel the plugin brings up when its project loads: answers /health and takes
 *  one run. Writing panel.json is what "the project loaded" looks like to the dispatcher. */
async function standInPanel(project) {
  const panel = http.createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 202, { "Content-Type": "application/json" })
    res.end(JSON.stringify(req.url === "/health" ? { app: "agentry", busy: false } : { ok: true, runId: "run_woken" }))
  })
  await new Promise((resolve) => panel.listen(0, "127.0.0.1", resolve))
  fs.mkdirSync(path.join(project, ".agentry"), { recursive: true })
  fs.writeFileSync(path.join(project, ".agentry", "panel.json"), JSON.stringify({ port: panel.address().port, runId: "", token: "t" }))
  return panel
}

async function fakeOpencode(handle) {
  const server = http.createServer(handle)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

const stopAll = (...servers) => {
  for (const server of servers) {
    server?.close()
    server?.closeAllConnections()
  }
}

test("dispatch: an opencode 2 server is woken through its API location, not the web app it serves on /path", async () => {
  const project = tempDir()
  const seen = []
  let panel
  const oc = await fakeOpencode(async (req, res) => {
    const url = new URL(req.url, "http://x")
    seen.push({ path: url.pathname, dir: url.searchParams.get("location[directory]"), auth: req.headers.authorization })
    if (url.pathname === "/api/agent") {
      panel = await standInPanel(project)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ location: { directory: project }, data: [] }))
    } else {
      res.writeHead(200, { "Content-Type": "text/html" }) // the 2.x web app answers every other path
      res.end("<!doctype html>")
    }
  })
  try {
    const dispatcher = new Dispatcher({ projectDir: project, serverUrl: oc.url, password: "pw", autostart: false, log: quiet })
    assert.equal((await dispatcher.run("workflows/x.yaml", "")).runId, "run_woken")
    assert.deepEqual(seen.map((r) => r.path), ["/api/agent"])
    assert.equal(seen[0].dir, project)
    assert.equal(seen[0].auth, `Basic ${Buffer.from("opencode:pw").toString("base64")}`)
  } finally {
    stopAll(oc.server, panel)
  }
})

test("dispatch: an opencode 1 server, which has no /api, is woken through /path?directory=", async () => {
  const project = tempDir()
  const seen = []
  let panel
  const oc = await fakeOpencode(async (req, res) => {
    const url = new URL(req.url, "http://x")
    seen.push(url.pathname)
    if (url.pathname === "/path") {
      seen.push(url.searchParams.get("directory"))
      panel = await standInPanel(project)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ directory: project }))
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found")
    }
  })
  try {
    const dispatcher = new Dispatcher({ projectDir: project, serverUrl: oc.url, autostart: false, log: quiet })
    assert.equal((await dispatcher.run("workflows/x.yaml", "")).runId, "run_woken")
    assert.deepEqual(seen, ["/api/agent", "/path", project])
  } finally {
    stopAll(oc.server, panel)
  }
})

test("dispatch: a server that wants a password says how to give it one", async () => {
  const oc = await fakeOpencode((req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" })
    res.end('{"_tag":"UnauthorizedError","message":"Authentication required"}')
  })
  try {
    const dispatcher = new Dispatcher({ projectDir: tempDir(), serverUrl: oc.url, autostart: false, log: quiet })
    await assert.rejects(dispatcher.run("workflows/x.yaml", ""), /start it with OPENCODE_SERVER_PASSWORD set/)
  } finally {
    stopAll(oc.server)
  }
})
