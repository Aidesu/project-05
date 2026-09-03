# project-05

React + TypeScript + Tailwind CSS + shadcn/ui + Zustand, built with Vite.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server                 |
| `npm run build`     | Type-check and build to `dist/`      |
| `npm run preview`   | Serve the production build locally   |
| `npm run lint`      | Run ESLint                           |
| `npm run typecheck` | Type-check without emitting          |

## Install as the new-tab page

A page cannot focus the browser's address bar — browsers forbid it. The
address bar gets focus when *the browser* opens a new tab, so the way to get
that behaviour is to make this page the new-tab page.

```bash
npm run build
```

Then in Chrome or Edge: `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → pick `dist/`. Every `Ctrl+T` now opens the board with the
caret already in the address bar.

Three things make the build loadable as an extension:

- `base: "./"` in `vite.config.ts` — inside an extension `/` is the extension
  root, not the page's folder, so absolute asset URLs 404.
- `public/manifest.json` — MV3, declaring `chrome_url_overrides.newtab`.
- The `favicon` permission, which lets `faviconUrl()` use Chrome's `_favicon`
  endpoint: icons the browser already holds, served offline with no
  third-party request. In a plain tab (and in Firefox, which has no such
  endpoint) it falls back to Google's favicon service.

`localStorage` and IndexedDB behave normally on an extension page, so sites,
settings and uploaded wallpapers all survive the move.

## Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui primitives — owned code, edit freely
│   └── layout/      # app chrome (header)
├── features/
│   ├── background/  # wallpaper: store, presets, render layer, settings
│   ├── settings/    # the right-hand settings panel
│   └── sites/       # the board: store, types, bubble, board, form
├── lib/
│   ├── asset-store.ts  # IndexedDB blob storage (uploads)
│   ├── color.ts        # hex ↔ rgb for the colour pickers
│   ├── url.ts          # URL normalisation + favicon derivation
│   └── utils.ts        # cn() class merger
├── index.css        # Tailwind entry + bloom-drift keyframes
├── App.tsx
└── main.tsx
```

`@/*` is aliased to `src/*` (declared in `tsconfig.json` and `vite.config.ts`).

Features are grouped by folder rather than by kind: everything about a site
lives under `src/features/sites/`, so a second feature never forces a
reorganisation.

## Adding shadcn/ui components

```bash
npx shadcn@latest add dropdown-menu
```

`components.json` is already configured (new-york style, neutral base, CSS variables).

## Data & storage

Sites are held in `src/features/sites/sites-store.ts`, a Zustand store wrapped
in the `persist` middleware — one key, `mainboard.sites`, in `localStorage`.

Two conventions keep it safe to evolve:

- **Timestamps are `number`** (`Date.now()`), never `Date`. `localStorage` goes
  through JSON, which does not round-trip `Date` objects.
- **`version` + `migrate` are wired from day one.** Bump the version and add a
  branch to `migrate` whenever the `Site` shape changes, so boards already saved
  in someone's browser keep loading.

The store owns CRUD plus the two invariants that must not be duplicated in a
component: URL normalisation and deduplication. Search, tag filtering and
ordering are derived at render time in `site-board.tsx` — deliberately not
stored, to avoid a second source of truth.

`src/features/background/background-store.ts` follows the same shape under the
key `mainboard.background`.

### Where uploads go

An uploaded wallpaper would blow past the ~5 MB `localStorage` quota on the
first photo, so the two are split:

- **Settings → `localStorage`.** A colour, a preset id, a URL, or an *asset id*
  — a few bytes either way.
- **Bytes → IndexedDB**, via `src/lib/asset-store.ts` (`putAsset` / `getAsset` /
  `deleteAsset`, no dependency). Replacing a background deletes the asset it
  replaced, so no orphan blobs accumulate.

Swapping `localStorage` for a real backend means replacing the middleware's
`storage` option; the components stay untouched.
