"use strict";

const TARGET_CORRECT = 10;
const START_TIME = 80;
const MAX_LIVES = 5;
const WAVE_DURATION = 1650;

const SOUND_FILES = {
  swing: "sound/hammer-swing.mp3",
  bonk: "sound/hammer-bonk.mp3",
  pop: "sound/capy-pop.mp3",
  correct: "sound/answer-correct.mp3",
  wrong: "sound/answer-wrong.mp3",
  yelp: "sound/capybara-yelp.mp3",
  clear: "sound/level-clear.mp3",
  ui: "sound/ui-click.mp3"
};

const audioBank = {};
const activeSounds = new Set();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  mapScreen: $("#mapScreen"), gameScreen: $("#gameScreen"), holesGrid: $("#holesGrid"),
  hearts: $("#hearts"), timer: $("#timerValue"), question: $("#questionText"), progress: $("#progressValue"),
  feedback: $("#feedback"), combo: $("#combo"), hammer: $("#hammer"),
  tutorial: $("#tutorialModal"), tutorialContent: $("#tutorialContent"), tutorialDots: $("#tutorialDots"),
  tutorialBack: $("#tutorialBackBtn"), tutorialNext: $("#tutorialNextBtn"),
  pause: $("#pauseModal"), result: $("#resultModal")
};

const state = {
  playing: false, paused: false, lives: MAX_LIVES, time: START_TIME, correct: 0,
  combo: 0, maxCombo: 0, sound: true, question: null, waveTimer: null, clockTimer: null,
  tutorialStep: 0, tutorialStartsGame: false, waveLocked: false, firstPlay: localStorage.getItem("capy-tutorial-seen") !== "1"
};

const tutorialPages = [
  { title: "看清楚乘法題", body: "題目會出現在畫面正上方。先算出答案，再尋找舉著正確數字的卡皮巴拉。", example: "7 × 8 = ?" },
  { title: "敲正確的答案", body: "卡皮巴拉會從不同洞口隨機冒出。滑鼠點擊或用手指輕點正確答案，就能得分！", example: "🔨  敲 56" },
  { title: "保護五顆愛心", body: "敲錯答案會少一顆愛心；卡皮巴拉自然縮回不扣血。用 80 秒答對 10 題就過關！", example: "❤️ ❤️ ❤️ ❤️ ❤️" }
];

function createHoles() {
  elements.holesGrid.innerHTML = "";
  for (let i = 0; i < 9; i += 1) {
    const hole = document.createElement("button");
    hole.type = "button";
    hole.className = "hole";
    hole.dataset.index = String(i);
    hole.setAttribute("aria-label", `第 ${i + 1} 個洞口`);
    hole.innerHTML = `<span class="capy-wrap"><img class="capybara" src="assets/capybara-idle.png" alt="卡皮巴拉"><span class="answer-plate"></span></span>`;
    hole.addEventListener("pointerdown", () => hitHole(hole));
    elements.holesGrid.appendChild(hole);
  }
}

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function newQuestion() {
  let a;
  let b;
  let key;
  do {
    a = 2 + Math.floor(Math.random() * 8);
    b = 2 + Math.floor(Math.random() * 8);
    key = `${a}x${b}`;
  } while (state.question && state.question.key === key);
  state.question = { a, b, answer: a * b, key };
  elements.question.textContent = `${a} × ${b} = ?`;
}

function makeDistractors(answer, count) {
  const pool = new Set();
  const { a, b } = state.question;
  [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b, answer - 2, answer + 2, answer - 1, answer + 1]
    .filter((value) => value > 0 && value !== answer)
    .forEach((value) => pool.add(value));
  while (pool.size < count) {
    const candidate = 4 + Math.floor(Math.random() * 77);
    if (candidate !== answer) pool.add(candidate);
  }
  return shuffle([...pool]).slice(0, count);
}

function clearHoles() {
  $$(".hole").forEach((hole) => {
    hole.classList.remove("is-active", "is-hit", "is-correct");
    hole.dataset.answer = "";
    hole.setAttribute("aria-label", hole.dataset.index ? `第 ${Number(hole.dataset.index) + 1} 個洞口` : "空洞口");
    hole.querySelector(".answer-plate").textContent = "";
    const image = hole.querySelector("img");
    image.src = "assets/capybara-idle.png";
  });
}

function showWave() {
  if (!state.playing || state.paused) return;
  clearTimeout(state.waveTimer);
  clearHoles();
  state.waveLocked = false;

  const activeCount = 2 + Math.floor(Math.random() * 3);
  const holes = shuffle($$(".hole")).slice(0, activeCount);
  const answers = shuffle([state.question.answer, ...makeDistractors(state.question.answer, activeCount - 1)]);
  holes.forEach((hole, index) => {
    hole.dataset.answer = String(answers[index]);
    hole.setAttribute("aria-label", `答案 ${answers[index]}`);
    hole.querySelector(".answer-plate").textContent = answers[index];
    hole.classList.add("is-active");
  });
  playSfx("pop", { volume: 0.16, rate: 0.96 + Math.random() * 0.08 });
  state.waveTimer = setTimeout(showWave, WAVE_DURATION);
}

function hitHole(hole) {
  if (!state.playing || state.paused || state.waveLocked || !hole.classList.contains("is-active")) return;
  state.waveLocked = true;
  bonkHammer();
  playSfx("swing", { volume: 0.42, rate: 1.06 });
  playSfx("bonk", { volume: 0.46 });
  const selected = Number(hole.dataset.answer);
  if (selected === state.question.answer) handleCorrect(hole); else handleWrong(hole);
}

function handleCorrect(hole) {
  clearTimeout(state.waveTimer);
  state.correct += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  hole.classList.add("is-correct");
  showFeedback("答對了！", "good");
  playSfx("correct", { volume: 0.5 });
  updateHud();
  if (state.correct >= TARGET_CORRECT) {
    setTimeout(() => endGame(true), 550);
    return;
  }
  setTimeout(() => {
    newQuestion();
    showWave();
  }, 620);
}

function handleWrong(hole) {
  clearTimeout(state.waveTimer);
  state.lives -= 1;
  state.combo = 0;
  hole.classList.add("is-hit");
  hole.querySelector("img").src = "assets/capybara-hit.png";
  showFeedback("再想一下！", "bad");
  playSfx("wrong", { volume: 0.58, rate: 1.03 });
  playSfx("yelp", { volume: 0.42, rate: 1.12 });
  updateHud();
  if (state.lives <= 0) {
    setTimeout(() => endGame(false), 650);
    return;
  }
  setTimeout(showWave, 1500);
}

function updateHud() {
  elements.hearts.textContent = "❤️".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  elements.hearts.setAttribute("aria-label", `剩下 ${state.lives} 滴血`);
  elements.timer.textContent = state.time;
  elements.progress.textContent = `${state.correct}/${TARGET_CORRECT}`;
  elements.combo.textContent = state.combo >= 2 ? `COMBO ×${state.combo}` : "";
}

function showFeedback(text, type) {
  elements.feedback.className = `feedback ${type}`;
  elements.feedback.textContent = text;
  void elements.feedback.offsetWidth;
  elements.feedback.classList.add("show");
}

function startClock() {
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(() => {
    if (!state.playing || state.paused) return;
    state.time -= 1;
    updateHud();
    if (state.time <= 10 && state.time > 0) playSfx("ui", { volume: 0.1, rate: 1.4 });
    if (state.time <= 0) endGame(false);
  }, 1000);
}

function startGame() {
  closeModal(elements.tutorial);
  closeModal(elements.result);
  showScreen("game");
  Object.assign(state, { playing: true, paused: false, lives: MAX_LIVES, time: START_TIME, correct: 0, combo: 0, maxCombo: 0, waveLocked: false });
  newQuestion();
  updateHud();
  startClock();
  setTimeout(showWave, 500);
}

function endGame(success) {
  if (!state.playing) return;
  state.playing = false;
  clearTimeout(state.waveTimer);
  clearInterval(state.clockTimer);
  clearHoles();
  const stars = success ? (state.lives === 5 && state.time >= 25 ? 3 : state.time >= 10 ? 2 : 1) : 0;
  if (success) {
    const saved = Math.max(Number(localStorage.getItem("capy-level-1-stars") || 0), stars);
    localStorage.setItem("capy-level-1-stars", String(saved));
    renderMapProgress();
  }
  $("#resultBadge").textContent = success ? "🏆" : "🌱";
  $("#resultTitle").textContent = success ? "挑戰成功！" : "差一點就成功了！";
  $("#resultStars").textContent = success ? `${"⭐ ".repeat(stars)}${"☆ ".repeat(3 - stars)}` : "☆ ☆ ☆";
  $("#resultMessage").textContent = success ? "太棒了！你完成了胡蘿蔔農場的乘法任務。" : "回到地圖休息一下，或再挑戰一次吧！";
  $("#resultCorrect").textContent = state.correct;
  $("#resultTime").textContent = `${state.time} 秒`;
  $("#resultCombo").textContent = state.maxCombo;
  openModal(elements.result);
  if (success) playSfx("clear", { volume: 0.48 });
  else if (state.time <= 0) playSfx("wrong", { volume: 0.3, rate: 0.88 });
}

function showScreen(name) {
  elements.mapScreen.classList.toggle("is-active", name === "map");
  elements.gameScreen.classList.toggle("is-active", name === "game");
}

function returnToMap() {
  state.playing = false;
  state.paused = false;
  clearTimeout(state.waveTimer);
  clearInterval(state.clockTimer);
  closeModal(elements.pause);
  closeModal(elements.result);
  showScreen("map");
}

function openTutorial(startsGame) {
  state.tutorialStep = 0;
  state.tutorialStartsGame = startsGame;
  renderTutorial();
  openModal(elements.tutorial);
}

function renderTutorial() {
  const page = tutorialPages[state.tutorialStep];
  $("#tutorialTitle").textContent = page.title;
  elements.tutorialContent.innerHTML = `<p>${page.body}</p><div class="tutorial-example">${page.example}</div>`;
  elements.tutorialDots.innerHTML = tutorialPages.map((_, index) => `<i class="${index === state.tutorialStep ? "active" : ""}"></i>`).join("");
  elements.tutorialBack.hidden = state.tutorialStep === 0;
  elements.tutorialNext.textContent = state.tutorialStep === tutorialPages.length - 1 ? (state.tutorialStartsGame ? "開始挑戰" : "知道了") : "下一步";
}

function tutorialNext() {
  if (state.tutorialStep < tutorialPages.length - 1) {
    state.tutorialStep += 1;
    renderTutorial();
    return;
  }
  localStorage.setItem("capy-tutorial-seen", "1");
  if (state.tutorialStartsGame) startGame(); else closeModal(elements.tutorial);
}

function togglePause() {
  if (!state.playing) return;
  state.paused = !state.paused;
  if (state.paused) openModal(elements.pause); else {
    closeModal(elements.pause);
    showWave();
  }
}

function openModal(modal) { modal.hidden = false; }
function closeModal(modal) { modal.hidden = true; }

function renderMapProgress() {
  const stars = Number(localStorage.getItem("capy-level-1-stars") || 0);
  $("#levelOneStars").textContent = `${"★ ".repeat(stars)}${"☆ ".repeat(3 - stars)}`;
}

function prepareSounds() {
  Object.entries(SOUND_FILES).forEach(([name, src]) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audioBank[name] = audio;
  });
}

function playSfx(name, { volume = 0.4, rate = 1 } = {}) {
  if (!state.sound || !audioBank[name]) return;
  const audio = audioBank[name].cloneNode();
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.playbackRate = rate;
  activeSounds.add(audio);
  const release = () => activeSounds.delete(audio);
  audio.addEventListener("ended", release, { once: true });
  audio.addEventListener("error", release, { once: true });
  const promise = audio.play();
  if (promise) promise.catch(release);
}

function toggleSound() {
  state.sound = !state.sound;
  $("#soundMapBtn").textContent = state.sound ? "🔊" : "🔇";
  $("#soundGameBtn").textContent = state.sound ? "🔊" : "🔇";
  if (!state.sound) {
    activeSounds.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeSounds.clear();
  } else playSfx("ui", { volume: 0.24, rate: 1.08 });
}

function bonkHammer() {
  elements.hammer.classList.remove("is-bonking");
  void elements.hammer.offsetWidth;
  elements.hammer.classList.add("is-bonking");
}

document.addEventListener("pointermove", (event) => {
  elements.hammer.style.left = `${event.clientX}px`;
  elements.hammer.style.top = `${event.clientY}px`;
});
document.addEventListener("pointerdown", bonkHammer);
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".level-node, .mini-button, .button, .hud-button, .exit-button, .round-button")) {
    playSfx("ui", { volume: 0.22 });
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.playing && !state.paused) togglePause();
});

$(".level-one").addEventListener("click", () => openTutorial(true));
$("#helpBtn").addEventListener("click", () => openTutorial(false));
elements.tutorialNext.addEventListener("click", tutorialNext);
elements.tutorialBack.addEventListener("click", () => { state.tutorialStep = Math.max(0, state.tutorialStep - 1); renderTutorial(); });
$("#pauseBtn").addEventListener("click", togglePause);
$("#resumeBtn").addEventListener("click", togglePause);
$("#pauseExitBtn").addEventListener("click", returnToMap);
$("#exitBtn").addEventListener("click", returnToMap);
$("#resultMapBtn").addEventListener("click", returnToMap);
$("#retryBtn").addEventListener("click", startGame);
$("#soundMapBtn").addEventListener("click", toggleSound);
$("#soundGameBtn").addEventListener("click", toggleSound);

createHoles();
renderMapProgress();
prepareSounds();
