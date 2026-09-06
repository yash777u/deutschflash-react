# DeutschFlash React

A static React + TypeScript migration of the supplied Streamlit project.

## Deploy to Vercel

Import this folder as a Vercel project. Vercel detects Vite automatically.

- Build command: `npm run build`
- Output directory: `dist`

The vocabulary workbooks, available cached pronunciation MP3s, and visual slides are bundled in `public/`. There are no API routes, server functions, environment variables, or backend dependencies.

## Local development

```bash
npm install
npm run dev
```

The app reads Excel workbooks directly in the browser using `xlsx`. Speech falls back to the browser's German speech-synthesis voice when an exact cached MP3 is not present.
# deutschflash-react
