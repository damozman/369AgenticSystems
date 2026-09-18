#!/usr/bin/env node
/** READ-ONLY. The voice, provider and language every live agent actually resolves to. */
import { Retell } from 'retell-sdk'
const client = new Retell({ apiKey: process.env.RETELL_API_KEY })
const res = await client.agent.list()
const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])
const seen = new Set()
const voiceCache = new Map()
async function voiceInfo(id) {
  if (!voiceCache.has(id)) {
    try { voiceCache.set(id, await client.voice.retrieve(id)) } catch (e) { voiceCache.set(id, { error: e.message }) }
  }
  return voiceCache.get(id)
}
for (const s of list) {
  if (seen.has(s.agent_id)) continue
  seen.add(s.agent_id)
  const a = await client.agent.retrieve(s.agent_id)
  const v = await voiceInfo(a.voice_id)
  console.log(`${a.agent_name}`)
  console.log(`   voice_id=${a.voice_id}  model=${a.voice_model ?? 'default'}  speed=${a.voice_speed ?? 1}  temp=${a.voice_temperature ?? '—'}`
    + `  language=${a.language ?? '—'}  provider=${v.provider ?? v.error}  name=${v.voice_name ?? '—'}  type=${v.voice_type ?? '—'}`)
}
