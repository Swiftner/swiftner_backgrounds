# Swiftner Backgrounds

Nine animated canvas backgrounds (`dusk`, `aurora`, `mist` · `tide`, `crest`, `drift` · `nebula`, `vapor`, `haze`) reconstructed from Adobe Illustrator exports. Three techniques — drifting circle stacks, layered wavy ribbons, blurred color mesh — in three palette variants each.

**Live demo:** [swiftner.github.io/swiftner_backgrounds](https://swiftner.github.io/swiftner_backgrounds/)

## Use it

**One-line embed (script tag):**

```html
<script src="https://unpkg.com/@swiftner/backgrounds/dist/embed.min.js" defer></script>

<section data-swiftner-bg="nebula">
  <h1>Any element with the attribute gets an animated background.</h1>
</section>
```

Pin a version for production (`@swiftner/backgrounds@0.1.0/dist/embed.min.js`) — unversioned URLs auto-update and can break on publish.

The script auto-scans for `[data-swiftner-bg]` on DOM ready and on later mutations. Optional per-element knobs: `data-swiftner-fps="30"`, `data-swiftner-dpr="2"`.

**As an npm package (pay only for what you import):**

```js
import { mount } from '@swiftner/backgrounds';
import nebula   from '@swiftner/backgrounds/nebula';

mount('.hero', nebula);                    // by selector
mount(document.body, nebula, { fps: 30 }); // or element + options
```

Per-asset subpaths (`/dusk`, `/tide`, `/nebula`, etc.) tree-shake to just that asset's renderer + data. Importing the full `index` pulls all nine.

## Defaults

`mount()` is tuned for ambient backgrounds:

| option | default | why |
|---|---|---|
| `fps` | `15` | wobble is slow — 60fps is wasted CPU |
| `dpr` | `1` | ambient bg doesn't need retina; big CPU win |

`mount()` returns `{ canvas, stop() }`. It pauses the loop on `visibilitychange` when the tab is hidden, and always honours `prefers-reduced-motion` (one static frame, no rAF scheduled).

## Repo layout

```
src/
  renderers/      blob.js, wave.js, mesh.js           — factories: create<Fam>(data) → (ctx, W, H, t) => void
  data/           blob1..3.js, wave1..3.js, mesh1..3.js — per-asset data modules (generated)
  assets/         dusk..haze.js + index.js barrel     — 9 presets { bg, render }
  core.js         mount(target, preset, options)
  index.js        public ESM — mount + all 9 assets
  embed.js        IIFE — auto-attach to [data-swiftner-bg]

scripts/
  extract.js        originals/*.svg → src/data/*.js (single build step, no intermediate JSON)
  generate-pages.js src/ → generated/*.html (9 showcase pages with Compare + Download)
  build-embed.js    src/embed.js → dist/embed.min.js (esbuild, IIFE)

originals/        raw Adobe SVGs (reference / Compare panel)
dist/             built embed bundle (checked in on release)
generated/        standalone showcase pages
```

## Build

```sh
npm install                # once, for esbuild
npm run extract            # originals/ → src/data/*.js  (re-run if originals/ changes)
npm run pages              # src/ → generated/*.html
npm run build              # src/ → dist/embed.min.js
```

## Data format notes

- **Blob:** each palette sampled as ~200–700 circles, fitted to a shared cubic bezier trajectory + per-circle residual. Animation jitters the 4 bezier control points; every stop's screen position = `bezier(t, jittered) + residual`.
- **Wave:** 400 sampled paths per variant, packed as a base64 binary blob (absolute-coord ops: `M`/`L`/`C`/`Z` with `i16 × 0.1` coords). Decoded once per instance into `Path2D`. 2× smaller than the raw path strings, pixel-identical within 0.05 units.
- **Mesh:** 32×32 RGB hex grid, upscaled through a blurred mid-res canvas to kill polygon banding from single-pass bilinear.

## Stack

Pure vanilla canvas + ES modules. No framework, no runtime dependencies. esbuild as a build-time devDep for the embed bundle.
