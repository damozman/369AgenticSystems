import sharp from 'sharp'
import { readdir, stat, unlink } from 'fs/promises'
import { join, extname, dirname, basename } from 'path'

const AGENTS_DIR = new URL('../public/agents', import.meta.url).pathname.replace(/^\//, '')
const TARGET_W = 280
const TARGET_H = 350

async function processDir(dir) {
  const entries = await readdir(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) {
      await processDir(full)
    } else if (extname(entry).toLowerCase() === '.png') {
      const jpgPath = join(dirname(full), basename(entry, '.png') + '.jpg')
      const before = Math.round(info.size / 1024)
      await sharp(full)
        .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'top' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(jpgPath)
      const { size: after } = await stat(jpgPath)
      console.log(`${entry} → .jpg: ${before}KB → ${Math.round(after / 1024)}KB`)
      await unlink(full)
    }
  }
}

processDir(AGENTS_DIR).catch(console.error)
