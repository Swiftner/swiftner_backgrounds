# Swiftner Backgrounds

Animated canvas brand backgrounds for [swiftner.com](https://swiftner.com).

**Live:** [swiftner.github.io/swiftner_backgrounds](https://swiftner.github.io/swiftner_backgrounds/)

Nine brand assets reconstructed from their Adobe Illustrator exports as self-contained, animated canvas generators — each page is a single HTML file with inline JS, no build step at runtime, no dependencies.

## What's here

- **`generated/`** — 9 standalone HTML pages, one per asset. Each:
  - Full-viewport `<canvas>` animating via `requestAnimationFrame`
  - `Download PNG` (captures the live canvas at its current pixel size)
  - `Compare` toggle that slides in the original SVG for side-by-side reference
  - Swiftner-themed controls (DM Mono pills, `#4E169C` purple)
- **`originals/`** — the raw Adobe exports (kept for reference / the Compare panel)
- **`*.svg`** at repo root — svgo-cleaned thumbnails used in the index grid
- **`index.html`** — tile grid linking to each generator (Playfair Display title, olive/navy palette)

## Asset families

Three techniques, three palette variants each:

| family | technique | palette variants |
|---|---|---|
| **Blob** | Adobe-style giant-circle stack along an animated cubic Bezier trajectory | deep · mid · light |
| **Wave** | 400 wavy Adobe paths stacked; whole set drifts with translate + rotate + scale wobble | deep · mid · light |
| **Mesh** | 32×32 color grid sampled from the PNG, bilinearly upscaled with blur; UV pans | deep · mid · light |

Palettes derived from `swiftner.com` CSS — navy `#13194a`, purple `#4E169C` / `#8447FF`, olive `#ffffe8`.

## Build

```sh
node extract.mjs      # sample circle coords / path data / mesh grids from originals/
node generate.mjs     # emit the 9 animated HTML pages into generated/
```

Re-run `generate.mjs` after editing presets in the script. Re-run `extract.mjs` if `originals/` changes.

## Repo layout

```
├── index.html              # tile grid
├── generated/              # 9 animated canvas pages
├── originals/              # raw Adobe SVGs
├── *.svg                   # svgo-cleaned thumbnails
├── extract.mjs             # originals/ → extracted.json
├── generate.mjs            # extracted.json → generated/*.html
├── extracted.json          # checked in; saves setup for anyone cloning
└── svgo.config.js          # config used to clean the thumbnails
```

## Stack

Pure vanilla canvas + ES modules. DM Sans / DM Mono / Playfair Display via Google Fonts. No framework, no bundler, no runtime dependencies.
