// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// HDR Starfield using img elements with HDR AVIF sprite
const clip = document.querySelector('.stars-clip');
const container = document.getElementById('stars');
const starSrc = 'assets/img/star-hdr.avif';
const starDensity = 1000; // px^2 per star
let stars = [];
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

function createStar(x, y) {
  const img = document.createElement('img');
  img.src = starSrc;
  img.alt = '';
  img.draggable = false;

  img.style.left = x + 'px';
  img.style.top = y + 'px';

  // Random size (1-5px base width)
  const size = Math.pow(Math.random(), 1.8) * 4 + 1;
  img.style.width = size + 'px';
  img.style.height = 'auto';

  // Start at full brightness
  img.style.opacity = '1';
  img.style.transform = 'scale(1)';

  container.appendChild(img);
  stars.push({
    el: img,
    x,
    y,
    twinkling: false,
    twinkleStart: 0,
    twinkleSpeed: rand(2.0, 4.0)
  });
}

function addStarsInRect(x0, y0, x1, y1) {
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return;

  const count = Math.round((width * height) / starDensity);
  for (let i = 0; i < count; i++) {
    createStar(rand(x0, x1), rand(y0, y1));
  }
}

function build() {
  // Clear existing stars
  container.innerHTML = '';
  stars = [];
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
function draw(nowMs) {
  // Throttle to ~20fps
  if (nowMs - lastFrame < 50) {
    requestAnimationFrame(draw);
    return;
  }
  lastFrame = nowMs;

  const t = nowMs / 1000; // seconds

  for (const s of stars) {
    if (s.twinkling) {
      // Currently in a twinkle cycle
      const elapsed = t - s.twinkleStart;
      const phase = elapsed * s.twinkleSpeed;

      if (phase >= Math.PI) {
        // Twinkle cycle complete, back to full brightness
        s.twinkling = false;
        s.el.style.opacity = '1';
        s.el.style.transform = 'scale(1)';
      } else {
        // Dim down then back up (use sin: 0 -> 1 -> 0, invert for brightness)
        const dim = Math.sin(phase); // 0 -> 1 -> 0
        const brightness = 1 - dim;  // 1 -> 0 -> 1
        s.el.style.opacity = (0.2 + brightness * 0.8).toFixed(3);
        s.el.style.transform = 'scale(' + (0.7 + brightness * 0.3).toFixed(3) + ')';
      }
    } else {
      // Randomly start a twinkle (low probability per frame)
      if (Math.random() < 0.01) {
        s.twinkling = true;
        s.twinkleStart = t;
        s.twinkleSpeed = rand(2.0, 4.0);
      }
    }
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

  let px = -1e6, py = -1e6, active = false;

  function updateAll(clientX, clientY) {
    px = clientX; py = clientY; active = true;
    for (const el of orbs) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = rect.width / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      let scale = 1;
      if (dist > r) {
        const dEdge = dist - r;               // distance to edge
        const influence = Math.max(rect.width * 1.2, 140);
        let t = Math.max(0, 1 - dEdge / influence); // 0..1 toward edge
        t = t * t; // ease
        scale = 1 + t * 0.20; // peak at edge
      } else {
        scale = 1 + 0.20; // hold inside
      }
      el.style.setProperty('--p', scale.toFixed(3));
    }
  }

  window.addEventListener('pointermove', (e) => updateAll(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerleave', () => {
    active = false;
    for (const el of orbs) el.style.setProperty('--p', '1');
  });
  window.addEventListener('resize', () => { if (active) updateAll(px, py); });
})();
