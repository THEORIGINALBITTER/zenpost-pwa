# ZenPost PWA

ZenPost PWA is the web and mobile-web version of ZenPost Studio.  
It combines writing, planning, cloud documents, image uploads, and quick notes in one interface.

## Features

- `ZenPost`: write and manage article drafts
- `Planner`: calendar, overview, scheduling, entry actions
- `ZenImage`: image upload and cloud image browser
- `ZenNote`: quick notes with cloud sync
- `Dashboard`: ZenCloud document overview
- `Settings`: profile, theme, cloud connection

## Tech Stack

- React 19
- Vite 7
- Font Awesome
- Editor.js (`@editorjs/editorjs` + tools)

## Requirements

- Node.js 20+ (recommended)
- npm 10+ (recommended)

## Local Setup

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5173` by default.

## Available Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run preview  # preview built app locally
```

## ZenCloud Connection

The app expects a valid ZenCloud session (base URL, token, project ID).  
Connection data is set through settings/profile flows and stored in local/session storage.

Relevant services:

- `src/services/cloudAuthService.js`
- `src/services/zenCloudService.js`
- `src/services/zenStudioSettings.js`

## Project Structure (Short)

```text
src/
  components/
    AppFooter.jsx
    ArticleWriterScreen.jsx
    PlannerScreen.jsx
    CloudDashboardScreen.jsx
    ZenImageCameraScreen.jsx
    ZenNoteQuickScreen.jsx
    ZenSettingsScreen.jsx
  services/
    appShellConfig.js
    cloudAuthService.js
    profileService.js
    themeService.js
    zenCloudService.js
  main.jsx
```

## Navigation / App Shell

- Main navigation is implemented in `AppFooter.jsx`.
- Screen switching and footer action mapping are centralized in `src/main.jsx`.
- Context-dependent footer actions are resolved via `resolveFooterAction`.

## Visual Preview

Store media files in `docs/media/` and keep names stable for README embedding:

- `docs/media/home.png`
- `docs/media/planner.png`
- `docs/media/editor.png`
- `docs/media/flow.gif`

## Build & Deployment

```bash
npm run build
```

Build output is generated in `dist/` and can be deployed to static hosting (e.g. Netlify, Vercel, nginx, Apache).

## Development Notes

- `node_modules/` and `dist/` are excluded via `.gitignore`.
- When changing planner/footer behavior, verify labels and actions across `ArticleWriterScreen`, `PlannerScreen`, `ZenNoteQuickScreen`, and `ZenImageCameraScreen`.
