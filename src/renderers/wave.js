// Binary format: u16 pathCount, then per path: u8[3] rgb, u16 cmdCount, cmds.
// Opcodes: 0=M(2), 1=L(2), 2=C(6), 3=Z(0). All coords absolute, i16 × 0.1.
// Exported so scripts/generate-pages.js can inline it alongside createWave.
export function decodeWaves(b64) {
  const raw = atob(b64);
  const b = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i);
  const dv = new DataView(b.buffer);
  let o = 0;
  const u8 = () => b[o++];
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; };
  const i16 = () => { const v = dv.getInt16(o, true); o += 2; return v / 10; };
  const n = u16();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = u8(), g = u8(), bl = u8();
    const fill = '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
    const m = u16();
    const p = new Path2D();
    for (let j = 0; j < m; j++) {
      const op = u8();
      if (op === 0)      p.moveTo(i16(), i16());
      else if (op === 1) p.lineTo(i16(), i16());
      else if (op === 2) p.bezierCurveTo(i16(), i16(), i16(), i16(), i16(), i16());
      else if (op === 3) p.closePath();
    }
    out[i] = { fill, path: p };
  }
  return out;
}

export function createWave(data) {
  const { drift, bg } = data;
  let paths;
  return (ctx, W, H, t) => {
    if (!paths) paths = decodeWaves(data.bin);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const phase = t * drift;
    const S = W / 720;
    const tx = Math.sin(phase) * 40 * S;
    const ty = Math.cos(phase * 1.3) * 24 * S;
    const rot = Math.sin(phase * 0.7) * 0.02;
    const scl = 1 + Math.sin(phase * 0.9) * 0.015;
    ctx.save();
    ctx.translate(W / 2 + tx, H / 2 + ty);
    ctx.rotate(rot);
    ctx.scale(S * scl, S * scl);
    ctx.translate(-360, -360);
    for (let i = 0; i < paths.length; i++) {
      ctx.fillStyle = paths[i].fill;
      ctx.fill(paths[i].path);
    }
    ctx.restore();
  };
}
