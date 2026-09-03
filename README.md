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

## Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui primitives — owned code, edit freely
│   └── layout/      # app chrome (header)
├── features/
│   └── sites/       # the board: store, types, bubble, board, form
├── lib/
│   ├── url.ts       # URL normalisation + favicon derivation
│   └── utils.ts     # cn() class merger
├── index.css        # Tailwind entry + design tokens
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

Swapping `localStorage` for IndexedDB or a real backend means replacing the
middleware's `storage` option; the components stay untouched.
