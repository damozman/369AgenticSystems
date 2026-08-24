'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface SiteOption {
  id: string
  slug: string
  business_name: string
}

interface PhotoVariant {
  width: number
  webp: string
  jpg: string
}

interface ProcessedPhoto {
  id: string
  url: string
  caption: string | null
  variants: PhotoVariant[]
  aspectRatio?: number
  dominantHex?: string
  isPrimary?: boolean
}

type Phase = 'idle' | 'signing' | 'uploading' | 'processing' | 'done' | 'error'

export default function PhotoUploadTool({ sites }: { sites: SiteOption[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [photo, setPhoto] = useState<ProcessedPhoto | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !siteId) return

    setPhase('signing')
    setError(null)
    setWarning(null)
    setPhoto(null)

    try {
      // Step 1: mint a signed Storage upload URL — see /api/lead-engine/photos/sign.
      const signRes = await fetch('/api/lead-engine/photos/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, filename: file.name }),
      })
      const signData: { path?: string; token?: string; error?: string } = await signRes.json()
      if (!signRes.ok || !signData.path || !signData.token) {
        throw new Error(signData.error ?? 'Could not get an upload URL')
      }

      // Step 2: the raw file goes straight to Storage, bypassing our own route's 4.5MB body limit
      // entirely — this is the whole reason step 1 exists. See docs/PHOTO-REQUIREMENTS.md.
      setPhase('uploading')
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('lead-engine-photos-incoming')
        .uploadToSignedUrl(signData.path, signData.token, file)
      if (uploadError) throw new Error(uploadError.message)

      // Step 3: tell the server to fetch, process, and store it — see /api/lead-engine/photos.
      setPhase('processing')
      const processRes = await fetch('/api/lead-engine/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, incomingPath: signData.path, filename: file.name }),
      })
      const processData: { photo?: ProcessedPhoto; warning?: string; error?: string } = await processRes.json()
      if (!processRes.ok || !processData.photo) {
        throw new Error(processData.error ?? 'Processing failed')
      }

      setPhoto(processData.photo)
      setWarning(processData.warning ?? null)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'processing'

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Site</label>
          <select
            value={siteId}
            onChange={e => setSiteId(e.target.value)}
            className="w-full border rounded px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
          >
            {sites.length === 0 && <option value="">No review fixtures found — run seed-lead-engine-review.mjs</option>}
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.business_name} ({s.slug})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Photo</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!file || !siteId || busy}
          className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {phase === 'idle' && 'Upload'}
          {phase === 'signing' && 'Getting upload URL…'}
          {phase === 'uploading' && 'Uploading to Storage…'}
          {phase === 'processing' && 'Processing (HEIC decode, resize, WebP encode)…'}
          {(phase === 'done' || phase === 'error') && 'Upload another'}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4 text-red-800 dark:text-red-200">
          <strong>Failed:</strong> {error}
        </div>
      )}

      {warning && (
        <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <strong>Warning:</strong> {warning}
        </div>
      )}

      {photo && (
        <div className="rounded border border-slate-300 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-start gap-4">
            <img
              src={photo.variants[Math.min(1, photo.variants.length - 1)]?.webp ?? photo.url}
              alt=""
              className="w-40 h-40 object-cover rounded"
              style={photo.dominantHex ? { background: photo.dominantHex } : undefined}
            />
            <dl className="text-sm space-y-1">
              <div><dt className="inline font-medium">Aspect ratio:</dt> <dd className="inline">{photo.aspectRatio?.toFixed(3) ?? '—'}</dd></div>
              <div><dt className="inline font-medium">Dominant color:</dt> <dd className="inline">{photo.dominantHex ?? '—'}</dd></div>
              <div><dt className="inline font-medium">Variants stored:</dt> <dd className="inline">{photo.variants.map(v => v.width).join('px, ')}px</dd></div>
              <div><dt className="inline font-medium">Photo id:</dt> <dd className="inline font-mono text-xs">{photo.id}</dd></div>
            </dl>
          </div>
          <div className="text-sm">
            <a href={photo.url} target="_blank" rel="noreferrer" className="underline">Open largest variant in a new tab →</a>
          </div>
        </div>
      )}
    </div>
  )
}
