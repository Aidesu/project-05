# project-05

React + TypeScript + Tailwind CSS + shadcn/ui + Zustand, built with Vite.

## Getting started

```bash
npm install
npm run dev
```

## Build instructions (for AMO source review)

This extension is built with Vite, which transpiles TypeScript, bundles
modules, and minifies output, so Mozilla requires the unprocessed source
alongside the signed build.

**Build environment:**

- OS: any (Linux, macOS, Windows), the build is pure Node/npm, no native
  dependencies
- Node.js: v22.x (tested with v22.23.1)
- npm: v10.x (tested with v10.9.8)

**Steps to produce an exact copy of the reviewed build:**

```bash
npm install            # installs exact versions pinned in package-lock.json
npm run build:firefox  # tsc -b && vite build --mode firefox, outputs to dist/
```

`dist/` is the artifact that gets zipped and submitted as the extension
package. No other manual steps, environment variables, or secrets are
involved.

`manifest.json` is generated from `manifest.config.json` by the small
`manifest()` plugin in `vite.config.ts`: the Firefox build drops the
`favicon` permission, which only exists in Chrome and which AMO's linter
flags as invalid. Nothing else differs between the two targets, `npm run
build` produces the Chrome package from the same sources.

**On `optional_host_permissions`:** the news feed reads publishers' RSS feeds
directly, which the browser allows only with host access for those hosts. The
list is not written by hand, the same plugin derives it from
`src/features/news/feeds.json`, the catalogue the app itself fetches from, so
the two cannot drift apart. It is *optional*, not required: the feed ships off,
and nothing is requested until someone turns it on and presses "Allow these
sources", at which point only the hosts behind the desks they opened are asked
for. Access is used for exactly one thing (an HTTP GET of the feed URL) and
the extension has no content scripts, so it never touches page content.

**On the `https://*/*` entry in that list:** desks can also be built by hand,
with any RSS feed the user adds themselves, and the host of a feed nobody has
typed yet cannot be known at build time. A browser only grants an origin that
some declared pattern covers, so this entry is the ceiling those requests are
made against, not a grant. Being optional it is never handed over at install,
and the app never asks for it: `permissions.request()` is always called with
the single `https://<host>/*` about to be read (`custom-feed-dialog.tsx`),
which is what the browser then shows in its prompt. The user-facing effect is
one permission dialog naming one site, each time a feed is added.

**On the two `innerHTML` warnings the linter reports in the bundle:** both
sit inside React DOM, in its `dangerouslySetInnerHTML` property handler
(`react-dom` 19.x, present in every React build). No application code in
`src/` uses `innerHTML` or `dangerouslySetInnerHTML`. Feed and API responses
are parsed with `DOMParser`, and nothing parsed out of them is ever inserted as
markup: the parser reads `textContent` for the words, and attributes
(`url`, `src`, `href`) for the addresses
(`src/features/news/feed-parser.ts`). Every one of those addresses then passes
`isSafeHttpUrl` or `safeImageUrl` (`src/lib/url.ts`) before reaching an `href`
or an `<img src>`, so only `http(s)` survives.

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server                 |
| `npm run build`         | Type-check and build to `dist/` (Chrome) |
| `npm run build:firefox` | Same, without the Chrome-only `favicon` permission |
| `npm run preview`   | Serve the production build locally   |
| `npm run lint`      | Run ESLint                           |
| `npm run typecheck` | Type-check without emitting          |

## Install as the new-tab page

A page cannot focus the browser's address barbrowsers forbid it. The
address bar gets focus when *the browser* opens a new tab, so the way to get
that behaviour is to make this page the new-tab page.

```bash
npm run build          # Chrome or Edge
npm run build:firefox  # Firefox
```

**Chrome or Edge:** `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → pick `dist/`. Every `Ctrl+T` now opens the board with the
caret already in the address bar.

**Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → pick `dist/manifest.json` (a file, not the folder). This lasts
until Firefox restartsFirefox only keeps unsigned add-ons installed for the
session, there is no permanent "load unpacked" outside Nightly/Developer
Edition with `xpinstall.signatures.required` turned off in `about:config`.
For a lasting install, submit the built `dist/` folder for signing at
[addons.mozilla.org](https://addons.mozilla.org) (self-distribution is fine:
it doesn't need to be public) and install the signed `.xpi` it gives back.

Four things make the build loadable as an extension:

- `base: "./"` in `vite.config.ts`inside an extension `/` is the extension
  root, not the page's folder, so absolute asset URLs 404.
- `manifest.config.json`MV3, declaring `chrome_url_overrides.newtab` plus
  `browser_specific_settings.gecko.id`, which Firefox requires to keep an
  add-on's identity (and its storage) stable across reloads. `vite.config.ts`
  emits it into `dist/` as `manifest.json`, per target.
- The `favicon` permission (Chrome build only), which lets `faviconUrl()` use
  Chrome's `_favicon` endpoint: icons the browser already holds, served offline with no
  third-party request. In a plain tab (and in Firefox, which has no such
  endpoint) it falls back to Google's favicon service.

`localStorage` and IndexedDB behave normally on an extension page, so sites,
settings and uploaded wallpapers all survive the move.

## Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui primitivesowned code, edit freely
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
in the `persist` middlewareone key, `mainboard.sites`, in `localStorage`.

Two conventions keep it safe to evolve:

- **Timestamps are `number`** (`Date.now()`), never `Date`. `localStorage` goes
  through JSON, which does not round-trip `Date` objects.
- **`version` + `migrate` are wired from day one.** Bump the version and add a
  branch to `migrate` whenever the `Site` shape changes, so boards already saved
  in someone's browser keep loading.

The store owns CRUD plus the two invariants that must not be duplicated in a
component: URL normalisation and deduplication. Search, tag filtering and
ordering are derived at render time in `site-board.tsx`deliberately not
stored, to avoid a second source of truth.

`src/features/background/background-store.ts` follows the same shape under the
key `mainboard.background`.

### Where uploads go

An uploaded wallpaper would blow past the ~5 MB `localStorage` quota on the
first photo, so the two are split:

- **Settings → `localStorage`.** A colour, a preset id, a URL, or an *asset id*
 a few bytes either way.
- **Bytes → IndexedDB**, via `src/lib/asset-store.ts` (`putAsset` / `getAsset` /
  `deleteAsset`, no dependency). Replacing a background deletes the asset it
  replaced, so no orphan blobs accumulate.

Swapping `localStorage` for a real backend means replacing the middleware's
`storage` option; the components stay untouched.
