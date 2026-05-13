# GLAMLI v2 — agent guide

This folder holds the Claude Design handoff for the GLAMLI prototype plus
the scaffolding for an eventual production rebuild. Read this before making
visual or structural changes.

## Visual source of truth

The following files in the project root are the **visual source of truth**.
They are the original Claude Design handoff exports. Treat them as a brief,
not as production code — recreate the visual output in whatever stack the
target codebase uses, but do not deviate from what they render:

- `glamli_v2.html` — shell, CSS tokens, all base styles
- `app.jsx` — root App, stage state, AutoML run animation, Tweaks wiring
- `chat.jsx` — left chat panel with streaming bubbles and stage intros
- `data.jsx` — mock dataset, assumptions, test cases, spec, AutoML steps
- `flowchart.jsx` — Canvas view (inputs → model → expected/predicted)
- `icons.jsx` — line-icon set
- `stages.jsx` — the five workflow stages (Upload → Domain → Tests → Review → Run)
- `tweaks-panel.jsx` — floating dev-only Tweaks shell

Open the prototype by serving the folder and loading `glamli_v2.html` in a
browser. The page bootstraps React + Babel from unpkg and inlines all the
JSX modules; no build step is required.

### Rules

1. **The handoff wins on visuals.** When the rebuild diverges from what the
   handoff renders, the handoff is correct. Do not paraphrase colours,
   substitute "close" radii, or simplify spacing.
2. **Tokens before classes.** Every colour, font, radius, shadow, and pad
   in the rebuild must come from `src/styles/globals.css`. If a value
   isn't in the tokens or in `docs/design-system.md`, it isn't part of the
   system — stop and check the handoff before adding it.
3. **Reuse handoff class names** (`.btn-primary`, `.col-card`, `.flow-canvas`,
   `.stage-eyebrow`, …) in the rebuild so designers can grep across both
   codebases.
4. **Do not modify the handoff files** without an explicit ask. They are
   the brief, not the implementation.

## Where to find what

- `docs/design-system.md` — the full extraction: colours, typography,
  spacing, radius, shadows, buttons, cards, forms, chat UI, flowchart UI,
  stages UI, tweak panel UI. Numbered sections; section IDs are stable.
- `src/styles/globals.css` — token layer (`:root`, `[data-theme="dark"]`,
  `[data-accent]`, `[data-density]`), resets, base typography, utility
  classes, animations, scrollbar. Import this **first** in any rebuild.
- `src/components/ui/` — reusable primitives, **only for repeated patterns**
  in the handoff. Each component ships with a sibling `.css` file
  containing the styles for that component's classes. Currently:
  - `Button` (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.btn-icon`)
  - `Card` + `CardPad` + `CardRow`
  - `Pill` (with `pill-dot`)
  - `StageHeader` (`StageEyebrow`, `StageTitle`, `StageLede`)
  - `ProgressBar`
  - `Skeleton`
  - `index.js` — barrel export
- Re-export new primitives from `src/components/ui/index.js` when promoting
  a repeated pattern.

## What is intentionally **not** a primitive

These appear once in the handoff and stay co-located with their host
module. Promote them into `src/components/ui/` only if they get reused:

- Workflow rail (`.workflow-rail`, `.rail-item`, `.rail-num`)
- View toggle (`.view-toggle`)
- Dropzone (`.dropzone`)
- Table preview (`.table-wrap`, `table.preview`)
- Column assumption card (`.col-card`, `.col-head`, `.col-name`, `.col-type`,
  `.assumption*`)
- Spec field (`.spec-field`, `.spec-label`, `.spec-value`)
- Tabs (`.tabs`, `.tab`)
- Status line (`.status-line`)
- Plan row (`.plan-row`)
- Flow canvas + nodes + edges (`.flow-canvas`, `.node*`, `.case-tab*`)
- Chat composer, message bubbles, typing dots
- Loader, loading-stage
- Tweaks panel (all `.twk-*` styles)

## Theming model

- `<html data-theme="light|dark" data-density="comfortable|compact" data-accent="sage|clay|slate|plum">`
- Accent values come from `[data-accent="..."]` selectors in
  `src/styles/globals.css`. The prototype's `app.jsx` currently writes
  custom properties directly on `document.documentElement` — when rebuilding
  prefer the data-attribute form.
- `--accent` stays the same across themes; only `--accent-soft` and
  `--accent-ink` remap in dark mode. Do not invent dark-mode accent ramps.

## When asked to change the visuals

1. Re-read the relevant section of `docs/design-system.md`.
2. If the change would introduce a token not already in `globals.css`,
   verify against the handoff first — the right move is usually to use
   an existing token, not to add a new one.
3. If the change is a genuinely new design decision, update
   `docs/design-system.md`, `globals.css`, and (if relevant) the UI
   primitive in the same commit.

## Status

The handoff is in place. The token layer and a minimal set of UI
primitives exist. The full app has **not** been rebuilt against this
scaffolding yet — the running prototype is still the unaltered handoff at
`glamli_v2.html`.
