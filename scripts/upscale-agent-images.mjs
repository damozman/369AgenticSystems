import sharp from 'sharp'
import { readdir, stat, rename } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const AGENTS_DIR = fileURLToPath(new URL('../public/img/agents', import.meta.url))
const TARGET_W = 840
const TARGET_H = 1050

async function processDir(dir) {
  const entries = await readdir(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    const info = await stat(full)
    
    if (info.isDirectory()) {
      await processDir(full)
    } else if (extname(entry).toLowerCase() === '.jpg' || extname(entry).toLowerCase() === '.jpeg') {
      // Skip temporary/backup files if any
      if (entry.endsWith('.tmp')) continue

      const metadata = await sharp(full).metadata()
      
      // Idempotency: skip if already upscaled
      if (metadata.width >= TARGET_W && metadata.height >= TARGET_H) {
        console.log(`Skipping ${entry} (already ${metadata.width}x${metadata.height})`)
        continue
      }
      
      const beforeKB = Math.round(info.size / 1024)
      const tempPath = full + '.tmp'
      
      try {
        await sharp(full)
          .resize(TARGET_W, TARGET_H, { kernel: 'lanczos3' })
          .sharpen({ sigma: 1.2, m1: 1.0, m2: 3.0 })
          .jpeg({ quality: 95, mozjpeg: true })
          .toFile(tempPath)
          
        await rename(tempPath, full)
        
        const newInfo = await stat(full)
        const afterKB = Math.round(newInfo.size / 1024)
        
        console.log(`Upscaled ${entry}: ${metadata.width}x${metadata.height} (${beforeKB}KB) → ${TARGET_W}x${TARGET_H} (${afterKB}KB)`)
      } catch (err) {
        console.error(`Error processing ${entry}:`, err)
      }
    }
  }
}

console.log(`Starting image upscale process in: ${AGENTS_DIR}`)
processDir(AGENTS_DIR)
  .then(() => console.log('Image upscale process complete.'))
  .catch(console.error)
