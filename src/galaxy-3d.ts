import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createLabelSprite } from './label-sprite'

// public/textures/milkyway_gaia.jpg: a face-on illustration of the Milky Way
// built from real ESA Gaia mission star-survey data (credit: ESA/Gaia/DPAC,
// S. Payne-Wardenaar; CC BY-SA 3.0 IGO - see README.md License section).
// Cropped from ESA's "You are here" (2022) release, with its English
// "YOU ARE HERE" callout removed (point-symmetric clone-patch) so our own
// Korean marker/label can be placed on it instead.
const GALAXY_TEXTURE = '/textures/milkyway_gaia.jpg'
const GALAXY_RADIUS = 220
// The Sun sits roughly 8.2 kpc (~27,000 ly) from the galactic center, in a
// disc whose diameter is commonly put at ~100,000 ly - a scene-unit ratio
// of 27,000 / 50,000 = 0.54.
const SUN_DISTANCE_RATIO = 0.54
const SUN_ANGLE = Math.PI * 0.15 // arbitrary - the texture has no machine-readable arm geometry to align to
// Negative because a positive Y rotation is counter-clockwise when viewed from above.
const SPIN_SPEED = -0.02 // rad/s, ~5 min per turn

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
  const galaxyDisc = new THREE.Mesh(
    new THREE.CircleGeometry(GALAXY_RADIUS, 64),
    new THREE.MeshBasicMaterial({ map: galaxyTexture, transparent: true, side: THREE.DoubleSide }),
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
