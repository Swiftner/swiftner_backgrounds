import { mount } from './core.js';
import * as assets from './assets/index.js';

const mounted = new WeakMap();

function attach(el) {
  if (mounted.has(el)) return;
  const name = el.getAttribute('data-swiftner-bg');
  const preset = assets[name];
  if (!preset) {
    console.warn(`[swiftner-bg] unknown asset "${name}" — known:`, Object.keys(assets).join(', '));
    return;
  }
  const opts = {};
  const fps = el.getAttribute('data-swiftner-fps');
  const dpr = el.getAttribute('data-swiftner-dpr');
  if (fps) opts.fps = Number(fps);
  if (dpr) opts.dpr = Number(dpr);
  mounted.set(el, mount(el, preset, opts));
}

function scan(root) {
  root.querySelectorAll('[data-swiftner-bg]').forEach(attach);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scan(document));
} else {
  scan(document);
}

const mo = new MutationObserver((records) => {
  for (const r of records) {
    for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches?.('[data-swiftner-bg]')) attach(n);
      if (n.querySelectorAll) scan(n);
    }
  }
});
const startObserving = () => mo.observe(document.body, { childList: true, subtree: true });
if (document.body) startObserving();
else document.addEventListener('DOMContentLoaded', startObserving);

window.SwiftnerBg = { mount, ...assets };
