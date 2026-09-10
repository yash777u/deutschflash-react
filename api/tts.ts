import { tts } from 'edge-tts'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await request.json() as { text?: unknown }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > 5000) return new Response('Invalid text', { status: 400 })

    const audio = await tts(text, { voice: 'de-DE-ConradNeural', rate: '-8%' })
    return new Response(audio, { headers: { 'Cache-Control': 'public, max-age=86400', 'Content-Type': 'audio/mpeg' } })
  } catch {
    return new Response('Could not generate speech', { status: 502 })
  }
}
