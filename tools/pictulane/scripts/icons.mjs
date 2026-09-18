import sharp from 'sharp'
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['icon-maskable', 512],
  ['apple-touch-icon', 180],
])
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/${name}.png`)
