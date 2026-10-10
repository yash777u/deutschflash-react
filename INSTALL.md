# Installation Guide

This project is a Vite + React + TypeScript app for learning German vocabulary with flashcards, searches, tests, bookmarks, and audio support.

## Requirements

- Node.js 20+ recommended
- npm 10+
- `uv` for automatic podcast subtitles
- A browser with local storage enabled

## 1) Install dependencies

From the project root:

```bash
npm install
```

## 2) Run locally

Start the development server:

```bash
npm run dev -- --host 0.0.0.0
```

On first launch, the app checks `public/podcasts` for `.mp3` and `.m4a` files. It creates `public/podcasts/subtitles/`, then uses a local Whisper base model to generate a matching `.vtt` file only when neither a `.vtt` nor `.srt` subtitle file already exists. The model and Python transcription package are downloaded on first use; generated subtitles stay in the folder and are reused on later launches. Keep the computer online for this first model download.

Then open the local address shown in the terminal, usually:

- http://localhost:5173/
- or another port if 5173 is already in use

## 3) Build for production

```bash
npm run build
```

This command runs the audio generation step first via the `prebuild` script.

## 4) Preview production build

```bash
npm run preview -- --host 0.0.0.0
```

## 5) Regenerate audio cache

If you add or update vocabulary data and want to refresh the generated audio files:

```bash
npm run audio:generate
```

## 6) Regenerate missing podcast subtitles

```bash
npm run podcasts:prepare
```

This command also runs automatically before `npm run dev` and `npm run build`. Run it manually after adding a podcast or when you want to retry caption generation.

Audio titles come from the filename before `.mp3` or `.m4a`, with underscores displayed as spaces. To provide your own timed subtitles, put `<audio-filename>.vtt` or `<audio-filename>.srt` in `public/podcasts/subtitles/`; existing subtitle files are never overwritten.

## Notes

- The app reads workbook data from the `public/data` folder and renders the content in the browser.
- Bookmarks and saved words are persisted in the browser using `localStorage`.
- Speech/audio falls back to browser-based German voice output when cached audio is unavailable.
- Podcast playback supports MP3 and M4A. Transcription runs locally on CPU using `faster-whisper` and the Whisper `base` model; the first generation can take a few minutes depending on recording length and computer speed.
- If Vercel or another hosting service is used, the app is configured to serve static assets and server-side API routes from the project root.
