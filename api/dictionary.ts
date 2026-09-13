type DictionaryEntry = { from: string; to: string }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const term = new URL(request.url).searchParams.get('term')?.trim().toLowerCase() ?? ''
  if (!term || term.length > 50) return Response.json({ entries: [] }, { status: 400 })

  try {
    const module = await import('dictcc-js')
    const translate = module.default?.translate ?? module.translate
    const entries = await new Promise<DictionaryEntry[]>((resolve, reject) => {
      translate('de', 'en', term, (result: DictionaryEntry[] | undefined, error: unknown) => {
        if (error) reject(error)
        else resolve(Array.isArray(result) ? result : [])
      })
    })

    return Response.json({ entries: entries.slice(0, 3) }, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    return Response.json({ entries: [] }, { status: 502 })
  }
}