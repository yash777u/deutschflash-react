import type { IncomingMessage, ServerResponse } from 'node:http'

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.statusCode = 405
    response.end('Method not allowed')
    return
  }

  const term = new URL(request.url ?? '/', 'https://germanv1.vercel.app').searchParams.get('term')?.trim().toLowerCase() ?? ''
  if (!term || term.length > 50) {
    sendJson(response, 400, { entries: [] })
    return
  }

  try {
    const upstream = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=de|en`)
    if (!upstream.ok) {
      sendJson(response, 502, { entries: [] })
      return
    }
    const payload = await upstream.json() as {
      responseData?: { translatedText?: string }
      matches?: { translation?: string }[]
    }
    const translations = (payload.matches ?? [])
      .map((match) => match.translation?.trim())
      .filter((translation): translation is string => Boolean(translation))
      .filter((translation, index, values) => values.indexOf(translation) === index)
      .slice(0, 3)
    if (!translations.length && payload.responseData?.translatedText) translations.push(payload.responseData.translatedText)

    response.setHeader('Cache-Control', 'public, max-age=86400')
    sendJson(response, 200, { entries: translations.map((to) => ({ from: term, to })) })
  } catch {
    sendJson(response, 502, { entries: [] })
  }
}