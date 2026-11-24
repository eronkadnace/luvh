/* ── Customize your love letter here ─────────────────────────── */
const CONFIG = {
  message: "I love you",          // repeated to build the heart
  spin: 0.12,                     // idle auto-rotation speed (rad/s), 0 to disable
  colors: {
    text: ["#ffd9e6", "#ffb3cd", "#ff8fb8", "#ffffff"],
  },
};
/* ────────────────────────────────────────────────────────────── */

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d");

document.title = `${CONFIG.message} ♥`;

const TAU = Math.PI * 2;
const CENTER_Y = -2.5; // vertical center of the heart curve in math space
const FONT_STACK = `Arial, Helvetica, sans-serif`;

const heartPoint = (t) => ({
  x: 16 * Math.sin(t) ** 3,
  y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
});

// Arc-length lookup so words spread evenly instead of bunching at the cusps.
const LUT_STEPS = 720;
const lutT = [0];
const lutAcc = [0];
{
  let prevP = heartPoint(0);
  let acc = 0;
  for (let i = 1; i <= LUT_STEPS; i++) {
    const t = (i / LUT_STEPS) * TAU;
    const p = heartPoint(t);
    acc += Math.hypot(p.x - prevP.x, p.y - prevP.y);
    lutT.push(t);
    lutAcc.push(acc);
    prevP = p;
  }
}

function tAtFrac(frac) {
  const target = frac * lutAcc[lutAcc.length - 1];
  let lo = 0;
  let hi = lutAcc.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (lutAcc[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = lutAcc[hi] - lutAcc[lo] || 1;
  return lutT[lo] + (lutT[hi] - lutT[lo]) * ((target - lutAcc[lo]) / span);
}

// Words are pre-rendered once into sprites so each frame is just a drawImage.
const SPRITE_SCALE = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
const wordSprites = new Map();
const heartSprites = new Map();
const measureCtx = document.createElement("canvas").getContext("2d");

const rgbOf = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

function getWordSprite(color, size) {
  const key = `${color}|${size}`;
  let sprite = wordSprites.get(key);
  if (sprite) return sprite;
  const font = `600 ${size}px ${FONT_STACK}`;
  measureCtx.font = font;
  const textW = measureCtx.measureText(CONFIG.message).width;
  const pad = Math.ceil(size * 0.9 + 6);
  const w = Math.ceil(textW + pad * 2);
  const h = Math.ceil(size * 1.7 + pad * 2);
  const c = document.createElement("canvas");
  c.width = w * SPRITE_SCALE;
  c.height = h * SPRITE_SCALE;
  const g = c.getContext("2d");
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = `rgba(${rgbOf(color)},0.85)`;
  g.shadowBlur = Math.max(4, size * 0.55);
  g.fillText(CONFIG.message, w / 2, h / 2);
  g.shadowBlur = 0;
  g.fillText(CONFIG.message, w / 2, h / 2);
  sprite = { canvas: c, w, h };
  wordSprites.set(key, sprite);
  return sprite;
}

function getHeartSprite(color) {
  let sprite = heartSprites.get(color);
  if (sprite) return sprite;
  const px = 96;
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d");
  g.translate(px / 2, px / 2);
  const s = (px * 0.8) / 32;
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const p = heartPoint((i / 64) * TAU);
    const x = p.x * s;
    const y = (CENTER_Y - p.y) * s;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 8;
  g.fill();
  g.shadowBlur = 0;
  g.fill();
  sprite = { canvas: c, w: px };
  heartSprites.set(color, sprite);
  return sprite;
}

let W = 0;
let H = 0;
let dpr = 1;
let cx = 0;
let cy = 0;
let heartScale = 14;
let words = [];
const bursts = [];
const HEART_COLORS = ["#ff9ecb", "#ff6f9c", "#ffe3ee", "#ff4d7e"];

let time = 0;

let yaw = 0.45;
let pitch = 0.1;
let yawVel = 0;
let pitchVel = 0;
let lastInteract = -1e6;
const ptr = { active: false, dragging: false, moved: 0, lastX: 0, lastY: 0, lastT: 0 };

const LAYER_OFFSETS = [-11, -4, 4, 11]; // px offsets from the curve, scaled with heart size

function createWord(frac, layer) {
  const t = tAtFrac(Math.min(0.999, frac));
  const p = heartPoint(t);
  const q = heartPoint(t + 0.001);
  // Canvas-space normal, so each layer sits like a stacked row of text.
  const dx = q.x - p.x;
  const dy = -(q.y - p.y);
  const dl = Math.hypot(dx, dy) || 1;
  const off = (LAYER_OFFSETS[layer] + (Math.random() - 0.5) * 4) * (heartScale / 16);
  const color =
    Math.random() < 0.6
      ? "#ffffff"
      : Math.random() < 0.5
        ? "#ffe3ee"
        : CONFIG.colors.text[(Math.random() * CONFIG.colors.text.length) | 0];
  const size = Math.round((3 + Math.random() * 6) * (heartScale / 16));
  const sprite = getWordSprite(color, size);
  return {
    x: p.x + (-dy / dl) * (off / heartScale),
    y: CENTER_Y - p.y + (dx / dl) * (off / heartScale),
    z: ((layer - 1.5) * 7 + (Math.random() - 0.5) * 1.5) / heartScale, // 7px depth step between layers
    sprite: sprite.canvas,
    spriteW: sprite.w,
    spriteH: sprite.h,
    alpha: 0.75 + Math.random() * 0.25,
    delay: 0.1 + Math.random() * 2.3, // scattered, not a sweep
    appearDur: 0.8 + Math.random() * 0.6,
    spawnX: (Math.random() * 1.2 - 0.1) * W,
    spawnY: (Math.random() * 1.2 - 0.1) * H,
    phase: Math.random() * TAU,
    speed: 0.5 + Math.random() * 1.6,
    amp: 1.5 + Math.random() * 2.5,
    twSpeed: 0.8 + Math.random() * 2,
  };
}

function buildWords() {
  words = [];
  const instant = time > 4.2; // resizing after any intro shouldn't replay it
  const layers = 4;
  const perLayer = 330;
  for (let layer = 0; layer < layers; layer++) {
    for (let i = 0; i < perLayer; i++) {
      const frac = ((i + layer * 0.37 + Math.random() * 0.8) / perLayer) % 1;
      const word = createWord(frac, layer);
      if (instant) word.delay = -1;
      words.push(word);
    }
  }
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2;
  cy = H * 0.445;
  heartScale = Math.min(W, H) * (W < H ? 0.0235 : 0.0175);
  buildWords();
}

function spawnBurst(x, y) {
  const count = 22;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * TAU;
    const speed = 50 + Math.random() * 170;
    bursts.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed * 0.9 - 70,
      size: 7 + Math.random() * 16,
      rot: (Math.random() - 0.5) * 1,
      spin: (Math.random() - 0.5) * 3.5,
      age: 0,
      ttl: 1.1 + Math.random() * 1.3,
      color: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0],
    });
  }
}

function updateAndDrawBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    if (b.age >= b.ttl) {
      bursts.splice(i, 1);
      continue;
    }
    const damp = Math.exp(-2.4 * dt);
    b.vx *= damp;
    b.vy = b.vy * damp - 26 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.spin * dt;

    const k = b.age / b.ttl;
    const sprite = getHeartSprite(b.color);
    const d = b.size * (0.75 + 0.5 * k) * 1.25;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.globalAlpha = (1 - k) * (1 - k);
    ctx.drawImage(sprite.canvas, -d / 2, -d / 2, d, d);
    ctx.restore();
  }
}

function drawHeartWords(s) {
  const D = Math.min(W, H) * 1.25; // camera distance for perspective
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const t = time;
  const hScale = 0.45 + 0.55 * Math.abs(cosY);
  const vScale = 0.75 + 0.25 * Math.abs(cosP);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of words) {
    let r = (t - p.delay) / p.appearDur;
    if (r <= 0) continue;
    r = Math.min(1, r);
    const e = 1 - (1 - r) ** 3; // fast off the mark, soft settle
    const fade = Math.min(1, r * 2.2);

    const wx = p.x * s + Math.sin(t * p.speed + p.phase) * p.amp;
    const wy = p.y * s + Math.cos(t * p.speed * 0.85 + p.phase * 1.6) * p.amp * 0.85;
    const wz = p.z * s;

    const x1 = wx * cosY + wz * sinY;
    const z1 = wz * cosY - wx * sinY;
    const y2 = wy * cosP - z1 * sinP;
    const z2 = wy * sinP + z1 * cosP;

    const k = D / Math.max(D * 0.5, D - z2);
    const depth = Math.max(-1, Math.min(1, z2 / (s * 14)));
    ctx.globalAlpha = Math.min(
      1,
      p.alpha *
        (0.88 + 0.12 * Math.sin(t * p.twSpeed + p.phase)) *
        (0.62 + 0.38 * depth) *
        (0.5 + 0.5 * hScale) *
        fade,
    );
    const pop = 0.55 + 0.45 * e;
    const sx = hScale * k * pop;
    const sy = vScale * k * pop;
    const px = p.spawnX + (cx + x1 * k - p.spawnX) * e;
    const py = p.spawnY + (cy + y2 * k - p.spawnY) * e;
    ctx.setTransform(dpr * sx, 0, 0, dpr * sy, dpr * px, dpr * py);
    ctx.drawImage(p.sprite, -p.spriteW / 2, -p.spriteH / 2, p.spriteW, p.spriteH);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.restore();
}

function updateRotation(dt) {
  if (ptr.active) return;
  yaw += yawVel * dt;
  pitch = Math.max(-0.6, Math.min(0.6, pitch + pitchVel * dt));
  const damp = Math.exp(-3.5 * dt);
  yawVel *= damp;
  pitchVel *= damp;
  if (performance.now() - lastInteract > 4000) yaw += CONFIG.spin * dt;
}

let prev = performance.now();

function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  time += dt;

  updateRotation(dt);

  ctx.clearRect(0, 0, W, H);
  drawHeartWords(heartScale);
  updateAndDrawBursts(dt);

  requestAnimationFrame(frame);
}

resize();

window.addEventListener("resize", resize);

window.addEventListener("pointerdown", (e) => {
  ptr.active = true;
  ptr.dragging = false;
  ptr.moved = 0;
  ptr.lastX = e.clientX;
  ptr.lastY = e.clientY;
  ptr.lastT = performance.now();
  lastInteract = ptr.lastT;
});

window.addEventListener("pointermove", (e) => {
  if (!ptr.active) return;
  const now = performance.now();
  const dx = e.clientX - ptr.lastX;
  const dy = e.clientY - ptr.lastY;
  ptr.lastX = e.clientX;
  ptr.lastY = e.clientY;
  ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.moved > 10) ptr.dragging = true;
  if (!ptr.dragging) return;
  const dt = Math.max((now - ptr.lastT) / 1000, 0.008);
  ptr.lastT = now;
  yaw += dx * 0.0065;
  pitch = Math.max(-0.6, Math.min(0.6, pitch + dy * 0.0045));
  yawVel = Math.max(-8, Math.min(8, (dx * 0.0065) / dt));
  pitchVel = Math.max(-5, Math.min(5, (dy * 0.0045) / dt));
  lastInteract = now;
});

window.addEventListener("pointerup", (e) => {
  if (ptr.active && !ptr.dragging) spawnBurst(e.clientX, e.clientY);
  ptr.active = false;
  ptr.dragging = false;
  yawVel *= 0.5;
  pitchVel *= 0.5;
  lastInteract = performance.now();
});

window.addEventListener("pointercancel", () => {
  ptr.active = false;
  ptr.dragging = false;
  lastInteract = performance.now();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Enter") spawnBurst(cx, cy);
});

requestAnimationFrame(frame);
