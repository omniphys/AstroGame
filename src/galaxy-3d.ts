import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createLabelSprite } from './label-sprite'
import { assetUrl } from './base-url'

// public/textures/milkyway_gaia.jpg: a face-on illustration of the Milky Way
// built from real ESA Gaia mission star-survey data (credit: ESA/Gaia/DPAC,
// S. Payne-Wardenaar; CC BY-SA 3.0 IGO - see README.md License section).
// Cropped from ESA's "You are here" (2022) release, with its English
// "YOU ARE HERE" callout removed (point-symmetric clone-patch) so our own
// Korean marker/label can be placed on it instead.
const GALAXY_TEXTURE = assetUrl('/textures/milkyway_gaia.jpg')
// The source image has a lot of empty black margin around the actual
// galaxy (radial brightness sampling put the visible disc's edge at
// roughly 52% of the frame's half-width) - mapping the full square to
// GALAXY_RADIUS would put anything placed by a real ly-based ratio (like
// the Sun, below) out past the visible structure, in that dead margin.
// Zoom the texture's UVs into just that central 52% so GALAXY_RADIUS
// actually corresponds to the galaxy's visible edge.
const GALAXY_TEXTURE_VISIBLE_FRACTION = 0.52
const GALAXY_RADIUS = 220
// The Sun sits roughly 8.2 kpc (~27,000 ly) from the galactic center, in a
// disc whose diameter is commonly put at ~100,000 ly - a scene-unit ratio
// of 27,000 / 50,000 = 0.54.
const SUN_DISTANCE_RATIO = 0.54
// Arbitrary (the texture has no machine-readable arm geometry to align
// to) - moved another 15° counter-clockwise (viewed from above, confirmed
// via camera.project() on test points: increasing this parametric angle
// moves the marker clockwise on screen, so CCW means decreasing it) per
// user feedback, from an original 27° placement.
const SUN_ANGLE = Math.PI * (-3 / 180) // -3°
// Negative because a positive Y rotation is counter-clockwise when viewed from above.
const SPIN_SPEED = -0.02 // rad/s, ~5 min per turn

// A radial white->black gradient used as an alpha mask so the disc fades
// out smoothly into the scene's black background instead of showing a
// hard circular silhouette. Solid out to 85% of the radius, then fades to
// fully transparent exactly at the edge (matches CircleGeometry's own UV
// circle, so there's no visible seam between the two).
function createEdgeFadeTexture(): THREE.Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.425, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'white')
  gradient.addColorStop(1, 'black')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

export function createGalaxy3DView(): () => void {
  const overlay = document.createElement('div')
  overlay.id = 'galaxy-overlay'

  const closeButton = document.createElement('button')
  closeButton.id = 'galaxy-close'
  closeButton.textContent = '뒤로'
  overlay.appendChild(closeButton)

  const hint = document.createElement('div')
  hint.id = 'galaxy-hint'
  hint.textContent = '우리 은하 모식도 · ESA 가이아(Gaia) 관측 자료 기반 삽화'
  overlay.appendChild(hint)

  const canvas = document.createElement('canvas')
  canvas.id = 'galaxy-canvas'
  overlay.appendChild(canvas)

  document.body.appendChild(overlay)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000)
  camera.position.set(0, 220, 320)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const galaxyTexture = new THREE.TextureLoader().load(GALAXY_TEXTURE)
  galaxyTexture.colorSpace = THREE.SRGBColorSpace
  galaxyTexture.repeat.set(GALAXY_TEXTURE_VISIBLE_FRACTION, GALAXY_TEXTURE_VISIBLE_FRACTION)
  galaxyTexture.offset.set((1 - GALAXY_TEXTURE_VISIBLE_FRACTION) / 2, (1 - GALAXY_TEXTURE_VISIBLE_FRACTION) / 2)
  const galaxyDisc = new THREE.Mesh(
    new THREE.CircleGeometry(GALAXY_RADIUS, 64),
    new THREE.MeshBasicMaterial({
      map: galaxyTexture,
      alphaMap: createEdgeFadeTexture(),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  )
  galaxyDisc.rotation.x = -Math.PI / 2

  const galaxy = new THREE.Group()
  galaxy.add(galaxyDisc)
  scene.add(galaxy)

  const sunRadius = GALAXY_RADIUS * SUN_DISTANCE_RATIO
  const sunMarker = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  sunMarker.position.set(Math.cos(SUN_ANGLE) * sunRadius, 1, Math.sin(SUN_ANGLE) * sunRadius)
  galaxy.add(sunMarker)

  const sunLabel = createLabelSprite('태양계 (우리의 위치)', { height: 7 })
  sunLabel.position.set(0, 9, 0)
  sunMarker.add(sunLabel)

  let isOpen = false
  let lastFrameTime = 0

  function resize() {
    if (!isOpen) return
    const { clientWidth, clientHeight } = overlay
    renderer.setSize(clientWidth, clientHeight)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  function animate(time: number) {
    if (!isOpen) return
    // Cap the step so a backgrounded tab doesn't jump the galaxy forward on return.
    const dt = Math.min((time - lastFrameTime) / 1000, 0.1)
    lastFrameTime = time
    galaxy.rotation.y += SPIN_SPEED * dt
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  function open() {
    if (isOpen) return
    isOpen = true
    overlay.classList.add('visible')
    resize()
    lastFrameTime = performance.now()
    requestAnimationFrame(animate)
  }

  function close() {
    isOpen = false
    overlay.classList.remove('visible')
  }

  closeButton.addEventListener('click', close)

  return open
}
