import { CONFIG } from './config.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { Camera } from './engine/camera.js';
import { Player } from './entities/player.js';
import { separate, setHitListener } from './entities/enemy.js';
import { Spawner } from './systems/spawner.js';
import {
  applyContactDamage,
  removeDead,
  resolveEnemyShotHits,
  resolveProjectileHits,
} from './systems/damage.js';
import { Effects } from './systems/effects.js';
import { Boss } from './entities/boss.js';
import { Necromancer } from './entities/necromancer.js';
import { IceWorm } from './entities/iceworm.js';
import { AbyssLord } from './entities/abysslord.js';
import { ENEMY_TYPES } from './enemies/types.js';
import { gemPool, spawnGem } from './entities/gem.js';
import { projectilePool } from './entities/projectile.js';
import { enemyShotPool } from './entities/enemyShot.js';
import { Chest } from './entities/chest.js';
import { updateGems } from './systems/pickups.js';
import {
  applyPickup,
  buildCrates,
  crateLoot,
  enemyDrop,
  rollEliteDrop,
  hitCrates,
  removeBroken,
  spawnPickup,
  updatePickups,
} from './systems/items.js';
import { UpgradeState } from './systems/upgrades.js';
import { cardAt, drawUpgradeScreen } from './ui/upgradeScreen.js';
import { pruneProjectiles } from './systems/weapons.js';
import { Arsenal } from './systems/arsenal.js';
import { HEROES, applyHero, loadHeroIndex, saveHeroIndex } from './systems/heroes.js';
import * as audio from './engine/audio.js';
import { loadRecord, submitRun } from './systems/records.js';
import { isUnlocked, loadCleared, markCleared } from './systems/campaign.js';
import { addGold, applyMeta, buy, loadMeta, META_UPGRADES, runGold } from './systems/meta.js';
import { drawShopScreen, shopRowAt } from './ui/shopScreen.js';
import { drawSummaryScreen } from './ui/summaryScreen.js';
import { formatTime } from './ui/format.js';
import { drawMenuScreen, drawPauseScreen } from './ui/menuScreens.js';
import { createTransition } from './ui/transition.js';
import { atlas } from './art/index.js';
import { Animator } from './gfx/animator.js';
import { DEFAULT_LOCATION, LOCATION_LIST } from './locations/index.js';
import { bakeGround } from './gfx/ground.js';
import { createLighting } from './gfx/lighting.js';
import { createBlizzard } from './gfx/blizzard.js';
import { drawShadow, sortByDepth } from './gfx/shadows.js';
import { blockShots, buildObstacles, collideBodies, collideBody } from './systems/obstacles.js';
import { drawText, textHeight, wrapText } from './gfx/font.js';
import { SpatialGrid } from './systems/grid.js';
import { patchSave, readSave } from './systems/save.js';
import { profiler } from './systems/profiler.js';
import { VOLUME_STEPS, defaultSettings, loadSettings, rebind, saveSettings } from './systems/settings.js';
import { SETTINGS_ROWS, drawSettingsScreen, settingsBarValue, settingsRowAt } from './ui/settingsScreen.js';
import { effectPool } from './systems/effects.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

/** Текущая локация: мир, земля и враги берутся из её данных. */
let location;
let world;
let groundImage;
let obstacles;
/** Сетки для столкновений: препятствия строятся раз на локацию, враги — каждый кадр. */
let obstacleGrid;
let enemyGrid;
/** Метель локации или null, если погода ясная. */
let blizzard;

/** Переключает локацию: перепекает землю и расставляет препятствия заново. */
function setLocation(next) {
  location = next;
  world = location.world;
  groundImage = bakeGround(atlas, location, CONFIG.ground.pixelScale);
  obstacles = buildObstacles(location);
  // Препятствия не двигаются — запас на смещения им не нужен.
  obstacleGrid = new SpatialGrid(world.width, world.height, 64, 0).rebuild(obstacles);
  enemyGrid = new SpatialGrid(world.width, world.height);
  blizzard = location.blizzard ? createBlizzard(CONFIG.width, CONFIG.height, location.blizzard) : null;
  patchSave({ location: location.id });
}

/** Последняя выбранная локация из сохранения, если она всё ещё открыта. */
function savedLocation() {
  const index = LOCATION_LIST.findIndex((l) => l.id === readSave().location);
  return index >= 0 && isUnlocked(LOCATION_LIST, index, loadCleared()) ? LOCATION_LIST[index] : DEFAULT_LOCATION;
}

setLocation(savedLocation());
const lighting = createLighting(canvas.width, canvas.height, CONFIG.lighting);
let settings = loadSettings();
const input = createInput(window, settings.bindings);

/** Применяет настройки: громкость и клавиши вступают в силу сразу и сохраняются. */
function applySettings(next) {
  settings = next;
  audio.setVolumes(settings);
  input.setBindings(settings.bindings);
  saveSettings(settings);
}
audio.setVolumes(settings);

/** Экран настроек: выбранная строка, ожидаемое действие при переназначении и куда вернуться. */
let settingsSelected = 0;
let rebinding = null;
let settingsReturn = 'menu';
let settingsNotice = '';

function openSettings() {
  settingsReturn = mode === 'paused' ? 'paused' : 'menu';
  settingsSelected = 0;
  rebinding = null;
  settingsNotice = '';
  mode = 'settings';
  audio.play('pick');
}

function closeSettings() {
  rebinding = null;
  settingsNotice = '';
  mode = settingsReturn;
}

/** Сдвиг громкости на шаг; на строках не про громкость ничего не делает. */
function nudgeVolume(row, direction) {
  const channel = SETTINGS_ROWS[row];
  if (channel?.kind !== 'volume') return;
  setVolume(channel.id, settings[channel.id] + direction / VOLUME_STEPS);
}

function setVolume(id, value) {
  const next = Math.min(1, Math.max(0, Math.round(value * VOLUME_STEPS) / VOLUME_STEPS));
  if (next === settings[id]) return;
  applySettings({ ...settings, [id]: next });
  audio.play('gem');
}

/** Выбор строки: клавиша — ждём нажатие, сброс — умолчания. */
function activateSetting(row) {
  const item = SETTINGS_ROWS[row];
  if (item.kind === 'key') {
    rebinding = item.id;
    settingsNotice = '';
  } else if (item.kind === 'reset') {
    applySettings(defaultSettings());
    audio.play('pick');
  }
}

/** Ждём клавишу для действия: Esc отменяет, занятые игрой клавиши отклоняем. */
function captureBinding(code) {
  if (code === 'Escape') {
    rebinding = null;
    settingsNotice = '';
    return;
  }
  const next = rebind(settings, rebinding, code);
  if (!next) {
    settingsNotice = 'Эта клавиша занята игрой';
    audio.play('hit');
    return;
  }
  applySettings(next);
  rebinding = null;
  settingsNotice = '';
  audio.play('pick');
}

/** Геймпад листает меню как клавиатура: кнопки превращаются в коды клавиш. */
const PAD_MENU_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'Escape', lb: 'KeyO' };
const PAD_CARD_KEYS = { a: 'Digit1', b: 'Digit2', x: 'Digit3' };

function padKey(button) {
  if (mode === 'playing' && !summary && !offers) return button === 'start' ? 'Escape' : null;
  if (offers) return PAD_CARD_KEYS[button] ?? null;
  if (button === 'start') return mode === 'paused' ? 'Escape' : mode === 'menu' ? 'Enter' : null;
  if (button === 'x') return mode === 'paused' ? 'KeyM' : mode === 'menu' || mode === 'shop' ? 'KeyB' : null;
  if (button === 'y') return mode === 'paused' || summary ? 'KeyR' : null;
  // Пока ждём клавишу для переназначения, геймпад только отменяет.
  if (rebinding) return button === 'b' ? 'Escape' : null;
  if (button === 'lb' && mode !== 'menu' && mode !== 'paused') return null;
  return PAD_MENU_KEYS[button] ?? null;
}

function pollGamepad() {
  for (const button of input.gamepad.justPressed()) {
    const code = padKey(button);
    if (code) onKey({ code, repeat: false, preventDefault() {} });
  }
}

let player;
let camera;
let enemies;
let projectiles;
let enemyShots;
let gems;
/** Разрушаемые ящики на карте и выпавшие предметы. */
let crates;
let pickups;
let spawner;
let arsenal;
let effects;
let upgrades;
/** Босс текущего забега: null, пока не вышел. */
let boss;

/** Золото и купленные постоянные улучшения. */
let meta = loadMeta();
let shopSelected = 0;
/** Выбранный в меню персонаж. */
let heroIndex = loadHeroIndex();

/** Режим игры: меню, магазин, забег или пауза (поражение — это !player.alive). */
let mode = 'menu';

/** Собирает мир с нуля — и для первого запуска, и для рестарта. */
function newRun() {
  player = new Player(world.width / 2, world.height / 2);
  applyHero(HEROES[heroIndex], player);
  applyMeta(meta, player);
  camera = new Camera(canvas.width, canvas.height, world, CONFIG.camera.smoothing);
  enemies = [];
  boss = null;
  // Снаряды и кристаллы прошлого забега возвращаются в пул, а не выбрасываются.
  if (projectiles) projectilePool.releaseAll(projectiles);
  else projectiles = [];
  if (enemyShots) enemyShotPool.releaseAll(enemyShots);
  else enemyShots = [];
  if (gems) gemPool.releaseAll(gems);
  else gems = [];
  crates = buildCrates(world, obstacles);
  pickups = [];
  spawner = new Spawner(world, location.enemies);
  arsenal = new Arsenal();
  arsenal.add(HEROES[heroIndex].weapon);
  effects?.clear();
  effects = new Effects();
  setHitListener((enemy, amount, crit) => {
    // В итоги идёт урон, который враг реально потерял, без перебора на добивании.
    damageDealt += Math.min(amount, enemy.hp);
    if (crit) crits += 1;
    effects.damageNumber(enemy.x, enemy.y - enemy.radius, amount, crit);
    if (crit) camera.addShake(CONFIG.shake.crit);
  });
  upgrades = new UpgradeState(arsenal, player);
  pendingLevels = 0;
  offers = null;
  hoveredCard = -1;
  elapsed = 0;
  kills = 0;
  killsByType = {};
  damageDealt = 0;
  crits = 0;
  summary = null;
  victoryDelay = 0;
  chest = null;

  // Первая волна сразу, чтобы игра не начиналась с пустого ожидания.
  spawner.spawnWave(enemies, camera);
  camera.snapTo(player);
}

/** Боссы со своим поведением; остальные — обычный Boss. */
const BOSS_CLASSES = { necromancer: Necromancer, iceworm: IceWorm, abyssal: AbyssLord };

/** Босс выходит из-за края кадра, как и обычные враги. */
function spawnBoss() {
  const point = spawner.pickSpawnPoint(camera);
  const type = ENEMY_TYPES[location.boss];
  const BossClass = BOSS_CLASSES[type.id] ?? Boss;
  boss = new BossClass(point.x, point.y, type, world);
  enemies.push(boss);
  audio.play('levelUp');
  camera.addShake(CONFIG.shake.playerHit);
}

/** Сколько повышений ещё не разыграно — за раз их может прийти несколько. */
let pendingLevels = 0;
/** Карточки на экране выбора; пока не null, мир стоит на паузе. */
let offers = null;
let hoveredCard = -1;

function openChoice() {
  offers = upgrades.roll(3);
  hoveredCard = -1;
  // Всё прокачано до упора — выбирать не из чего, играем дальше.
  if (offers.length === 0) {
    offers = null;
    pendingLevels = 0;
  }
}

function pickCard(index) {
  if (!offers || index < 0 || index >= offers.length) return;
  const card = offers[index];
  card.apply();
  if (card.evolution) {
    // Эволюция — событие забега: вспышка вокруг героя и встряска.
    audio.play('levelUp');
    effects.deathBurst(player.x, player.y, card.color, 2);
    camera.addShake(CONFIG.shake.crit);
  } else {
    audio.play('pick');
  }
  pendingLevels -= 1;
  offers = null;
  if (pendingLevels > 0) openChoice();
}

const CHOICE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

const transition = createTransition();

const MENU_SHIFT = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

/** Пройденные локации кампании. */
let cleared = loadCleared();

function locationOpen(target = location) {
  return isUnlocked(LOCATION_LIST, LOCATION_LIST.indexOf(target), cleared);
}

/** Выбор локации в меню: листаем список по кругу и пересобираем мир на фоне. */
function shiftLocation(step) {
  const index = LOCATION_LIST.indexOf(location);
  setLocation(LOCATION_LIST[(index + step + LOCATION_LIST.length) % LOCATION_LIST.length]);
  newRun();
  audio.play('pick');
}

/** Выбор персонажа в меню: запоминается и применяется на старте забега. */
function shiftHero(step) {
  heroIndex = (heroIndex + step + HEROES.length) % HEROES.length;
  saveHeroIndex(heroIndex);
  audio.play('pick');
}

/** Из меню в забег; закрытая локация не стартует. */
function startFromMenu() {
  if (locationOpen()) startRunFaded();
  else audio.play('hit');
}

/** Покупка в магазине: звук подтверждает или отказывает. */
function buyUpgrade(index) {
  const next = index >= 0 ? buy(meta, META_UPGRADES[index].id) : null;
  if (next) meta = next;
  audio.play(next ? 'pick' : 'hit');
}

function startRun() {
  newRun();
  mode = 'playing';
  audio.play('start');
}

/** Старт забега и выход в меню идут через затемнение. */
function startRunFaded() {
  transition.go(startRun);
}

/** Следующая локация кампании или undefined, если дальше пока нет. */
function nextLocation() {
  return LOCATION_LIST[LOCATION_LIST.indexOf(location) + 1];
}

/** После победы: идём в следующую локацию, а если её нет — в меню. */
function continueFaded() {
  const next = nextLocation();
  if (!next) {
    menuFaded();
    return;
  }
  transition.go(() => {
    setLocation(next);
    startRun();
  });
}

function menuFaded() {
  transition.go(() => setMode('menu'));
}

function setMode(next) {
  if (mode === next) return;
  if (next === 'paused') audio.play('pause');
  mode = next;
}

function onKey(event) {
  if (event.repeat) return;

  // Браузер включает звук только после жеста игрока — первое нажатие и есть он.
  audio.unlock();
  audio.startMusic();
  if (mode === 'settings' && rebinding) {
    event.preventDefault?.();
    captureBinding(event.code);
    return;
  }
  if (event.code === 'KeyN') {
    audio.toggleMute();
    return;
  }
  // F3 — профилировщик кадра; браузер на F3 открыл бы поиск по странице.
  if (event.code === 'F3') {
    event.preventDefault();
    profiler.toggle();
    return;
  }

  if (transition.busy) return;

  if (mode === 'settings') {
    const up = event.code === 'KeyW' || event.code === 'ArrowUp';
    const down = event.code === 'KeyS' || event.code === 'ArrowDown';
    if (event.code === 'Escape' || event.code === 'KeyO') closeSettings();
    else if (up) settingsSelected = (settingsSelected + SETTINGS_ROWS.length - 1) % SETTINGS_ROWS.length;
    else if (down) settingsSelected = (settingsSelected + 1) % SETTINGS_ROWS.length;
    else if (event.code in MENU_SHIFT) nudgeVolume(settingsSelected, MENU_SHIFT[event.code]);
    else if (event.code === 'Enter' || event.code === 'Space') activateSetting(settingsSelected);
    return;
  }

  if (mode === 'shop') {
    if (event.code === 'Escape' || event.code === 'KeyB') mode = 'menu';
    else if (event.code === 'KeyW' || event.code === 'ArrowUp') {
      shopSelected = (shopSelected + META_UPGRADES.length - 1) % META_UPGRADES.length;
    } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
      shopSelected = (shopSelected + 1) % META_UPGRADES.length;
    } else if (event.code === 'Enter' || event.code === 'Space') buyUpgrade(shopSelected);
    return;
  }

  if (mode === 'menu') {
    if (event.code === 'KeyB') mode = 'shop';
    else if (event.code === 'KeyO') openSettings();
    else if (event.code === 'Enter' || event.code === 'Space') startFromMenu();
    else if (event.code in MENU_SHIFT) shiftLocation(MENU_SHIFT[event.code]);
    else if (event.code === 'KeyW' || event.code === 'ArrowUp') shiftHero(-1);
    else if (event.code === 'KeyS' || event.code === 'ArrowDown') shiftHero(1);
    return;
  }

  if (summary) {
    if (summary.victory) {
      if (event.code === 'Enter') continueFaded();
      else if (event.code === 'KeyR') startRunFaded();
      else if (event.code === 'Escape') menuFaded();
    } else if (event.code === 'KeyR' || event.code === 'Enter') startRunFaded();
    else if (event.code === 'Escape') menuFaded();
    return;
  }

  if (offers) {
    if (event.code in CHOICE_KEYS) pickCard(CHOICE_KEYS[event.code]);
    return;
  }

  if (event.code === 'Escape' || event.code === 'KeyP') {
    setMode(mode === 'paused' ? 'playing' : 'paused');
  } else if (mode === 'paused' && event.code === 'KeyO') {
    openSettings();
  } else if (mode === 'paused' && event.code === 'KeyR') {
    startRunFaded();
  } else if (mode === 'paused' && event.code === 'KeyM') {
    menuFaded();
  }
}

window.addEventListener('keydown', onKey);

// Пауза сама включается, когда вкладка теряет фокус.
window.addEventListener('blur', () => {
  if (mode === 'playing' && !summary && !offers) setMode('paused');
});

/** Канвас растягивается стилями, поэтому переводим координаты мыши в его пиксели. */
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
}

canvas.addEventListener('mousemove', (event) => {
  if (mode === 'settings') {
    const row = settingsRowAt(canvasPoint(event).x, canvasPoint(event).y, canvas);
    if (row >= 0 && !rebinding) settingsSelected = row;
    canvas.style.cursor = row >= 0 ? 'pointer' : 'default';
    return;
  }
  if (mode === 'shop') {
    const { x, y } = canvasPoint(event);
    const row = shopRowAt(x, y, canvas);
    if (row >= 0) shopSelected = row;
    canvas.style.cursor = row >= 0 ? 'pointer' : 'default';
    return;
  }
  if (!offers) return;
  const { x, y } = canvasPoint(event);
  hoveredCard = cardAt(x, y, offers.length, canvas);
  canvas.style.cursor = hoveredCard >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('click', (event) => {
  audio.unlock();
  audio.startMusic();
  if (transition.busy) return;
  if (mode === 'settings') {
    const { x, y } = canvasPoint(event);
    const row = settingsRowAt(x, y, canvas);
    if (rebinding || row < 0) return;
    settingsSelected = row;
    const item = SETTINGS_ROWS[row];
    if (item.kind === 'volume') {
      const value = settingsBarValue(x, canvas);
      if (value !== null) setVolume(item.id, value);
    } else activateSetting(row);
    return;
  }
  if (mode === 'shop') {
    const { x, y } = canvasPoint(event);
    const row = shopRowAt(x, y, canvas);
    if (row >= 0) {
      shopSelected = row;
      buyUpgrade(row);
    }
    return;
  }
  if (mode === 'menu') {
    startFromMenu();
    return;
  }
  if (mode === 'paused') {
    setMode('playing');
    return;
  }
  if (summary) {
    if (summary.victory) continueFaded();
    else startRunFaded();
    return;
  }
  if (!offers) return;
  const { x, y } = canvasPoint(event);
  pickCard(cardAt(x, y, offers.length, canvas));
  canvas.style.cursor = 'default';
});

let elapsed = 0;
let kills = 0;
let killsByType = {};
let damageDealt = 0;
let crits = 0;
/** Итоги забега: собираются один раз в момент смерти, до этого null. */
let summary = null;
/** Секунд до экрана победы после падения босса; 0 — босс ещё жив. */
let victoryDelay = 0;
const VICTORY_DELAY = 1.5;
/** Сундук с наградой за босса: null, пока босс жив. */
let chest = null;

/** Награда: полное лечение и бесплатное улучшение на выбор. */
function openChest() {
  chest.open();
  player.hp = player.maxHp;
  pendingLevels += 1;
  audio.play('levelUp');
  effects.deathBurst(chest.x, chest.y, '#ffd65a', 2);
  effects.levelUp(chest.x, chest.y, player.level);
  camera.addShake(CONFIG.shake.crit);
}
/** Лучшие показатели — для главного меню. */
let record = loadRecord();

/** Фиксирует итоги забега и обновляет рекорд; victory — босс повержен. */
function finishRun(victory = false) {
  const stats = {
    time: elapsed,
    kills,
    level: player.level,
    damage: damageDealt,
    wave: spawner.wave,
    crits,
    killsByType,
    build: upgrades.summary(),
  };
  if (victory) cleared = markCleared(cleared, location.id);
  const result = submitRun(stats);
  record = result.record;
  const gold = runGold(meta, stats, victory);
  meta = addGold(meta, gold);
  summary = { stats, result, victory, location, gold, next: victory ? nextLocation() : undefined };
  if (victory) audio.play('levelUp');
  else if (result.beaten.size > 0) audio.play('record');
}

// Мир нужен уже в меню — он рисуется на фоне.
newRun();

/** В меню герой стоит и идёт — показываем оба клипа рядом. */
const menuHeroes = [new Animator(atlas, 'hero.idle.down'), new Animator(atlas, 'hero.walk.down')];

function update(dt) {
  profiler.begin('логика');
  transition.update(dt);
  pollGamepad();
  if (mode === 'menu' || mode === 'shop' || mode === 'settings') for (const hero of menuHeroes) hero.update(dt);
  // Метель идёт в меню и в живом забеге; пауза и выбор апгрейда замораживают её.
  if (mode === 'menu' || (mode === 'playing' && !summary && !offers)) blizzard?.update(dt);

  // Тряска доигрывает и после смерти игрока, но замирает вместе с миром на паузе.
  if (mode === 'playing' && !offers) camera.updateShake(dt, CONFIG.shake);

  // В меню, на паузе, после смерти и на экране выбора мир замирает целиком.
  if (mode !== 'playing' || summary || offers) return;

  elapsed += dt;
  player.update(dt, input, world, location.surface?.grip);
  collideBody(player, obstacleGrid);
  profiler.lap('ИГРОК');

  // Когда время локации вышло, выходит босс, а обычные волны прекращаются.
  if (location.boss && !boss && elapsed >= location.duration) spawnBoss();
  if (!boss) spawner.update(dt, enemies, camera);

  // Призванных боссом врагов он кладёт в тот же список: идём по копии.
  // Урон от ударов босса тоже считается здесь, поэтому здоровье запоминаем до них.
  const hpBefore = player.hp;
  for (const enemy of [...enemies]) enemy.update(dt, player, enemyShots, enemies);
  if (boss?.slammed) camera.addShake(CONFIG.shake.playerHit);
  profiler.lap('ВРАГИ');
  separate(enemies, enemyGrid.rebuild(enemies));
  collideBodies(enemies, obstacleGrid);
  // Расталкивание и препятствия сдвинули врагов — перекладываем к местам,
  // где их будут искать касания, оружие и снаряды до конца кадра.
  enemyGrid.rebuild(enemies);
  applyContactDamage(player, enemyGrid);
  profiler.lap('ТОЛПА');

  for (const shot of enemyShots) shot.update(dt);
  blockShots(enemyShots, obstacleGrid);
  resolveEnemyShotHits(enemyShots, player);
  if (player.hp < hpBefore) {
    audio.play(player.alive ? 'hit' : 'death');
    camera.addShake(player.alive ? CONFIG.shake.playerHit : CONFIG.shake.playerDeath);
  }
  profiler.lap('ПУЛИ ВРАГОВ');

  // Щит и аура убивают без снарядов — кладут жертв в тот же список.
  const killed = [];
  const shotsBefore = projectiles.length;
  arsenal.update(dt, { player, enemies, enemyGrid, enemyShots, projectiles, killed });
  if (projectiles.length > shotsBefore) audio.play('shot');
  for (const shot of projectiles) shot.update(dt);
  blockShots(projectiles, obstacleGrid);
  killed.push(...resolveProjectileHits(projectiles, enemyGrid));
  profiler.lap('ОРУЖИЕ');

  // Ящики ломаются от снарядов; подобранный предмет срабатывает сразу,
  // а жертвы бомбы идут в общий список убитых.
  for (const crate of crates) crate.update(dt);
  for (const crate of hitCrates(projectiles, crates)) {
    effects.deathBurst(crate.x, crate.y, '#9a6a36', 1);
    audio.play('kill');
    const loot = crateLoot();
    if (loot === 'gem') gems.push(spawnGem(crate.x, crate.y, 5));
    else spawnPickup(pickups, crate.x, crate.y, loot);
  }
  removeBroken(crates);
  for (const pickup of updatePickups(pickups, player, dt)) {
    audio.play('pick');
    effects.deathBurst(pickup.x, pickup.y, pickup.info.color, 1.5);
    killed.push(...applyPickup(pickup, { player, gems, enemies, boss }));
    if (pickup.kind === 'bomb') camera.addShake(CONFIG.shake.playerHit);
  }
  profiler.lap('ПРЕДМЕТЫ');

  kills += killed.length;
  for (const enemy of killed) killsByType[enemy.type.id] = (killsByType[enemy.type.id] ?? 0) + 1;
  if (killed.length > 0) {
    audio.play('kill');
    camera.addShake(CONFIG.shake.enemyDeath * Math.min(killed.length, 4));
  }
  for (const enemy of killed) {
    effects.corpse(enemy);
    effects.deathBurst(enemy.x, enemy.y, enemy.color, enemy.radius / 13);
    gems.push(spawnGem(enemy.x, enemy.y, enemy.xp));
    const drop = enemy.modifier?.drop ? rollEliteDrop() : enemyDrop();
    if (drop) spawnPickup(pickups, enemy.x, enemy.y, drop);
  }

  const xpGained = updateGems(gems, player, dt);
  if (xpGained > 0) audio.play('gem');
  const levelsGained = player.gainXp(xpGained);
  if (levelsGained > 0) audio.play('levelUp');
  for (let i = 0; i < levelsGained; i += 1) {
    effects.levelUp(player.x, player.y, player.level - levelsGained + i + 1);
  }
  pendingLevels += levelsGained;
  if (pendingLevels > 0 && player.alive) openChoice();
  profiler.lap('ДОБЫЧА');

  removeDead(enemies);
  pruneProjectiles(projectiles, world, projectilePool);
  pruneProjectiles(enemyShots, world, enemyShotPool);
  effects.update(dt);

  camera.follow(player, dt);
  profiler.lap('УБОРКА');

  if (!player.alive) {
    finishRun();
  } else if (boss && !boss.alive) {
    if (!chest) {
      // Босс пал: оставшиеся снаряды гаснут, на его месте появляется сундук.
      enemyShotPool.releaseAll(enemyShots);
      boss.dismissMinions?.(enemies);
      audio.play('record');
      camera.addShake(CONFIG.shake.playerDeath);
      chest = new Chest(boss.x, boss.y);
    } else if (!chest.opened) {
      chest.update(dt);
      if (chest.reachedBy(player)) openChest();
    } else {
      // Награда получена и выбрана — пару секунд празднуем и идём к итогам.
      victoryDelay += dt;
      if (victoryDelay >= VICTORY_DELAY) finishRun(true);
    }
  }
}

/** Музыка тише, когда мир стоит: меню, пауза, выбор апгрейда, смерть. */
function syncMusic() {
  const active = mode === 'playing' && !summary && !offers;
  audio.setMusicLevel(active ? 1 : 0.35);
}

function render() {
  profiler.begin('отрисовка');
  syncMusic();
  // Фон за пределами мира — чтобы край был виден, а не обрывался в пустоту.
  ctx.fillStyle = location.colors.outside;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  camera.apply(ctx);

  drawWorld();
  drawShadows();
  profiler.lap('ЗЕМЛЯ');
  chest?.draw(ctx);
  for (const pickup of pickups) pickup.draw(ctx);
  for (const gem of gems) gem.draw(ctx);
  const scene = { player, enemies };
  arsenal.draw(ctx, scene, 'under');
  effects.draw(ctx);
  if (boss?.alive) boss.drawGround?.(ctx);
  // Враги и игрок — в одном списке: кто ниже на экране, тот рисуется поверх.
  for (const body of sortByDepth([player, ...enemies, ...obstacles, ...crates])) body.draw(ctx);
  for (const shot of projectiles) shot.draw(ctx);
  for (const shot of enemyShots) shot.draw(ctx);
  arsenal.draw(ctx, scene, 'over');

  ctx.restore();
  profiler.lap('СПРАЙТЫ');

  drawLighting();
  profiler.lap('СВЕТ');

  if (mode === 'menu') drawMenu();
  else if (mode === 'shop') {
    drawMenu();
    drawShopScreen(ctx, canvas, meta, shopSelected);
  } else if (mode === 'settings') {
    if (settingsReturn === 'paused') drawHud();
    else drawMenu();
    drawSettingsScreen(ctx, canvas, settings, settingsSelected, rebinding, settingsNotice);
  } else {
    drawHud();
    if (mode === 'paused') drawPauseScreen(ctx, canvas);
  }
  transition.draw(ctx, canvas);
  profiler.lap('ИНТЕРФЕЙС');
  drawProfiler();
  profiler.endFrame();
}

/** Панель F3: время по частям кадра и заполненность пулов. */
function drawProfiler() {
  if (!profiler.enabled) return;
  profiler.draw(ctx, canvas, [
    ['СНАРЯДЫ', projectilePool, projectiles.length],
    ['ПУЛИ ВРАГОВ', enemyShotPool, enemyShots.length],
    ['КРИСТАЛЛЫ', gemPool, gems.length],
    ['ЭФФЕКТЫ', effectPool, effects.items.length],
  ]);
}

/** Собирает источники света сцены и накладывает тьму поверх мира. */
function drawLighting() {
  const cfg = CONFIG.lighting;
  const lights = [{ x: player.x, y: player.y, ...cfg.player }];
  for (const shot of projectiles) lights.push({ x: shot.x, y: shot.y, ...cfg.projectile });
  for (const shot of enemyShots) lights.push({ x: shot.x, y: shot.y, ...cfg.enemyShot });
  for (const gem of gems) lights.push({ x: gem.x, y: gem.y, ...cfg.gem });
  for (const pickup of pickups) {
    lights.push({ x: pickup.x, y: pickup.y, ...cfg.gem, color: pickup.info.color });
  }
  lighting.draw(
    ctx,
    lights,
    Math.round(camera.x + camera.shakeX),
    Math.round(camera.y + camera.shakeY),
  );

  // Белая пелена поверх тьмы, под HUD: в метель видно только вокруг героя.
  blizzard?.draw(ctx, player.x - camera.x - camera.shakeX, player.y - camera.y - camera.shakeY);
}

/** Тени всех, кто стоит на земле, — одним слоем под спрайтами. */
function drawShadows() {
  const cfg = CONFIG.shadows;
  for (const gem of gems) drawShadow(ctx, gem.x, gem.y + 8, cfg.gemRadius, cfg);
  for (const o of obstacles) drawShadow(ctx, o.x, o.footY, o.radius * 1.2, cfg);
  for (const c of crates) drawShadow(ctx, c.x, c.footY, c.radius, cfg);
  for (const enemy of enemies) if (!enemy.underground) drawShadow(ctx, enemy.x, enemy.footY, enemy.radius, cfg);
  if (player.visible) drawShadow(ctx, player.x, player.footY, player.radius, cfg);
}

function drawWorld() {
  const view = camera.viewport;
  const left = Math.max(0, Math.floor(view.left));
  const top = Math.max(0, Math.floor(view.top));
  const width = Math.min(world.width, Math.ceil(view.right)) - left;
  const height = Math.min(world.height, Math.ceil(view.bottom)) - top;
  ctx.drawImage(groundImage, left, top, width, height, left, top, width, height);

  ctx.strokeStyle = location.colors.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, world.width - 3, world.height - 3);
}

function drawHud() {
  ctx.save();

  drawXpBar();
  drawHealthBar();
  drawStats();

  // Таймер забега по центру под полосой опыта.
  const colors = CONFIG.colors;
  drawText(ctx, formatTime(elapsed), canvas.width / 2, 16, {
    scale: 4,
    align: 'center',
    color: colors.hudText,
    shadow: colors.hudShadow,
  });

  // До босса остаётся обратный отсчёт; без босса таймер просто идёт вверх.
  if (boss?.alive) {
    drawBossBar();
  } else if (boss) {
    const label = chest?.opened ? 'ПОВЕРЖЕН' : 'ПОВЕРЖЕН — ОТКРОЙ СУНДУК';
    drawText(ctx, `${boss.type.title.toUpperCase()} ${label}`, canvas.width / 2, 52, {
      scale: 2,
      align: 'center',
      color: colors.hudText,
      shadow: colors.hudShadow,
    });
  } else if (location.duration !== null) {
    const left = Math.max(0, location.duration - elapsed);
    drawText(ctx, `БОСС ЧЕРЕЗ ${formatTime(left)}`, canvas.width / 2, 52, {
      scale: 2,
      align: 'center',
      color: colors.hudDim,
      shadow: colors.hudShadow,
    });
  }

  drawMinimap();
  if (summary) drawSummaryScreen(ctx, canvas, summary);
  if (offers) {
    drawUpgradeScreen(ctx, canvas, {
      offers,
      hovered: hoveredCard,
      level: player.level - pendingLevels + 1,
    });
  }

  ctx.restore();
}

/** Рамка полосы: тёмная подложка, цветная заливка и светлая окантовка в пиксель. */
function drawBar(x, y, width, height, ratio, fill) {
  const colors = CONFIG.colors;
  ctx.fillStyle = colors.playerOutline;
  ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
  ctx.fillStyle = colors.hpBarBack;
  ctx.fillRect(x, y, width, height);

  const filled = Math.round(width * Math.max(0, Math.min(1, ratio)));
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, filled, height);
  // Блик сверху придаёт полосе объём.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x, y, filled, 2);

  ctx.strokeStyle = colors.hudBevel;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, width + 3, height + 3);
}

/** Здоровье босса: широкая полоса снизу, на второй фазе краснеет. */
function drawBossBar() {
  const width = 520;
  const height = 18;
  const x = (canvas.width - width) / 2;
  const y = canvas.height - 48;
  drawBar(x, y, width, height, boss.hp / boss.maxHp, boss.phaseNumber === 1 ? boss.type.barColor ?? '#5fbf6a' : '#e0452f');
  drawText(ctx, boss.type.title.toUpperCase(), canvas.width / 2, y - 22, {
    scale: 2,
    align: 'center',
    color: CONFIG.colors.hudText,
    shadow: CONFIG.colors.hudShadow,
  });
}

/** Полоса опыта во всю ширину по верхнему краю экрана. */
function drawXpBar() {
  const height = 6;
  ctx.fillStyle = CONFIG.colors.hpBarBack;
  ctx.fillRect(0, 0, canvas.width, height);
  const filled = Math.round(canvas.width * player.xpRatio);
  ctx.fillStyle = CONFIG.colors.xpBar;
  ctx.fillRect(0, 0, filled, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(0, 0, filled, 2);
  ctx.fillStyle = CONFIG.colors.playerOutline;
  ctx.fillRect(0, height, canvas.width, 2);
}

function drawHealthBar() {
  const colors = CONFIG.colors;
  const x = 18;
  const y = 22;
  const width = 220;
  const height = 20;
  const ratio = player.hpRatio;
  const fill =
    ratio > 0.5 ? colors.hpBar : ratio > 0.25 ? colors.hpBarLow : colors.hpBarCritical;

  drawBar(x, y, width, height, ratio, fill);
  drawText(ctx, `${Math.ceil(player.hp)}/${player.maxHp}`, x + width / 2, y + 3, {
    scale: 2,
    align: 'center',
    color: colors.hudText,
    shadow: colors.hudShadow,
  });
}

/** Столбец текста под здоровьем: уровень, убийства, волна и собранный билд. */
function drawStats() {
  const colors = CONFIG.colors;
  const scale = 2;
  const lineHeight = textHeight(scale) + 6;
  const x = 18;
  let y = 56;

  const rows = [
    [`УР ${player.level}`, `ОПЫТ ${player.xp}/${player.xpToNext}`],
    [`УБИЙСТВ ${kills}`, `ВРАГОВ ${enemies.length}`],
    [`ВОЛНА ${spawner.wave}`, `ЧЕРЕЗ ${spawner.timeToNextWave.toFixed(1)} С`],
  ];
  for (const [main, extra] of rows) {
    drawText(ctx, main, x, y, { scale, color: colors.hudText, shadow: colors.hudShadow });
    drawText(ctx, extra, x + 130, y, { scale, color: colors.hudDim, shadow: colors.hudShadow });
    y += lineHeight;
  }

  const taken = upgrades.summary();
  if (taken) {
    y += 4;
    for (const line of wrapText(taken, 300, 2)) {
      drawText(ctx, line, x, y, { scale: 2, color: colors.hudDim, shadow: colors.hudShadow });
      y += textHeight(2) + 4;
    }
  }
}

function drawMenu() {
  drawMenuScreen(ctx, canvas, record, {
    list: LOCATION_LIST,
    selected: LOCATION_LIST.indexOf(location),
    cleared,
  }, meta.gold, HEROES[heroIndex]);
  menuHeroes.forEach((hero, i) => {
    hero.draw(ctx, canvas.width / 2 + (i === 0 ? -40 : 40), 150, { scale: 4 });
  });
}

/** Миникарта в углу: где игрок и куда смотрит камера. */
function drawMinimap() {
  const width = 120;
  const height = width * (world.height / world.width);
  const x = canvas.width - width - 16;
  const y = 16;
  const scale = width / world.width;

  ctx.fillStyle = 'rgba(8, 10, 16, 0.75)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = location.colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  const view = camera.viewport;
  ctx.strokeStyle = CONFIG.colors.hud;
  ctx.strokeRect(
    x + view.left * scale,
    y + view.top * scale,
    canvas.width * scale,
    canvas.height * scale,
  );

  ctx.fillStyle = '#4a5368';
  for (const o of obstacles) ctx.fillRect(x + o.x * scale - 1, y + o.y * scale - 1, 2, 2);

  for (const enemy of enemies) {
    ctx.fillStyle = enemy.elite ? enemy.modifier.color : enemy.color;
    ctx.beginPath();
    ctx.arc(x + enemy.x * scale, y + enemy.y * scale, enemy.elite ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = CONFIG.colors.player;
  ctx.beginPath();
  ctx.arc(x + player.x * scale, y + player.y * scale, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

createLoop(update, render).start();
