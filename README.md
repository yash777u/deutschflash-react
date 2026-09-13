# DeutschFlash React

A static React + TypeScript migration of the supplied Streamlit project.

## Deploy to Vercel

Import this folder as a Vercel project. Vercel detects Vite automatically.

- Build command: `npm run build`
- Output directory: `dist`

The vocabulary workbooks, available cached pronunciation MP3s, and visual slides are bundled in `public/`. The hover dictionary and speech fallback use the Vercel functions in `api/`.

## Local development

```bash
npm install
npm run dev
```

The app reads Excel workbooks directly in the browser using `xlsx`. Speech falls back to the browser's German speech-synthesis voice when an exact cached MP3 is not present.
# deutschflash-react
# deutschflash-react

After adding more vocab 
run ''' npm run audio:generate '''
