// Dedicated buttons that open the 3D solar-system/galaxy views directly -
// not tied to sky-object selection (selecting the Sun/Milky Way in the sky
// just centers the view on them, like any other object; see main.ts).
export function createViewButtons(openSolarSystem: () => void, openGalaxy: () => void): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.id = 'view-buttons'

  const solarSystemButton = document.createElement('button')
  solarSystemButton.className = 'view-button'
  solarSystemButton.textContent = '태양계'
  solarSystemButton.addEventListener('click', openSolarSystem)

  const galaxyButton = document.createElement('button')
  galaxyButton.className = 'view-button'
  galaxyButton.textContent = '우리 은하'
  galaxyButton.addEventListener('click', openGalaxy)

  wrapper.appendChild(solarSystemButton)
  wrapper.appendChild(galaxyButton)
  document.body.appendChild(wrapper)
  return wrapper
}
