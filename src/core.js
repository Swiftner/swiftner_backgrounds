// Attach an animated canvas background to `target`. Returns { canvas, stop() }.
// NOTE: inlined verbatim into standalone pages via .toString() — keep
// self-contained (no external imports, no closed-over symbols).
export function mount(target, preset, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new Error(`[swiftner-bg] target not found: ${target}`);

  const { fps = 15, dpr = 1 } = options;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isBody = el === document.body || el === document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    `position:${isBody ? 'fixed' : 'absolute'};inset:0;width:100%;height:100%;` +
    `pointer-events:none;z-index:-1;display:block;`;

  // Force a stacking context so z-index:-1 stays bounded within the host;
  // without it, the host's background paints above our canvas (layer 3 > 2).
  const cs = getComputedStyle(el);
  const prevPos = !isBody && cs.position === 'static' ? el.style.position : null;
  const prevIso = cs.isolation !== 'isolate'          ? el.style.isolation : null;
  if (prevPos !== null) el.style.position  = 'relative';
  if (prevIso !== null) el.style.isolation = 'isolate';
  el.insertBefore(canvas, el.firstChild);

  const ctx = canvas.getContext('2d');
  const render = preset.render;
  let W = 0, H = 0;
  const resize = () => {
    const rect = isBody
      ? { width: innerWidth, height: innerHeight }
      : el.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width  * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W; canvas.height = H;
    if (reduced) render(ctx, W, H, 0);
  };
  resize();

  let ro = null;
  if (isBody) addEventListener('resize', resize);
  else { ro = new ResizeObserver(resize); ro.observe(el); }

  const start = performance.now();
  const FRAME_MS = 1000 / fps;
  let lastRender = -Infinity;
  let rafId = 0;
  let stopped = false;

  const loop = (now) => {
    rafId = 0;
    if (stopped) return;
    if (now - lastRender >= FRAME_MS) {
      lastRender = now;
      render(ctx, W, H, now - start);
    }
    schedule();
  };
  const schedule = () => {
    if (!stopped && !document.hidden && !rafId) rafId = requestAnimationFrame(loop);
  };
  const onVis = () => schedule();

  if (!reduced) {
    document.addEventListener('visibilitychange', onVis);
    schedule();
  }

  return {
    canvas,
    stop() {
      if (stopped) return;
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      else removeEventListener('resize', resize);
      if (!reduced) document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
      if (prevPos !== null) el.style.position  = prevPos;
      if (prevIso !== null) el.style.isolation = prevIso;
    },
  };
}
