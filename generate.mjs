#!/usr/bin/env node
// Emit 9 standalone HTML pages, one per brand asset, each with its own
// canvas generator. Blob pages replay the real Adobe circle trajectory
// (extracted to extracted.json). Wave pages sweep a procedural wavy path
// using the real color sequence. Mesh pages use radial glows on a gradient.
//
// Run:  node extract.mjs     (once, to build extracted.json from originals/)
//       node generate.mjs    (emit the 9 HTML files)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('extracted.json', 'utf8'));

// BLOB: animate the cubic bezier that defines the circle trajectory.
// Each circle's position = bezier(t, animated control points) + baked residual.
// P0 and P3 (endpoints) get a small independent wobble; P1 and P2 (controls)
// get larger wobbles so the curve flexes rather than just translates.
const BLOB = ({ bezier, stops, bg, wobble }) => `
  const B = ${JSON.stringify(bezier)};
  const stops = ${JSON.stringify(stops)};
  ctx.fillStyle = '${bg}';
  ctx.fillRect(0, 0, W, H);
  // Scale strictly proportional to width. Content is a W-sized square, centered
  // vertically — vertical overflow is clipped, vertical slack gets bg colour.
  const S = W;
  const offX = 0;
  const offY = (H - S) / 2;
  const ph = t * ${wobble.speed};
  const p0x = B.P0.x + Math.sin(ph * 0.9 + 0.3) * ${wobble.endAmp};
  const p0y = B.P0.y + Math.cos(ph * 1.1 + 0.9) * ${wobble.endAmp};
  const p1x = B.P1.x + Math.sin(ph * 1.3 + 1.7) * ${wobble.ctrlAmp};
  const p1y = B.P1.y + Math.cos(ph * 1.0 + 2.3) * ${wobble.ctrlAmp};
  const p2x = B.P2.x + Math.sin(ph * 0.8 + 3.1) * ${wobble.ctrlAmp};
  const p2y = B.P2.y + Math.cos(ph * 1.4 + 4.2) * ${wobble.ctrlAmp};
  const p3x = B.P3.x + Math.sin(ph * 1.2 + 5.1) * ${wobble.endAmp};
  const p3y = B.P3.y + Math.cos(ph * 0.7 + 0.2) * ${wobble.endAmp};
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const u = s.t, mu = 1 - u;
    const bx = mu*mu*mu*p0x + 3*mu*mu*u*p1x + 3*mu*u*u*p2x + u*u*u*p3x;
    const by = mu*mu*mu*p0y + 3*mu*mu*u*p1y + 3*mu*u*u*p2y + u*u*u*p3y;
    ctx.fillStyle = s.fill;
    ctx.beginPath();
    ctx.arc(offX + (bx + s.dx) * S, offY + (by + s.dy) * S, s.r * S, 0, Math.PI * 2);
    ctx.fill();
  }
`;

// WAVE: replay the real wavy path data from Adobe's 1000 stacked paths.
// Animation: translate + scale + rotate wobble — enough to read as motion at
// full viewport size without breaking the wave silhouette.
const WAVE = ({ paths, bg, drift }) => `
  const paths = ${JSON.stringify(paths)};
  ctx.fillStyle = '${bg}';
  ctx.fillRect(0, 0, W, H);
  const phase = t * ${drift};
  ctx.save();
  // Scale strictly proportional to width.
  const S = W / 720;
  const tx = Math.sin(phase) * 40 * S;
  const ty = Math.cos(phase * 1.3) * 24 * S;
  const rot = Math.sin(phase * 0.7) * 0.02;
  const scl = 1 + Math.sin(phase * 0.9) * 0.015;
  ctx.translate(W / 2 + tx, H / 2 + ty);
  ctx.rotate(rot);
  ctx.scale(S * scl, S * scl);
  ctx.translate(-360, -360);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const path = new Path2D(p.d);
    ctx.fillStyle = p.fill;
    ctx.fill(path);
  }
  ctx.restore();
`;

// MESH: render an NxN color grid onto a tiny offscreen canvas, then drawImage
// through an intermediate mid-res canvas with smoothing at each step, plus a
// final blur filter. That kills polygon banding from single-pass bilinear.
const MESH = ({ grid, size, bg }) => {
  const cells = [...grid].sort((a, b) =>
    Math.round(a.y * (size - 1)) - Math.round(b.y * (size - 1)) ||
    Math.round(a.x * (size - 1)) - Math.round(b.x * (size - 1))
  );
  const flat = cells.map(c => c.c);
  return `
  const cells = ${JSON.stringify(flat)};
  const GRID = ${size};
  // Solid bg first — guarantees no transparent borders after the blur below.
  ctx.fillStyle = '${bg}';
  ctx.fillRect(0, 0, W, H);
  // Source canvas: the raw GRIDxGRID pixel grid.
  if (!window._off) {
    window._off = document.createElement('canvas');
    window._off.width = GRID; window._off.height = GRID;
    const octx = window._off.getContext('2d');
    const id = octx.createImageData(GRID, GRID);
    for (let i = 0; i < cells.length; i++) {
      const n = parseInt(cells[i].slice(1), 16);
      id.data[i * 4    ] = (n >> 16) & 255;
      id.data[i * 4 + 1] = (n >> 8) & 255;
      id.data[i * 4 + 2] = n & 255;
      id.data[i * 4 + 3] = 255;
    }
    octx.putImageData(id, 0, 0);
    window._mid = document.createElement('canvas');
  }
  // Mid canvas scales with render size so both screen and download paths look the same.
  const midSide = Math.min(1024, Math.max(W, H) / 2);
  if (window._mid.width !== midSide) {
    window._mid.width = window._mid.height = midSide;
  }
  const mctx = window._mid.getContext('2d');
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = 'high';
  // UV drift: pan a slightly smaller sub-window of the source grid.
  const phase = t * 0.00035;
  const amp = 4;
  const dx = Math.sin(phase) * amp;
  const dy = Math.cos(phase * 1.27) * amp;
  const win = GRID - amp * 2;
  // Apply blur on the mid canvas so the final drawImage has clean non-feathered edges.
  mctx.filter = 'blur(' + midSide * 0.01 + 'px)';
  mctx.drawImage(window._off, amp + dx, amp + dy, win, win,
                 0, 0, midSide, midSide);
  mctx.filter = 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Crop the middle 70% of the mid canvas and stretch to fill. Cuts off the
  // dark/solid edge pixels from the original sample so the canvas fills with
  // rich mesh content edge-to-edge.
  const crop = midSide * 0.15;
  ctx.drawImage(window._mid, crop, crop, midSide - crop * 2, midSide - crop * 2,
                0, 0, W, H);
`;
};

// Human-facing names per asset, used in page titles and download filenames.
const NAMES = {
  Blob1: 'Dusk',   Blob2: 'Aurora', Blob3: 'Mist',
  Wave1: 'Tide',   Wave2: 'Crest',  Wave3: 'Drift',
  Mesh1: 'Nebula', Mesh2: 'Vapor',  Mesh3: 'Haze',
};

// ---- per-asset presets ----
const PRESETS = {
  Blob1: { bg: data.Blob1.stops[0].fill, body: BLOB({
    bezier: data.Blob1.bezier, stops: data.Blob1.stops, bg: data.Blob1.stops[0].fill,
    wobble: { speed: 0.00030, endAmp: 0.04, ctrlAmp: 0.10 } }) },
  Blob2: { bg: data.Blob2.stops[0].fill, body: BLOB({
    bezier: data.Blob2.bezier, stops: data.Blob2.stops, bg: data.Blob2.stops[0].fill,
    wobble: { speed: 0.00025, endAmp: 0.04, ctrlAmp: 0.10 } }) },
  Blob3: { bg: data.Blob3.stops[0].fill, body: BLOB({
    bezier: data.Blob3.bezier, stops: data.Blob3.stops, bg: data.Blob3.stops[0].fill,
    wobble: { speed: 0.00028, endAmp: 0.04, ctrlAmp: 0.10 } }) },

  Wave1: { bg: data.Wave1.paths[0].fill, body: WAVE({ paths: data.Wave1.paths, bg: data.Wave1.paths[0].fill, drift: 0.00035 }) },
  Wave2: { bg: data.Wave2.paths[0].fill, body: WAVE({ paths: data.Wave2.paths, bg: data.Wave2.paths[0].fill, drift: 0.00040 }) },
  Wave3: { bg: data.Wave3.paths[0].fill, body: WAVE({ paths: data.Wave3.paths, bg: data.Wave3.paths[0].fill, drift: 0.00030 }) },

  Mesh1: { bg: '#13194a', body: MESH({ grid: data.Mesh1.grid, size: data.Mesh1.size, bg: '#13194a' }) },
  Mesh2: { bg: '#3d3385', body: MESH({ grid: data.Mesh2.grid, size: data.Mesh2.size, bg: '#3d3385' }) },
  Mesh3: { bg: '#bfaaff', body: MESH({ grid: data.Mesh3.grid, size: data.Mesh3.size, bg: '#bfaaff' }) },
};

function page(name, bg, body) {
  const display = NAMES[name] || name;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${display} — Swiftner</title>
<link rel="icon" type="image/png" sizes="96x96" href="../favicon-96x96.png">
<link rel="shortcut icon" href="../favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap">
<style>
  html,body { margin:0; padding:0; width:100%; height:100%; background:${bg}; overflow:hidden;
              font-family:'DM Mono', ui-monospace, monospace; color:#111827; }
  canvas { position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%; display:block; }

  .controls { position:fixed; top:18px; left:18px; z-index:3; display:flex; gap:8px; align-items:center; }
  .controls > * { font-family:'DM Mono', ui-monospace, monospace; font-size:11px; font-weight:500;
                  letter-spacing:.04em; text-transform:uppercase;
                  height:32px; border-radius:999px; border:0; cursor:pointer; transition:background .15s, color .15s; }
  .controls a { color:#fff; background:#4E169C; padding:0 14px; display:inline-flex; align-items:center; text-decoration:none; }
  .controls a:hover { background:#3d1280; }
  .controls button { color:#4E169C; background:#fff; padding:0 14px; border:1px solid rgba(78,22,156,.25); }
  .controls button:hover { background:#f5f1fb; }
  button.toggle.on { background:#4E169C; color:#fff; border-color:#4E169C; }

  .peek { position:fixed; top:0; right:0; bottom:0; width:40vw; background:${bg};
          transform:translateX(100%); transition:transform .25s ease; z-index:2;
          border-left:1px solid rgba(0,0,0,.15); }
  .peek.show { transform:translateX(0); }
  .peek img { width:100%; height:100%; object-fit:cover; display:block; }
  .peek .chip { position:absolute; top:18px; left:18px; letter-spacing:.04em; text-transform:uppercase;
                font-family:'DM Mono', ui-monospace, monospace; font-size:11px; font-weight:500;
                color:#fff; background:#4E169C; padding:8px 12px; border-radius:999px; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<aside class="peek" id="peek">
  <span class="chip">Original</span>
  <img src="../originals/${name}.svg" alt="${name} original">
</aside>
<div class="controls">
  <a href="../index.html">All assets</a>
  <button id="dl">Download PNG</button>
  <button id="cmp" class="toggle">Compare</button>
</div>
<script>
// Renderer: draws one frame of the generator into any 2d ctx at (W, H, t ms).
function render(ctx, W, H, t) {
  ${body.trim()}
}

const c = document.getElementById('c');
const ctx = c.getContext('2d');
const dpr = Math.min(devicePixelRatio || 1, 2);
let W = 0, H = 0;
function resize() {
  // Read the canvas element's actual rendered size rather than viewport — this
  // matches what the user sees when the canvas is position:fixed and fills the window.
  const rect = c.getBoundingClientRect();
  W = Math.round(rect.width * dpr);
  H = Math.round(rect.height * dpr);
  c.width = W; c.height = H;
}
resize();
addEventListener('resize', resize);

const start = performance.now();
function frame(now) {
  render(ctx, W, H, now - start);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.getElementById('cmp').onclick = (e) => {
  document.getElementById('peek').classList.toggle('show');
  e.currentTarget.classList.toggle('on');
};

// Download the live canvas as-is (matches whatever is on screen).
document.getElementById('dl').onclick = () => {
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '${display.toLowerCase()}-' + c.width + 'x' + c.height + '.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
};
</script>
</body>
</html>
`;
}

mkdirSync('generated', { recursive: true });
for (const [name, p] of Object.entries(PRESETS)) {
  const html = page(name, p.bg, p.body);
  writeFileSync(`generated/${name}.html`, html);
  console.log(`generated/${name}.html  ${Buffer.byteLength(html).toString().padStart(5)} bytes`);
}
