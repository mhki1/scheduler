# Schedule Planner

A single-page React + Vite schedule planner. It stores one schedule in browser `localStorage`; it does not require a backend or database.

## Requirements

- Node.js 18+ recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

## Build for WordPress / Ubuntu hosting

```bash
npm run build
```

Vite writes the production app to `dist/`. Upload the **contents** of `dist/` to a directory on your WordPress server.

If deploying at:

`https://example.com/wp-content/uploads/schedule-planner/`

change `base` in `vite.config.js` to:

```js
base: '/wp-content/uploads/schedule-planner/',
```

Then run `npm run build` again.

The app is a standalone static page. It can be opened directly at its URL or embedded in a WordPress page using an iframe:

```html
<iframe
  src="/wp-content/uploads/schedule-planner/"
  title="Schedule Planner"
  style="width:100%; min-height:900px; border:0;"
></iframe>
```

## Features

- Single schedule with a permanent blank row at the bottom
- Automatic localStorage persistence
- Add at bottom and insert between rows
- Drag-and-drop reorder
- Global delete mode
- Start/end/duration/drive-time blur calculations
- Update upwards and downwards
- Backup-plan checkbox
- Plain-text import/export
- Supports time values beyond 24 hours, e.g. `25:30`
