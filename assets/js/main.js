// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// HDR Starfield using img elements with HDR AVIF sprite
const clip = document.querySelector('.stars-clip');
const container = document.getElementById('stars');
const starSrc = 'assets/img/star-hdr.avif';
const starDensity = 1000; // px^2 per star
const TARGET_FRAME_MS = 50; // ~20fps
const TWINKLE_START_CHANCE = 0.01; // per frame
let idleStars = [];
let twinklingStars = [];
let w = 0, h = 0;
let fieldW = 0, fieldH = 0;
let built = false;

const rand = (min, max) => Math.random() * (max - min) + min;

function resize() {
  const newW = clip.clientWidth;
  const newH = clip.clientHeight;
  if (newW <= 0 || newH <= 0) return;
  if (!built) {
    w = newW;
    h = newH;
    build();
    built = true;
    return;
  }
  const prevW = w;
  const prevH = h;
  w = newW;
  h = newH;
  expandField(prevW, prevH);
}

function createStar(x, y, fragment) {
  const img = document.createElement('img');
  img.src = starSrc;
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';

  img.style.left = x + 'px';
  img.style.top = y + 'px';

  // Random size (1-5px base width)
  const size = Math.pow(Math.random(), 1.8) * 4 + 1;
  img.style.width = size + 'px';
  img.style.height = 'auto';

  // Start at full brightness
  img.style.opacity = '1';
  img.style.transform = 'scale(1)';

  fragment.appendChild(img);
  const star = {
    el: img,
    twinkleStart: 0,
    twinkleSpeed: 0
  };
  idleStars.push(star);
}

function addStarsInRect(x0, y0, x1, y1) {
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return;

  const count = Math.round((width * height) / starDensity);
  if (count <= 0) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    createStar(rand(x0, x1), rand(y0, y1), fragment);
  }
  container.appendChild(fragment);
}

function build() {
  // Clear existing stars
  container.replaceChildren();
  idleStars = [];
  twinklingStars = [];
  fieldW = w;
  fieldH = h;
  addStarsInRect(0, 0, fieldW, fieldH);
}

function expandField(prevW, prevH) {
  const prevFieldW = fieldW;
  const prevFieldH = fieldH;
  const newFieldW = Math.max(prevFieldW, w);
  const newFieldH = Math.max(prevFieldH, h);

  if (newFieldW > prevFieldW) {
    addStarsInRect(prevFieldW, 0, newFieldW, prevFieldH);
  }
  if (newFieldH > prevFieldH) {
    addStarsInRect(0, prevFieldH, newFieldW, newFieldH);
  }

  fieldW = newFieldW;
  fieldH = newFieldH;
}

let lastFrame = 0;

function samplePoisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let p = 1;
    let k = 0;
    do {
      k += 1;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
  // Normal approximation keeps sampling fast and avoids underflow for large lambda.
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(lambda + z * Math.sqrt(lambda)));
}

function takeRandomIdleStar() {
  const idx = Math.floor(Math.random() * idleStars.length);
  const star = idleStars[idx];
  idleStars[idx] = idleStars[idleStars.length - 1];
  idleStars.pop();
  return star;
}

function draw(nowMs) {
  // Throttle to ~20fps
  if (nowMs - lastFrame < TARGET_FRAME_MS) {
    requestAnimationFrame(draw);
    return;
  }
  lastFrame = nowMs;

  const t = nowMs / 1000; // seconds

  if (idleStars.length) {
    const expectedStarts = idleStars.length * TWINKLE_START_CHANCE;
    let starts = samplePoisson(expectedStarts);
    while (starts > 0 && idleStars.length) {
      const s = takeRandomIdleStar();
      s.twinkleStart = t;
      s.twinkleSpeed = rand(2.0, 4.0);
      twinklingStars.push(s);
      starts -= 1;
    }
  }

  for (let i = twinklingStars.length - 1; i >= 0; i--) {
    const s = twinklingStars[i];
    // Currently in a twinkle cycle
    const elapsed = t - s.twinkleStart;
    const phase = elapsed * s.twinkleSpeed;

    if (phase >= Math.PI) {
      // Twinkle cycle complete, back to full brightness
      s.el.style.opacity = '1';
      s.el.style.transform = 'scale(1)';
      twinklingStars[i] = twinklingStars[twinklingStars.length - 1];
      twinklingStars.pop();
      idleStars.push(s);
      continue;
    }

    // Dim down then back up (use sin: 0 -> 1 -> 0, invert for brightness)
    const dim = Math.sin(phase); // 0 -> 1 -> 0
    const brightness = 1 - dim; // 1 -> 0 -> 1
    s.el.style.opacity = (0.2 + brightness * 0.8).toFixed(3);
    s.el.style.transform = 'scale(' + (0.7 + brightness * 0.3).toFixed(3) + ')';
  }
  requestAnimationFrame(draw);
}

const ro = new ResizeObserver(resize);
ro.observe(clip);
resize();
requestAnimationFrame(draw);

// Proximity scaling for orbs: grow toward edge, hold inside (no extra growth)
(function enableProximityScaling() {
  const orbs = Array.from(document.querySelectorAll('.orb'));
  if (!orbs.length) return;

  let px = -1e6;
  let py = -1e6;
  let active = false;
  let rafId = 0;
  let measurePending = false;
  let orbMetrics = [];

  function measureOrbs() {
    orbMetrics = orbs.map((el) => {
      const rect = el.getBoundingClientRect();
      const r = rect.width / 2;
      return {
        el,
        cx: rect.left + r,
        cy: rect.top + r,
        r,
        influence: Math.max(rect.width * 1.2, 140)
      };
    });
  }

  function scheduleMeasure() {
    if (measurePending) return;
    measurePending = true;
    requestAnimationFrame(() => {
      measurePending = false;
      measureOrbs();
      if (active) updateAll(px, py);
    });
  }

  function updateAll(clientX, clientY) {
    for (const orb of orbMetrics) {
      const dx = clientX - orb.cx;
      const dy = clientY - orb.cy;
      const dist = Math.hypot(dx, dy);
      let scale = 1;
      if (dist > orb.r) {
        const dEdge = dist - orb.r; // distance to edge
        let t = Math.max(0, 1 - dEdge / orb.influence); // 0..1 toward edge
        t = t * t; // ease
        scale = 1 + t * 0.20; // peak at edge
      } else {
        scale = 1 + 0.20; // hold inside
      }
      orb.el.style.setProperty('--p', scale.toFixed(3));
    }
  }

  function requestUpdate(clientX, clientY) {
    px = clientX;
    py = clientY;
    active = true;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateAll(px, py);
    });
  }

  measureOrbs();

  window.addEventListener('pointermove', (e) => requestUpdate(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerleave', () => {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    for (const el of orbs) el.style.setProperty('--p', '1');
  });
  window.addEventListener('resize', scheduleMeasure);
  window.addEventListener('scroll', scheduleMeasure, { passive: true });
})();
