import './style.css'
import { initStelEngine } from './engine'

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

  // Wire up sky data sources here once you have a skydata bundle, e.g.:
  //   stel.core.stars.addDataSource({ url: '/skydata/stars' })
  //   stel.core.skycultures.addDataSource({ url: '/skydata/skycultures/western', key: 'western' })
  //   stel.core.landscapes.addDataSource({ url: '/skydata/landscapes/guereins', key: 'guereins' })
  stel.core.milkyway.addDataSource({ url: '/skydata/surveys/milkyway' })
  // See README.md for where to obtain this data; it is not bundled with the engine source.

  stel.core.observer.utc = Date.now() / 86400000 + 2440587.5
})
