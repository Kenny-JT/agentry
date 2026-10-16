// Trigger parsers + checks (src/triggers.ts has no runtime imports, so Node strips its types directly).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  checkTriggers,
  fileTriggerAccepts,
  nextScheduleTime,
  parseDuration,
  parseScheduleAt,
} from "../src/triggers.ts"

test("durations", () => {
  assert.equal(parseDuration("30s"), 30_000)
  assert.equal(parseDuration("15m"), 900_000)
  assert.equal(parseDuration("1.5h"), 5_400_000)
  assert.equal(parseDuration("500ms"), 500)
  for (const bad of ["", "15", "0s", "-3m", "2 weeks", undefined]) assert.equal(parseDuration(bad), null, String(bad))
})

test("schedule.at: days, ranges that wrap, bad input", () => {
  assert.deepEqual(parseScheduleAt("17:00"), { hour: 17, minute: 0, days: null })
  assert.deepEqual([...parseScheduleAt("Fri 17:00").days], [5])
  assert.deepEqual([...parseScheduleAt("Mon-Fri 08:30").days].sort(), [1, 2, 3, 4, 5])
  assert.deepEqual([...parseScheduleAt("Fri-Mon 10:00").days].sort(), [0, 1, 5, 6])
  assert.deepEqual([...parseScheduleAt("mon,wed 9:05").days].sort(), [1, 3])
  assert.deepEqual([...parseScheduleAt("weekdays 07:00").days].sort(), [1, 2, 3, 4, 5])
  for (const bad of ["25:00", "17:60", "Funday 10:00", "5pm", "Fri", ""]) assert.equal(parseScheduleAt(bad), null, bad)
})

test("next schedule time is strictly after `after`, on an allowed day", () => {
  const friday5pm = parseScheduleAt("Fri 17:00")
  const wed = new Date(2026, 9, 14, 12, 0) // Wed 14 Oct 2026, noon (local)
  assert.equal(nextScheduleTime(friday5pm, wed).getTime(), new Date(2026, 9, 16, 17, 0).getTime())
  const exactly = new Date(2026, 9, 16, 17, 0)
  assert.equal(nextScheduleTime(friday5pm, exactly).getTime(), new Date(2026, 9, 23, 17, 0).getTime())
  const daily = parseScheduleAt("08:00")
  assert.equal(nextScheduleTime(daily, new Date(2026, 9, 14, 7, 59)).getTime(), new Date(2026, 9, 14, 8, 0).getTime())
})

test("file trigger ignores in-progress downloads and honours match/ignore", () => {
  const t = { path: "Downloads", match: ["*.pdf", "*.png"], ignore: "draft*" }
  assert.equal(fileTriggerAccepts(t, "Syllabus.PDF"), true)
  assert.equal(fileTriggerAccepts(t, "notes.txt"), false)
  assert.equal(fileTriggerAccepts(t, "draft-1.pdf"), false)
  assert.equal(fileTriggerAccepts({ path: "x" }, "Unconfirmed 123.crdownload"), false)
  assert.equal(fileTriggerAccepts({ path: "x" }, "a.pdf.part"), false)
  assert.equal(fileTriggerAccepts({ path: "x" }, "~$report.docx"), false)
  assert.equal(fileTriggerAccepts({ path: "x" }, "anything.zip"), true)
})

test("checkTriggers reports each problem once, accepts a valid block", () => {
  assert.deepEqual(checkTriggers({
    file: { path: "Downloads", settle: "2s" },
    schedule: { at: "Fri 17:00" },
    web: { url: "https://courses.example.edu/cs225", every: "30s", initial: true },
    mail: { query: "in:inbox", every: "10s" },
    git: { repo: "../shop", event: "push", branch: ["main"] },
  }), [])
  const problems = checkTriggers({
    file: {},
    schedule: { at: "17:00", every: "1h" },
    web: { url: "ftp://x" },
    mail: { provider: "imap" },
    git: { repo: "r", event: "merge" },
    cron: "* * * * *",
  })
  const fields = problems.map((p) => `${p.kind}${p.field ? `.${p.field}` : ""}`).sort()
  assert.deepEqual(fields, ["file.path", "git.event", "mail.provider", "on.cron", "schedule", "web.url"])
  assert.equal(checkTriggers("file").length, 1)
  assert.deepEqual(checkTriggers(undefined), [])
})
