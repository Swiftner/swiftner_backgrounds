#!/usr/bin/env node
// originals/*.svg → src/data/*.js. The only build step that touches the
// raw Adobe exports; everything downstream imports from src/.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Animation rates baked into each data module — single source of truth for
// every consumer (standalone pages, embed, npm). Edit here, re-run.
const TUNING = {
  Blob1: { wobble: { speed: 0.000075,  endAmp: 0.04, ctrlAmp: 0.10 } },
  Blob2: { wobble: { speed: 0.0000625, endAmp: 0.04, ctrlAmp: 0.10 } },
  Blob3: { wobble: { speed: 0.00007,   endAmp: 0.04, ctrlAmp: 0.10 } },
  Wave1: { drift: 0.0000875 },
  Wave2: { drift: 0.00010   },
  Wave3: { drift: 0.000075  },
  Mesh1: { drift: 0.0000875, bg: '#13194a' },
  Mesh2: { drift: 0.0000875, bg: '#3d3385' },
  Mesh3: { drift: 0.0000875, bg: '#bfaaff' },
};

function parseStyles(src) {
  const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const map = {};
  if (!m) return map;
  const re = /\.(cls-\d+|st\d+)\s*\{\s*fill:\s*(#[0-9a-f]{6})/gi;
  let x; while ((x = re.exec(m[1]))) map[x[1]] = x[2].toLowerCase();
  return map;
}

function sample(arr, target) {
  if (arr.length <= target) return arr;
  const step = (arr.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => arr[Math.round(i * step)]);
}

// Blob: circle stack → cubic-bezier trajectory + per-circle residual.
function parseCircles(src, styles) {
  const out = [];
  const re = /<circle\b[^>]*\bclass="([^"]+)"[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"[^>]*\br="([^"]+)"/g;
  let m; while ((m = re.exec(src))) {
    out.push({ x: +m[2] / 720, y: +m[3] / 720, r: +m[4] / 720, fill: styles[m[1]] });
  }
  return out.filter(c => c.fill);
}

// Least-squares fit a cubic bezier to points; endpoints pinned to first/last.
function fitCubicBezier(pts) {
  const n = pts.length;
  const P0 = { x: pts[0].x, y: pts[0].y };
  const P3 = { x: pts[n - 1].x, y: pts[n - 1].y };
  let a11 = 0, a12 = 0, a22 = 0;
  let b1x = 0, b2x = 0, b1y = 0, b2y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), mt = 1 - t;
    const A = 3 * mt * mt * t, B = 3 * mt * t * t;
    const baseX = mt*mt*mt * P0.x + t*t*t * P3.x;
    const baseY = mt*mt*mt * P0.y + t*t*t * P3.y;
    const rx = pts[i].x - baseX, ry = pts[i].y - baseY;
    a11 += A * A; a12 += A * B; a22 += B * B;
    b1x += A * rx; b2x += B * rx;
    b1y += A * ry; b2y += B * ry;
  }
  const det = a11 * a22 - a12 * a12;
  return {
    P0, P3,
    P1: { x: (a22 * b1x - a12 * b2x) / det, y: (a22 * b1y - a12 * b2y) / det },
    P2: { x: (a11 * b2x - a12 * b1x) / det, y: (a11 * b2y - a12 * b1y) / det },
  };
}

function bezierAt(t, b) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*b.P0.x + 3*mt*mt*t*b.P1.x + 3*mt*t*t*b.P2.x + t*t*t*b.P3.x,
    y: mt*mt*mt*b.P0.y + 3*mt*mt*t*b.P1.y + 3*mt*t*t*b.P2.y + t*t*t*b.P3.y,
  };
}

function extractBlob(name) {
  const src = readFileSync(`originals/${name}.svg`, 'utf8');
  const styles = parseStyles(src);
  const circles = parseCircles(src, styles);
  const bezier = fitCubicBezier(circles);
  const stops = circles.map((c, i) => {
    const t = i / (circles.length - 1);
    const b = bezierAt(t, bezier);
    return { t, dx: c.x - b.x, dy: c.y - b.y, r: c.r, fill: c.fill };
  });
  return { bezier, stops, bg: circles[0].fill, ...TUNING[name] };
}

// Wave: 400 sampled paths → compact binary blob.
function parsePaths(src, styles) {
  const out = [];
  const re = /<path\b[^>]*\bclass="([^"]+)"[^>]*\bd="([^"]+)"/g;
  let m; while ((m = re.exec(src))) {
    if (styles[m[1]]) out.push({ fill: styles[m[1]], d: m[2] });
  }
  return out;
}

// Binary format: u16 pathCount; then per path: u8[3] rgb, u16 cmdCount, cmds.
// Opcodes (abs-coord, i16 × 10): 0=M(2), 1=L(2), 2=C(6), 3=Z(0). `s` expands
// to `C` via control-point reflection. Relative → absolute done at encode
// time so decoder never accumulates rounding error across many hops.
function encodeWaves(paths) {
  const bytes = [];
  const put8  = (n) => bytes.push(n & 0xff);
  const put16 = (n) => { bytes.push(n & 0xff, (n >> 8) & 0xff); };
  const putI  = (n) => put16(Math.round(n * 10));

  put16(paths.length);

  for (const p of paths) {
    const n = parseInt(p.fill.slice(1), 16);
    put8((n >> 16) & 255); put8((n >> 8) & 255); put8(n & 255);
    const cntIdx = bytes.length;
    put16(0);

    const tok = p.d.match(/[a-zA-Z]|-?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?/g);
    let i = 0;
    const num = () => parseFloat(tok[i++]);
    let cmd = '', cmds = 0;
    let cx = 0, cy = 0, sx = 0, sy = 0;
    let lc2x = 0, lc2y = 0, hadC = false;

    const M = (x, y) => { put8(0); putI(x); putI(y); cmds++; };
    const L = (x, y) => { put8(1); putI(x); putI(y); cmds++; };
    const C = (x1,y1,x2,y2,x,y) => { put8(2); putI(x1);putI(y1);putI(x2);putI(y2);putI(x);putI(y); cmds++; };
    const Z = () => { put8(3); cmds++; };

    while (i < tok.length) {
      const t = tok[i];
      if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
      switch (cmd) {
        case 'M': cx = num(); cy = num(); M(cx,cy); sx=cx; sy=cy; cmd='L'; hadC=false; break;
        case 'L': cx = num(); cy = num(); L(cx,cy); hadC=false; break;
        case 'l': cx += num(); cy += num(); L(cx,cy); hadC=false; break;
        case 'h': cx += num(); L(cx,cy); hadC=false; break;
        case 'v': cy += num(); L(cx,cy); hadC=false; break;
        case 'C': { const x1=num(),y1=num(),x2=num(),y2=num(),x=num(),y=num();
                    C(x1,y1,x2,y2,x,y); lc2x=x2; lc2y=y2; cx=x; cy=y; hadC=true; break; }
        case 'c': { const x1=cx+num(),y1=cy+num(),x2=cx+num(),y2=cy+num(),x=cx+num(),y=cy+num();
                    C(x1,y1,x2,y2,x,y); lc2x=x2; lc2y=y2; cx=x; cy=y; hadC=true; break; }
        case 's': { const x1 = hadC ? 2*cx - lc2x : cx, y1 = hadC ? 2*cy - lc2y : cy;
                    const x2 = cx + num(), y2 = cy + num();
                    const x  = cx + num(), y  = cy + num();
                    C(x1,y1,x2,y2,x,y); lc2x=x2; lc2y=y2; cx=x; cy=y; hadC=true; break; }
        case 'Z': case 'z': Z(); cx=sx; cy=sy; hadC=false; break;
        default: throw new Error(`unsupported SVG command: ${cmd}`);
      }
    }
    bytes[cntIdx]     = cmds & 0xff;
    bytes[cntIdx + 1] = (cmds >> 8) & 0xff;
  }
  return Buffer.from(bytes).toString('base64');
}

function extractWave(name) {
  const src = readFileSync(`originals/${name}.svg`, 'utf8');
  const styles = parseStyles(src);
  // 400 samples: dense enough to avoid visible gaps between ribbons.
  const paths = sample(parsePaths(src, styles), 400);
  const bin = encodeWaves(paths);
  return { bin, bg: paths[0].fill, ...TUNING[name] };
}

// Mesh: rasterize the SVG, then sample a GRID×GRID color grid via imagemagick.
function extractMesh(name) {
  const pngPath = `/tmp/_${name}.png`;
  execSync(`rsvg-convert -w 720 -h 720 originals/${name}.svg -o ${pngPath}`);
  const GRID = 32;
  const txt = execSync(`magick ${pngPath} -resize ${GRID}x${GRID} -depth 8 txt:`).toString();
  const grid = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^(\d+),(\d+):\s*\((\d+),(\d+),(\d+)/);
    if (!m) continue;
    const [, x, y, r, g, b] = m;
    grid.push({
      x: +x / (GRID - 1), y: +y / (GRID - 1),
      c: '#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join(''),
    });
  }
  // Renderer wants a row-major flat array of hex strings.
  grid.sort((a, b) =>
    Math.round(a.y * (GRID - 1)) - Math.round(b.y * (GRID - 1)) ||
    Math.round(a.x * (GRID - 1)) - Math.round(b.x * (GRID - 1))
  );
  return { cells: grid.map(c => c.c), size: GRID, ...TUNING[name] };
}

function write(key, obj) {
  writeFileSync(`src/data/${key}.js`, `export default ${JSON.stringify(obj)};\n`);
}

for (const [name, ex] of [
  ['Blob1', extractBlob], ['Blob2', extractBlob], ['Blob3', extractBlob],
  ['Wave1', extractWave], ['Wave2', extractWave], ['Wave3', extractWave],
  ['Mesh1', extractMesh], ['Mesh2', extractMesh], ['Mesh3', extractMesh],
]) {
  const data = ex(name);
  const key = name.toLowerCase();
  write(key, data);
  const size = Buffer.byteLength(JSON.stringify(data));
  console.log(`src/data/${key}.js  ${size.toString().padStart(7)}B`);
}
