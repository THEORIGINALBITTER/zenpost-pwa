# ZenPost PWA

ZenPost PWA ist die Web- und Mobile-Web-Version von ZenPost Studio.  
Die App bündelt Schreiben, Planen, Cloud-Dokumente, Bild-Uploads und schnelle Notizen in einer Oberfläche.

## Features

- `ZenPost`: Artikel schreiben und Entwürfe verwalten
- `Planer`: Kalender, Übersicht, Terminplanung, Eintrag-Aktionen
- `ZenImage`: Bild-Upload und Cloud-Bildliste
- `ZenNote`: schnelle Notizen mit Cloud-Sync
- `Dashboard`: Dokumentenübersicht in ZenCloud
- `Settings`: Profil, Theme, Cloud-Verbindung

## Tech Stack

- React 19
- Vite 7
- Font Awesome
- Editor.js (`@editorjs/editorjs` + Tools)

## Voraussetzungen

- Node.js 20+ (empfohlen)
- npm 10+ (empfohlen)

## Lokales Setup

```bash
npm install
npm run dev
```

App startet standardmäßig unter `http://localhost:5173`.

## Verfügbare Skripte

```bash
npm run dev      # Entwicklungsserver
npm run build    # Production Build
npm run preview  # Build lokal prüfen
```

## ZenCloud Verbindung

Die App erwartet eine gültige ZenCloud-Session (Base URL, Token, Projekt-ID).  
Die Verbindung wird über die Settings/Profile-Flows gesetzt und in Local Storage/Session gehalten.

Relevante Services:

- `src/services/cloudAuthService.js`
- `src/services/zenCloudService.js`
- `src/services/zenStudioSettings.js`

## Projektstruktur (Kurzüberblick)

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

- Die Hauptnavigation sitzt in `AppFooter.jsx`.
- Bildschirmwechsel und Footer-Action-Mapping laufen zentral in `src/main.jsx`.
- Kontextabhängige Footer-Aktionen werden über `resolveFooterAction` gesteuert.

## Build & Deployment

```bash
npm run build
```

Build-Ausgabe liegt in `dist/` und kann auf statischem Hosting deployed werden (z. B. Netlify, Vercel, nginx, Apache).

## Hinweise für Entwicklung

- `node_modules/` und `dist/` sind per `.gitignore` ausgeschlossen.
- Bei UI-Änderungen an Navigation/Planer immer `ArticleWriterScreen`, `PlannerScreen`, `ZenNoteQuickScreen` und `ZenImageCameraScreen` auf konsistente Footer-Labels prüfen.

## Visuals (Screenshots & GIF)

Lege Medien in `docs/media/` ab und nutze diese Dateinamen, damit die README-Einbettungen stabil bleiben:

- `docs/media/home.png`
- `docs/media/planner.png`
- `docs/media/editor.png`
- `docs/media/flow.gif`

Beispiel-Einbettungen:

```md
![Home](docs/media/home.png)
![Planer](docs/media/planner.png)
![Editor](docs/media/editor.png)
![Flow](docs/media/flow.gif)
```
