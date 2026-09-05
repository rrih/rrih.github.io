import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pokemon } from '../src/catalog'
import { formLabel, forms, formsFor, modelFor } from '../src/forms'
import { parseScene } from '../src/sceneStudio'
import { habitats } from '../src/types'

test('actual alternate forms have distinct selectors, complete data and embedded animated assets', () => {
  expect(forms.length).toBe(120)
  expect(new Set(forms.map((form) => form.id)).size).toBe(forms.length)
  expect(forms.filter((form) => form.kind === 'mega')).toHaveLength(62)
  expect(forms.filter((form) => form.kind === 'regional')).toHaveLength(58)
  for (const entry of pokemon) {
    const choices = formsFor(entry.id).map((form) => formLabel(form, (key) => key))
    expect(new Set(choices).size).toBe(choices.length)
  }
  for (const form of forms) {
    expect(pokemon.some((entry) => entry.id === form.speciesId)).toBe(true)
    expect(form.stats).toHaveLength(6)
    expect(form.stats.every((value) => Number.isFinite(value) && value > 0 && value <= 255)).toBe(true)
    expect(form.height).toBeGreaterThan(0)
    expect(form.weight).toBeGreaterThan(0)
    for (const url of [form.model.url, form.model.shiny].filter((value): value is string => !!value)) {
      expect(url).toMatch(/^\/atlas\/models\/forms\/[a-z0-9-]+\.glb$/)
      const file = readFileSync(resolve(import.meta.dir, '../public', url.slice('/atlas/'.length)))
      expect(file.toString('ascii', 0, 4)).toBe('glTF')
      expect(file.readUInt32LE(8)).toBe(file.length)
      const gltf = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)))
      expect(gltf.meshes.length).toBeGreaterThan(0)
      expect(gltf.animations).toHaveLength(1)
      expect(gltf.animations[0].channels.length).toBeGreaterThan(0)
      for (const image of gltf.images || [])
        expect(image.uri === undefined || image.uri.startsWith('data:')).toBe(true)
      for (const buffer of gltf.buffers || [])
        expect(buffer.uri === undefined || buffer.uri.startsWith('data:')).toBe(true)
      for (const channel of gltf.animations[0].channels) {
        expect(gltf.nodes[channel.target.node]).toBeDefined()
        expect(gltf.animations[0].samplers[channel.sampler]).toBeDefined()
      }
    }
  }
})

test('saved scenes retain known matching forms and backgrounds while rejecting arbitrary references', () => {
  for (const form of forms) {
    for (const habitat of habitats) {
      const scene = {
        id: 'scene',
        name: 'Scene',
        members: [
          {
            key: 'member',
            speciesId: form.speciesId,
            formId: form.id,
            shiny: !!form.model.shiny,
            x: 0,
            z: 0,
            rotation: 0,
            scale: 1,
          },
        ],
        settings: {
          playing: true,
          rotate: false,
          speed: 1,
          light: 1,
          habitat,
          backgroundId: 'caaf9e76-66de-47ec-b630-2cad2c0cfe70',
          wireframe: false,
          shiny: false,
          quality: 'high',
          animation: 0,
        },
      }
      expect(parseScene(scene)?.members[0].formId).toBe(form.id)
      expect(modelFor(form.speciesId, form.id)).toEqual(form.model)
      expect(
        parseScene({ ...scene, members: [{ ...scene.members[0], speciesId: form.speciesId === 1 ? 2 : 1 }] }),
      ).toBeNull()
      expect(
        parseScene({
          ...scene,
          settings: { ...scene.settings, backgroundId: 'https://example.com/private.png' },
        }),
      ).toBeNull()
    }
  }
})
