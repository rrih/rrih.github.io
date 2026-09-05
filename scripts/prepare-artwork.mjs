import { mkdir, writeFile, access } from 'node:fs/promises'
import sharp from 'sharp'

const output = new URL('../public/artwork/', import.meta.url)
await mkdir(output, { recursive: true })
const queue = Array.from({ length: 1025 }, (_, i) => i + 1)
const failures = []
let completed = 0
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const id = queue.shift()
    const path = new URL(`${id}.webp`, output)
    try {
      try { await access(path); continue } catch {}
      let response
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`, { signal: AbortSignal.timeout(45000) })
          if (response.ok) break
        } catch { }
      }
      if (!response?.ok) throw new Error(`Unavailable ${id}`)
      const input = Buffer.from(await response.arrayBuffer())
      const image = await sharp(input).resize(192, 192, { fit: 'inside' }).webp({ quality: 78, effort: 5 }).toBuffer()
      await writeFile(path, image)
      completed++
      if (completed % 100 === 0) console.log(`Artwork: ${completed}`)
    } catch (error) { failures.push({ id, error: String(error) }) }
  }
}))
console.log(JSON.stringify({ completed, failures }))
if (failures.length) process.exitCode = 1
