import { mkdir, access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tts } from 'edge-tts/out/index.js'
import XLSX from 'xlsx'

const root = process.cwd()
const dataDir = path.join(root, 'public', 'data')
const cacheDir = path.join(root, 'public', 'audio-cache')
let edgeAvailable = true
const workbooks = [
  ['A1', 'A1_vocab.xlsx'],
  ['A2', 'A2_vocab.xlsx'],
  ['B1', 'B1_vocab.xlsx'],
  ['B2', 'B2_vocab.xlsx'],
  ['Movie', 'Movie_vocab.xlsx'],
  ['OFFICIAL_GERMAN_A1_List', 'OFFICIAL_GERMAN_A1_List_vocab.xlsx'],
  ['TOPICS_WISE', 'TOPICS_WISE_vocab.xlsx'],
]

const clean = (value) => {
  const text = String(value ?? '').trim()
  return text === 'nan' || text === 'undefined' ? '' : text
}
const filePart = (value) => clean(value).replaceAll(' ', '_').replaceAll('/', '_').replace(/[^a-zA-Z0-9_\-äöüÄÖÜß]/g, '').replace(/_{2,}/g, '_')
const folderDay = (level, day) => level === 'OFFICIAL_GERMAN_A1_List' ? day.replace(/^Day (\d)$/, 'Day 0$1') : day
const targetFor = (level, day, sourceRow, text, kind) => path.join(cacheDir, level, folderDay(level, day), kind, `row_${sourceRow + 2}_${filePart(text)}.mp3`)

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

async function generate(level, day, rows) {
  for (const [sourceRow, row] of rows.entries()) {
    const word = clean(row.german_word)
    if (!word) continue
    const audioItems = [[word, 'pronounce'], [clean(row.example_sentence), 'sentence']]
    for (const [text, kind] of audioItems) {
      if (!text) continue
      const target = targetFor(level, day, sourceRow, text, kind)
      if (await exists(target)) continue
      await mkdir(path.dirname(target), { recursive: true })
      try {
        let audio
        if (edgeAvailable) {
          try {
            audio = await tts(text, { voice: 'de-DE-ConradNeural', rate: '-8%' })
          } catch {
            edgeAvailable = false
            console.warn('Edge TTS is unavailable; using Google German TTS for the remaining files.')
          }
        }
        if (!audio) {
          const response = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(text)}`)
          if (!response.ok || !response.headers.get('content-type')?.includes('audio')) throw new Error(`Google TTS returned ${response.status}`)
          audio = Buffer.from(await response.arrayBuffer())
        }
        await writeFile(target, audio)
        console.log(`generated ${path.relative(root, target)}`)
      } catch (error) {
        console.warn(`could not generate ${level}/${day}/${kind}/${text}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
}

let missing = 0
for (const [level, file] of workbooks) {
  const workbook = XLSX.readFile(path.join(dataDir, file))
  for (const day of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[day], { defval: '' })
    missing += rows.filter((row) => clean(row.german_word)).length
    await generate(level, day, rows)
  }
}
console.log(`audio cache scan complete: ${missing} vocabulary entries checked`)
