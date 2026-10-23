import './style.css'
import { initStelEngine } from './engine'
import { initObserverLocation } from './location'
import { createToolbar } from './ui'
import { createSelectionPanel } from './selection-panel'
import { createObjectSearch } from './object-search'
import { createSolarSystem3DView } from './solar-system-3d'
import { createGalaxy3DView } from './galaxy-3d'
import { createViewButtons } from './view-buttons'
import { createPhotoMode } from './photo-mode'
import { createExplorationMode } from './exploration-mode'
import { createSoundToggle, installButtonClickSound } from './sound'
import { loadKoDict, ko } from './i18n'
import { isApproachMinigameActive } from './approach-minigame'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="stel-canvas" style="width:100vw;height:100vh;display:block;"></canvas>
`

const canvas = document.querySelector<HTMLCanvasElement>('#stel-canvas')!

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

// Official Stellarium-hosted HiPS textures for the planets (our bundled
// skydata only ships Moon/Sun imagery - see below). Live third-party fetch,
// same as the DSS survey.
const PLANET_SURVEYS: Record<string, string> = {
  mercury: 'https://data.stellarium.org/surveys/mercury',
  venus: 'https://data.stellarium.org/surveys/venus',
  mars: 'https://data.stellarium.org/surveys/mars',
  jupiter: 'https://data.stellarium.org/surveys/jupiter',
  saturn: 'https://data.stellarium.org/surveys/saturn',
  uranus: 'https://data.stellarium.org/surveys/uranus',
  neptune: 'https://data.stellarium.org/surveys/neptune',
}

async function main() {
  // loadKoDict() and initStelEngine() don't depend on each other - the
  // engine only calls translateFn once it actually needs to render a label,
  // well after both of these resolve - so run them concurrently instead of
  // stacking a dict fetch in front of the much longer WASM load.
  const [, stel] = await Promise.all([loadKoDict(), initStelEngine(canvas, (_domain, str) => ko(str))])
  console.log('Stellarium Web Engine ready', stel)

  // The engine's built-in font is a heavily subset Latin-only NotoSans, so
  // Korean labels would otherwise translate correctly but render as nothing
  // (no glyphs). Load a Hangul-capable font as a fallback for both faces -
  // this is additive (tried first, falls back to the built-in font for
  // glyphs it doesn't have), not a replacement.
  stel.setFont('regular', '/fonts/NotoSansKR-Variable.ttf')
  stel.setFont('bold', '/fonts/NotoSansKR-Variable.ttf')

  const core = stel.core
  core.stars.addDataSource({ url: '/skydata/stars' })
  core.skycultures.addDataSource({ url: '/skydata/skycultures/western', key: 'western' })
  core.dsos.addDataSource({ url: '/skydata/dso' })
  core.landscapes.addDataSource({ url: '/skydata/landscapes/guereins', key: 'guereins' })
  core.milkyway.addDataSource({ url: '/skydata/surveys/milkyway' })
  core.minor_planets.addDataSource({ url: '/skydata/mpcorb.dat', key: 'mpc_asteroids' })
  core.planets.addDataSource({ url: '/skydata/surveys/sso/moon', key: 'moon' })
  core.planets.addDataSource({ url: '/skydata/surveys/sso/sun', key: 'sun' })
  for (const [key, url] of Object.entries(PLANET_SURVEYS)) {
    core.planets.addDataSource({ url, key })
  }
  core.comets.addDataSource({ url: '/skydata/CometEls.txt', key: 'mpc_comets' })
  core.satellites.addDataSource({ url: '/skydata/tle_satellite.jsonl.gz', key: 'jsonl/sat' })
  // Public CDS HiPS survey (not bundled - it's a huge tile pyramid fetched
  // live). Powers the "zoom in to see a real photo" effect; toggled off by
  // default via the DSS Photos button since it depends on third-party
  // network access.
  core.dss.addDataSource({ url: 'https://alasky.cds.unistra.fr/DSS/DSSColor' })

  // Constellation lines/art are hidden by default in the engine; turn lines on
  // so the sky doesn't look empty, and leave art as an opt-in toggle.
  core.constellations.lines_visible = true

  // Real time, flowing forward, from the browser's actual location.
  core.observer.utc = stel.date2MJD(new Date())
  core.time_speed = 1

  createToolbar(stel)
  createSelectionPanel(stel)
  createObjectSearch(stel)
  const openSolarSystem = createSolarSystem3DView()
  const openGalaxy = createGalaxy3DView()
  createViewButtons(openSolarSystem, openGalaxy)
  createPhotoMode(stel)
  createExplorationMode(stel)
  document.body.appendChild(createSoundToggle('sound-toggle'))
  installButtonClickSound()
  document.querySelector('#loading-indicator')?.remove()

  // Not awaited: the toolbar/panel don't depend on the observer's location,
  // and initObserverLocation() always resolves on its own (success or not)
  // without anything else in main() waiting on it.
  initObserverLocation(stel)

  // Space centers and smoothly locks the view on whatever is selected
  // (clicking an object on the canvas sets core.selection automatically).
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !core.selection || isApproachMinigameActive()) return
    e.preventDefault()
    stel.pointAndLock(core.selection, 1.0)
  })
}

main()
