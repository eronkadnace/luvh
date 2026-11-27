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
const CENTER_TEXT = "my love Lolita ♥";

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
const textSprites = new Map();
const heartSprites = new Map();
const measureCtx = document.createElement("canvas").getContext("2d");

const rgbOf = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

function getTextSprite(text, color, size) {
  const key = `${text}|${color}|${size}`;
  let sprite = textSprites.get(key);
  if (sprite) return sprite;
  const font = `600 ${size}px ${FONT_STACK}`;
  measureCtx.font = font;
  const textW = measureCtx.measureText(text).width;
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
  g.fillText(text, w / 2, h / 2);
  g.shadowBlur = 0;
  g.fillText(text, w / 2, h / 2);
  sprite = { canvas: c, w, h };
  textSprites.set(key, sprite);
  return sprite;
}

const getWordSprite = (color, size) => getTextSprite(CONFIG.message, color, size);

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
let centerSprite = null;
const bursts = [];
const HEART_COLORS = ["#ff9ecb", "#ff6f9c", "#ffe3ee", "#ff4d7e"];

/* ── Small symbol-flower companions ──────────────────────────── */
const FLOWER = {
  glyphs: ["-", "_", "=", "+", ">", "<", "*", "~", "^", ":", "/", "\\", "·"],
  coreGlyphs: ["*", "+", "·", ":"],
  wordsPerRing: 190,
  glyphSize: 8,
  spin: 0.5,
  colors: {
    petal: ["#ffd7e6", "#ff9ec4", "#ff6fa5"],
    core: ["#ffd98a", "#ffb347", "#fff3d6"],
  },
};
const F_PETAL_L = 16;
const F_PETAL_W = 3.8;
const fOutline = [];
{
  const N = 140;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    fOutline.push([F_PETAL_W * Math.sin(a), (F_PETAL_L / 2) * (1 - Math.cos(a))]);
  }
}
const fOutlineLen = [0];
{
  let acc = 0;
  for (let i = 1; i < fOutline.length; i++) {
    acc += Math.hypot(fOutline[i][0] - fOutline[i - 1][0], fOutline[i][1] - fOutline[i - 1][1]);
    fOutlineLen.push(acc);
  }
}
function fOutlineAt(frac, scale) {
  const target = frac * fOutlineLen[fOutlineLen.length - 1];
  let lo = 0;
  let hi = fOutlineLen.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (fOutlineLen[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = fOutlineLen[hi] - fOutlineLen[lo] || 1;
  const k = (target - fOutlineLen[lo]) / span;
  return [
    (fOutline[lo][0] + (fOutline[hi][0] - fOutline[lo][0]) * k) * scale,
    (fOutline[lo][1] + (fOutline[hi][1] - fOutline[lo][1]) * k) * scale,
  ];
}
const fSmooth = (x) => x * x * (3 - 2 * x);
const fEaseOutBack = (x, c1) => {
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
// Five companions in the gaps around the heart; every bloom is its own random
// flower — shape, size, curl and timing — and opens once, never closes.
const FLOWER_SPOTS = [
  [0.86, 0.1],
  [0.88, 0.62],
  [0.8, 0.82],
  [0.32, 0.84],
  [0.92, 0.245],
];
const flowers = FLOWER_SPOTS.map(([sx, sy], i) => {
  const lenK = 0.85 + Math.random() * 0.35;
  const widK = 0.8 + Math.random() * 0.5;
  return {
    sx,
    sy,
    x: 0,
    y: 0,
    scale: 3,
    cacheR: 60,
    sizeK: i === 4 ? 0.003 + Math.random() * 0.0004 : 0.0036 + Math.random() * 0.0022,
    yaw: 0.35,
    pitch: 0.38,
    spinZ: 0,
    spinDir: Math.random() < 0.5 ? -1 : 1,
    petals: 6 + ((Math.random() * 5) | 0),
    rings: Math.random() < 0.35 ? [1, 0.72, 0.46] : [1, 0.6 + Math.random() * 0.18],
    L: F_PETAL_L * lenK,
    W: F_PETAL_W * widK,
    lenK,
    widK,
    coreK: 0.8 + Math.random() * 0.45,
    cup: 1.1 + Math.random(),
    bowl: 7 + Math.random() * 4,
    recurve: 1.6 + Math.random() * 1.4,
    fold: 1.05 + Math.random() * 0.5,
    tipFirst: Math.random() < 0.3,
    bloomDur: 1.3 + Math.random(),
    overshoot: 0.8 + Math.random() * 0.9,
    lagSpread: 0.5 + Math.random() * 1.1,
    whiteK: 0.45 + Math.random() * 0.3,
    glyphs: [...FLOWER.glyphs].sort(() => Math.random() - 0.5).slice(0, 8 + ((Math.random() * 4) | 0)),
    bloomStart: 1 + Math.random() * 9,
    petalVar: Array.from({ length: 16 }, () => ({
      len: 0.9 + Math.random() * 0.2,
      tilt: (Math.random() - 0.5) * 0.16,
      lag: Math.random(),
      skew: (Math.random() - 0.5) * 0.5,
    })),
    words: [],
    cache: document.createElement("canvas"),
    g: null,
    settled: false,
    fadeDur: 0.7 + Math.random() * 0.5,
    breatheSpeed: 0.6 + Math.random() * 0.8,
    breathePhase: Math.random() * TAU,
  };
});
for (const f of flowers) f.g = f.cache.getContext("2d");

function fPetalBloom(f, petal, t) {
  const lag = f.petalVar[petal].lag * f.lagSpread;
  const r = Math.min(1, Math.max(0, (t - f.bloomStart - lag) / f.bloomDur));
  return fEaseOutBack(r, f.overshoot); // opens once, never closes
}

function fMakeGlyph(f, lx, ly, petal, z0, palette, glyphs, sizeBase) {
  const color = Math.random() < f.whiteK ? "#ffffff" : palette[(Math.random() * palette.length) | 0];
  const glyph = glyphs[(Math.random() * glyphs.length) | 0];
  const size = Math.max(2, Math.round((sizeBase + Math.random() * sizeBase) * (f.scale / 16)));
  const sprite = getTextSprite(glyph, color, size);
  return {
    lx,
    ly,
    petal,
    z0,
    sprite: sprite.canvas,
    spriteW: sprite.w,
    spriteH: sprite.h,
    alpha: 0.75 + Math.random() * 0.25,
    phase: Math.random() * TAU,
    speed: 0.5 + Math.random() * 1.4,
    amp: 0.6 + Math.random() * 1.2,
    twSpeed: 0.8 + Math.random() * 2,
  };
}

function fBuildWords(f) {
  f.words = [];
  for (let p = 0; p < f.petals; p++) {
    for (const ring of f.rings) {
      const n = Math.round(FLOWER.wordsPerRing * ring);
      for (let i = 0; i < n; i++) {
        const shell = ring * (0.92 + Math.random() * 0.16);
        const [ox, oy] = fOutlineAt(((i + Math.random() * 0.7) / n) % 1, shell);
        const lx = ox * f.widK + (Math.random() - 0.5) * 0.5 * f.widK;
        const ly = oy * f.lenK + (Math.random() - 0.5) * 0.5 * f.lenK;
        if (ly < 2.4 * f.lenK) continue;
        f.words.push(fMakeGlyph(f, lx, ly, p, 0, FLOWER.colors.petal, f.glyphs, FLOWER.glyphSize));
      }
    }
  }
  for (const [r, n] of [[0.9, 20], [2.0, 40], [3.0, 56], [3.8, 72]]) {
    for (let i = 0; i < n; i++) {
      const a = ((i + Math.random() * 0.6) / n) * TAU;
      const w = fMakeGlyph(
        f,
        Math.cos(a) * r * f.coreK,
        Math.sin(a) * r * f.coreK,
        -1,
        (4.2 - r) * 0.4 * f.coreK,
        FLOWER.colors.core,
        FLOWER.coreGlyphs,
        FLOWER.glyphSize * 0.75,
      );
      w.alpha = 0.9 + Math.random() * 0.1;
      f.words.push(w);
    }
  }
}

// Each flower renders into its own cached bitmap. Once settled the bitmap is
// reused untouched; spin and idle breathe happen on the single blit instead.
function fRender(f, t) {
  const g = f.g;
  const s = f.scale;
  const R = f.cacheR;
  const D = Math.min(W, H) * 1.4;
  const cosY = Math.cos(f.yaw);
  const sinY = Math.sin(f.yaw);
  const cosP = Math.cos(f.pitch);
  const sinP = Math.sin(f.pitch);
  const coreBreath = 1 + 0.05 * Math.sin(t * 1.4);
  const gO = Math.min(1, Math.max(0, fPetalBloom(f, 0, t)));
  const coreK = coreBreath * (0.3 + 0.7 * gO);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, R * 2, R * 2);
  g.globalCompositeOperation = "lighter";
  for (const p of f.words) {
    const isCore = p.petal < 0;
    const o = isCore ? 1 : fPetalBloom(f, p.petal, t);
    const ok = Math.min(1, o);
    let x = p.lx * (isCore ? coreK : 1);
    let y = p.ly * (isCore ? coreK : 1);
    let z = isCore ? p.z0 * (0.3 + 0.7 * gO) : p.z0;
    let ang;
    if (isCore) {
      ang = 0;
    } else {
      const pv = f.petalVar[p.petal];
      const v = Math.min(1, p.ly / f.L);
      const u = p.lx / f.W;
      const wave = f.tipFirst ? 1 - v : v;
      const ol = fSmooth(Math.min(1, Math.max(0, ok * 1.35 - wave * 0.35)));
      x = p.lx * (0.35 + 0.65 * ol) + pv.skew * Math.sin(Math.PI * v) * ol;
      y = p.ly * (0.5 + 0.5 * ol) * pv.len;
      z =
        p.z0 +
        f.cup * ol * u * u * (0.35 + 0.65 * Math.sin(Math.PI * v)) +
        ol * (f.bowl * v * v - f.recurve * v ** 4) +
        (p.petal % 2) * 1.1 * ol;
      const fold =
        (1 - ol) * f.fold +
        pv.tilt * ol +
        Math.sin(t * 0.9 + p.petal * 1.7) * 0.05 * ol;
      const cf = Math.cos(fold);
      const sf = Math.sin(fold);
      const ry = y * cf - z * sf;
      z = y * sf + z * cf;
      y = ry;
      ang = (p.petal / f.petals) * TAU;
    }
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const X = x * ca - y * sa;
    const Y = x * sa + y * ca;
    const wx = X * s + Math.sin(t * p.speed + p.phase) * p.amp;
    const wy = Y * s + Math.cos(t * p.speed * 0.85 + p.phase * 1.6) * p.amp * 0.85;
    const wz = z * s;
    const x1 = wx * cosY + wz * sinY;
    const z1 = wz * cosY - wx * sinY;
    const y2 = wy * cosP - z1 * sinP;
    const z2 = wy * sinP + z1 * cosP;
    const k = D / Math.max(D * 0.5, D - z2);
    const depth = Math.max(-1, Math.min(1, z2 / (s * 12)));
    g.globalAlpha = Math.min(
      1,
      p.alpha *
        (0.88 + 0.12 * Math.sin(t * p.twSpeed + p.phase)) *
        (0.5 + 0.5 * depth) *
        (isCore ? 0.35 + 0.65 * gO : 0.22 + 0.78 * fSmooth(Math.min(1, o * 3))),
    );
    g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (R + x1 * k), dpr * (R + y2 * k));
    g.drawImage(p.sprite, -p.spriteW / 2, -p.spriteH / 2, p.spriteW, p.spriteH);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = "source-over";
}

function fLayout() {
  for (const f of flowers) {
    f.scale = Math.min(W, H) * f.sizeK;
    f.x = W * f.sx;
    f.y = H * f.sy;
    f.cacheR = Math.ceil(f.scale * 24);
    f.cache.width = f.cache.height = Math.ceil(f.cacheR * 2 * dpr);
    fBuildWords(f);
    f.settled = false;
  }
}

function drawFlowers() {
  for (const f of flowers) {
    // Each flower fades in over the moment just before its bloom starts.
    const fadeK = fSmooth(Math.min(1, Math.max(0, (time - f.bloomStart + f.fadeDur) / f.fadeDur)));
    if (fadeK <= 0) continue;
    const bloomingNow = time > f.bloomStart - 0.05 && time < f.bloomStart + f.bloomDur + 1.9;
    if (bloomingNow || dragTarget === f || !f.settled) {
      fRender(f, time);
      if (!bloomingNow && dragTarget !== f) f.settled = true;
    }
    ctx.save();
    ctx.globalAlpha = fadeK * (0.9 + 0.1 * Math.sin(time * f.breatheSpeed + f.breathePhase));
    ctx.translate(f.x, f.y);
    ctx.rotate(f.spinZ);
    ctx.drawImage(f.cache, -f.cacheR, -f.cacheR, f.cacheR * 2, f.cacheR * 2);
    ctx.restore();
  }
}

// Timed violet orbs in three fixed zones: above the heart, below it, and inside it.
const GLOW_PEAK = 0.85; // peak brightness of an orb

const orbs = [];
let outlinePts = []; // heart rim samples in canvas space, for placement tests

let time = 0;

let yaw = 0.45;
let pitch = 0.1;
const ptr = { active: false, dragging: false, moved: 0, lastX: 0, lastY: 0, lastT: 0 };
let hoverX = null;
let hoverY = null;
let dragTarget = null;

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
    glitchy: Math.random() < 0.05, // only some words ever glitch
    glitchAt: time + 3 + Math.random() * 18,
    gStart: -1,
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
  centerSprite = getTextSprite(CENTER_TEXT, "#ffe3ee", Math.round(heartScale * 1.2));
  fLayout();
  outlinePts = [];
  for (let i = 0; i < 240; i++) {
    const p = heartPoint((i / 240) * TAU);
    outlinePts.push([p.x * heartScale, (CENTER_Y - p.y) * heartScale]);
  }
  buildWords();
  orbs.length = 0;
  for (const zone of [0, 1, 2]) {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0); // 1 or 2 orbs per zone
    for (let i = 0; i < n; i++) orbs.push(makeOrb(zone));
  }
  for (const note of document.querySelectorAll(".note")) {
    if (note.style.left) clampNote(note); // dropped photos stay reachable on smaller screens
  }
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

function pointInsideHeart(dx, dy) {
  let inside = false;
  for (let i = 0, j = outlinePts.length - 1; i < outlinePts.length; j = i++) {
    const [xi, yi] = outlinePts[i];
    const [xj, yj] = outlinePts[j];
    if (yi > dy !== yj > dy && dx < ((xj - xi) * (dy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function rimClear(x, y, pad) {
  const dx = x - cx;
  const dy = y - cy;
  for (const [ox, oy] of outlinePts) {
    if ((dx - ox) ** 2 + (dy - oy) ** 2 < pad * pad) return false;
  }
  return true;
}

function pickZoneSpot(zone, r, others) {
  const pad = r * 1.4 + Math.max(16, heartScale);
  const noteRects = [...document.querySelectorAll(".note")].map((n) => n.getBoundingClientRect());
  const labelW = (centerSprite ? centerSprite.w / 2 : 0) + pad;
  const labelH = (centerSprite ? centerSprite.h / 2 : 0) + pad;
  for (let i = 0; i < 90; i++) {
    let x;
    let y;
    if (zone === 2) {
      x = cx + (Math.random() * 2 - 1) * 12 * heartScale;
      y = cy + (Math.random() * 2 - 1) * 10 * heartScale;
      if (!pointInsideHeart(x - cx, y - cy) || !rimClear(x, y, pad)) continue;
    } else if (zone === 0) {
      const yMax = cy - 4 * heartScale;
      if (yMax - 0.05 * H < 20) continue;
      x = (0.07 + Math.random() * 0.86) * W;
      y = 0.05 * H + Math.random() * (yMax - 0.05 * H);
      if (pointInsideHeart(x - cx, y - cy) || !rimClear(x, y, pad)) continue;
    } else {
      const yMin = cy + 4 * heartScale;
      if (0.95 * H - yMin < 20) continue;
      x = (0.07 + Math.random() * 0.86) * W;
      y = yMin + Math.random() * (0.95 * H - yMin);
      if (pointInsideHeart(x - cx, y - cy) || !rimClear(x, y, pad)) continue;
    }
    if (Math.abs(x - cx) < labelW && Math.abs(y - cy) < labelH) continue;
    if (noteRects.some((rc) => x > rc.left - pad && x < rc.right + pad && y > rc.top - pad && y < rc.bottom + pad))
      continue;
    if (others.some((o) => o.on && Math.hypot(x - o.x, y - o.y) < (r + o.r) * 1.05 + 14)) continue;
    return { x, y };
  }
  return null;
}

function makeOrb(zone) {
  return {
    zone,
    x: 0,
    y: 0,
    on: false,
    r: 0,
    period: 3.5 + Math.random() * 3.5,
    phase: Math.random() * 10,
    cycle: -1,
  };
}

function respawnOrb(o) {
  const min = Math.min(W, H);
  o.r = (o.zone === 2 ? 0.018 + Math.random() * 0.027 : 0.022 + Math.random() * 0.053) * min;
  const spot = pickZoneSpot(
    o.zone,
    o.r,
    orbs.filter((p) => p !== o),
  );
  o.on = !!spot;
  if (spot) {
    o.x = spot.x;
    o.y = spot.y;
  }
}

function drawGlow() {
  for (const o of orbs) {
    const t = time + o.phase;
    const cycle = Math.floor(t / o.period);
    if (cycle !== o.cycle) {
      o.cycle = cycle; // relocates at the dimmest point, so the move is invisible
      respawnOrb(o);
    }
    if (!o.on) continue;
    const k = t / o.period - cycle;
    const env = 0.12 + 0.88 * Math.sin(Math.PI * k) ** 2;
    const a = GLOW_PEAK * env;
    if (a < 0.01) continue;
    const R = o.r * (1 + 0.35 * k);
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
    g.addColorStop(0, `rgba(205, 150, 255, ${a})`);
    g.addColorStop(0.12, `rgba(190, 130, 255, ${a * 0.82})`);
    g.addColorStop(0.25, `rgba(178, 115, 255, ${a * 0.6})`);
    g.addColorStop(0.4, `rgba(165, 100, 255, ${a * 0.38})`);
    g.addColorStop(0.55, `rgba(152, 85, 255, ${a * 0.22})`);
    g.addColorStop(0.7, `rgba(140, 72, 255, ${a * 0.11})`);
    g.addColorStop(0.85, `rgba(130, 62, 255, ${a * 0.04})`);
    g.addColorStop(1, "rgba(120, 55, 255, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(o.x - R, o.y - R, R * 2, R * 2);
    ctx.restore();
  }
}

// Deterministic 0–1 hash so glitch jumps stutter at a steady rate.
const hash01 = (n) => {
  const v = Math.sin(n) * 43758.5453;
  return v - Math.floor(v);
};

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

    // Occasional glitch: a few settled words jump hard in stuttery steps, then snap back.
    if (p.glitchy && r === 1 && t >= p.glitchAt) {
      p.gStart = t;
      p.gDur = 0.45 + Math.random() * 0.5;
      p.gSeed = Math.random() * 1000;
      p.gAmp = (0.35 + Math.random() * 0.65) * Math.min(W, H) * 0.22;
      p.gStep = 10 + Math.random() * 8;
      p.glitchAt = t + p.gDur + 6 + Math.random() * 16;
    }
    let gx = 0;
    let gy = 0;
    let flick = 1;
    if (p.gStart >= 0) {
      if (t - p.gStart >= p.gDur) {
        p.gStart = -1; // snap straight back into the heart
      } else {
        const step = Math.floor(t * p.gStep);
        gx = (hash01(step * 1.37 + p.gSeed) * 2 - 1) * p.gAmp;
        gy = (hash01(step * 2.11 + p.gSeed) * 2 - 1) * p.gAmp * 0.75;
        if (hash01(step * 0.73 + p.gSeed) > 0.72) flick = 0.3;
      }
    }

    const wx = p.x * s + Math.sin(t * p.speed + p.phase) * p.amp;
    const wy = p.y * s + Math.cos(t * p.speed * 0.85 + p.phase * 1.6) * p.amp * 0.85;
    const wz = p.z * s;

    const x1 = wx * cosY + wz * sinY;
    const z1 = wz * cosY - wx * sinY;
    const y2 = wy * cosP - z1 * sinP;
    const z2 = wy * sinP + z1 * cosP;

    const k = D / Math.max(D * 0.5, D - z2);
    const depth = Math.max(-1, Math.min(1, z2 / (s * 14)));
    ctx.globalAlpha =
      Math.min(
        1,
        p.alpha *
          (0.88 + 0.12 * Math.sin(t * p.twSpeed + p.phase)) *
          (0.62 + 0.38 * depth) *
          (0.5 + 0.5 * hScale) *
          fade,
      ) * flick;
    const pop = 0.55 + 0.45 * e;
    const sx = hScale * k * pop;
    const sy = vScale * k * pop;
    const px = p.spawnX + (cx + x1 * k - p.spawnX) * e + gx;
    const py = p.spawnY + (cy + y2 * k - p.spawnY) * e + gy;
    ctx.setTransform(dpr * sx, 0, 0, dpr * sy, dpr * px, dpr * py);
    ctx.drawImage(p.sprite, -p.spriteW / 2, -p.spriteH / 2, p.spriteW, p.spriteH);
  }
  const cr = Math.min(1, Math.max(0, (t - 2) / 1));
  if (cr > 0 && centerSprite) {
    // Sits on the heart's own Z axis, so it stays dead-center as the heart spins;
    // it's an oriented label, so it only shows while the face is toward the viewer.
    const face = Math.abs(cosY * cosP);
    const vis = Math.min(1, Math.max(0, (face - 0.7) / 0.18));
    if (vis > 0.01) {
      ctx.globalAlpha = 0.95 * cr * vis;
      ctx.setTransform(dpr, 0, 0, dpr, dpr * cx, dpr * cy);
      ctx.drawImage(
        centerSprite.canvas,
        -centerSprite.w / 2,
        -centerSprite.h / 2,
        centerSprite.w,
        centerSprite.h,
      );
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.restore();
}

function updateRotation(dt) {
  if (ptr.active) return;
  // Objects turn only while hovered or swiped — no idle spin.
  if (hoverX !== null && pointInsideHeart(hoverX - cx, hoverY - cy)) yaw += CONFIG.spin * dt;
  if (hoverX !== null) {
    for (const f of flowers) {
      if (Math.hypot(hoverX - f.x, hoverY - f.y) < f.scale * 18) f.spinZ += FLOWER.spin * f.spinDir * dt;
    }
  }
}

let prev = performance.now();

function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  time += dt;

  updateRotation(dt);

  ctx.clearRect(0, 0, W, H);
  drawGlow();
  drawHeartWords(heartScale);
  drawFlowers();
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
  hoverX = e.clientX;
  hoverY = e.clientY;
  dragTarget =
    flowers.find((f) => Math.hypot(e.clientX - f.x, e.clientY - f.y) < f.scale * 18) ||
    (pointInsideHeart(e.clientX - cx, e.clientY - cy) ? "heart" : null);
});

window.addEventListener("pointermove", (e) => {
  hoverX = e.clientX;
  hoverY = e.clientY;
  if (!ptr.active) return;
  const dx = e.clientX - ptr.lastX;
  const dy = e.clientY - ptr.lastY;
  ptr.lastX = e.clientX;
  ptr.lastY = e.clientY;
  ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.moved > 10) ptr.dragging = true;
  if (!ptr.dragging) return;
  ptr.lastT = performance.now();
  if (dragTarget === "heart") {
    yaw += dx * 0.0065;
    pitch = Math.max(-0.6, Math.min(0.6, pitch + dy * 0.0045));
  } else if (dragTarget && dragTarget !== "heart") {
    dragTarget.yaw += dx * 0.0065;
    dragTarget.pitch = Math.max(-1.2, Math.min(1.2, dragTarget.pitch + dy * 0.0045));
  }
});

window.addEventListener("pointerup", (e) => {
  if (ptr.active && !ptr.dragging) spawnBurst(e.clientX, e.clientY);
  ptr.active = false;
  ptr.dragging = false;
  if (dragTarget && dragTarget !== "heart") dragTarget.settled = false;
  dragTarget = null;
  if (e.pointerType !== "mouse") {
    hoverX = null;
    hoverY = null;
  }
});

window.addEventListener("pointercancel", () => {
  ptr.active = false;
  ptr.dragging = false;
  if (dragTarget && dragTarget !== "heart") dragTarget.settled = false;
  dragTarget = null;
});

window.addEventListener("pointerout", (e) => {
  if (!e.relatedTarget) {
    hoverX = null;
    hoverY = null;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Enter") spawnBurst(cx, cy);
});

// Polaroids can be picked up and dropped anywhere, staying partly on screen.
function clampNote(note) {
  const w = note.offsetWidth;
  const h = note.offsetHeight;
  const x = parseFloat(note.style.left) || 0;
  const y = parseFloat(note.style.top) || 0;
  note.style.left = `${Math.min(Math.max(x, -w * 0.2), W - w * 0.8)}px`;
  note.style.top = `${Math.min(Math.max(y, -h * 0.2), H - h * 0.8)}px`;
}

let noteZ = 10;

for (const note of document.querySelectorAll(".note")) {
  let pid = null;
  let grabX = 0;
  let grabY = 0;
  let baseX = 0;
  let baseY = 0;

  note.addEventListener("pointerdown", (e) => {
    if (pid !== null) return;
    pid = e.pointerId;
    note.setPointerCapture(pid);
    baseX = note.offsetLeft;
    baseY = note.offsetTop;
    note.style.left = `${baseX}px`;
    note.style.top = `${baseY}px`;
    note.style.right = "auto";
    note.style.zIndex = ++noteZ;
    grabX = e.clientX;
    grabY = e.clientY;
    note.classList.add("dragging");
    e.stopPropagation();
  });

  note.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    note.style.left = `${baseX + e.clientX - grabX}px`;
    note.style.top = `${baseY + e.clientY - grabY}px`;
    clampNote(note);
  });

  const drop = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    note.classList.remove("dragging");
    if (note.hasPointerCapture(e.pointerId)) note.releasePointerCapture(e.pointerId);
  };
  note.addEventListener("pointerup", drop);
  note.addEventListener("pointercancel", drop);
}

requestAnimationFrame(frame);
