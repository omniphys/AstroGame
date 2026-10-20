import { defineConfig } from 'vite'

export default defineConfig({
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
})
