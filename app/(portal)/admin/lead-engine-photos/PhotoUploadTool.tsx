'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { decideBatchPhotoUpload, WARN_PHOTO_LONG_EDGE } from '@/lib/lead-engine/limits'

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

interface Photo {
  id: string
  url: string
  caption: string | null
  variants?: PhotoVariant[]
  aspectRatio?: number
  width?: number
  height?: number
  dominantHex?: string
  isPrimary?: boolean
  slot?: 'hero' | 'band' | 'service' | 'gallery'
  slotKey?: string
}

type Phase = 'idle' | 'working' | 'done' | 'error'

/** A thumbnail source that does not download the 2560px original to draw a 160px box. */
function thumb(p: Photo): string {
  return p.variants?.[0]?.webp ?? p.url
}

export default function PhotoUploadTool({ sites }: { sites: SiteOption[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [services, setServices] = useState<string[]>([])
  const [max, setMax] = useState(18)
  const [loadingList, setLoadingList] = useState(false)

  const refresh = useCallback(async (id: string) => {
    if (!id) { setPhotos([]); return }
    setLoadingList(true)
    try {
      const res = await fetch(`/api/lead-engine/photos?siteId=${encodeURIComponent(id)}`)
      const data: { photos?: Photo[]; services?: string[]; max?: number; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load photos')
      setPhotos(data.photos ?? [])
      setServices(data.services ?? [])
      if (data.max) setMax(data.max)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load photos')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { void refresh(siteId) }, [siteId, refresh])

  // Advisory only. The real limit is the per-request count check inside POST /api/lead-engine/photos
  // -- this call cannot enforce anything, it just says so before a long upload rather than after.
  const batch = decideBatchPhotoUpload({ currentCount: photos.length, incomingCount: files.length })

  async function uploadOne(file: File, index: number): Promise<string | null> {
    setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`)

    const signRes = await fetch('/api/lead-engine/photos/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, filename: file.name }),
    })
    const signData: { path?: string; token?: string; error?: string } = await signRes.json()
    if (!signRes.ok || !signData.path || !signData.token) {
      throw new Error(signData.error ?? 'Could not get an upload URL')
    }

    // Straight to Storage, bypassing our own route's 4.5MB body limit -- the whole reason the sign
    // step exists. See docs/PHOTO-REQUIREMENTS.md.
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('lead-engine-photos-incoming')
      .uploadToSignedUrl(signData.path, signData.token, file)
    if (uploadError) throw new Error(uploadError.message)

    const processRes = await fetch('/api/lead-engine/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        incomingPath: signData.path,
        filename: file.name,
        // Caption and hero apply to the FIRST file only. Both describe one specific photo, and
        // copying them across a batch would caption five photos identically and fight over the
        // single hero slot -- the DB's partial unique index allows one primary per site, so the
        // last write would silently win.
        ...(index === 0 && caption.trim() ? { caption: caption.trim() } : {}),
        ...(index === 0 && isPrimary ? { isPrimary: true } : {}),
      }),
    })
    const processData: { photo?: Photo; warning?: string; error?: string } = await processRes.json()
    if (!processRes.ok || !processData.photo) {
      throw new Error(`${file.name}: ${processData.error ?? 'Processing failed'}`)
    }
    return processData.warning ?? null
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length || !siteId || !batch.allowed) return

    setPhase('working')
    setError(null)
    setWarnings([])

    const collected: string[] = []
    try {
      // Sequential, not parallel: each upload runs a HEIC decode and four resize/encode passes
      // server-side, and firing ten at once is how a serverless function times out. Slower and
      // finishes.
      for (let i = 0; i < files.length; i++) {
        const w = await uploadOne(files[i], i)
        if (w) collected.push(`${files[i].name}: ${w}`)
      }
      setWarnings(collected)
      setPhase('done')
      setFiles([])
      setCaption('')
      setIsPrimary(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setWarnings(collected)
      setPhase('error')
    } finally {
      setProgress(null)
      // Refresh either way. A batch that failed on file 4 still landed files 1-3, and the list is
      // the only place that says so.
      await refresh(siteId)
    }
  }

  /**
   * `value` is the <select>'s own encoding: '' for automatic, a bare slot name, or
   * `service:<name>` for a specific tile. Kept as one control because "where does this go" is one
   * decision, and splitting it into a slot picker plus a service picker makes an invalid pair
   * (service with no name) reachable.
   */
  async function assign(photoId: string, value: string) {
    setError(null)
    const isService = value.startsWith('service:')
    try {
      const res = await fetch('/api/lead-engine/photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          slot: value === '' ? null : isService ? 'service' : value,
          ...(isService ? { slotKey: value.slice('service:'.length) } : {}),
        }),
      })
      const data: { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not move that photo')
      await refresh(siteId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move that photo')
    }
  }

  /**
   * Where a tagged photo lands on its service's page — read from the same order the page reads.
   *
   * Returns null for anything not tagged to a service, and for a tag naming a service that no
   * longer exists (the stale-tag warning above already covers that case, and saying "leads Drain
   * cleaning" about a service that is gone would contradict it).
   */
  function servicePosition(photo: Photo): string | null {
    if (photo.slot !== 'service' || !photo.slotKey) return null
    if (!services.some(name => name.trim().toLowerCase() === photo.slotKey!.trim().toLowerCase())) return null

    const siblings = photos.filter(
      q => q.slot === 'service'
        && q.slotKey?.trim().toLowerCase() === photo.slotKey!.trim().toLowerCase(),
    )
    const i = siblings.findIndex(q => q.id === photo.id)
    if (i === 0) return `Leads the ${photo.slotKey} page`
    if (i > 0 && i <= 3) return `In the ${photo.slotKey} strip (${i} of 3)`
    return `Tagged to ${photo.slotKey}, but its page shows only the first four`
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo? The variants are removed from Storage too — this cannot be undone.')) return
    setError(null)
    try {
      const res = await fetch(`/api/lead-engine/photos?photoId=${encodeURIComponent(photoId)}`, { method: 'DELETE' })
      const data: { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      await refresh(siteId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const busy = phase === 'working'
  const hasPrimary = photos.some(p => p.isPrimary)

  return (
    <div className="space-y-8">
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Site</label>
          <select
            value={siteId}
            onChange={e => setSiteId(e.target.value)}
            className="w-full border rounded px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
          >
            {sites.length === 0 && <option value="">No sites found</option>}
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.business_name} ({s.slug})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Photos <span className="font-normal text-slate-500">— you can pick several at once</span>
          </label>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm"
          />
          {files.length > 1 && (
            <p className="mt-1 text-xs text-slate-500">
              {files.length} selected. Caption and hero below apply to the first one only.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Caption <span className="font-normal text-slate-500">— optional</span>
          </label>
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="What this shows, in the customer's words"
            className="w-full border rounded px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
          />
          <p className="mt-1 text-xs text-slate-500">
            Used as the alt text when a gallery photo has no other description.
          </p>
        </div>

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="mt-1"
            />
            <span>
              Use as the hero photo
              {hasPrimary && (
                <span className="block text-xs text-amber-700 dark:text-amber-400">
                  This site already has a hero photo — uploading this will take it over.
                </span>
              )}
            </span>
          </label>
        </div>

        {!batch.allowed && (
          <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            {batch.reason}
          </div>
        )}

        <button
          type="submit"
          disabled={!files.length || !siteId || busy || !batch.allowed}
          className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? (progress ?? 'Working…') : `Upload${files.length > 1 ? ` ${files.length} photos` : ''}`}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4 text-red-800 dark:text-red-200">
          <strong>Failed:</strong> {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200 text-sm space-y-1">
          {warnings.map(w => <div key={w}>{w}</div>)}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {photos.length === 0
            ? `No photos yet — room for ${max}`
            : `${photos.length} photo${photos.length === 1 ? '' : 's'} on this site, of ${max}`}
        </h2>
        {/* The tiles below are photos that are ALREADY on the site, not empty slots waiting to be
            filled. "18 of 18" read as "eighteen places to put something" to the first person who
            used this, which is a fair reading of a counter next to a grid of boxes. Say which it
            is, and say it only when the distinction matters. */}
        {photos.length >= max && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
            This site is full. Every tile below is a photo already on it — delete one to make room.
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {hasPrimary
            ? 'One photo is marked as the hero.'
            : 'No hero photo chosen — the page will use the first one uploaded.'}
        </p>

        {loadingList && <p className="text-sm text-slate-500">Loading…</p>}
        {!loadingList && photos.length === 0 && (
          <p className="text-sm text-slate-500">Nothing uploaded for this site yet.</p>
        )}

        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map(p => (
            <li key={p.id} className="rounded border border-slate-300 dark:border-slate-700 overflow-hidden">
              <img
                src={thumb(p)}
                alt={p.caption ?? ''}
                className="w-full h-32 object-cover"
                style={p.dominantHex ? { background: p.dominantHex } : undefined}
              />
              <div className="p-2 space-y-1 text-xs">
                <select
                  value={p.slot === 'service' ? `service:${p.slotKey ?? ''}` : p.slot ?? ''}
                  onChange={e => assign(p.id, e.target.value)}
                  className="w-full border rounded px-1 py-0.5 text-xs dark:bg-slate-800 dark:border-slate-600"
                >
                  <option value="">Automatic</option>
                  <option value="hero">Hero (top of page)</option>
                  <option value="band">Wide band</option>
                  <option value="gallery">Gallery only</option>
                  {services.map(name => (
                    <option key={name} value={`service:${name}`}>Service — {name}</option>
                  ))}
                </select>
                {p.isPrimary && !p.slot && (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    Hero
                  </span>
                )}
                {p.slot === 'service' && !services.includes(p.slotKey ?? '') && (
                  // The service was renamed or removed after this photo was pinned to it. The
                  // photo still renders -- it falls back to automatic -- but the stated intent is
                  // stale and silently ignoring that is how an operator stops trusting the tool.
                  <div className="text-amber-700 dark:text-amber-400">
                    &ldquo;{p.slotKey}&rdquo; is no longer a service — placed automatically
                  </div>
                )}
                {servicePosition(p) && (
                  // Several photos may now name the same service, and WHICH one leads that
                  // service's page is decided by upload order. Without saying so, an operator
                  // tagging four photos has no idea which becomes the big one at the top.
                  <div className="text-slate-600 dark:text-slate-400">{servicePosition(p)}</div>
                )}
                <div className="text-slate-700 dark:text-slate-300 break-words">
                  {p.caption ?? <span className="text-slate-400">No caption</span>}
                </div>
                <div className="text-slate-500">
                  {p.width && p.height ? `${p.width} × ${p.height}` : 'size unknown'}
                </div>
                {p.width && p.height && Math.max(p.width, p.height) < WARN_PHOTO_LONG_EDGE && (
                  // The number that was missing. A photo can look large on screen and still be
                  // under the threshold, and without this the hero warning is unfalsifiable.
                  <div className="text-amber-700 dark:text-amber-400">
                    Under {WARN_PHOTO_LONG_EDGE}px — a larger photo wins the hero
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="text-red-700 dark:text-red-400 underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
