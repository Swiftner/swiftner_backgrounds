# swiftner_backgrounds

Brand-asset SVGs for [swiftner.com](https://swiftner.com), reconstructed as lightweight animated canvas generators.

- **9 assets** — three families (`Blob`, `Wave`, `Mesh`), each in three palette variants (`deep`, `mid`, `light`).
- **Full-bleed animated canvases** in `generated/` — each is a standalone HTML page with its own JS generator, no dependencies.
- **Originals preserved** in `originals/` — the raw Adobe Illustrator exports.
- **Cleaned SVGs** at the project root — svgo-optimized, visually identical to the originals.

## Live

[GitHub Pages site](https://swiftner.github.io/swiftner_backgrounds/) — click any tile to open its animated generator.

## Build

```sh
node extract.mjs      # sample circle coords / path data / mesh grids from originals/
node generate.mjs     # emit the 9 animated HTML pages into generated/
```

Re-run `generate.mjs` after editing presets.

## Layout

| file | what |
|---|---|
| `index.html` | tile grid, links to each generator |
| `generated/*.html` | self-contained canvas generators (one per asset) |
| `originals/*.svg` | raw Adobe exports |
| `*.svg` (root) | svgo-cleaned versions used as thumbnails |
| `extract.mjs` | parses originals/ into `extracted.json` |
| `generate.mjs` | renders `extracted.json` into `generated/*.html` |

Each generator page has:
- full-viewport canvas
- size selector + **Download PNG** button (720 / 1080 / 1440 / 2160 / 4096)
- **Compare** toggle that slides in the original SVG from the right
