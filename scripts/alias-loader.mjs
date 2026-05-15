/**
 * Node ESM loader hook that resolves @/ path aliases at runtime.
 * Usage: node --import ./scripts/alias-loader.mjs <entry>
 *
 * @/ maps to dist/src/ (the compiled output directory)
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
import path from 'path'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const relativePath = specifier.slice(2) // strip '@/'
    const resolved = path.join(projectRoot, 'dist', 'src', relativePath + '.js')
    return nextResolve(pathToFileURL(resolved).href, context)
  }

  // Handle relative imports that omit .js extension (TypeScript compiled output)
  return nextResolve(specifier, context)
}
