import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'local-edge-tts',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString()) as { text?: unknown }
          const text = typeof body.text === 'string' ? body.text.trim() : ''
          if (!text || text.length > 5000) { response.statusCode = 400; response.end('Invalid text'); return }
          const { tts } = await import('edge-tts/out/index.js')
          const audio = await tts(text, { voice: 'de-DE-ConradNeural', rate: '-8%' })
          response.setHeader('Cache-Control', 'public, max-age=86400')
          response.setHeader('Content-Type', 'audio/mpeg')
          response.end(audio)
        } catch { response.statusCode = 502; response.end('Could not generate speech') }
      })

      server.middlewares.use('/api/dictionary', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        try {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const term = (url.searchParams.get('term') ?? '').trim().toLowerCase()
          if (!term || term.length > 50) {
            response.statusCode = 400
            response.end(JSON.stringify({ entries: [] }))
            return
          }

          const module = await import('dictcc-js')
          const translate = module.default?.translate ?? module.translate
          const result = await new Promise<Array<{ from: string; to: string }>>((resolve, reject) => {
            translate('de', 'en', term, (entries: Array<{ from: string; to: string }> | undefined, error: unknown) => {
              if (error) reject(error)
              else resolve(Array.isArray(entries) ? entries : [])
            })
          })

          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ entries: result.slice(0, 3) }))
        } catch {
          response.statusCode = 502
          response.end(JSON.stringify({ entries: [] }))
        }
      })
    },
  }],
})
