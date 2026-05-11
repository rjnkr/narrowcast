const SLIDE_MS    = 20_000;
const STATUS_MS   = 60_000;
const MANIFEST_MS = 10 * 60_000;

let slides       = [];
let currentIndex = 0;
let autoTimer    = null;
let persistentFrames = {};  // id → <iframe>
let regularFrame = null;

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('clock').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Manifest ──────────────────────────────────────────────────────────────────
async function loadManifest() {
  console.log('[slideshow] loadManifest start');
  try {
    const res = await fetch('/slides/manifest.json', { cache: 'no-store' });
    console.log('[slideshow] manifest response:', res.status, res.ok);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[slideshow] manifest parsed, slides:', data.slides?.length);
    applyManifest(data.slides);
  } catch (e) {
    console.error('[slideshow] Failed to load manifest:', e);
    const loading = document.getElementById('loading');
    if (loading) loading.innerHTML = `<div style="color:#e05c2a;font-size:16px;font-family:sans-serif;text-align:center">
      Manifest load failed:<br>${e.message}</div>`;
  }
}

function applyManifest(newSlides) {
  console.log('[slideshow] applyManifest called with', newSlides?.length, 'slides');
  try {
    slides = newSlides;
    buildPersistentFrames();
    console.log('[slideshow] persistentFrames built');
    buildDots();
    console.log('[slideshow] dots built');
    if (currentIndex >= slides.length) currentIndex = 0;
    showSlide(currentIndex, true);
    resetAuto();
    console.log('[slideshow] showSlide done, hiding loading');
    document.getElementById('loading').style.display = 'none';
    console.log('[slideshow] loading hidden');
  } catch (e) {
    console.error('[slideshow] applyManifest error:', e);
    const loading = document.getElementById('loading');
    if (loading) loading.innerHTML = `<div style="color:#e05c2a;font-size:16px;font-family:sans-serif;text-align:center">
      applyManifest error:<br>${e.message}<br><pre style="font-size:12px;text-align:left">${e.stack}</pre></div>`;
  }
}

// ── Persistent iframes ────────────────────────────────────────────────────────
// Created once per unique slide id — session/login state stays alive across
// manifest reloads. Stale iframes (id no longer in manifest) are removed.
function buildPersistentFrames() {
  const main = document.getElementById('main');
  const activeIds = new Set(slides.filter(s => s.persistent).map(s => s.id));

  // Remove iframes for slides that are no longer in the manifest
  for (const id of Object.keys(persistentFrames)) {
    if (!activeIds.has(id)) {
      persistentFrames[id].remove();
      delete persistentFrames[id];
    }
  }

  // Create iframes for new persistent slides
  slides.forEach(slide => {
    if (!slide.persistent) return;
    if (!persistentFrames[slide.id]) {
      const iframe = document.createElement('iframe');
      iframe.className = 'slide-frame';
      iframe.src = slide.url;
      iframe.title = slide.label;
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation');
      iframe.setAttribute('allowfullscreen', '');
      main.appendChild(iframe);
      persistentFrames[slide.id] = iframe;
    }
  });
}

// ── Regular (cycling) iframe ───────────────────────────────────────────────────
function getRegularFrame() {
  if (!regularFrame) {
    const main = document.getElementById('main');
    regularFrame = document.createElement('iframe');
    regularFrame.className = 'slide-frame';
    regularFrame.title = 'slide';
    regularFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    main.appendChild(regularFrame);
  }
  return regularFrame;
}

// ── Show slide ─────────────────────────────────────────────────────────────────
function showSlide(index, force) {
  if (!slides.length) return;
  const prevIndex = currentIndex;
  currentIndex = ((index % slides.length) + slides.length) % slides.length;
  if (!force && currentIndex === prevIndex) return;

  const slide = slides[currentIndex];
  const isPersistent = !!slide.persistent;

  // Hide all frames
  document.querySelectorAll('.slide-frame').forEach(f => f.classList.remove('active'));

  // For persistent slides: full interaction — hide nav click zones
  // For regular slides: pointer-events: none on iframe, nav zones handle clicks
  document.getElementById('nav-prev').style.display = isPersistent ? 'none' : 'block';
  document.getElementById('nav-next').style.display = isPersistent ? 'none' : 'block';

  if (isPersistent) {
    const pFrame = persistentFrames[slide.id];
    if (pFrame) pFrame.classList.add('active');
  } else {
    const frame = getRegularFrame();
    // Only change src when the slide actually changes — browser cache handles re-visits
    if (frame.dataset.url !== slide.url) {
      frame.src = slide.url;
      frame.dataset.url = slide.url;
    }
    frame.classList.add('active');
  }

  updateDots();
  document.getElementById('counter').textContent =
    `Slide ${currentIndex + 1} / ${slides.length}`;
}

// ── Auto-advance ───────────────────────────────────────────────────────────────
function resetAuto() {
  clearInterval(autoTimer);
  const duration = slides[currentIndex]?.duration ?? SLIDE_MS;
  autoTimer = setTimeout(() => { advance(1); }, duration);
}

function advance(dir) {
  showSlide(currentIndex + dir);
  resetAuto();
}

// ── Navigation click zones ─────────────────────────────────────────────────────
document.getElementById('nav-prev').addEventListener('click', () => advance(-1));
document.getElementById('nav-next').addEventListener('click', () => advance(1));

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') advance(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   advance(-1);
});

// ── Footer dots ────────────────────────────────────────────────────────────────
function buildDots() {
  const container = document.getElementById('dots');
  container.innerHTML = '';
  slides.forEach((slide, i) => {
    const btn = document.createElement('button');
    btn.className = 'dot';
    btn.setAttribute('aria-label', `Slide ${i + 1}: ${slide.label}`);
    btn.addEventListener('click', () => { showSlide(i, true); resetAuto(); });
    container.appendChild(btn);
  });
}

function updateDots() {
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

// ── Status / offline badge ─────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('offline-badge').classList.toggle('show', !data.online);
  } catch {
    document.getElementById('offline-badge').classList.add('show');
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
resetAuto();
loadManifest();
checkStatus();
setInterval(checkStatus, STATUS_MS);
setInterval(loadManifest, MANIFEST_MS);
