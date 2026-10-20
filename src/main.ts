import './style.css'
import { initStelEngine } from './engine'
import { createToolbar } from './ui'

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

initStelEngine(canvas).then((stel) => {
  console.log('Stellarium Web Engine ready', stel)

  const core = stel.core
  core.stars.addDataSource({ url: '/skydata/stars' })
  core.skycultures.addDataSource({ url: '/skydata/skycultures/western', key: 'western' })
  core.dsos.addDataSource({ url: '/skydata/dso' })
  core.landscapes.addDataSource({ url: '/skydata/landscapes/guereins', key: 'guereins' })
  core.milkyway.addDataSource({ url: '/skydata/surveys/milkyway' })
  core.minor_planets.addDataSource({ url: '/skydata/mpcorb.dat', key: 'mpc_asteroids' })
  core.planets.addDataSource({ url: '/skydata/surveys/sso/moon', key: 'moon' })
  core.planets.addDataSource({ url: '/skydata/surveys/sso/sun', key: 'sun' })
  core.comets.addDataSource({ url: '/skydata/CometEls.txt', key: 'mpc_comets' })
  core.satellites.addDataSource({ url: '/skydata/tle_satellite.jsonl.gz', key: 'jsonl/sat' })

  // Constellation lines/art are hidden by default in the engine; turn lines on
  // so the sky doesn't look empty, and leave art as an opt-in toggle.
  core.constellations.lines_visible = true

  core.observer.utc = Date.now() / 86400000 + 2440587.5

  createToolbar(stel)
})
