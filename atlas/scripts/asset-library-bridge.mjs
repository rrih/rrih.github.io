// Native Rust owns inputs, conversion options, validation, budgets and reports.
// This adapter exposes the existing Sharp/glTF Transform codecs to the CLI.
import fs from 'node:fs/promises'
import sharp from 'sharp'

const request = JSON.parse(process.argv[2])
if (request.operation === 'artwork') {
  await sharp(request.input).resize(request.resize).webp(request.webp).toFile(request.output)
} else if (request.operation === 'model') {
  const { Logger, NodeIO } = await import('@gltf-transform/core')
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions')
  const { dedup, draco, prune, textureCompress } = await import('@gltf-transform/functions')
  const { default: draco3d } = await import('draco3dgltf')
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })
  const document = await io.read(request.input)
  document.setLogger(new Logger(Logger.Verbosity.ERROR))
  await document.transform(prune(), dedup(), draco(request.draco), textureCompress({ ...request.texture, encoder: sharp }))
  const binary = await io.writeBinary(document)
  await io.readBinary(binary)
  await fs.writeFile(request.output, binary)
} else {
  throw new Error('Unknown codec operation')
}
