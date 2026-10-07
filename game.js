/* Memory Match — game logic. No dependencies, ES module. */

const GRIDS = {
  "4x4": { cols: 4, pairs: 8 },
  "4x5": { cols: 4, pairs: 10 },
  "6x6": { cols: 6, pairs: 18 },
};

const FLIP_BACK_MS = 750; // mismatch shows before flipping back
const PAIR_CONFIRM_MS = 350; // first card stays readable before pair locks

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const muteBtn = document.getElementById("mute");
const restartBtn = document.getElementById("restart");
const sizesEl = document.getElementById("sizes");
const winDialog = document.getElementById("win-dialog");
const winStatsEl = document.getElementById("win-stats");
const winBestEl = document.getElementById("win-best");
const installBtn = document.getElementById("install");

let gridKey = "4x4";
let library = []; // [{file?, caption, emoji?}]
let deck = []; // [{pairId, faceIdx, el, state}]
let firstPick = null;
let lockBoard = false;
let moves = 0;
let matchedPairs = 0;
let startTs = 0;
let timerId = 0;
let soundOn = (localStorage.getItem("mm.sound") ?? "1") === "1";
let audioCtx = null;
let deferredInstall = null;

/* ---------- face library ---------- */

const FACE_EXTS = ["webp", "png", "jpg", "jpeg", "svg"];

async function loadLibrary() {
  let declared = [];
  try {
    const res = await fetch("faces/faces.json", { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      declared = data.faces.map((face) => ({
        file: `faces/${face.file}`,
        caption: face.caption ?? stem(face.file),
      }));
    }
  } catch {
    // no faces.json — fall through to auto-listing
  }
  if (declared.length) return declared;

  // Auto-list faces/face-01..face-64, probing common extensions per index.
  const found = [];
  for (let i = 1; i <= 64; i++) {
    const num = String(i).padStart(2, "0");
    const hit = await firstExisting(FACE_EXTS.map((ext) => `faces/face-${num}.${ext}`));
    if (hit) found.push({ file: hit, caption: `Face ${i}` });
  }
  return found;
}

async function firstExisting(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {
      // offline and not cached — skip
    }
  }
  return null;
}

function stem(name) {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/* Fallback deck (emoji glyphs) so the game is playable before real artwork exists. */
function fallbackLibrary(count) {
  const EMOJI = ["\u{1F34E}", "\u{1F34A}", "\u{1F985}", "\u{1F430}", "\u{1F43B}", "\u{1F43C}",
    "\u{1F98A}", "\u{1F43F}", "\u{1F41D}", "\u{1F41B}", "\u{1F52D}", "\u{1F680}",
    "\u{1F31F}", "\u{1F308}", "\u{1F381}", "\u{1F49A}", "\u{1F525}", "\u{1FAB4}"];
  return EMOJI.slice(0, count).map((emoji, i) => ({
    emoji,
    caption: `Face ${i + 1}`,
  }));
}

/* ---------- deck / board ---------- */

function sampleFaces(count) {
  const pool = shuffle(library.map((_, i) => i));
  return pool.slice(0, count);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const { cols, pairs } = GRIDS[gridKey];
  const pairsList = sampleFaces(pairs);
  const cards = pairsList.flatMap((faceIdx) => [
    { faceIdx, pairId: faceIdx },
    { faceIdx, pairId: faceIdx },
  ]);
  shuffle(cards);

  boardEl.style.setProperty("--cols", String(cols));
  boardEl.dataset.grid = gridKey;
  boardEl.replaceChildren();

  deck = cards.map((card, idx) => {
    const el = document.createElement("button");
    el.className = "card";
    el.type = "button";
    el.dataset.index = String(idx);
    el.setAttribute("role", "gridcell");
    el.setAttribute("aria-label", `Card ${idx + 1}, face down`);

    const inner = document.createElement("div");
    inner.className = "card-inner";
    inner.append(faceCard("face-back"), faceCard("face-front", card.faceIdx));

    el.appendChild(inner);
    boardEl.appendChild(el);
    el.addEventListener("click", () => onFlip(card));

    return { ...card, el, state: "down" };
  });
}

function faceCard(cls, faceIdx) {
  const div = document.createElement("div");
  div.className = `face ${cls}`;
  if (cls === "face-front" && faceIdx != null) {
    const face = library[faceIdx];
    if (face.file) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = face.file;
      img.alt = "";
      div.appendChild(img);
    } else {
      const glyph = document.createElement("span");
      glyph.className = "face-emoji";
      glyph.textContent = face.emoji;
      div.appendChild(glyph);
    }
  }
  return div;
}

/* ---------- gameplay ---------- */

function onFlip(card) {
  if (lockBoard || card.state !== "down") return;
  flipUp(card);
  beep("flip");

  if (!firstPick) {
    firstPick = card;
    card.state = "first";
    return;
  }

  moves++;
  movesEl.textContent = `${moves} move${moves === 1 ? "" : "s"}`;

  const a = firstPick;
  firstPick = null;
  if (card.pairId === a.pairId) resolveMatch(a, card);
  else resolveMismatch(a, card);
}

function resolveMatch(a, b) {
  lockBoard = true;
  // Keep the first card readable briefly so the player sees the pair they made.
  setTimeout(() => {
    a.state = b.state = "matched";
    a.el.disabled = b.el.disabled = true;
    for (const c of [a, b]) {
      c.el.classList.add("is-matched");
      c.el.setAttribute("aria-label", `Matched: ${library[c.faceIdx].caption}`);
    }
    beep("match");
    buzz(30);
    matchedPairs++;
    lockBoard = false;
    maybeWin();
  }, PAIR_CONFIRM_MS);
}

function resolveMismatch(a, b) {
  lockBoard = true;
  setTimeout(() => {
    for (const c of [a, b]) c.el.classList.add("is-wrong");
    beep("wrong");
    buzz([40, 60, 40]);
    setTimeout(() => {
      for (const c of [a, b]) {
        c.state = "down";
        c.el.classList.remove("is-wrong", "is-up");
        c.el.setAttribute("aria-label", "Face down card");
      }
      lockBoard = false;
    }, 320);
  }, FLIP_BACK_MS);
}

function flipUp(card) {
  card.state = "up";
  card.el.classList.add("is-up");
}

function maybeWin() {
  if (matchedPairs < GRIDS[gridKey].pairs) return;
  stopTimer();
  const secs = Math.round((Date.now() - startTs) / 1000);
  beep("win");
  setTimeout(() => showWin(secs), 550);
}

/* ---------- stats ---------- */

function startTimer() {
  startTs = Date.now();
  timerId = setInterval(() => {
    timerEl.textContent = fmtTime(Math.round((Date.now() - startTs) / 1000));
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = 0;
}

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bestKey() {
  return `mm.best.${gridKey}`;
}

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(bestKey())) ?? null;
  } catch {
    return null;
  }
}

function writeBest(score) {
  localStorage.setItem(bestKey(), JSON.stringify(score));
}

function beatsBest(prev, next) {
  if (!prev) return true;
  return next.moves < prev.moves ||
    (next.moves === prev.moves && next.seconds < prev.seconds);
}

function showWin(secs) {
  const score = { moves, seconds: secs };
  const prev = readBest();
  const isBest = beatsBest(prev, score);
  if (isBest) writeBest(score);

  winStatsEl.textContent = `${moves} moves — ${fmtTime(secs)}`;
  winBestEl.textContent = isBest
    ? `New best for ${gridKey}!`
    : `Best: ${prev.moves} moves — ${fmtTime(prev.seconds)}`;
  winDialog.showModal();
}

/* ---------- sound & haptics ---------- */

function beep(kind) {
  if (!soundOn) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const tone = (freq, t0, dur, type = "sine", gain = 0.08) => {
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, now + t0);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      osc.connect(amp).connect(audioCtx.destination);
      osc.start(now + t0);
      osc.stop(now + t0 + dur);
    };
    if (kind === "flip") tone(520, 0, 0.06, "triangle");
    if (kind === "match") {
      tone(660, 0, 0.09);
      tone(880, 0.08, 0.12);
    }
    if (kind === "wrong") tone(180, 0, 0.12, "sawtooth", 0.05);
    if (kind === "win") {
      for (let i = 0; i < 5; i++) tone(440 + i * 110, i * 0.09, 0.14, "triangle", 0.07);
    }
  } catch {
    // audio unavailable — stay silent
  }
}

function buzz(pattern) {
  if (soundOn && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // unsupported
    }
  }
}

/* ---------- install ---------- */

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});

/* ---------- controls ---------- */

function markGridButtons(key) {
  for (const btn of sizesEl.querySelectorAll(".size")) {
    btn.setAttribute("aria-checked", String(btn.dataset.grid === key));
  }
}

function setGrid(key) {
  if (!GRIDS[key]) return;
  gridKey = key;
  localStorage.setItem("mm.grid", key);
  markGridButtons(key);
  restart();
}

function restart() {
  firstPick = null;
  lockBoard = false;
  moves = 0;
  matchedPairs = 0;
  movesEl.textContent = "0 moves";
  timerEl.textContent = "0:00";
  stopTimer();
  buildDeck();
  startTimer();
}

muteBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("mm.sound", soundOn ? "1" : "0");
  muteBtn.setAttribute("aria-pressed", String(!soundOn));
  muteBtn.textContent = soundOn ? "\u{1F50A}" : "\u{1F507}";
});

restartBtn.addEventListener("click", restart);

sizesEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".size");
  if (btn) setGrid(btn.dataset.grid);
});

winDialog.addEventListener("close", restart);

/* ---------- boot ---------- */

async function boot() {
  const params = new URLSearchParams(location.search);
  const paramGrid = params.get("grid");
  const initial = (paramGrid && GRIDS[paramGrid] && paramGrid) ||
    localStorage.getItem("mm.grid") || "4x4";
  gridKey = GRIDS[initial] ? initial : "4x4";
  markGridButtons(gridKey);

  library = await loadLibrary();
  if (library.length < GRIDS["4x4"].pairs) {
    library = fallbackLibrary(Math.max(GRIDS["4x4"].pairs, library.length));
  }
  restart();
}

boot();