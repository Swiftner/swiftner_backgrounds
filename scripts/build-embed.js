#!/usr/bin/env node
// Bundle src/embed.js → dist/embed.min.js (self-contained IIFE for <script>).
import { build } from 'esbuild';
import { mkdirSync, statSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/embed.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/embed.min.js',
  legalComments: 'none',
});

const { size } = statSync('dist/embed.min.js');
console.log(`dist/embed.min.js  ${(size / 1024).toFixed(1)} KB`);
