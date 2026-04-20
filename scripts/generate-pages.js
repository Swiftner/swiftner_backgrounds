#!/usr/bin/env node
// Emit 9 self-contained HTML pages from src/. Each page inlines mount() +
// the renderer factory + (optionally) decodeWaves, then instantiates a preset
// and calls mount(document.body, preset). Single source of truth: src/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { mount } from '../src/core.js';
import { createBlob } from '../src/renderers/blob.js';
import { createWave, decodeWaves } from '../src/renderers/wave.js';
import { createMesh } from '../src/renderers/mesh.js';

import blob1 from '../src/data/blob1.js';
import blob2 from '../src/data/blob2.js';
import blob3 from '../src/data/blob3.js';
import wave1 from '../src/data/wave1.js';
import wave2 from '../src/data/wave2.js';
import wave3 from '../src/data/wave3.js';
import mesh1 from '../src/data/mesh1.js';
import mesh2 from '../src/data/mesh2.js';
import mesh3 from '../src/data/mesh3.js';

// [src-stem, display-name, factory, data, extras-to-inline?]
const ASSETS = [
  ['Blob1', 'Dusk',   createBlob, blob1],
  ['Blob2', 'Aurora', createBlob, blob2],
  ['Blob3', 'Mist',   createBlob, blob3],
  ['Wave1', 'Tide',   createWave, wave1, [decodeWaves]],
  ['Wave2', 'Crest',  createWave, wave2, [decodeWaves]],
  ['Wave3', 'Drift',  createWave, wave3, [decodeWaves]],
  ['Mesh1', 'Nebula', createMesh, mesh1],
  ['Mesh2', 'Vapor',  createMesh, mesh2],
  ['Mesh3', 'Haze',   createMesh, mesh3],
];

function page(src, display, factory, data, extras = []) {
  const bg = data.bg;
  const extraSrc = extras.map(fn => fn.toString()).join('\n');
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap">
<style>
  html,body { margin:0; padding:0; width:100%; height:100%; background:${bg}; overflow:hidden;
              font-family:'DM Mono', ui-monospace, monospace; color:#111827; }

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
<aside class="peek" id="peek">
  <span class="chip">Original</span>
  <img src="../originals/${src}.svg" alt="${src} original">
</aside>
<div class="controls">
  <a href="../index.html">All assets</a>
  <button id="dl">Download PNG</button>
  <button id="cmp" class="toggle">Compare</button>
</div>
<script>
${mount.toString()}
${extraSrc}
${factory.toString()}
const data = ${JSON.stringify(data)};
const preset = { bg: '${bg}', render: ${factory.name}(data) };
const bg = mount(document.body, preset, { dpr: Math.min(devicePixelRatio || 1, 2) });

document.getElementById('cmp').onclick = (e) => {
  document.getElementById('peek').classList.toggle('show');
  e.currentTarget.classList.toggle('on');
};
document.getElementById('dl').onclick = () => {
  bg.canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '${display.toLowerCase()}-' + bg.canvas.width + 'x' + bg.canvas.height + '.png';
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
for (const [src, display, factory, data, extras] of ASSETS) {
  const html = page(src, display, factory, data, extras);
  writeFileSync(`generated/${src}.html`, html);
  console.log(`generated/${src}.html  ${Buffer.byteLength(html).toString().padStart(7)} bytes`);
}
