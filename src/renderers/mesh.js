// Two-pass upscale: NxN grid → mid-res canvas with blur filter → main canvas.
// The blur pass kills polygon banding that single-pass bilinear produces.
export function createMesh(data) {
  const { cells, size: GRID, drift, bg } = data;
  let off, mid, mctx, midSide = 0;
  return (ctx, W, H, t) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (!off) {
      off = document.createElement('canvas');
      off.width = GRID; off.height = GRID;
      const octx = off.getContext('2d');
      const id = octx.createImageData(GRID, GRID);
      for (let i = 0; i < cells.length; i++) {
        const n = parseInt(cells[i].slice(1), 16);
        id.data[i * 4    ] = (n >> 16) & 255;
        id.data[i * 4 + 1] = (n >> 8)  & 255;
        id.data[i * 4 + 2] =  n        & 255;
        id.data[i * 4 + 3] = 255;
      }
      octx.putImageData(id, 0, 0);
      mid = document.createElement('canvas');
    }
    const newSide = Math.min(1024, Math.max(W, H) / 2);
    if (newSide !== midSide) {
      midSide = newSide;
      mid.width = mid.height = midSide;
      mctx = mid.getContext('2d');
      mctx.imageSmoothingEnabled = true;
      mctx.imageSmoothingQuality = 'high';
    }
    const phase = t * drift;
    const amp = 4;
    const dx = Math.sin(phase) * amp;
    const dy = Math.cos(phase * 1.27) * amp;
    const win = GRID - amp * 2;
    mctx.filter = 'blur(' + midSide * 0.01 + 'px)';
    mctx.drawImage(off, amp + dx, amp + dy, win, win, 0, 0, midSide, midSide);
    mctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Crop the middle 70% to hide the darker edge samples.
    const crop = midSide * 0.15;
    ctx.drawImage(mid, crop, crop, midSide - crop * 2, midSide - crop * 2,
                  0, 0, W, H);
  };
}
