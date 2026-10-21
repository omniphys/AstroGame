import * as THREE from 'three'

// A camera-facing text label for a Three.js scene (planet/star names, etc).
// Shared by solar-system-3d.ts and galaxy-3d.ts.
export function createLabelSprite(text: string, options: { fontSize?: number; height?: number } = {}): THREE.Sprite {
  const fontSize = options.fontSize ?? 48
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${fontSize}px sans-serif`
  canvas.width = Math.ceil(ctx.measureText(text).width) + 24
  canvas.height = Math.ceil(fontSize * 1.5)
  // measureText above needed the context sized first; font resets on resize.
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  const spriteHeight = options.height ?? 5
  sprite.scale.set((spriteHeight * canvas.width) / canvas.height, spriteHeight, 1)
  return sprite
}
