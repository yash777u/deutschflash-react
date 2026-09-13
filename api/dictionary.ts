export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const term = new URL(request.url).searchParams.get('term')?.trim().toLowerCase() ?? ''
  if (!term || term.length > 50) return Response.json({ entries: [] }, { status: 400 })

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=de|en`)
    if (!response.ok) return Response.json({ entries: [] }, { status: 502 })
    const payload = await response.json() as {
      responseData?: { translatedText?: string }
      matches?: { translation?: string }[]
    }
    const translations = (payload.matches ?? [])
      .map((match) => match.translation?.trim())
      .filter((translation): translation is string => Boolean(translation))
      .filter((translation, index, values) => values.indexOf(translation) === index)
      .slice(0, 3)
    if (!translations.length && payload.responseData?.translatedText) translations.push(payload.responseData.translatedText)

    return Response.json({ entries: translations.map((to) => ({ from: term, to })) }, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    return Response.json({ entries: [] }, { status: 502 })
  }
}