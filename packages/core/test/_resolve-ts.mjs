// `--import` hook for the core tests: src/ uses extensionless relative imports (tsconfig
// moduleResolution "Bundler"), which Node's type stripping does not resolve on its own.
// Tries `<spec>.ts` for a relative specifier that has no extension, then falls through.
import { register } from "node:module"

register(`data:text/javascript,${encodeURIComponent(`
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"
export async function resolve(specifier, context, next) {
  if (/^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const candidate = new URL(specifier + ".ts", context.parentURL)
    if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context)
  }
  return next(specifier, context)
}
`)}`)
