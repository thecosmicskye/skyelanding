// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Starfield (original look, refactored without behavior changes)
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
let stars = [];
let w, h, dpr;

const rand = (min, max) => Math.random() * (max - min) + min;

function resize() {
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  w = canvas.clientWidth; h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  build();
}

function build() {
  const count = Math.round((w * h) / 8000); // density
  stars = new Array(count).fill(0).map(() => ({
    x: rand(0, w),
    y: rand(0, h),
    r: Math.pow(Math.random(), 1.8) * 1.4 + 0.2,
    intensity: rand(0.4, 1.0),
    currentSpeed: rand(0.8, 3.0), // reasonable speed range
    phaseStart: 0,                // sine phase at cycle start
    timeStart: 0                  // time at cycle start
  }));
}

function draw(nowMs) {
  const t = nowMs / 1000; // seconds
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    // Current phase based on elapsed since cycle start
    const elapsed = t - s.timeStart;
    const currentPhase = s.phaseStart + elapsed * s.currentSpeed;
    // Cycle reset at π for abs(sin)
    if (currentPhase >= s.phaseStart + Math.PI) {
      s.phaseStart = 0;
      s.timeStart = t;
      s.currentSpeed = rand(0.8, 3.0);
    }
    const phase = s.phaseStart + (t - s.timeStart) * s.currentSpeed;
    const twinkle = 0.2 + 0.8 * Math.abs(Math.sin(phase));
    const brightness = s.intensity * twinkle;
    const radius = s.r * (0.6 + brightness * 0.8);
    const opacity = 0.1 + brightness * 0.9;

    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 3);
    grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
    grad.addColorStop(0.5, `rgba(207,232,255,${opacity * 0.6})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(draw);
}

const ro = new ResizeObserver(resize);
ro.observe(canvas);
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

