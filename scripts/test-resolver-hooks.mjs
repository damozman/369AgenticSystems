import { pathToFileURL } from 'node:url'

const ROOT = pathToFileURL(process.cwd() + '/').href

/** Anything already carrying an extension Node can resolve on its own. */
const HAS_EXTENSION = /\.(?:[cm]?[jt]sx?|json|node)$/

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    // `@/lib/x` → <root>/lib/x.ts — Next's alias maps @ to the project root.
    // Note this appends `.ts` blindly, so `@/lib/verticals` (a DIRECTORY) will not resolve —
    // import `@/lib/verticals/index` explicitly.
    return nextResolve(new URL(specifier.slice(2) + '.ts', ROOT).href, context)
  }

  // Relative, extensionless — TypeScript's own resolution, which Node does not implement.
  //
  // Added 2026-08-23. `lib/verticals/index.ts` imports `./dental`, so any test that reaches that
  // module died on ERR_MODULE_NOT_FOUND even though tsc and Next resolve it fine. Lead Engine
  // derives its vertical list from there deliberately, to make a second spelling of `real-estate`
  // structurally impossible, so this stopped being avoidable.
  //
  // Deliberately a TRY, falling through on failure: a genuine directory import or a real missing
  // module must still produce Node's own error rather than a confusing one about a `.ts` file
  // nobody wrote.
  if (context.parentURL && /^\.\.?\//.test(specifier) && !HAS_EXTENSION.test(specifier)) {
    try {
      return await nextResolve(new URL(specifier + '.ts', context.parentURL).href, context)
    } catch {
      // fall through to the default resolution below
    }
  }

  return nextResolve(specifier, context)
}
