// Builds public/skydata/nebula-dss/ - a small local HiPS survey (the kind
// of tile pyramid core.dss expects, see src/main.ts) with real color DSS
// imagery for 6 famous nebulae/galaxies: M31, M42, M45, M22, IC 434, IC 2118.
//
// Why this exists: the live CDS DSS survey (alasky.cds.unistra.fr, what
// core.dss pointed at originally) is a many-GB third-party fetch, and is
// unreachable outright from some networks (see README's "DSS photos"
// note). stellarium-web.org works around this by mirroring the same
// underlying survey (CDS P/DSS2/color) onto their own CDN
// (stellarium.sfo2.cdn.digitaloceanspaces.com) - reachable where alasky
// isn't. Their CDN's CORS is locked to stellarium-web.org specifically, so
// a browser on this site can't fetch from it directly - but CORS is a
// browser-only restriction, so a server-side download (this script) can
// still mirror the handful of tiles covering just these 6 objects.
//
// These are the *exact* already-built HEALPix tiles from that survey - no
// reprojection happens here, this script just figures out which
// Norder/Dir/Npix addresses cover each object's sky position (using the
// same HEALPix math as engine/stellarium-web-engine/src/algos/healpix.c)
// and downloads those specific files byte-for-byte.
//
// Usage: node tools/mirror-nebula-dss.cjs

const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/skydata/nebula-dss')
const SURVEY_BASE = 'https://stellarium.sfo2.cdn.digitaloceanspaces.com/surveys/dss/v1'

const DEG2RAD = Math.PI / 180
const ARCMIN2RAD = DEG2RAD / 60
const MIN_ORDER = 3
const MAX_ORDER = 9
const GRID = 40 // seeding sample grid resolution per axis

function sexToRad(h, m, s, sign) { return sign * (h + m / 60 + s / 3600) * 15 * DEG2RAD }
function dmsToRad(d, m, s, sign) { return sign * (d + m / 60 + s / 3600) * DEG2RAD }

// J2000 coordinates and a generous, un-rotated RA/Dec bounding box (arcmin)
// per object - enough margin to comfortably contain it without being
// precisely aligned to its true position angle.
const OBJECTS = [
  { slug: 'm31', raRad: sexToRad(0,42,44.3,1), decRad: dmsToRad(41,16,9,1), boxArcmin: 110 },
  { slug: 'm42', raRad: sexToRad(5,35,17.3,1), decRad: dmsToRad(5,23,28,-1), boxArcmin: 70 },
  { slug: 'm45', raRad: sexToRad(3,47,24,1), decRad: dmsToRad(24,7,0,1), boxArcmin: 110 },
  { slug: 'm22', raRad: sexToRad(18,36,23.9,1), decRad: dmsToRad(23,54,17,-1), boxArcmin: 40 },
  { slug: 'ic434', raRad: sexToRad(5,40,59,1), decRad: dmsToRad(2,10,0,-1), boxArcmin: 90 },
  { slug: 'ic2118', raRad: sexToRad(5,2,0,1), decRad: dmsToRad(7,54,0,-1), boxArcmin: 110 },
]

// --- HEALPix (ports engine/stellarium-web-engine/src/algos/healpix.c) ---

function ctabVal(m) { return (m&1) | ((m&2)<<7) | ((m&4)>>1) | ((m&8)<<6) | ((m&0x10)>>2) | ((m&0x20)<<5) | ((m&0x40)>>3) | ((m&0x80)<<4) }
function healpixXyf2nest(nside, ix, iy, face) {
  const utabVal = (m) => (m&1) | ((m&2)<<1) | ((m&4)<<2) | ((m&8)<<3) | ((m&0x10)<<4) | ((m&0x20)<<5) | ((m&0x40)<<6) | ((m&0x80)<<7)
  return face * nside * nside +
    (utabVal(ix & 0xff) | (utabVal((ix >>> 8) & 0xff) << 16) |
     (utabVal(iy & 0xff) << 1) | (utabVal((iy >>> 8) & 0xff) << 17))
}
function fmodulo(v1, v2) {
  if (v1 >= 0) return v1 < v2 ? v1 : v1 % v2
  const tmp = (v1 % v2) + v2
  return tmp === v2 ? 0 : tmp
}
function ang2pixNest(nside, theta, phi) {
  const z = Math.cos(theta)
  const za = Math.abs(z)
  const tt = fmodulo(phi, 2 * Math.PI) * (2 / Math.PI)
  let faceNum, ix, iy
  if (za <= 2 / 3) {
    const temp1 = nside * (0.5 + tt)
    const temp2 = nside * (z * 0.75)
    const jp = Math.floor(temp1 - temp2)
    const jm = Math.floor(temp1 + temp2)
    const ifp = Math.floor(jp / nside)
    const ifm = Math.floor(jm / nside)
    faceNum = (ifp === ifm) ? (ifp | 4) : ((ifp < ifm) ? ifp : (ifm + 8))
    ix = jm & (nside - 1)
    iy = nside - (jp & (nside - 1)) - 1
  } else {
    let ntt = Math.floor(tt)
    if (ntt >= 4) ntt = 3
    const tp = tt - ntt
    const tmp = nside * Math.sqrt(3 * (1 - za))
    let jp = Math.floor(tp * tmp)
    let jm = Math.floor((1 - tp) * tmp)
    if (jp >= nside) jp = nside - 1
    if (jm >= nside) jm = nside - 1
    if (z >= 0) { faceNum = ntt; ix = nside - jm - 1; iy = nside - jp - 1 }
    else { faceNum = ntt + 8; ix = jp; iy = jm }
  }
  return healpixXyf2nest(nside, ix, iy, faceNum)
}
// Standard gnomonic deprojection - just used to spread a dense grid of
// sample points across each object's box, to seed candidate tile addresses.
function tangentXYToRaDec(X, Y, ra0, dec0) {
  const rho = Math.sqrt(X * X + Y * Y)
  if (rho < 1e-12) return [ra0, dec0]
  const c = Math.atan(rho)
  const sinc = Math.sin(c), cosc = Math.cos(c)
  const dec = Math.asin(cosc * Math.sin(dec0) + (Y * sinc * Math.cos(dec0)) / rho)
  const ra = ra0 + Math.atan2(X * sinc, rho * Math.cos(dec0) * cosc - Y * Math.sin(dec0) * sinc)
  return [ra, dec]
}

function candidateTiles(obj) {
  const out = []
  for (let order = MIN_ORDER; order <= MAX_ORDER; order++) {
    const nside = 1 << order
    const seen = new Set()
    for (let gy = -2; gy <= GRID + 2; gy++) {
      for (let gx = -2; gx <= GRID + 2; gx++) {
        const X = ((gx / GRID) - 0.5) * obj.boxArcmin * ARCMIN2RAD
        const Y = ((gy / GRID) - 0.5) * obj.boxArcmin * ARCMIN2RAD
        const [ra, dec] = tangentXYToRaDec(X, Y, obj.raRad, obj.decRad)
        seen.add(ang2pixNest(nside, Math.PI / 2 - dec, fmodulo(ra, 2 * Math.PI)))
      }
    }
    for (const pix of seen) out.push({ order, pix })
  }
  return out
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(false); return }
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(true)))
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  let total = 0
  for (const obj of OBJECTS) {
    const tiles = candidateTiles(obj)
    let got = 0
    const CONCURRENCY = 12
    for (let i = 0; i < tiles.length; i += CONCURRENCY) {
      const batch = tiles.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(({ order, pix }) => {
        const dirN = Math.floor(pix / 10000) * 10000
        const relPath = `Norder${order}/Dir${dirN}/Npix${pix}.webp`
        const dest = path.join(OUT_DIR, relPath)
        // Two nearby objects can need the same tile at a low order - skip
        // re-downloading it.
        if (fs.existsSync(dest)) return true
        return download(`${SURVEY_BASE}/${relPath}`, dest)
      }))
      got += results.filter(Boolean).length
    }
    console.log(`${obj.slug}: ${got}/${tiles.length} tiles`)
    total += got
  }
  fs.writeFileSync(path.join(OUT_DIR, 'properties'), [
    'obs_description          = Local mirror of CDS P/DSS2/color (the real alasky DSS survey), downloaded tile-for-tile from stellarium-web.org\'s own CDN mirror - just the patches of sky around 6 famous nebulae/galaxies (M31, M42, M45, M22, IC 434, IC 2118), not the full sky.',
    `hips_release_date        = ${new Date().toISOString().slice(0, 10)}T00:00Z`,
    `hips_order_min           = ${MIN_ORDER}`,
    `hips_order               = ${MAX_ORDER}`,
    'hips_tile_width          = 512',
    'hips_tile_format         = webp',
    '',
  ].join('\n'))
  console.log(`total: ${total} tiles -> ${OUT_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
