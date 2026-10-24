import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createLabelSprite } from './label-sprite'
import { assetUrl } from './base-url'

interface PlanetElements {
  label: string
  textureFile: string
  orbitAu: number
  periodDays: number
  eccentricity: number
  inclinationDeg: number
  meanLongitudeDeg: number // at J2000
  perihelionLongitudeDeg: number
}

// Standard textbook orbital elements - not pulled from the engine (its
// Kepler elements are internal to the C core and aren't exposed to JS), and
// not needed to be more precise than this for an educational orrery.
// Longitudes are J2000 (JPL/Standish), so the view opens on today's real
// layout; periods are given precisely enough that Mercury drifts < 1 deg
// over decades.
// Textures: Solar System Scope (solarsystemscope.com), CC BY 4.0 - see
// README.md License section.
const PLANETS: PlanetElements[] = [
  { label: '수성', textureFile: '2k_mercury.jpg', orbitAu: 0.387, periodDays: 87.969, eccentricity: 0.206, inclinationDeg: 7.0, meanLongitudeDeg: 252.25, perihelionLongitudeDeg: 77.46 },
  { label: '금성', textureFile: '2k_venus_surface.jpg', orbitAu: 0.723, periodDays: 224.701, eccentricity: 0.007, inclinationDeg: 3.4, meanLongitudeDeg: 181.98, perihelionLongitudeDeg: 131.6 },
  { label: '지구', textureFile: '2k_earth_daymap.jpg', orbitAu: 1.0, periodDays: 365.256, eccentricity: 0.017, inclinationDeg: 0.0, meanLongitudeDeg: 100.46, perihelionLongitudeDeg: 102.94 },
  { label: '화성', textureFile: '2k_mars.jpg', orbitAu: 1.524, periodDays: 686.98, eccentricity: 0.093, inclinationDeg: 1.9, meanLongitudeDeg: 355.45, perihelionLongitudeDeg: 336.06 },
  { label: '목성', textureFile: '2k_jupiter.jpg', orbitAu: 5.203, periodDays: 4332.59, eccentricity: 0.049, inclinationDeg: 1.3, meanLongitudeDeg: 34.4, perihelionLongitudeDeg: 14.73 },
  { label: '토성', textureFile: '2k_saturn.jpg', orbitAu: 9.537, periodDays: 10759.22, eccentricity: 0.057, inclinationDeg: 2.5, meanLongitudeDeg: 49.95, perihelionLongitudeDeg: 92.6 },
  { label: '천왕성', textureFile: '2k_uranus.jpg', orbitAu: 19.19, periodDays: 30685.4, eccentricity: 0.046, inclinationDeg: 0.8, meanLongitudeDeg: 313.24, perihelionLongitudeDeg: 170.95 },
  { label: '해왕성', textureFile: '2k_neptune.jpg', orbitAu: 30.07, periodDays: 60189, eccentricity: 0.011, inclinationDeg: 1.8, meanLongitudeDeg: 304.88, perihelionLongitudeDeg: 44.96 },
]

// Real AU distances would make the inner planets invisible next to
// Neptune's orbit - compress with sqrt(AU), a common orrery convention.
const ORBIT_SCALE = 40
function orbitVisualRadius(orbitAu: number): number {
  return ORBIT_SCALE * Math.sqrt(orbitAu)
}

// Real planet radii would make Mercury a sub-pixel dot next to Jupiter -
// compress with a log term so every body stays visible and roughly ordered.
function planetVisualRadius(index: number): number {
  return 1.2 + Math.log2(index + 2)
}

const TIME_SCALE_DAYS_PER_SECOND = 20 // Mercury's ~88-day orbit completes in a few seconds
const J2000_MS = Date.UTC(2000, 0, 1, 12)
const DEG = Math.PI / 180

// Kepler's equation M = E - e*sin(E) has no closed form - Newton-Raphson
// converges to machine precision in a handful of iterations for e < 0.3
// (all 8 planets qualify).
function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let e = meanAnomaly
  for (let i = 0; i < 8; i++) {
    e -= (e - eccentricity * Math.sin(e) - meanAnomaly) / (1 - eccentricity * Math.cos(e))
  }
  return e
}

// Position in the orbital plane, relative to the Sun AT A FOCUS (not the
// ellipse's geometric center) - this is what actually makes it a Kepler
// orbit. Parametrized directly by eccentric anomaly E (not time/mean
// anomaly) so the same function draws the static orbit line (sampled evenly
// over E) and the moving planet (E solved from the time-linear mean
// anomaly) - guaranteeing the two can't drift apart.
function pointAtEccentricAnomaly(planet: PlanetElements, eccentricAnomaly: number): THREE.Vector2 {
  const a = orbitVisualRadius(planet.orbitAu)
  const b = a * Math.sqrt(1 - planet.eccentricity * planet.eccentricity)
  return new THREE.Vector2(a * (Math.cos(eccentricAnomaly) - planet.eccentricity), b * Math.sin(eccentricAnomaly))
    .rotateAround(new THREE.Vector2(), planet.perihelionLongitudeDeg * DEG)
}

// Tilts an orbital-plane point into the scene's 3D space by inclination.
// Both the orbit line and the moving planet go through this, so the two
// can never visually diverge. Orbital-plane +y maps to world -z so that,
// seen from the camera above (+y), orbits run counter-clockwise - as they
// do seen from the north ecliptic pole.
function tiltToWorld(planar: THREE.Vector2, inclinationDeg: number): THREE.Vector3 {
  const tilt = (inclinationDeg * Math.PI) / 180
  return new THREE.Vector3(planar.x, planar.y, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), -(Math.PI / 2 + tilt))
}

function loadPlanetTexture(loader: THREE.TextureLoader, file: string): THREE.Texture {
  const texture = loader.load(assetUrl(`/textures/planets/${file}`))
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createSolarSystem3DView(): () => void {
  const overlay = document.createElement('div')
  overlay.id = 'solar-system-overlay'

  const closeButton = document.createElement('button')
  closeButton.id = 'solar-system-close'
  closeButton.textContent = '뒤로'
  overlay.appendChild(closeButton)

  const canvas = document.createElement('canvas')
  canvas.id = 'solar-system-canvas'
  overlay.appendChild(canvas)

  document.body.appendChild(overlay)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000)
  camera.position.set(0, 220, 320)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const textureLoader = new THREE.TextureLoader()

  scene.add(new THREE.AmbientLight(0xffffff, 0.3))
  const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0)
  scene.add(sunLight)

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 32),
    new THREE.MeshBasicMaterial({ map: loadPlanetTexture(textureLoader, '2k_sun.jpg') }),
  )
  scene.add(sun)
  const sunLabel = createLabelSprite('태양')
  sunLabel.position.set(0, 9, 0)
  sun.add(sunLabel)

  for (let i = 0; i < PLANETS.length; i++) {
    const planet = PLANETS[i]

    const orbitPoints: THREE.Vector3[] = []
    for (let s = 0; s <= 128; s++) {
      const e = (2 * Math.PI * s) / 128
      orbitPoints.push(tiltToWorld(pointAtEccentricAnomaly(planet, e), planet.inclinationDeg))
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints)
    const orbitLine = new THREE.LineLoop(orbitGeometry, new THREE.LineBasicMaterial({ color: 0x555566 }))
    scene.add(orbitLine)

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetVisualRadius(i), 24, 24),
      new THREE.MeshStandardMaterial({ map: loadPlanetTexture(textureLoader, planet.textureFile), roughness: 0.9 }),
    )
    const label = createLabelSprite(planet.label)
    label.position.set(0, planetVisualRadius(i) + 3, 0)
    mesh.add(label)
    scene.add(mesh)
    ;(mesh as any).userData.planet = planet
  }

  let isOpen = false
  let lastFrameMs = 0
  let simulatedDays = 0

  function resize() {
    if (!isOpen) return // overlay is display:none, clientWidth/Height would read 0
    const { clientWidth, clientHeight } = overlay
    renderer.setSize(clientWidth, clientHeight)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  function animate(nowMs: number) {
    if (!isOpen) return
    const deltaSeconds = lastFrameMs ? (nowMs - lastFrameMs) / 1000 : 0
    lastFrameMs = nowMs
    simulatedDays += deltaSeconds * TIME_SCALE_DAYS_PER_SECOND

    for (const child of scene.children) {
      const planet: PlanetElements | undefined = (child as any).userData?.planet
      if (!planet) continue
      const meanAnomaly =
        (planet.meanLongitudeDeg - planet.perihelionLongitudeDeg) * DEG + (2 * Math.PI * simulatedDays) / planet.periodDays
      const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, planet.eccentricity)
      child.position.copy(tiltToWorld(pointAtEccentricAnomaly(planet, eccentricAnomaly), planet.inclinationDeg))
    }

    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  function open() {
    if (isOpen) return
    isOpen = true
    overlay.classList.add('visible')
    resize()
    lastFrameMs = 0
    simulatedDays = (Date.now() - J2000_MS) / 86_400_000
    requestAnimationFrame(animate)
  }

  function close() {
    isOpen = false
    overlay.classList.remove('visible')
  }

  closeButton.addEventListener('click', close)

  return open
}
