import { pathToFileURL } from 'node:url'

const ROOT = pathToFileURL(process.cwd() + '/').href

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    // `@/lib/x` → <root>/lib/x.ts — Next's alias maps @ to the project root.
    return nextResolve(new URL(specifier.slice(2) + '.ts', ROOT).href, context)
  }
  return nextResolve(specifier, context)
}
