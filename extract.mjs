#!/usr/bin/env node
// Extract circle trajectories + color sequences from originals/ SVGs.
// Produces ./extracted.json with per-asset arrays of { x, y, r, fill }
// downsampled to ~60 circles, ready for the generator.

import { readFileSync, writeFileSync } from 'node:fs';

function parseStyles(src) {
  const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const map = {};
  if (!m) return map;
  const re = /\.(cls-\d+|st\d+)\s*\{\s*fill:\s*(#[0-9a-f]{6})/gi;
  let x; while ((x = re.exec(m[1]))) map[x[1]] = x[2].toLowerCase();
  return map;
}

function parseCircles(src, styles) {
  const out = [];
  const re = /<circle\b[^>]*\bclass="([^"]+)"[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"[^>]*\br="([^"]+)"/g;
  let m; while ((m = re.exec(src))) {
    out.push({ x: +m[2] / 720, y: +m[3] / 720, r: +m[4] / 720, fill: styles[m[1]] });
  }
  return out.filter(c => c.fill);
}

function sample(arr, target) {
  if (arr.length <= target) return arr;
  const step = (arr.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => arr[Math.round(i * step)]);
}

// Least-squares fit a cubic bezier to a sequence of (x,y) points.
// Returns the 4 control points; endpoints are pinned to points[0] and points[n-1].
function fitCubicBezier(points) {
  const n = points.length;
  const P0 = { x: points[0].x, y: points[0].y };
  const P3 = { x: points[n - 1].x, y: points[n - 1].y };
  let a11 = 0, a12 = 0, a22 = 0;
  let b1x = 0, b2x = 0, b1y = 0, b2y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const mt = 1 - t;
    const A = 3 * mt * mt * t;
    const B = 3 * mt * t * t;
    const baseX = mt * mt * mt * P0.x + t * t * t * P3.x;
    const baseY = mt * mt * mt * P0.y + t * t * t * P3.y;
    const rx = points[i].x - baseX, ry = points[i].y - baseY;
    a11 += A * A; a12 += A * B; a22 += B * B;
    b1x += A * rx; b2x += B * rx;
    b1y += A * ry; b2y += B * ry;
  }
  const det = a11 * a22 - a12 * a12;
  const P1 = {
    x: (a22 * b1x - a12 * b2x) / det,
    y: (a22 * b1y - a12 * b2y) / det,
  };
  const P2 = {
    x: (a11 * b2x - a12 * b1x) / det,
    y: (a11 * b2y - a12 * b1y) / det,
  };
  return { P0, P1, P2, P3 };
}

function bezierAt(t, b) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*b.P0.x + 3*mt*mt*t*b.P1.x + 3*mt*t*t*b.P2.x + t*t*t*b.P3.x,
    y: mt*mt*mt*b.P0.y + 3*mt*mt*t*b.P1.y + 3*mt*t*t*b.P2.y + t*t*t*b.P3.y,
  };
}

const result = {};
for (const name of ['Blob1', 'Blob2', 'Blob3']) {
  const src = readFileSync(`originals/${name}.svg`, 'utf8');
  const styles = parseStyles(src);
  const circles = parseCircles(src, styles);
  const bezier = fitCubicBezier(circles);
  // For each circle: store its t param, its residual (delta from bezier fit),
  // color, and radius. The generator reconstructs position as B(t) + residual.
  const stops = circles.map((c, i) => {
    const t = i / (circles.length - 1);
    const b = bezierAt(t, bezier);
    return { t, dx: c.x - b.x, dy: c.y - b.y, r: c.r, fill: c.fill };
  });
  result[name] = { kind: 'blob', bezier, stops };
  const residMax = Math.max(...stops.map(s => Math.hypot(s.dx, s.dy)));
  console.log(`${name}: ${circles.length} circles, bezier fit, max residual ${(residMax * 720).toFixed(1)}px`);
}

// For Wave[N] the shapes are paths, not circles.  We still want a
// trajectory-like sweep: sample a diagonal band of points + take each path's
// color.  The paths have complex d attrs, but for matching we can treat each
// path as a tall curved band that spans the canvas.  We'll render these
// differently — just capture the color sequence.
function parsePathsFull(src, styles) {
  const out = [];
  const re = /<path\b[^>]*\bclass="([^"]+)"[^>]*\bd="([^"]+)"/g;
  let m; while ((m = re.exec(src))) {
    if (styles[m[1]]) out.push({ fill: styles[m[1]], d: m[2] });
  }
  return out;
}

for (const name of ['Wave1', 'Wave2', 'Wave3']) {
  const src = readFileSync(`originals/${name}.svg`, 'utf8');
  const styles = parseStyles(src);
  const paths = parsePathsFull(src, styles);
  // 400 samples: dense enough to avoid visible gaps/hairlines between ribbons
  result[name] = { kind: 'wave', paths: sample(paths, 400) };
  console.log(`${name}: ${paths.length} -> ${result[name].paths.length} wavy paths`);
}

// Sample each Mesh original as an 8x8 color grid — Photoshop gradient-mesh
// rendered at low-res; canvas will bilinearly smooth it back up.
import { execSync } from 'node:child_process';
for (const name of ['Mesh1', 'Mesh2', 'Mesh3']) {
  const src = `originals/${name}.svg`;
  // rsvg -> png pipe -> imagemagick 8x8 -> txt
  const pngPath = `/tmp/_${name}.png`;
  execSync(`rsvg-convert -w 720 -h 720 ${src} -o ${pngPath}`);
  const GRID = 32;
  const txt = execSync(`magick ${pngPath} -resize ${GRID}x${GRID} -depth 8 txt:`).toString();
  const grid = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^(\d+),(\d+):\s*\((\d+),(\d+),(\d+)/);
    if (!m) continue;
    const [_, x, y, r, g, b] = m;
    grid.push({
      x: +x / (GRID - 1), y: +y / (GRID - 1),
      c: '#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join('')
    });
  }
  result[name] = { kind: 'mesh', grid, size: GRID };
  console.log(`${name}: ${grid.length} grid cells (${GRID}x${GRID})`);
}

writeFileSync('extracted.json', JSON.stringify(result));
console.log('\nwrote extracted.json');
