import { defineConfig } from 'vite'

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages project page serves this at /AstroGame/, not the domain
  // root - only `vite build` (what `npm run build` and the Pages workflow
  // run) and `vite preview` (which serves that same build) need that prefix
  // baked in. `npm run dev` must stay at '/' so the local dev URL doesn't
  // change. Runtime code that builds absolute asset URLs by hand (engine/
  // skydata/images - anything Vite's own HTML/asset pipeline doesn't see)
  // reads this back via assetUrl() in src/base-url.ts.
  base: command === 'build' || isPreview ? '/AstroGame/' : '/',
  plugins: [
    {
      // public/skydata/*.gz is a payload the engine's WASM code gunzips
      // itself. Vite's dev server sets Content-Encoding: gzip for .gz
      // files, which makes the browser transparently decompress it first
      // and hands the engine already-decompressed bytes it then fails to
      // gunzip again. Serve it as opaque binary instead.
      name: 'skydata-gz-passthrough',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.gz')) {
            // setHeader happens later, in the static-file middleware, so
            // intercept it rather than removeHeader-ing too early.
            const setHeader = res.setHeader.bind(res)
            res.setHeader = (name: string, value: string | number | readonly string[]) => {
              if (name.toLowerCase() === 'content-encoding') return res
              return setHeader(name, value)
            }
          }
          next()
        })
      },
    },
  ],
}))
