import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'

type PodcastTrack = {
  id: string
  title: string
  audioSrc: string
  captionsSrc: string | null
  format: string
}

type CaptionCue = {
  start: number
  end: number
  text: string
}

type SavedPlayback = {
  speed: number
  volume: number
  lastPosition: number
}

const STORAGE_KEY = 'deutschflash-podcast-progress'
const captionMeaningCache = new Map<string, Promise<string[]>>()

async function lookUpCaptionMeaning(word: string): Promise<string[]> {
  const normalized = word.trim().replace(/[^\p{L}\p{N}ßäöüÄÖÜ-]/gu, '').toLowerCase()
  if (!normalized || normalized.length < 2) return []
  if (!captionMeaningCache.has(normalized)) {
    captionMeaningCache.set(normalized, fetch(`/api/dictionary?term=${encodeURIComponent(normalized)}`)
      .then(async (response) => {
        if (!response.ok) return []
        const result = await response.json() as { entries?: { to: string }[] }
        return (result.entries ?? []).map((entry) => entry.to).filter(Boolean).slice(0, 3)
      })
      .catch(() => []))
  }
  return captionMeaningCache.get(normalized) ?? []
}

function CaptionText({ text }: { text: string }) {
  const parts = text.split(/(\s+|[.,!?;:()[\]"“”„])/u)
  return <span className="caption-words">{parts.map((part, index) => {
    if (!/^[\p{L}ßäöüÄÖÜ-]+$/u.test(part)) return <span key={`${part}-${index}`}>{part}</span>
    return <CaptionMeaningWord key={`${part}-${index}`} word={part} />
  })}</span>
}

function CaptionMeaningWord({ word }: { word: string }) {
  const [meanings, setMeanings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function loadMeaning() {
    if (meanings.length || loading) return
    setLoading(true)
    try {
      setMeanings(await lookUpCaptionMeaning(word))
    } finally {
      setLoading(false)
    }
  }

  return <span className="meaning-token caption-meaning-token">
    <button type="button" className="meaning-word caption-meaning-word" aria-label={`Meaning of ${word}`} aria-expanded={open} onMouseEnter={() => { setOpen(true); void loadMeaning() }} onFocus={() => { setOpen(true); void loadMeaning() }} onMouseLeave={() => setOpen(false)} onBlur={() => setOpen(false)} onClick={() => { setOpen(true); void loadMeaning() }}>{word}</button>
    {open && <span className="meaning-popover caption-meaning-popover" role="tooltip">{loading ? 'Looking up…' : meanings.length ? meanings.map((meaning, index) => <strong key={`${meaning}-${index}`}>{meaning}{index < meanings.length - 1 ? ', ' : ''}</strong>) : 'No meaning found'}</span>}
  </span>
}

function readSavedPlayback(): Record<string, SavedPlayback> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, SavedPlayback>
  } catch {
    return {}
  }
}

function parseTimestamp(value: string): number {
  const parts = value.trim().replace(',', '.').split(':')
  const seconds = Number(parts.pop())
  const minutes = Number(parts.pop() ?? 0)
  const hours = Number(parts.pop() ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

function parseCaptions(contents: string): CaptionCue[] {
  return contents.split(/\r?\n\s*\r?\n/).flatMap((block) => {
    const lines = block.trim().split(/\r?\n/)
    const timing = lines.find((line) => line.includes('-->'))
    if (!timing) return []

    const [start, end] = timing.split('-->').map((value) => value.trim().split(/\s+/)[0] ?? '')
    const timingPattern = /^(?:(?:\d{2}:)?\d{2}:)?\d{2}[,.]\d{3}$/
    if (!timingPattern.test(start) || !timingPattern.test(end)) return []

    const text = lines.slice(lines.indexOf(timing) + 1).join(' ').replace(/<[^>]*>/g, '').trim()
    return text ? [{ start: parseTimestamp(start), end: parseTimestamp(end), text }] : []
  })
}

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00'
  const seconds = Math.floor(value)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function PodcastLibrary() {
  const [tracks, setTracks] = useState<PodcastTrack[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [captions, setCaptions] = useState<CaptionCue[]>([])
  const [captionStatus, setCaptionStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [savedPlayback, setSavedPlayback] = useState(readSavedPlayback)
  const [audioError, setAudioError] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [libraryError, setLibraryError] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const activeTrack = tracks.find((track) => track.id === selectedId) ?? tracks[0]
  const activeCaption = useMemo(
    () => captions.find((cue) => currentTime >= cue.start && currentTime <= cue.end),
    [captions, currentTime]
  )
  const visibleCaptions = useMemo(
    () => captions.filter((cue) => cue.end >= currentTime - 10 && cue.start <= currentTime + 10),
    [captions, currentTime]
  )

  useEffect(() => {
    const controller = new AbortController()
    fetch('/podcasts/manifest.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Podcast manifest unavailable')
        return response.json() as Promise<PodcastTrack[]>
      })
      .then((items) => {
        setTracks(items)
        setSelectedId((current) => current || items[0]?.id || '')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setLibraryError(true)
      })
      .finally(() => setLoadingTracks(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlayback))
  }, [savedPlayback])

  useEffect(() => {
    if (!activeTrack) return
    const saved = savedPlayback[activeTrack.id]
    setSpeed(Math.min(2.5, Math.max(0.25, saved?.speed ?? 1)))
    setVolume(Math.min(1, Math.max(0, saved?.volume ?? 1)))
    setCurrentTime(saved?.lastPosition ?? 0)
    setDuration(0)
    setAudioError(false)
  }, [activeTrack?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
    audio.volume = volume
  }, [activeTrack?.id, speed, volume])

  useEffect(() => {
    if (!activeTrack?.captionsSrc) {
      setCaptions([])
      setCaptionStatus('missing')
      return
    }

    const controller = new AbortController()
    setCaptions([])
    setCaptionStatus('loading')
    fetch(activeTrack.captionsSrc, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Captions unavailable')
        return response.text()
      })
      .then((contents) => {
        setCaptions(parseCaptions(contents))
        setCaptionStatus('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setCaptionStatus('error')
      })

    return () => controller.abort()
  }, [activeTrack?.captionsSrc])

  function saveProgress(time: number) {
    setCurrentTime(time)
    if (!activeTrack) return
    setSavedPlayback((previous) => ({
      ...previous,
      [activeTrack.id]: { speed, volume, lastPosition: time }
    }))
  }

  function selectTrack(track: PodcastTrack) {
    setSelectedId(track.id)
    setCurrentTime(0)
  }

  function seekTo(time: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }

  if (loadingTracks) {
    return <section className="content podcast-layout"><div className="eyebrow">Listen</div><h1>Podcasts and stories</h1><p className="lede">Loading audio library…</p></section>
  }

  if (!tracks.length) {
    return <section className="content podcast-layout"><div className="eyebrow">Listen</div><h1>Podcasts and stories</h1><p className="lede">{libraryError ? 'Could not load the podcast list. Restart the development server and try again.' : 'No audio files found. Add .m4a or .mp3 files to public/podcasts.'}</p></section>
  }

  return <section className="content podcast-layout">
    <div className="eyebrow">Listen</div>
    <h1>Podcasts and stories</h1>
    <p className="lede">Every M4A or MP3 in your podcasts folder appears here. Matching VTT and SRT files provide synced subtitles.</p>
    <div className="podcast-shell">
      <aside className="podcast-list" aria-label="Audio library">
        {tracks.map((track) => <button key={track.id} type="button" className={track.id === activeTrack?.id ? 'podcast-item active' : 'podcast-item'} onClick={() => selectTrack(track)}>
          <span className="podcast-cover">{track.format === 'M4A' ? '♫' : '🎧'}</span>
          <span><strong>{track.title}</strong><small>{track.format} audio</small></span>
        </button>)}
      </aside>
      {activeTrack && <div className="podcast-player-panel">
        <div className="podcast-header">
          <span className="podcast-type">{activeTrack.format} audio</span>
          <h2>{activeTrack.title}</h2>
        </div>
        <div className="audio-controls">
          <audio
            key={activeTrack.id}
            ref={audioRef}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const audio = event.currentTarget
              const saved = savedPlayback[activeTrack.id]
              setDuration(audio.duration)
              audio.playbackRate = speed
              audio.volume = volume
              if (saved?.lastPosition && saved.lastPosition < audio.duration) audio.currentTime = saved.lastPosition
            }}
            onDurationChange={(event) => setDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => saveProgress(event.currentTarget.currentTime)}
            onError={() => setAudioError(true)}
            onPlay={() => setAudioError(false)}
            src={activeTrack.audioSrc}
          />
        </div>
        {audioError && <p className="audio-error" role="alert">This audio could not be played. The player is using {activeTrack.format}; use the MP3 copy when a browser cannot decode this M4A.</p>}
        <div className="podcast-controls">
          <label className="range-control">
            <span className="range-title"><span>Playback speed</span><strong>{speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×</strong></span>
            <input aria-label="Playback speed" type="range" min="0.25" max="2.5" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
            <span className="range-limits"><span>0.25×</span><span>2.5×</span></span>
          </label>
          <label className="range-control volume-control">
            <span className="range-title"><span className="volume-label"><Volume2 size={16} /> Volume</span><strong>{Math.round(volume * 100)}%</strong></span>
            <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            <span className="range-limits"><span>0%</span><span>100%</span></span>
          </label>
        </div>
        <div className="transcript-box">
          <div className="transcript-heading"><h3>Subtitles</h3><span>±10 sec · {formatTime(currentTime)} / {formatTime(duration)}</span></div>
          {activeCaption && <p className="live-transcript">{activeCaption.text}</p>}
          {visibleCaptions.length > 0
            ? <div className="caption-list">{visibleCaptions.map((cue) => <div key={`${cue.start}-${cue.end}`} className={cue === activeCaption ? 'transcript-line active' : 'transcript-line'}><button type="button" className="caption-seek" aria-label={`Play subtitle from ${formatTime(cue.start)}`} onClick={() => seekTo(cue.start)}><span className="caption-time">{formatTime(cue.start)}</span></button><CaptionText text={cue.text} /></div>)}</div>
            : <p className="caption-empty">{captionStatus === 'loading' ? 'Loading subtitles…' : captionStatus === 'error' ? 'Could not load subtitles.' : captionStatus === 'ready' ? 'No caption lines near this point in the recording.' : `Timed subtitles will appear here when ${activeTrack.id}.vtt or .srt is added to this folder.`}</p>}
        </div>
      </div>}
    </div>
  </section>
}