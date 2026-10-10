import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const directory = path.join(root, 'public', 'podcasts')
const subtitleDirectory = path.join(directory, 'subtitles')
await mkdir(subtitleDirectory, { recursive: true })
const filenames = await readdir(directory)
const audioFiles = filenames.filter((name) => /\.(mp3|m4a)$/i.test(name))
const captionFiles = new Set((await readdir(subtitleDirectory)).filter((name) => /\.(vtt|srt)$/i.test(name)).map((name) => name.toLowerCase()))
const audioByBasename = new Map()

for (const filename of audioFiles) {
  const basename = filename.replace(/\.(mp3|m4a)$/i, '')
  const group = audioByBasename.get(basename) ?? []
  group.push(filename)
  audioByBasename.set(basename, group)
}

const tracks = [...audioByBasename.entries()].map(([basename, files]) => {
  const selectedAudio = files.find((name) => path.extname(name).toLowerCase() === '.mp3') ?? files[0]
  const caption = ['.vtt', '.srt'].find((suffix) => captionFiles.has(`${basename}${suffix}`.toLowerCase()))
  const title = basename.replaceAll('_', ' ').replace(/\s+/g, ' ').trim()

  return {
    id: basename,
    title,
    audioSrc: `/podcasts/${encodeURIComponent(selectedAudio)}`,
    captionsSrc: caption ? `/podcasts/subtitles/${encodeURIComponent(`${basename}${caption}`)}` : null,
    format: path.extname(selectedAudio).slice(1).toUpperCase()
  }
}).sort((left, right) => left.title.localeCompare(right.title))

await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(tracks, null, 2)}\n`)
console.log(`Podcast manifest updated: ${tracks.length} audio file(s) found.`)