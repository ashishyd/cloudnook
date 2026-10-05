# Cloudnook
**Your day, under one sky.**

A cozy desktop home for your weather, tasks, reminders and sticky notes — as beautiful, themeable widgets.

## Features
- **Live weather** (Open-Meteo, no API key): animated scene, 14-day outlook, hour-by-hour view for any day, UV, wind compass, humidity, pressure, visibility, air quality, sun arc.
- **Precipitation radar** (RainViewer + OpenStreetMap tiles).
- **Severe weather alerts**: local hazard detection worldwide, plus official NWS alerts for US locations.
- **Multi-location chips**: switch quickly between saved cities.
- **Tasks** with priority, due dates, due notifications, filters, progress ring, inline editing.
- **Reminders** with repeat, native notifications, configurable snooze, macOS notification actions.
- **Sticky notes** in six colours, pinning, autosave.
- **Universal search** (`/`): cities, tasks and notes.
- **Widgets**: drag to reorder, resize, hide, or pop out as always-on-top desktop widgets.
- **Themes**, units, launch at login, global show/hide (`⌘⇧Space` / `Ctrl+Shift+Space`).
- **Encrypted local store** via OS keychain when available, plus export/import backup.
- **Auto-update** for packaged builds (GitHub Releases).

## Run
```bash
npm install
npm start
npm test
npm run icons
npm run dist        # current platform (mac installs to /Applications)
npm run dist:win
npm run dist:linux
```

### Signing / notarize (macOS)
Set `CSC_LINK` + `CSC_KEY_PASSWORD` to sign. For notarize also set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. Without these, builds still succeed unsigned.

Shortcuts: `/` search · `Cmd/Ctrl+,` settings · `Cmd/Ctrl+Shift+Space` show/hide.
Data is stored locally in your user-data folder (`cloudnook.json`), encrypted when the OS keychain is available.
