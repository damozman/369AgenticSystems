'use client'

import { useState } from 'react'
import type { OpsBriefInputDef, OpsBriefMetricDef, OpsBriefInput } from '@/lib/ops-brief-schema'

interface MappingEntry {
  column: string | null
  confidence: number
}

interface MetricResult {
  value: number | null
  reason?: string
}

interface UploadResponse {
  uploadId: string
  reusedMapping: boolean
  headers: string[]
  proposedMapping?: Record<OpsBriefInput, MappingEntry>
  metrics?: Record<string, MetricResult>
  error?: string
}

interface ConfirmResponse {
  metrics?: Record<string, MetricResult>
  error?: string
}

interface Props {
  inputSchema: OpsBriefInputDef[]
  metricSchema: OpsBriefMetricDef[]
}

type Step = 'form' | 'review' | 'results'

function formatMetricValue(value: number, unit: string): string {
  if (unit === '%') return `${value}%`
  if (unit === '$') return `$${value.toLocaleString()}`
  return `${value} ${unit}`
}

export default function OpsUploadTool({ inputSchema, metricSchema }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [clientLabel, setClientLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [uploadId, setUploadId] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<OpsBriefInput, MappingEntry> | null>(null)
  const [metrics, setMetrics] = useState<Record<string, MetricResult> | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !clientLabel.trim()) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('clientLabel', clientLabel.trim())
    formData.append('vertical', 'wholesale')

    try {
      const res = await fetch('/api/admin/ops-brief/upload', { method: 'POST', body: formData })
      const data: UploadResponse = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      setUploadId(data.uploadId)
      setHeaders(data.headers)

      if (data.reusedMapping) {
        setMetrics(data.metrics ?? null)
        setStep('results')
      } else {
        setMapping(data.proposedMapping ?? null)
        setStep('review')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!uploadId || !mapping) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ops-brief/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, confirmedMapping: mapping }),
      })
      const data: ConfirmResponse = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Confirm failed')
      setMetrics(data.metrics ?? null)
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function updateMappingColumn(key: OpsBriefInput, column: string) {
    setMapping(prev =>
      prev ? { ...prev, [key]: { column: column || null, confidence: prev[key]?.confidence ?? 0 } } : prev
    )
  }

  function reset() {
    setStep('form')
    setClientLabel('')
    setFile(null)
    setError(null)
    setUploadId(null)
    setHeaders([])
    setMapping(null)
    setMetrics(null)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {step === 'form' && (
        <form
          onSubmit={handleUpload}
          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Client label
            </label>
            <input
              type="text"
              value={clientLabel}
              onChange={e => setClientLabel(e.target.value)}
              placeholder="e.g. Synthetic Distributor - Messy"
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Free text — remembers this &quot;client&quot;&apos;s mapping for next time. Not a real client record.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              File (.csv, .xlsx)
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-700 dark:text-slate-300"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !file || !clientLabel.trim()}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? 'Uploading…' : 'Upload & Parse'}
          </button>
        </form>
      )}

      {step === 'review' && mapping && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Review proposed mapping</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Detected headers: {headers.join(', ') || '(none)'}
            </p>
          </div>

          <div className="space-y-3">
            {inputSchema.map(field => (
              <div key={field.key} className="flex items-center gap-3">
                <div className="w-56 shrink-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{field.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{field.description}</p>
                </div>
                <select
                  value={mapping[field.key]?.column ?? ''}
                  onChange={e => updateMappingColumn(field.key, e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">— no match —</option>
                  {headers.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right shrink-0">
                  {Math.round((mapping[field.key]?.confidence ?? 0) * 100)}%
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-md px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Computing…' : 'Confirm & Compute'}
            </button>
            <button onClick={reset} className="text-sm text-slate-600 dark:text-slate-400 underline">
              Start over
            </button>
          </div>
        </div>
      )}

      {step === 'results' && metrics && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Computed metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metricSchema.map(m => {
                const result = metrics[m.key]
                const hasValue = result && result.value !== null
                return (
                  <div key={m.key} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                    {hasValue ? (
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {formatMetricValue(result!.value as number, m.unit)}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Insufficient data — {result?.reason ?? 'no reason given'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-600 dark:text-slate-400">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Self-score against the blueprint&apos;s pass/park checklist
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Was Claude&apos;s proposed mapping correct or close-to-correct on the first try?</li>
              <li>Did the human correction step take minutes, not an hour?</li>
              <li>Did at least 3-4 of the 5 metrics compute cleanly?</li>
              <li>Does the result read the way the original sample brief did?</li>
            </ul>
          </div>

          <button onClick={reset} className="text-sm text-slate-600 dark:text-slate-400 underline">
            Test another file
          </button>
        </div>
      )}
    </div>
  )
}
