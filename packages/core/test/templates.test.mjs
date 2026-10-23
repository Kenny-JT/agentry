// Every file in workflows/templates must be one the editor's template library can list and open,
// and one the runner accepts: a titled header, the runner's structural gate, no validation errors.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { checkRunnable } from "../src/runtime.ts"
import { workflowFromYaml } from "../src/serialize.ts"
import { templateInfo } from "../src/templates.ts"
import { validateWorkflow } from "../src/validate.ts"

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "workflows", "templates")
const files = fs.readdirSync(dir).filter((file) => /\.ya?ml$/.test(file)).sort()

test("templateInfo reads the title, the use-when line and the tags from the leading comments", () => {
  const info = templateInfo("# Fix a bug\r\n# Use when: something broke\n# Tags: code, bug,\n#\n# Flow: a -> b\nintroduction: x\n# not part of the header\n")
  assert.deepEqual(info, { title: "Fix a bug", useWhen: "something broke", tags: ["code", "bug"] })
  assert.deepEqual(templateInfo("introduction: no header\n"), { title: "", useWhen: "", tags: [] })
})

test("there are templates to list", () => {
  assert.ok(files.length > 0)
})

for (const file of files) {
  test(`template ${file}: titled, accepted by the runner, opens in the editor, no validation errors`, () => {
    const text = fs.readFileSync(path.join(dir, file), "utf8")
    const info = templateInfo(text)
    assert.ok(info.title, "the first comment line is the title")
    assert.ok(info.useWhen, "a '# Use when:' line says when to pick it")
    const check = checkRunnable(parse(text))
    assert.deepEqual(check.ok ? [] : check.errors, [])
    assert.deepEqual(Object.keys(workflowFromYaml(text).agents), Object.keys(check.workflow.agents))
    const errors = validateWorkflow(check.workflow).filter((issue) => issue.severity === "error")
    assert.deepEqual(errors.map((issue) => `${issue.nodeId ?? "workflow"}: ${issue.message}`), [])
  })
}
