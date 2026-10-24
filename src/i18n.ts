// Korean names for planets/moons/stars/constellations/DSOs, vendored from
// Stellarium's own translation data (CDS/Stellarium i18n project):
//   https://stellarium.sfo2.cdn.digitaloceanspaces.com/i18n/v1/skyculture/ko.json
// Catalog designations (M31, HIP 1234, ...) and anything else not in the
// dictionary are left as-is, per design - there's no good Korean name for
// those anyway.
import { assetUrl } from './base-url'

let dict: Record<string, string> | null = null

export async function loadKoDict(): Promise<void> {
  try {
    const res = await fetch(assetUrl('/i18n/skyculture-ko.json'))
    dict = await res.json()
  } catch {
    dict = {}
  }
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Korean name if we have one, otherwise the original string unchanged.
// The engine sometimes passes names in a different case than the dictionary
// (e.g. constellation IAU codes rendered as "URSA MAJOR" vs. the
// dictionary's "Ursa Major"), so fall back to a title-cased lookup before
// giving up.
export function ko(name: string): string {
  if (!dict) return name
  if (dict[name]) return dict[name]
  return dict[titleCase(name)] || name
}

// "한글명 (English name)" when translated, otherwise just the original name.
export function koWithEn(name: string): string {
  const translated = ko(name)
  return translated === name ? name : `${translated} (${name})`
}
