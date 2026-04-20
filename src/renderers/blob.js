export function createBlob(data) {
  const { bezier: B, stops, wobble, bg } = data;
  return (ctx, W, H, t) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const S = W;
    const offY = (H - S) / 2;
    const ph = t * wobble.speed;
    const p0x = B.P0.x + Math.sin(ph * 0.9 + 0.3) * wobble.endAmp;
    const p0y = B.P0.y + Math.cos(ph * 1.1 + 0.9) * wobble.endAmp;
    const p1x = B.P1.x + Math.sin(ph * 1.3 + 1.7) * wobble.ctrlAmp;
    const p1y = B.P1.y + Math.cos(ph * 1.0 + 2.3) * wobble.ctrlAmp;
    const p2x = B.P2.x + Math.sin(ph * 0.8 + 3.1) * wobble.ctrlAmp;
    const p2y = B.P2.y + Math.cos(ph * 1.4 + 4.2) * wobble.ctrlAmp;
    const p3x = B.P3.x + Math.sin(ph * 1.2 + 5.1) * wobble.endAmp;
    const p3y = B.P3.y + Math.cos(ph * 0.7 + 0.2) * wobble.endAmp;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const u = s.t, mu = 1 - u;
      const bx = mu*mu*mu*p0x + 3*mu*mu*u*p1x + 3*mu*u*u*p2x + u*u*u*p3x;
      const by = mu*mu*mu*p0y + 3*mu*mu*u*p1y + 3*mu*u*u*p2y + u*u*u*p3y;
      ctx.fillStyle = s.fill;
      ctx.beginPath();
      ctx.arc((bx + s.dx) * S, offY + (by + s.dy) * S, s.r * S, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}
