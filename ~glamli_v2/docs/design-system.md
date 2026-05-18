# GLAMLI v2 — Design System

This document is the design contract for GLAMLI v2. Every rule below was extracted verbatim from the Claude Design handoff files in the project root (`glamli_v2.html`, `app.jsx`, `chat.jsx`, `data.jsx`, `flowchart.jsx`, `icons.jsx`, `stages.jsx`, `tweaks-panel.jsx`). Those files are the **visual source of truth** — do not invent styles or tokens that are not present there.

The aesthetic is a calm, document-like workspace: warm off-white background, soft greys, a single sage accent, generous spacing, serif headings, mono for code/columns.

---

## 1. Colours

All colour values are defined as CSS custom properties on `:root` and overridden under `[data-theme="dark"]`. Accent swaps happen at runtime via `[data-accent="…"]` (set by `app.jsx`).

### 1.1 Light theme (default, `:root`)

| Token              | Value     | Role                                                                |
| ------------------ | --------- | ------------------------------------------------------------------- |
| `--bg`             | `#f7f4ee` | Page background (warm off-white "paper")                            |
| `--bg-elev`        | `#fbf9f4` | Elevated surfaces: topbar, panel chrome, hover states for `.spec-value` |
| `--surface`        | `#ffffff` | Cards, msg bubbles, dropzone, table body, inputs                    |
| `--surface-2`      | `#f1ede5` | Subtle fills: view-toggle track, pills, inline `code`, table head bg |
| `--border`         | `#e6e0d4` | Default 1px borders                                                 |
| `--border-strong` | `#d8d0bf` | Heavier borders: composer-box, dropzone (dashed), btn, kbd, node    |
| `--text`           | `#2a2825` | Primary text                                                        |
| `--text-2`         | `#6b6760` | Secondary text, muted labels                                        |
| `--text-3`         | `#9a9388` | Tertiary text, eyebrow/uppercase labels, placeholders               |

### 1.2 Dark theme (`[data-theme="dark"]`)

| Token              | Value     |
| ------------------ | --------- |
| `--bg`             | `#1a1916` |
| `--bg-elev`        | `#211f1b` |
| `--surface`        | `#26241f` |
| `--surface-2`      | `#2e2b25` |
| `--border`         | `#36322b` |
| `--border-strong` | `#44403a` |
| `--text`           | `#ebe7df` |
| `--text-2`         | `#a8a297` |
| `--text-3`         | `#75716a` |
| `--accent-soft`    | `#2d3a2a` |
| `--accent-ink`     | `#b6c8b1` |

Note: `--accent` itself does NOT change in dark mode — only `--accent-soft` / `--accent-ink` are remapped.

### 1.3 Accent (swappable at runtime)

The accent has three slots: `--accent` (mid), `--accent-soft` (tinted background), `--accent-ink` (deep text/icon).

| Accent name | `--accent` | `--accent-soft` | `--accent-ink` |
| ----------- | ---------- | --------------- | -------------- |
| **sage** (default) | `#6f8a6a` | `#e3ebde` | `#43583f` |
| **clay**    | `#a86b50` | `#f1e2d8` | `#6e4633` |
| **slate**   | `#6a7a8c` | `#dee3ea` | `#3f4a58` |
| **plum**    | `#8a6a82` | `#ebdde7` | `#583f50` |

### 1.4 Status colours

| Token       | Value     | Use                                  |
| ----------- | --------- | ------------------------------------ |
| `--warn`    | `#b8763a` | Warning (prediction-differs message) |
| `--danger`  | `#b65a4f` | Destructive                          |
| `--good`    | `#6f8a6a` | Positive (= sage; e.g. "synced" dot) |

### 1.5 Light-on-accent text

The string colour `#fbf9f4` (same as `--bg-elev` light value) is used as a literal value (not via token) for text on filled accent surfaces: `.btn-primary` text, `.brand-mark` glyph, `.rail-item.complete .rail-num`, `.case-tab.active` text.

---

## 2. Typography

### 2.1 Font families (loaded via Google Fonts in `glamli_v2.html`)

| Token          | Stack                                                                  | Used for                                        |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `--font-sans`  | `'Inter', system-ui, -apple-system, sans-serif`                        | All UI text by default                          |
| `--font-serif` | `'Source Serif 4', Georgia, serif`                                     | `h1.stage-title`, `.brand-mark` glyph           |
| `--font-mono`  | `'JetBrains Mono', ui-monospace, monospace`                            | Column names, code, `.kbd`, plan names, numbers |

Inter weights loaded: 400, 500, 600, 700. Source Serif 4 weights: 400, 500, 600 (variable opsz 8..60). JetBrains Mono weights: 400, 500.

Body has `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility`.

### 2.2 Type scale

| Element / class              | Size    | Weight | Line-height | Other                                            |
| ---------------------------- | ------- | ------ | ----------- | ------------------------------------------------ |
| `body` (base)                | `14px`  | 400    | `1.55`      | sans                                             |
| `h1.stage-title`             | `32px`  | 500    | `1.15`      | serif, letter-spacing `-.015em`                  |
| `.stage-lede`                | `15px`  | 400    | inherits    | `--text-2`, `max-width: 60ch`, `text-wrap: pretty` |
| `.stage-eyebrow`             | `11.5px`| 600    | —           | uppercase, letter-spacing `.1em`, `--text-3`     |
| `.panel-title`               | `12px`  | 600    | —           | uppercase, letter-spacing `.08em`, `--text-3`    |
| `.spec-label`                | `11.5px`| 600    | —           | uppercase, letter-spacing `.08em`, `--text-3`    |
| `.col-type`                  | `11.5px`| 400    | —           | uppercase, letter-spacing `.05em`, `--text-3`    |
| `.col-name`                  | `13px`  | 500    | —           | mono, `--accent-ink` on `--accent-soft` chip     |
| `.msg-bubble`                | `13.5px`| —      | `1.6`       |                                                  |
| `.msg-bubble code`           | `12px`  | —      | —           | mono, `--accent-ink` on `--surface-2`            |
| `.msg-meta`                  | `11px`  | —      | —           | `--text-3`                                       |
| `.composer textarea`         | `13.5px`| —      | `1.5`       |                                                  |
| `.btn`                       | inherit (14px) | 500 | —    |                                                  |
| `.btn-sm`                    | `12.5px`| 500    | —           |                                                  |
| `.rail-item`                 | `12.5px`| —      | —           | `.active` → weight 500                           |
| `.view-toggle button`        | `12.5px`| 500    | —           |                                                  |
| `.tab`                       | `13px`  | 500    | —           |                                                  |
| `.pill`                      | `11.5px`| 500    | —           | radius `100px`                                   |
| `table.preview` body         | `12.5px`| —      | —           | `font-variant-numeric: tabular-nums`             |
| `table.preview th`           | `11.5px`| 600    | —           | uppercase, letter-spacing `.04em`, `--text-2`    |
| `.assumption`, `.assumption-edit` | `13px` | — | `1.55`     |                                                  |
| `.spec-value`                | `13.5px`| —      | `1.5`       |                                                  |
| `.case-tab`                  | `12px`  | —      | —           |                                                  |
| `.status-line`               | `13px`  | —      | —           |                                                  |
| `.plan-row`                  | `13px`  | —      | —           | `.plan-name` mono `12.5px`                       |
| `.node`                      | `12px`  | —      | —           |                                                  |
| `.node-label`                | `10.5px`| 600    | —           | uppercase, letter-spacing `.08em`, `--text-3`    |
| `.node-name`                 | `11.5px`| 500    | —           | mono, `--accent-ink`                             |
| `.node-value`                | `13px`  | 500    | —           | `font-variant-numeric: tabular-nums`             |
| `.node-input input`          | `12.5px`| —      | —           | `font-variant-numeric: tabular-nums`             |
| `.kbd`                       | `11px`  | —      | —           | mono                                             |
| `.small` (utility)           | `12px`  | —      | —           |                                                  |

Numbers in tables, node values, plan scores, and node inputs use `font-variant-numeric: tabular-nums`.

### 2.3 Markdown rendering inside chat bubbles

`chat.jsx` recognises only:

- `**bold**` → `<strong>` (`--text`, weight 600)
- `` `code` `` → `<code>` (mono, 12px, `--accent-ink` on `--surface-2`, padding `1px 6px`, radius `4px`)
- Paragraph breaks on `\n\n` (each paragraph wrapped in `<p>` with `margin: 0 0 8px`; last `<p>` margin 0)

---

## 3. Spacing

### 3.1 Spacing tokens

| Token    | Comfortable (default) | Compact (`[data-density="compact"]`) | Where used                  |
| -------- | --------------------- | ------------------------------------ | --------------------------- |
| `--pad`  | `20px`                | `14px`                               | Generic content padding     |
| `--gap`  | `16px`                | `10px`                               | Generic gap between blocks  |

The density data-attribute is set on `<html>` by `app.jsx` based on the Tweaks panel.

### 3.2 Recurring spacing values (literal)

These pixel values are used throughout the prototype and should be preserved as the spacing rhythm:

- **2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 60** px

Examples:

- Panel header: `14px 18px`
- View header / topbar height: `48px`, padding `0 18px`
- Workflow body: `28px 36px 60px`, `max-width: 760px`, centred
- Workflow rail: `12px 18px`, gap `4px`
- Stage rail items: padding `6px 10px`, gap `10px`
- Chat feed: padding `18px`, message gap `18px`, intra-msg gap `6px`
- Composer: padding `12px 14px`; composer-box padding `10px 10px 8px 12px`
- Card pad: `18px 20px`; card-row: `12px 20px`
- Col-card: `16px 18px`, bottom margin `10px`
- Spec field: `14px 20px`
- Pill: `2px 8px`
- Buttons: `.btn` `32px` tall padding `0 12px`; `.btn-sm` `26px` tall padding `0 9px`; `.btn-icon` `30×30`
- Stage spacing: title `h1` margin `6px 0 6px`; lede `0 0 24px`; stage CTA row `margin-top: 24px`
- Loading stage: `padding: 40px 20px`, loader margin `0 auto 24px`
- Dropzone: `40px` padding (empty) → `18px 22px` (uploaded), `1.5px` dashed border

### 3.3 Layout shell

`.app-shell`:

- `display: grid; grid-template-columns: 320px 1fr; height: 100%;`
- Under `max-width: 1280px` → `grid-template-columns: 280px 1fr;`

Topbar is `48px` tall, sits above the shell. Panels (`.panel`) are full-height flex columns with a 1px right border that drops on the last panel.

---

## 4. Radius

| Token         | Value  | Use                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------ |
| `--radius`    | `10px` | `.msg-bubble`, `.table-wrap`, `.node` (also literal `10px`)                    |
| `--radius-lg` | `14px` | `.card`, `.col-card`, `.dropzone`                                              |

Literal radii used elsewhere (no tokens):

- `4px` — inline `code`/`.ref`
- `5px` — `.col-name` chip, `.node-input input`, `.skel`
- `6px` — `.view-toggle button` (inner), `.spec-value`
- `7px` — `.btn-sm`, `.kbd`, `.case-tab`
- `8px` — `.btn`, `.btn-icon`, `.view-toggle` (outer), `.rail-item`, `.brand-mark`, `.status-line`
- `10px` — large primary CTA in Stage 5 (`borderRadius: 10`)
- `12px` — `.composer-box`
- `50%` — `.rail-num`, `.node-handle`, the Stage-5 success check disc, `.loader`, `.pill-dot`, `.typing-dot`
- `100px` — `.pill` (full pill)

---

## 5. Shadows

| Token         | Value                                                              | Use                                                     |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `--shadow-sm` | `0 1px 0 rgba(40,30,15,.04), 0 1px 2px rgba(40,30,15,.04)`         | `.node`, `.view-toggle button.active`                   |
| `--shadow-md` | `0 1px 0 rgba(40,30,15,.04), 0 4px 14px rgba(40,30,15,.06)`        | Defined but not directly used inside the page CSS — reserve for hover/dialog states. |

Shadows are deliberately subtle and warm-tinted; never use neutral black `rgba(0,0,0,…)` for surface shadows in the main page (the tweaks panel uses its own `rgba(0,0,0,…)` shadow because it is a floating glass overlay).

---

## 6. Buttons

### 6.1 Base (`.btn`)

- `height: 32px; padding: 0 12px;`
- `display: inline-flex; align-items: center; gap: 6px;`
- `background: var(--surface); color: var(--text);`
- `border: 1px solid var(--border-strong); border-radius: 8px;`
- `font-weight: 500; white-space: nowrap;`
- Transitions: `background .15s, border-color .15s`
- Hover: `background: var(--surface-2)`
- Disabled: `opacity: .45; cursor: not-allowed`

### 6.2 Variants

- **`.btn-primary`** — accent fill (`background: var(--accent)`, `color: #fbf9f4`, transparent border). Hover → `background: var(--accent-ink)`.
- **`.btn-ghost`** — transparent background and border, `color: var(--text-2)`. Hover → `background: var(--surface-2); color: var(--text)`.

### 6.3 Sizes / shapes

- **`.btn-sm`** — `height: 26px; padding: 0 9px; font-size: 12.5px; border-radius: 7px;`
- **`.btn-icon`** — `width: 30px; height: 30px; padding: 0;` centred. Use alone or stacked with `.btn-sm` (`btn-icon btn-sm`).
- A one-off oversized primary CTA appears in Stage 5: inline `style={{ height: 44, padding: '0 22px', fontSize: 15, borderRadius: 10 }}`. Reserve for the single "Test it Out!" moment.

### 6.4 Icon usage

Icons come from the `Icon` component in `icons.jsx` and are placed inline before the label with the button's `gap: 6px`. Typical icon sizes inside buttons: 13 (sm), 14 (default), 15–16 (large/icon-only).

---

## 7. Cards

### 7.1 `.card`

- `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;`

### 7.2 Sub-parts

- **`.card-pad`** — `padding: 18px 20px;`
- **`.card-row`** — `display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border);` Last row drops its bottom border.

### 7.3 `.col-card` (per-column assumption card)

- Standalone card with `padding: 16px 18px; margin-bottom: 10px;` — same surface/border/radius-lg as `.card`.
- Inner `.col-head` is a baseline-aligned row with `margin-bottom: 8px`.
- `.col-name` is a mono chip on `--accent-soft` (`padding: 2px 8px; border-radius: 5px; color: var(--accent-ink);`).
- `.col-type` is an uppercase muted label.
- `.assumption` rows are separated by `1px dashed var(--border)` (first row has no border). Each row: `padding: 8px 0; gap: 10px;` with a `·` bullet (`.a-bullet`) and a flex-1 textarea (`.assumption-edit`).
- Hover on `.assumption` reveals `.assumption-actions` (opacity 0 → 1) via a `.15s` transition.

### 7.4 Specialised card content

- **Table preview** uses `.table-wrap` to wrap a `<table class="preview">` in card chrome (`border + radius`). See §11.
- **Plan rows** (`.plan-row`) live inside a `.card` and use a 4-column grid `24px 1fr auto auto`. The best row has `.plan-row.best` → `background: var(--accent-soft)`.
- **Spec fields** (`.spec-field`) stack inside a `.card`, separated by `1px solid var(--border)`; last drops the border.

---

## 8. Forms

All form controls inherit family/size/color from the parent (`input, textarea, select { font-family: inherit; font-size: inherit; color: inherit; }`).

### 8.1 Composer textarea (chat)

- Lives inside `.composer-box` (`background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; padding: 10px 10px 8px 12px;`).
- Border transitions on focus-within: `border-color: var(--accent)`.
- `<textarea>` itself is borderless, no outline, `resize: none`, `min-height: 40px; max-height: 140px; font-size: 13.5px; line-height: 1.5;`.
- Below the textarea: `.composer-row` holds left-side tools (paperclip icon button) and the send button (primary when there is a draft).

### 8.2 Inline assumption textareas (`.assumption-edit`)

- Fully transparent, no border, no outline, no resize. `font-size: 13px; line-height: 1.55; padding: 0;`. Auto-grows on input via `e.target.scrollHeight` in `stages.jsx` (`StageDomain`).

### 8.3 Spec field textareas (`.spec-value`)

- Transparent at rest with a transparent 1px border so the layout doesn't shift on hover/focus.
- Hover → `border-color: var(--border); background: var(--bg-elev);`.
- Focus → `border-color: var(--accent); background: var(--surface);` (and `outline: none`).
- Padding `6px 8px` with negative margin `-6px -8px` so the focus chrome appears to grow outside the label, without reflowing siblings.
- Auto-grows via `AutoTextarea` helper in `stages.jsx`.

### 8.4 Node inputs (`.node-input input`)

- `background: var(--bg-elev); border: 1px solid var(--border); border-radius: 5px; padding: 4px 6px; font-size: 12.5px;`
- `font-variant-numeric: tabular-nums; outline: none;`
- Focus → `border-color: var(--accent)`.

### 8.5 Inline `<select>` (used in flowchart inputs & expected output)

- Inline-styled to match `.node-input input`:
  `width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 5px; padding: 4px 6px; font-size: 12.5px;`

### 8.6 Dropzone

- `border: 1.5px dashed var(--border-strong); border-radius: var(--radius-lg); background: var(--surface); padding: 40px; text-align: center; cursor: pointer;`
- Hover → `background: var(--bg-elev); border-color: var(--accent);`
- Variant `.dropzone.uploaded` switches to solid border, `padding: 18px 22px;` and left-aligns.

### 8.7 Tweaks-panel fields (`.twk-field`, `.twk-slider`, `.twk-seg`, `.twk-toggle`, `.twk-num`, `.twk-swatch`, `.twk-btn`)

Live in `tweaks-panel.jsx` only. They use translucent white surfaces over a backdrop-filter glass panel and are independent of the main token set. Do not port them into the app; they are for the floating dev-only Tweaks shell.

---

## 9. Chat UI

### 9.1 Panel layout

- `<aside class="panel">` (uses the shared `.panel` chrome: `--bg-elev` background, right border, flex column).
- `.panel-header` (`14px 18px`, bottom border) shows the brand-mark (24×24 in the chat header instead of the topbar's 22×22), "Assistant" title (13.5px / 600), "Stage N of 5" sub-label (small + muted), and a right-aligned ghost icon-button (refresh).
- `.panel-body` scrolls; auto-scrolls to bottom on new messages or streaming updates (see `chat.jsx`).

### 9.2 Feed

- `.chat-feed { padding: 18px; display: flex; flex-direction: column; gap: 18px; }`
- Each message `.msg` is a flex column with `gap: 6px` and two children: `.msg-meta` + `.msg-bubble`.
- `.msg-meta` (11px, `--text-3`) shows the speaker label (assistant shows the brand name "GLAMLI" in `--text` weight 600; user shows "You") then a `·` separator and a timestamp.

### 9.3 Bubbles

- **Assistant** (default `.msg-bubble`): `--surface` background, `1px solid var(--border)`, `padding: 12px 14px`, `border-radius: var(--radius)` (10px), `font-size: 13.5px; line-height: 1.6;`.
  - `<strong>` → `--text`, weight 600.
  - Inline `code`/`.ref` → mono 12px, `--accent-ink` on `--surface-2`, `padding: 1px 6px; border-radius: 4px;`.
  - Paragraphs separated by 8px bottom margin (last paragraph margin 0).
- **User** (`.msg.user .msg-bubble`): no background, no border, no padding, `--text-2`, italic. Meta colour `--text-3`.

### 9.4 Typing indicator

`.typing-dot` — 5×5 grey dots in a row, separated by 3px right-margin, animated by `@keyframes blink` (`opacity 0.25 → 1 → 0.25`, 1.2s loop, dots staggered by 0.15s and 0.30s).

When the assistant message is empty and `streaming` is true, render three `.typing-dot`s inside the bubble. After the first chunk, the dots are replaced by the streaming text.

### 9.5 Composer

- `.composer` strip — `padding: 12px 14px; border-top: 1px solid var(--border); background: var(--bg-elev);`
- `.composer-box` — see §8.1.
- Below the box, a `.row.small.muted` shows hints: `Press <span class="kbd">Enter</span> to send` on the left, `Synced with workflow` on the right, with `margin-top: 8px` and `padding: 0 4px`.
- Send button: `.btn .btn-icon .btn-sm`. When `draft.trim()` is truthy, also apply `.btn-primary` (so it fills with accent). Always carries an arrow-up icon (size 14).

---

## 10. Flowchart UI

### 10.1 Canvas

- `.flow-canvas` — dotted-grid background:
  `background: radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 1px) 0 0/22px 22px, var(--bg);`
- `overflow: hidden`, flex-grows to fill its panel.
- An absolutely-positioned `<svg class="flow-svg">` covers the canvas for arrow paths (`pointer-events: none`, `overflow: visible`).

### 10.2 Case tabs (above the canvas)

- `.case-tabs` strip — `padding: 8px 14px; background: var(--bg-elev); border-bottom: 1px solid var(--border); gap: 4px; overflow-x: auto;`
- `.case-tab` — `1px solid var(--border)` rounded 7px chip, `--surface` background, 12px text, `--text-2` colour, `padding: 5px 10px`.
- `.case-tab.active` → flipped: `background: var(--text); color: var(--bg-elev); border-color: transparent;` (i.e. dark pill).
- `.case-tab.add` → `border-style: dashed; color: var(--text-3); background: transparent;`

### 10.3 Nodes (`.node`)

- Default: `position: absolute; width: 152px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; box-shadow: var(--shadow-sm); font-size: 12px; cursor: grab; user-select: none;`
- Active grab cursor on press.
- `.node-label` — header strip inside the node: uppercase 10.5px / 600, `--text-3`, with a tiny right-side index (e.g. `F1`).
- `.node-name` — mono 11.5px / 500, `--accent-ink`.
- `.node-value` — sans 13px / 500, `--text`, tabular-nums.
- `.node-handle` — 8×8 circle on the side: `--surface` fill, `1.5px solid var(--border-strong)`, `top: 50%; transform: translateY(-50%);`. Variants `.left { left: -5px; }` and `.right { right: -5px; }`.

### 10.4 Node variants

- **Input node** (`.node-input`) — contains label + name + `<input type="number">` or `<select>` (see §8.4–8.5). Right handle only (paths flow outwards).
- **Model node** (`.node.model`) — `width: 168px; text-align: center; border: 1.5px solid var(--border-strong);`. Has both left + right handles.
  - `.node.model.lit` — `border-color: var(--accent); background: var(--accent-soft);`. The node-name colour switches to `--accent-ink`.
- **Output node** (`.node.output`) — `background: var(--bg-elev);`. Left handle only.
  - `.node.output.predicted` — `background: var(--accent-soft); border-color: var(--accent);` (the appearance state after "Test it Out!").

### 10.5 Edges

- Cubic-Bezier paths drawn in SVG, with midpoint control points (`dx = (to.x - from.x) * 0.5`).
- Default stroke: `var(--border-strong)`, width `1.4`, arrowhead marker `#arrow-default` (filled `var(--border-strong)`).
- Predicted-edge stroke: `var(--accent)`, width `1.8`, marker `#arrow-accent`.
- Endpoints are trimmed `ARROW_OFFSET = 6` short of the target so the arrowhead sits cleanly.

### 10.6 Column headers (above each node column)

Plain absolute-positioned divs sitting at `top: 20` of the canvas: 11px uppercase, letter-spacing `.1em`, `--text-3`, weight 600, centred within the column width.

### 10.7 Canvas geometry (current layout)

- Canvas inner width: `820px`, centred (`margin: 24px auto`).
- Inputs column at `x = 60`, width 200.
- Model column at `x = 320`, width 180.
- Outputs column at `x = 580`, width 180.
- Input nodes step vertically by `110px` from `y = 60`.
- Model centred against the inputs block; Expected sits 90px above the model centreline, Predicted 90px below.

### 10.8 Canvas footer strip (below the canvas)

`12px 16px` strip with `border-top: 1px solid var(--border); background: var(--bg-elev);`. Shows a status line — green tick when prediction matches expectation (`color: var(--good)`) or warn-coloured caution (`color: var(--warn)`) when they differ. A ghost trash icon-button appears on the right when more than one case exists.

---

## 11. Stages UI

### 11.1 Workflow rail (top of the Pipeline view)

- `.workflow-rail` — `display: flex; gap: 4px; padding: 12px 18px; border-bottom: 1px solid var(--border); overflow-x: auto;`
- `.rail-item` — pill button: `padding: 6px 10px; border-radius: 8px; font-size: 12.5px; color: var(--text-2); background: transparent; border: 1px solid transparent;`
  - Hover (not disabled) → `background: var(--surface-2)`.
  - Disabled → `opacity: .45; cursor: not-allowed`.
  - `.rail-item.active` → `background: var(--surface); border-color: var(--border); color: var(--text); font-weight: 500;`
  - `.rail-item.complete` flips the `.rail-num` to sage-filled.
- `.rail-num` — 20×20 circle: `--surface` background, `1px solid var(--border-strong)`, 11px / 600 number. Active → text-coloured chip (`background: var(--text); color: var(--bg-elev);`). Complete → accent fill with light glyph.

### 11.2 Stage layout

- `.workflow-body` — `padding: 28px 36px 60px; max-width: 760px; margin: 0 auto;`
- Each stage opens with a vertical block:
  1. `.stage-eyebrow` (e.g. "Stage 3 of 5") — uppercase 11.5px / 600, `--text-3`, letter-spacing `.1em`.
  2. `h1.stage-title` — serif 32px / 500, `line-height: 1.15; letter-spacing: -.015em; margin: 6px 0;`.
  3. `.stage-lede` — 15px, `--text-2`, max-width `60ch`, `margin: 0 0 24px; text-wrap: pretty;`.

### 11.3 Stage-specific patterns

- **Stage 1 — Upload.** Empty: dropzone (see §8.6) with a database icon (`size 28`) in `--text-3`, "Drop a CSV file here" 15px / 500, sub-line (small + muted), and a `.btn-sm` "Use sample · …" CTA. Uploaded: a `.card` whose first `.card-row` has an accent-soft 36×36 icon tile (`borderRadius: 8`) holding a document icon and metadata; a `.pill.good` "Parsed" badge on the right; a card-pad section with `border-top` + `--bg-elev` background showing "What I see" eyebrow + blurb. Below the card: an uppercase muted "First 10 rows" caption, then a `.table-wrap` table.
- **Stage 2 — Domain.** A list of `.col-card`s, each with `.col-head` (mono name chip + uppercase type + ghost `.btn-sm + Add`), and `.assumption` rows (bullet + auto-grow textarea + hover trash). Footer row: ghost "Add a missing column" on the left, primary "Continue to test cases" on the right.
- **Stage 3 — Tests.** Two cards: a `card-pad` progress card with title + "Minimum N required" sub + a `have / min` mono counter (18px / 500) + a `.progress-track`/`.progress-fill`; and a list card whose `card-pad` header says "Your cases so far" + a hint "Edit on the flowchart →", with each case rendered as a `.card-row` (case name + mono summary line, right-side "expected → pill"). Footer: "Open canvas" btn + primary "Continue to review" (disabled until min reached).
- **Stage 4 — Review.** Single `.card` containing five `.spec-field` blocks (`.spec-label` + `.spec-value` auto-growing textarea). Footer: ghost "Regenerate from scratch" + primary "Confirm & run AutoML".
- **Stage 5 — Run.** Tabs row (`.tabs` + `.tab` + `.tab.active`). Running state in Overview: `.loading-stage` (40px 20px, centred) with a `.loader` (56×56 circular accent-top border, 1s `spin`) + "Running… N%" muted line + a `.card-pad` with a sequence of `.status-line` rows (idle, active highlighted in `--accent-soft`/`--accent-ink`, done in `--text`). Done state: 56×56 circular `--accent-soft` badge with a sage check (`Icon name="check" size={26}`), "Best model" line, F1 metric + "trained in 12s" sub-line, and an oversized primary CTA (`height: 44; padding: 0 22px; fontSize: 15; borderRadius: 10`). Advanced tab: a `.card` with "Model leaderboard" header + `.plan-row`s (best row tinted `--accent-soft`) — with `.skel` placeholders while training; and a second `.card` listing the data-prep plan (13px / 1.7 line-height, mono inline keys). When done, an aligned-right `.btn-sm` "Download source code".

### 11.4 View toggle (Pipeline / Canvas)

- `.view-toggle` — inline-flex on `--surface-2` background, `border-radius: 8px; padding: 3px; gap: 2px;`.
- Inner buttons — borderless, 5×14 padding, 12.5px / 500, `--text-2`. `.active` → `--surface` background, `--text` colour, `--shadow-sm`.
- Sits inside `.view-header` (48px tall strip below the topbar) centred, with a right-aligned absolute meta line (`.view-header-meta`: 12px, `--text-3`, e.g. "Stage 3 of 5").

### 11.5 Tabs (used in Stage 5)

- `.tabs` — `display: flex; gap: 2px; border-bottom: 1px solid var(--border);`
- `.tab` — borderless, `padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--text-2); border-bottom: 2px solid transparent; margin-bottom: -1px;` (overlaps the row's border)
- `.tab.active` → `color: var(--text); border-bottom-color: var(--accent);`

### 11.6 Pills, status lines, plan rows, skeletons, progress

- **Pill** — see §1.4 + style block. Use `.pill.good` for accent-soft positives. `.pill-dot` is a 6×6 dot using `currentColor`.
- **Status line** — `.status-line` 8×14 padding, 8px radius, 13px, gap 10. Variants `.done` (`--text`), `.active` (`--accent-soft` bg + `--accent-ink` text). Lead with a `.status-icon` (16px wide) holding a check, typing-dot, or open circle depending on state.
- **Plan row** — see §7.4.
- **Skeleton** — `.skel`: animated linear gradient `--surface-2 → --bg-elev → --surface-2`, `background-size: 200% 100%`, 5px radius, 1.6s `skel` keyframe.
- **Progress** — `.progress-track` (4px tall, `--surface-2` track, `2px` radius) + `.progress-fill` (`--accent` fill, `transition: width .4s ease`).

### 11.7 Top bar

- `.topbar` — 48px tall, padded `0 18px`, `--bg-elev` background, bottom border. Holds `.brand` on the left (22×22 sage square `.brand-mark` with a serif glyph, then "GLAMLI" in 600, then a muted "· building <code>customer_churn</code>") and `.topbar-meta` on the right (12.5px, `--text-2`, items separated by `·`).

---

## 12. Tweak panel UI

The Tweaks panel is the floating dev shell from `tweaks-panel.jsx`. It is **opt-in** (only opens when the design-tool host posts `__activate_edit_mode`) and uses its own self-contained stylesheet (the `__TWEAKS_STYLE` string).

### 12.1 Visual identity

- Position: `fixed; right: 16px; bottom: 16px;` Clamps to viewport via `ResizeObserver` and is draggable by the header.
- Surface: warm-glass — `background: rgba(250,249,247,.78); backdrop-filter: blur(24px) saturate(160%); border: .5px solid rgba(255,255,255,.6); border-radius: 14px;`
- Shadow: `0 1px 0 rgba(255,255,255,.5) inset, 0 12px 40px rgba(0,0,0,.18)`
- Width: `280px`, `max-height: calc(100vh - 32px)`.
- Typography: `font: 11.5px/1.4 ui-sans-serif, system-ui, …` — distinct from the app's Inter, so the panel reads as a tool, not as part of the app.
- Title bar: `b` 12px / 600 with a 22×22 ✕ button (`.twk-x`) that posts `__edit_mode_dismissed` on click.
- Body: scroll-able, `padding: 2px 14px 14px`, `gap: 10px`, custom scrollbar 8px.

### 12.2 Controls in the shell

(all use the `.twk-*` namespace; none of these should leak into the main app's class set)

- `TweakSection` — uppercase section header (`.twk-sect`, 10px / 600, letter-spacing `.06em`).
- `TweakRow` — label/value row (`.twk-row` column, or `.twk-row.twk-row-h` horizontal).
- `TweakSlider` — `<input type="range">` with `.twk-slider` styling (4px track, 14px circular thumb).
- `TweakRadio` — segmented control: `.twk-seg` with `.twk-seg-thumb` that translates via percentage math; supports pointer drag.
- `TweakToggle` — 32×18 pill switch with a 14×14 white nub; on-state colour `#34c759`.
- `TweakSelect` — `<select.twk-field>` with custom caret SVG background.
- `TweakNumber` — `.twk-num` row with a draggable label scrubber and a right-aligned tabular-nums input.
- `TweakColor` — native colour input styled as a 56×22 swatch.
- `TweakButton` — `.twk-btn` (dark filled, 26px high, 7px radius) with `.secondary` (light) variant.

### 12.3 Used tweaks in this prototype

`app.jsx` registers the following groups:

- **Appearance** — Theme (`light`/`dark` radio), Density (`comfortable`/`compact` radio), Accent (`sage`/`clay`/`slate`/`plum` select).
- **Demo controls** — "Restart from Stage 1" button, "Jump to AutoML run" button.

The radios drive `[data-theme]` / `[data-density]`; the select swaps three custom-property values on `:root` directly from JS.

---

## 13. Utility classes

| Class       | Definition                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| `.row`      | `display: flex; gap: 8px; align-items: center;`                             |
| `.col`      | `display: flex; flex-direction: column;`                                    |
| `.grow`     | `flex: 1;`                                                                  |
| `.muted`    | `color: var(--text-2);`                                                     |
| `.small`    | `font-size: 12px;`                                                          |
| `.mono`     | `font-family: var(--font-mono);`                                            |
| `.divider`  | `height: 1px; background: var(--border); margin: 16px 0;`                   |
| `.kbd`      | inline mono 11px chip on `--surface` with a 2px-bottom border-strong outline (`border-radius: 4px`). |

Scrollbar (WebKit): 10px width/height; thumb is `--border-strong` with a 2px inset of `--bg-elev`, hover thumb darkens to `--text-3`.

---

## 14. Motion / animations

| Name        | Where                                | Definition                                                  |
| ----------- | ------------------------------------ | ----------------------------------------------------------- |
| `blink`     | `.typing-dot`                        | 1.2s infinite ease-in-out; `0%, 80%, 100% → .25` / `40% → 1` opacity |
| `skel`      | `.skel`                              | 1.6s linear infinite; `background-position: 200% 0 → -200% 0` |
| `spin`      | `.loader`                            | 1s linear infinite; `transform: rotate(360deg)` (border-top: `--accent`) |
| Transitions | `.btn` (`.15s` background + border-color); `.composer-box` (`.15s` border-color); `.dropzone` (`.15s` background + border-color); `.assumption-actions` (`.15s` opacity); `.progress-fill` (`.4s` width ease) |

Chat streaming (in `app.jsx`): assistant messages append 3 characters every 18ms via `setInterval`.

---

## 15. Implementation rules for the rebuild

1. **The handoff files in the project root are the visual source of truth.** When the rebuild diverges from what those files render, the handoff wins. Do not paraphrase the tokens or substitute "close" colours.
2. **Tokens before classes.** Every colour, font, radius, shadow, and pad in the rebuild must come from the tokens defined in `src/styles/globals.css`. If a value isn't in the tokens or in this doc, it isn't part of the system.
3. **Class names match the handoff.** Where the handoff defines a named class (`.btn-primary`, `.col-card`, `.flow-canvas`, …), reuse the same name in the rebuild so designers can find styles by Cmd-F across both codebases.
4. **Density and accent are data-attributes on `<html>`**, set by JS that owns the Tweaks panel. CSS only reads them.
5. **`.btn-primary` text colour is the literal `#fbf9f4`**, not `--bg-elev`. It must remain readable on the accent even when the user switches accents.
6. **Light surfaces never lift with neutral black shadows.** Use `--shadow-sm` / `--shadow-md`. The Tweaks glass panel is the only exception and uses its own internal shadow tokens.
7. **The dotted-grid canvas is mandatory** — the flowchart background must keep the 22px radial-gradient dot pattern from §10.1.
8. **Number columns are tabular-nums.** Tables, plan scores, node values, and node inputs all opt in.
9. **The serif is used sparingly** — only `h1.stage-title` and the `.brand-mark` glyph. Body, panel titles, and meta stay sans.
10. **No styles outside the handoff.** If you find yourself adding shadows, gradients, or extra colour ramps, stop and check the handoff first.
