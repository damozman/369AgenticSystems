import { WHOLESALE_INPUT_SCHEMA, WHOLESALE_METRICS } from '@/lib/ops-brief-schema'
import OpsUploadTool from './OpsUploadTool'

// Auto-protected by middleware.ts (config.matcher includes /admin/:path*).
export default function OpsBriefTestPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Ops-Brief Parsing Test</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Internal test harness — wholesale vertical only, no client-facing polish. Upload a real
          (or synthetic) messy export, review Claude&apos;s proposed column mapping, and see which of
          the 5 target metrics compute cleanly. Not a production feature.
        </p>
      </div>
      <OpsUploadTool inputSchema={WHOLESALE_INPUT_SCHEMA} metricSchema={WHOLESALE_METRICS} />
    </div>
  )
}
