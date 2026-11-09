// Free-text search over the engine's full catalog of named objects (stars,
// DSOs, planets/moons, constellations...), as opposed to object-search.ts's
// small curated dropdown. The engine itself only exposes exact-match lookup
// (stel.getObj(), see sky-nav.ts), so the suggestion list here is built from
// the Korean skyculture dictionary (i18n.ts's dictEntries()) - the fullest
// list of "designation -> human name" pairs we have client-side, vendored
// from Stellarium's own translation data (~7000 entries).
import type { StelInstance } from './engine'
import { dictEntries } from './i18n'
import { resolveDesignation, selectAndLock } from './sky-nav'

interface SearchEntry {
  en: string
  ko: string
  // Candidate designations to try with stel.getObj() - which exact string
  // form a given object is indexed under isn't predictable from the
  // dictionary alone (see object-search.ts's CURATED_OBJECTS comment), so
  // try the bare name first and the engine's "NAME X" proper-name
  // convention (used by planets/moons/sun) second.
  candidates: string[]
}

const MAX_RESULTS = 12

function buildIndex(): SearchEntry[] {
  return dictEntries().map(([en, ko]) => ({ en, ko, candidates: [en, `NAME ${en}`] }))
}

function rank(query: string, entry: SearchEntry): number {
  const q = query.toLowerCase()
  const en = entry.en.toLowerCase()
  if (en === q || entry.ko === query) return 0
  if (en.startsWith(q) || entry.ko.startsWith(query)) return 1
  return 2
}

function search(index: SearchEntry[], rawQuery: string): SearchEntry[] {
  const query = rawQuery.trim()
  if (!query) return []
  const q = query.toLowerCase()
  return index
    .filter((e) => e.en.toLowerCase().includes(q) || e.ko.includes(query))
    .sort((a, b) => rank(query, a) - rank(query, b) || a.ko.localeCompare(b.ko, 'ko'))
    .slice(0, MAX_RESULTS)
}

export function createCatalogSearch(stel: StelInstance): HTMLDivElement {
  const index = buildIndex()

  const wrapper = document.createElement('div')
  wrapper.id = 'catalog-search'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'catalog-search-input'
  input.placeholder = '🔎 천체 이름으로 검색 (예: 시리우스, Sirius, M31)'
  input.autocomplete = 'off'
  input.spellcheck = false

  const list = document.createElement('ul')
  list.className = 'catalog-search-results'

  const hint = document.createElement('div')
  hint.className = 'catalog-search-hint'

  let results: SearchEntry[] = []
  let highlighted = -1
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function closeList() {
    list.innerHTML = ''
    list.classList.remove('visible')
    results = []
    highlighted = -1
  }

  function renderList() {
    list.innerHTML = ''
    results.forEach((entry, i) => {
      const item = document.createElement('li')
      item.textContent = `${entry.ko} (${entry.en})`
      item.className = i === highlighted ? 'highlighted' : ''
      item.addEventListener('mousedown', (e) => {
        // mousedown (not click) fires before the input's blur, so it isn't
        // lost when the list closes on blur first.
        e.preventDefault()
        pick(entry)
      })
      list.appendChild(item)
    })
    list.classList.toggle('visible', results.length > 0)
  }

  function pick(entry: SearchEntry) {
    input.value = ''
    closeList()
    // Resolution can take a couple of seconds (retrying while the engine
    // loads the object's data tile - see resolveDesignation), and the
    // dictionary this search is built from is far broader than what's
    // actually in the bundled skydata, so some picks never resolve at all.
    // Without this, that multi-second gap looks like the search box just
    // silently did nothing.
    hint.textContent = '이동 중…'
    resolveDesignation(
      stel,
      entry.candidates,
      (obj) => {
        hint.textContent = ''
        selectAndLock(stel, obj, 1.0)
      },
      () => {
        hint.textContent = '이 천체의 위치 데이터가 없어 이동할 수 없습니다'
        setTimeout(() => (hint.textContent = ''), 3000)
      },
    )
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      results = search(index, input.value)
      highlighted = results.length > 0 ? 0 : -1
      renderList()
    }, 120)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length === 0) return
      highlighted = (highlighted + 1) % results.length
      renderList()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length === 0) return
      highlighted = (highlighted - 1 + results.length) % results.length
      renderList()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && results[highlighted]) pick(results[highlighted])
    } else if (e.key === 'Escape') {
      input.blur()
    }
  })

  input.addEventListener('blur', () => {
    // Small delay so a result's mousedown handler still sees it in the DOM.
    setTimeout(closeList, 100)
  })

  wrapper.appendChild(input)
  wrapper.appendChild(list)
  wrapper.appendChild(hint)
  document.body.appendChild(wrapper)
  return wrapper
}
