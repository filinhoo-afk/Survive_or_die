/**
 * Звук без файлов: все эффекты и музыка синтезируются на WebAudio.
 *
 * Браузер разрешает звук только после действия игрока, поэтому контекст
 * создаётся лениво — в unlock(), из обработчиков клавиш и кликов.
 */

const MASTER_VOLUME = 0.5;
const MUSIC_VOLUME = 0.22;
const SFX_VOLUME = 0.6;

/** Музыка: четыре аккорда в ля миноре, по такту на каждый. Ноты — в полутонах от ля. */
const BPM = 112;
const STEP = 60 / BPM / 2; // восьмая нота
const BASS = [0, -4, -2, -5]; // корни аккордов: A, F, G, E
const ARP = [0, 3, 7, 12, 7, 3, 7, 3]; // минорное арпеджио над корнем
const LOOKAHEAD = 0.15;

const A2 = 110;
const noteHz = (semitones, base = A2) => base * 2 ** (semitones / 12);

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let noiseBuffer = null;

let muted = false;
let musicOn = false;
let nextStep = 0;
let stepIndex = 0;
let timer = null;

/** Минимальный интервал между одинаковыми звуками, с — чтобы толпа не превращалась в шум. */
const COOLDOWNS = { shot: 0.05, kill: 0.04, hit: 0.08, gem: 0.04 };
const lastPlayed = {};

/** Создаёт контекст при первом жесте игрока и размораживает его, если браузер усыпил. */
export function unlock() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = SFX_VOLUME;
    sfxGain.connect(master);

    noiseBuffer = makeNoise();
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (musicOn && !timer) startScheduler();
}

function makeNoise() {
  const length = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Один тон с быстрым затуханием; freqEnd — плавный сдвиг высоты. */
function tone({ type = 'square', freq, freqEnd = freq, duration, volume = 0.3, delay = 0, out = sfxGain }) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Всплеск шума через фильтр — для взрывов и ударов. */
function burst({ duration, volume = 0.3, freq = 1200, freqEnd = freq, delay = 0 }) {
  const start = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = noiseBuffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, start);
  if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter).connect(gain).connect(sfxGain);
  source.start(start);
  source.stop(start + duration + 0.02);
}

const SOUNDS = {
  shot: () => tone({ type: 'square', freq: 720, freqEnd: 240, duration: 0.07, volume: 0.12 }),
  kill: () => {
    burst({ duration: 0.14, volume: 0.35, freq: 1800, freqEnd: 200 });
    tone({ type: 'triangle', freq: 220, freqEnd: 70, duration: 0.12, volume: 0.25 });
  },
  hit: () => {
    burst({ duration: 0.2, volume: 0.5, freq: 900, freqEnd: 120 });
    tone({ type: 'sawtooth', freq: 140, freqEnd: 50, duration: 0.2, volume: 0.35 });
  },
  gem: () => tone({ type: 'sine', freq: 880 + Math.random() * 120, duration: 0.08, volume: 0.15 }),
  levelUp: () => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone({ type: 'square', freq, duration: 0.16, volume: 0.2, delay: i * 0.08 }),
    );
  },
  pick: () => {
    tone({ type: 'triangle', freq: 660, duration: 0.09, volume: 0.25 });
    tone({ type: 'triangle', freq: 990, duration: 0.14, volume: 0.25, delay: 0.07 });
  },
  start: () => {
    tone({ type: 'square', freq: 330, duration: 0.1, volume: 0.2 });
    tone({ type: 'square', freq: 495, duration: 0.18, volume: 0.2, delay: 0.09 });
  },
  pause: () => tone({ type: 'sine', freq: 440, freqEnd: 330, duration: 0.1, volume: 0.2 }),
  /** Фанфара нового рекорда — вступает, когда отзвучал звук смерти. */
  record: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((freq, i) =>
      tone({ type: 'triangle', freq, duration: 0.2, volume: 0.25, delay: 0.9 + i * 0.11 }),
    );
  },
  death: () => {
    tone({ type: 'sawtooth', freq: 330, freqEnd: 40, duration: 1.0, volume: 0.35 });
    burst({ duration: 0.8, volume: 0.4, freq: 1500, freqEnd: 80 });
  },
};

/** Проигрывает эффект по имени; до первого жеста игрока и при mute молчит. */
export function play(name) {
  if (!ctx || muted || !SOUNDS[name]) return;

  const cooldown = COOLDOWNS[name];
  if (cooldown) {
    const now = ctx.currentTime;
    if (now - (lastPlayed[name] ?? -1) < cooldown) return;
    lastPlayed[name] = now;
  }

  SOUNDS[name]();
}

function scheduleStep(index, time) {
  const bar = Math.floor(index / 8) % BASS.length;
  const beat = index % 8;
  const root = BASS[bar];

  // Бас — на сильные доли, арпеджио — каждая восьмая потише.
  if (beat % 4 === 0) {
    const start = time - ctx.currentTime;
    tone({ type: 'triangle', freq: noteHz(root), duration: STEP * 3.5, volume: 0.5, delay: start, out: musicGain });
  }
  tone({
    type: 'square',
    freq: noteHz(root + ARP[beat], A2 * 4),
    duration: STEP * 0.9,
    volume: 0.12,
    delay: time - ctx.currentTime,
    out: musicGain,
  });
}

function startScheduler() {
  nextStep = ctx.currentTime + 0.05;
  timer = setInterval(() => {
    while (nextStep < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(stepIndex, nextStep);
      stepIndex += 1;
      nextStep += STEP;
    }
  }, 50);
}

function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

/** Включает фоновую музыку (повторный вызов ничего не меняет). */
export function startMusic() {
  musicOn = true;
  if (ctx && !timer) startScheduler();
}

export function stopMusic() {
  musicOn = false;
  stopScheduler();
}

/** Приглушает музыку — на паузе и в меню — вместо полной остановки. */
export function setMusicLevel(level) {
  if (!ctx) return;
  musicGain.gain.setTargetAtTime(MUSIC_VOLUME * level, ctx.currentTime, 0.1);
}

export function toggleMute() {
  muted = !muted;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
  return muted;
}

export function isMuted() {
  return muted;
}
