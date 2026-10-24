// The chat client against stand-in opencode servers of both generations: which one answers is
// learned when the session opens, and each prompt then takes that server's way to the reply.
import { after, test } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import { AiRequestError, createSession, sendPrompt } from "../src/aiClient.ts"

const servers = []
after(() => {
  for (const server of servers) {
    server.close()
    server.closeAllConnections()
  }
})

/** routes: "METHOD /path" -> (request) => [status, json?]; anything else answers 404 text. */
async function standIn(routes) {
  const log = []
  const server = http.createServer((req, res) => {
    let body = ""
    req.on("data", (chunk) => { body += chunk })
    req.on("end", () => {
      const path = req.url.split("?")[0]
      const entry = { method: req.method, url: req.url, path, auth: req.headers.authorization, body: body ? JSON.parse(body) : undefined }
      log.push(entry)
      const route = routes[`${req.method} ${path}`]
      if (!route) {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not Found")
        return
      }
      const [status, json] = route(entry)
      if (json === undefined) {
        res.writeHead(status)
        res.end()
        return
      }
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(JSON.stringify(json))
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  servers.push(server)
  return { url: `http://127.0.0.1:${server.address().port}`, log }
}

const settingsFor = (url, extra = {}) => ({ url, password: "", directory: "", agent: "plan", model: "", ...extra })
const text = (value) => ({ type: "text", text: value })

test("opencode 2: the session opens under /api; a prompt is admitted, awaited, and answered with the turn's assistant text", async () => {
  const server = await standIn({
    "POST /api/session": () => [200, { data: { id: "ses_1" } }],
    "POST /api/session/ses_1/agent": () => [204],
    "POST /api/session/ses_1/model": () => [204],
    "POST /api/session/ses_1/prompt": () => [200, { data: { id: "msg_2", type: "user" } }],
    "POST /api/experimental/session/ses_1/wait": () => [204],
    "GET /api/session/ses_1/context": () => [200, {
      data: [
        { id: "msg_0", type: "user", text: "earlier" },
        { id: "msg_1", type: "assistant", content: [text("an earlier reply")] },
        { id: "msg_2", type: "user", text: "edit" },
        { id: "msg_3", type: "assistant", content: [text("Added a summary step.")] },
        { id: "msg_4", type: "assistant", content: [{ type: "reasoning", text: "thinking" }, text("```yaml\nagents: {}\n```")] },
        { id: "msg_5", type: "idle", outcome: "succeeded" },
      ],
    }],
  })
  const settings = settingsFor(server.url, { password: "pw", directory: "C:\\work", model: "opencode/free-model" })
  const session = await createSession(settings)
  assert.deepEqual(session, { id: "ses_1", opencode: 2 })
  const reply = await sendPrompt(settings, session, "edit")
  assert.equal(reply.text, "Added a summary step.\n\n```yaml\nagents: {}\n```")
  assert.deepEqual(server.log.map((r) => `${r.method} ${r.path}`), [
    "POST /api/session",
    "POST /api/session/ses_1/agent",
    "POST /api/session/ses_1/model",
    "POST /api/session/ses_1/prompt",
    "POST /api/experimental/session/ses_1/wait",
    "GET /api/session/ses_1/context",
  ])
  assert.deepEqual(server.log[0].body.location, { directory: "C:\\work" })
  assert.deepEqual(server.log[1].body, { agent: "plan" })
  assert.deepEqual(server.log[2].body, { model: { id: "free-model", providerID: "opencode" } })
  assert.deepEqual(server.log[3].body, { text: "edit" })
  assert.ok(server.log.every((r) => r.auth === `Basic ${Buffer.from("opencode:pw").toString("base64")}`))
})

test("opencode 2: a turn the provider fails is an error carrying the provider's message", async () => {
  const server = await standIn({
    "POST /api/session": () => [200, { data: { id: "ses_9" } }],
    "POST /api/session/ses_9/agent": () => [204],
    "POST /api/session/ses_9/prompt": () => [200, { data: { id: "msg_1" } }],
    "POST /api/experimental/session/ses_9/wait": () => [204],
    "GET /api/session/ses_9/context": () => [200, {
      data: [
        { id: "msg_1", type: "user", text: "edit" },
        { id: "msg_2", type: "assistant", content: [] },
        { id: "msg_3", type: "idle", outcome: "failed", error: { message: "OAuth access token has expired" } },
      ],
    }],
  })
  const settings = settingsFor(server.url)
  const session = await createSession(settings)
  await assert.rejects(sendPrompt(settings, session, "edit"), (error) => error instanceof AiRequestError && /OAuth access token has expired/.test(error.message))
})

test("opencode 1 has no /api: the session opens at /session and a prompt blocks on /session/{id}/message", async () => {
  const server = await standIn({
    "POST /session": () => [200, { id: "s1" }],
    "POST /session/s1/message": () => [200, { info: {}, parts: [text("Done."), { type: "tool" }, text("```yaml\na: 1\n```")] }],
  })
  const settings = settingsFor(server.url, { directory: "/work" })
  const session = await createSession(settings)
  assert.deepEqual(session, { id: "s1", opencode: 1 })
  assert.equal((await sendPrompt(settings, session, "edit")).text, "Done.\n```yaml\na: 1\n```")
  assert.deepEqual(server.log.map((r) => `${r.method} ${r.url}`), [
    "POST /api/session",
    "POST /session?directory=%2Fwork",
    "POST /session/s1/message?directory=%2Fwork",
  ])
  assert.equal(server.log[2].body.agent, "plan")
})

test("a server that wants a password says how to give it one; a wrong password is told apart", async () => {
  const server = await standIn({ "POST /api/session": () => [401, { _tag: "UnauthorizedError", message: "Authentication required" }] })
  await assert.rejects(createSession(settingsFor(server.url)), (error) => error instanceof AiRequestError && error.status === 401 && /OPENCODE_SERVER_PASSWORD/.test(error.hint))
  await assert.rejects(createSession(settingsFor(server.url, { password: "wrong" })), (error) => error instanceof AiRequestError && /rejected the password/.test(error.message))
})

test("nothing listening: an error that names the server and the --cors opencode 2 needs", async () => {
  const closed = await standIn({})
  const url = closed.url
  await new Promise((resolve) => servers.pop().close(resolve))
  await assert.rejects(createSession(settingsFor(url)), (error) => error instanceof AiRequestError && error.message.includes(url) && /--cors/.test(error.hint))
})
