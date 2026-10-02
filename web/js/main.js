// Puddle Imposter — rendering, controls, HUD, meetings, the lava ejection and menus.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game, SPEED, USE_R } from './game.js';
import { MAPS, COLORS, TASK_NAMES, buildMap, roomName } from './maps.js';
import { World, THEMES } from './world.js';
import { Puddle, drawPuddleIcon, setEnv } from './puddle.js';
import { LavaPit } from './eject.js';
import { openTask } from './tasks.js';
import { planChat, humanSays, sayText, botVote, count, coolDown } from './meeting.js';
import { initAudio, sfx, setMood, setMusic, setSfx, audio } from './audio.js';

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

// ------------------------------------------------------------------ renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.has('lq') ? 0.75 : 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
setEnv(env);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.5, 0.97);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());
const dark = $('dark'), dctx = dark.getContext('2d');
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  dark.width = w; dark.height = h;
}
addEventListener('resize', resize); resize();

const lava = new LavaPit();
lava.scene.environment = env; lava.scene.environmentIntensity = 0.25;

// ------------------------------------------------------------------ settings + stats
const DEF = { mapId: -1, role: 'random', imps: 2, count: 10, killCd: 25, smarts: 1, tasksPer: 6, color: 1, name: '' };
const settings = { ...DEF, ...LS.get('pi.settings', {}) };
const stats = { games: 0, wins: 0, crewWins: 0, impWins: 0, dunked: 0, ...LS.get('pi.stats', {}) };
const maxImps = n => n <= 6 ? 1 : n <= 8 ? 2 : 3;
function save(flash) {
  LS.set('pi.settings', settings); LS.set('pi.stats', stats);
  if (flash && S === 'play') { const s = $('saved'); s.classList.remove('hidden'); s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; }
}
setInterval(() => save(true), 30000);

// ------------------------------------------------------------------ title screen
function mapPreview(c, id) {
  const m = buildMap(MAPS[id]), T = THEMES[MAPS[id].theme], g = c.getContext('2d');
  const s = Math.min(c.width / m.W, c.height / m.H), ox = (c.width - m.W * s) / 2, oy = (c.height - m.H * s) / 2;
  g.fillStyle = T.bg; g.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < m.H; j++) for (let i = 0; i < m.W; i++) if (m.grid[j * m.W + i]) { g.fillStyle = m.roomOf[j * m.W + i] >= 0 ? T.floorC : T.hallC; g.fillRect(ox + i * s, oy + j * s, s + 0.5, s + 0.5); }
}
function buildTitle() {
  const maps = $('maps'); maps.innerHTML = '';
  const cards = [...MAPS.map(m => m.id), -1];
  for (const id of cards) {
    const b = document.createElement('div'); b.className = 'mapc' + (settings.mapId === id ? ' sel' : '');
    const c = document.createElement('canvas'); c.width = 240; c.height = 148;
    if (id >= 0) mapPreview(c, id); else { const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 240, 148); gr.addColorStop(0, '#203040'); gr.addColorStop(1, '#402020'); g.fillStyle = gr; g.fillRect(0, 0, 240, 148); g.font = '900 70px sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 120, 78); }
    const n = document.createElement('div'); n.className = 'mn'; n.textContent = id >= 0 ? MAPS[id].name : 'Random';
    const s2 = document.createElement('div'); s2.className = 'ms'; s2.textContent = id >= 0 ? MAPS[id].sub : 'A different map every game';
    b.append(c, n, s2);
    b.onclick = () => { settings.mapId = id; sfx.blip(); buildTitle(); save(); };
    maps.append(b);
  }
  const sw = $('swatches'); sw.innerHTML = '';
  COLORS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'sw' + (settings.color === i ? ' sel' : ''); d.style.boxShadow = `0 0 12px 3px ${c.hex}, inset 0 0 0 2px ${c.hex}`; d.title = c.name; d.onclick = () => { settings.color = i; sfx.blip(); buildTitle(); save(); }; sw.append(d); });
  for (const seg of document.querySelectorAll('.seg')) {
    const k = seg.dataset.k;
    for (const b of seg.children) {
      b.classList.toggle('on', String(settings[k]) === b.dataset.v);
      b.onclick = () => { settings[k] = k === 'role' ? b.dataset.v : +b.dataset.v; if (k === 'count' || k === 'imps') settings.imps = Math.min(settings.imps, maxImps(settings.count)); sfx.blip(); buildTitle(); save(); };
    }
  }
  for (const b of $('o-imps').children) b.style.opacity = +b.dataset.v > maxImps(settings.count) ? 0.3 : 1;
  $('nm').value = settings.name;
  $('stats').textContent = stats.games ? `Games ${stats.games} · Wins ${stats.wins} (crew ${stats.crewWins}, imposter ${stats.impWins}) · Puddles dunked ${stats.dunked}` : '';
  syncAudioButtons();
}
$('nm').oninput = e => { settings.name = e.target.value.trim().slice(0, 12); };
function syncAudioButtons() { for (const id of ['b-music', 'b-music2']) $(id).style.opacity = audio.music ? 1 : 0.45; for (const id of ['b-sfx', 'b-sfx2']) $(id).style.opacity = audio.sfx ? 1 : 0.45; }
for (const id of ['b-music', 'b-music2']) $(id).onclick = () => { initAudio(); setMusic(!audio.music); settings.music = audio.music; syncAudioButtons(); save(); };
for (const id of ['b-sfx', 'b-sfx2']) $(id).onclick = () => { initAudio(); setSfx(!audio.sfx); settings.sfx = audio.sfx; syncAudioButtons(); save(); };
if (settings.music === false) audio.music = false;
if (settings.sfx === false) audio.sfx = false;
$('b-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
$('b-help').onclick = () => { $('scr-help').classList.remove('hidden'); };
$('b-help-close').onclick = () => { $('scr-help').classList.add('hidden'); };
$('b-solo').onclick = () => startGame();
$('b-again').onclick = () => NET ? showLobby() : startGame();
$('b-title').onclick = () => { if (NET) leaveOnline(); toTitle(); };
$('b-quit').onclick = () => { $('scr-pause').classList.add('hidden'); toTitle(); };
$('b-resume').onclick = () => { $('scr-pause').classList.add('hidden'); S = 'play'; };
addEventListener('pointerdown', () => { initAudio(); if (S === 'title') setMood('title'); }, { once: true });

// ------------------------------------------------------------------ game state
let S = 'title', game = null, world = null, models = [], bodyModels = new Map(), taskPanel = null, stateT = 0, killedFx = null;
let camPos = new THREE.Vector3(), visR = 7.5, stepAcc = 0, heatBeep = 0, lastRoom = '', roomT = 0, endT = -1, dripCd = 0;
let me = 0, NET = null;          // NET is set while playing online
const H = () => game.players[me];

function disposeScene(sc) {
  sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); } });
}
function toTitle() {
  if (taskPanel) taskPanel.close();
  S = 'title'; hideAll(); $('scr-title').classList.remove('hidden');
  lava.stop(); lava.showTitle(COLORS.slice(0, 7).map(c => c.hex));
  renderPass.scene = lava.scene; renderPass.camera = lava.camera;
  setMood('title'); buildTitle();
}
function hideAll() { for (const id of ['scr-online', 'scr-lobby', 'scr-title', 'scr-role', 'hud', 'scr-alert', 'scr-meeting', 'scr-end', 'eject-txt', 'bigmap', 'scr-pause', 'scr-help']) $(id).classList.add('hidden'); }

function startGame() {
  initAudio(); save();
  if (NET) leaveOnline();
  me = 0;
  const mapId = Q.has('map') ? +Q.get('map') : settings.mapId >= 0 ? settings.mapId : Math.floor(Math.random() * MAPS.length);
  const role = Q.get('role') || settings.role;
  game = new Game({ mapId, role, imps: Math.min(settings.imps, maxImps(settings.count)), count: settings.count, killCd: settings.killCd, smarts: settings.smarts, tasksPer: settings.tasksPer, color: settings.color, name: settings.name || COLORS[settings.color].name });
  setupGame();
}
function setupGame() {
  if (world) disposeScene(world.scene);
  world = new World(); world.build(game.map, env);
  world.onDrip = pos => { const h = H(); const d = Math.hypot(pos.x - h.x, pos.z - h.z); if (d < 7 && dripCd <= 0) { dripCd = 0.08; sfx.drip(0.35 * (1 - d / 7), (pos.x - h.x) / 7); } };
  const h = H();
  models = game.players.map(p => {
    const lc = h.imp && p.imp ? '#ff3a2a' : null;
    const pd = new Puddle(p.color, p.name, world, lc); world.scene.add(pd.group); return pd;
  });
  bodyModels = new Map(); killedFx = null; endT = -1; visR = game.vision(h);
  lava.stop();
  renderPass.scene = world.scene; renderPass.camera = world.camera;
  camPos.set(h.x, 15, h.z + 9.5);
  // role reveal
  hideAll(); S = 'intro'; stateT = 0;
  $('scr-role').classList.remove('hidden');
  const t = $('role-title'); t.textContent = h.imp ? 'IMPOSTER' : 'CREWMATE'; t.className = 'roletitle ' + (h.imp ? 'imp' : 'crew');
  const ni = game.o.imps;
  $('role-sub').textContent = h.imp ? (ni > 1 ? 'Evaporate the crew with your partner' + (ni > 2 ? 's' : '') + '. Don\'t get caught.' : 'Evaporate the crew. Don\'t get caught.') : `There ${ni === 1 ? 'is 1 Imposter' : 'are ' + ni + ' Imposters'} among the puddles`;
  $('role-map').textContent = game.map.def.name.toUpperCase();
  const team = h.imp ? game.players.filter(p => p.imp) : game.players;
  const rc = $('role-team'), g = rc.getContext('2d'); g.clearRect(0, 0, rc.width, rc.height);
  const n = team.length, sp = Math.min(120, 1000 / n);
  team.forEach((p, i) => { const x = rc.width / 2 + (i - (n - 1) / 2) * sp, s = p.id === me ? 70 : 52; drawPuddleIcon(g, x, 170 - (p.id === me ? 10 : 0), s, p.color); g.font = '700 18px "Avenir Next", sans-serif'; g.fillStyle = h.imp ? '#ff6a5a' : '#fff'; g.textAlign = 'center'; g.fillText(p.name, x, 270); });
  if (h.imp) sfx.imposterReveal(); else sfx.crewReveal();
  setMood('play');
  buildTaskList(); drawMinimapBase();
  if (Q.has('pos')) { const [x, z] = Q.get('pos').split(',').map(Number); h.x = x; h.z = z; }
}

// ------------------------------------------------------------------ input
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') { if (e.code === 'Enter') e.target.blur(); return; }
  initAudio();
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (S === 'title' && e.code === 'Enter') startGame();
  if ((S === 'online' || S === 'lobby') && e.code === 'Escape') { leaveOnline(); toTitle(); }
  if (S === 'play') {
    if (taskPanel && taskPanel.open) return;
    const h = H();
    if (e.code === 'KeyE' || e.code === 'Space') { if (h.inVent >= 0) doVent(); else doUse(); }
    if (e.code === 'KeyR') doReport();
    if (e.code === 'KeyQ') doKill();
    if (e.code === 'KeyV') doVent();
    if (e.code === 'Digit1') doSab('lights');
    if (e.code === 'Digit2') doSab('heat');
    if (h.inVent >= 0 && (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      const l = game.map.vents[h.inVent].links; const cur = (h.ventSel || 0) + (e.code === 'KeyA' || e.code === 'ArrowLeft' ? -1 : 1);
      h.ventSel = (cur + l.length) % l.length; if (NET) nsend({ t: 'act', a: 'vent', op: 'hop', j: l[h.ventSel] }); else game.ventHop(h, l[h.ventSel]); sfx.vent();
    }
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'Escape') { S = 'pause'; $('scr-pause').classList.remove('hidden'); }
  } else if (S === 'pause' && e.code === 'Escape') { S = 'play'; $('scr-pause').classList.add('hidden'); }
  else if (S === 'map' && (e.code === 'KeyM' || e.code === 'Escape')) toggleMap();
  else if (S === 'end' && e.code === 'Enter') startGame();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
$('a-use').onclick = () => { const h = H(); if (h.inVent >= 0) doVent(); else doUse(); };
$('a-report').onclick = () => doReport();
$('a-kill').onclick = () => doKill();
$('a-vent').onclick = () => doVent();
$('a-sab').onclick = () => $('sabmenu').classList.toggle('hidden');
$('s-lights').onclick = () => { doSab('lights'); $('sabmenu').classList.add('hidden'); };
$('s-heat').onclick = () => { doSab('heat'); $('sabmenu').classList.add('hidden'); };
$('minimap').onclick = () => toggleMap();
$('bigmap').onclick = () => toggleMap();
function toggleMap() {
  if (S === 'play') { S = 'map'; $('bigmap').classList.remove('hidden'); drawMap($('bigmapc'), true); sfx.blip(900); }
  else if (S === 'map') { S = 'play'; $('bigmap').classList.add('hidden'); }
}

function doUse() {
  const h = H(), u = game.usable(h); if (!u) return;
  if (u.kind === 'task') {
    if (h.imp) { sfx.bad(); flashBanner('Imposters can only fake tasks', 1.6); return; }
    const t = game.map.tasks[u.id];
    taskPanel = openTask(t.type, () => { if (NET) { h.done.add(u.id); nsend({ t: 'act', a: 'task', id: u.id }); } else game.completeTask(h, u.id); buildTaskList(); }, () => { });
    taskPanel.at = { x: h.x, z: h.z };
  } else if (u.kind === 'lights') {
    taskPanel = openTask('lights', () => NET ? nsend({ t: 'act', a: 'lights' }) : game.fixLights(), () => { });
  } else if (u.kind === 'valve') { h.holding = u.i; if (NET) nsend({ t: 'act', a: 'hold', i: u.i }); sfx.blip(700); }
  else if (u.kind === 'button') { if (NET) nsend({ t: 'act', a: 'button' }); else game.callMeeting(h, null); }
}
function doReport() { const h = H(), b = game.bodyNear(h); if (b) { if (NET) nsend({ t: 'act', a: 'report' }); else game.callMeeting(h, b); } }
function doKill() { const h = H(), t = game.killTarget(h); if (t) { if (NET) nsend({ t: 'act', a: 'kill' }); else game.kill(h, t); } }
function doVent() {
  const h = H(); if (!h.imp || !h.alive) return;
  if (h.inVent >= 0) { if (NET) nsend({ t: 'act', a: 'vent', op: 'out' }); else game.ventOut(h); return; }
  const v = game.ventNear(h); if (v >= 0) { h.ventSel = 0; if (NET) nsend({ t: 'act', a: 'vent', op: 'in' }); else game.ventIn(h, v); }
}
function doSab(type) { const h = H(); if (!h.imp || S !== 'play') return; if (NET) { if (game.sab || game.sabCd > 0) sfx.bad(); else nsend({ t: 'act', a: 'sab', kind: type }); return; } if (!game.sabotage(type)) sfx.bad(); }

let bannerT = 0;
function flashBanner(html, t = 2.5) { const b = $('banner'); b.innerHTML = html; b.classList.remove('hidden'); bannerT = t; }

// ------------------------------------------------------------------ hud
function buildTaskList() {
  const h = H(), L = $('tasklist'); let html = '';
  if (h.imp) html += `<div class="imp">Sabotage and kill everyone.</div><div style="color:#9fb4c4;font-size:12px">Fake tasks:</div>`;
  if (!h.alive && !h.imp) html += `<div style="color:#9fb4c4;font-size:12px">You're a ghost — keep doing tasks</div>`;
  if (game.sab) html += `<div class="sab">${game.sab.type === 'lights' ? '💡 Fix Lights (' + game.map.lights.room + ')' : '🔥 Heatwave! Coolant valves (' + game.map.valves.map(v => v.room).join(' + ') + ')'}</div>`;
  for (const id of h.tasks) { const t = game.map.tasks[id]; html += `<div class="t ${h.done.has(id) && !h.imp ? 'done' : ''}">${t.room}: ${TASK_NAMES[t.type]}</div>`; }
  L.innerHTML = html;
  const { total, done } = game.taskTotals();
  $('tbar').style.width = (done / Math.max(1, total) * 100) + '%';
}
let mmBase = null, mmScale = 1, mmOX = 0, mmOY = 0;
function drawMinimapBase() {
  const m = game.map, T = THEMES[m.def.theme];
  mmBase = document.createElement('canvas'); mmBase.width = 1100; mmBase.height = 760;
  const g = mmBase.getContext('2d');
  mmScale = Math.min(1060 / m.W, 720 / m.H); mmOX = (1100 - m.W * mmScale) / 2; mmOY = (760 - m.H * mmScale) / 2;
  g.fillStyle = 'rgba(10,16,24,.92)'; g.fillRect(0, 0, 1100, 760);
  for (let j = 0; j < m.H; j++) for (let i = 0; i < m.W; i++) { const v = m.grid[j * m.W + i]; if (v) { g.fillStyle = m.roomOf[j * m.W + i] >= 0 ? '#3e5a72' : '#2c4256'; g.fillRect(mmOX + i * mmScale, mmOY + j * mmScale, mmScale + 0.6, mmScale + 0.6); } }
  g.strokeStyle = '#7fb0d8'; g.lineWidth = 3;
  for (const r of m.rooms) { g.strokeRect(mmOX + r.x0 * mmScale, mmOY + r.z0 * mmScale, r.w * mmScale, r.d * mmScale); }
  g.font = '800 20px "Avenir Next", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.75)';
  for (const r of m.rooms) g.fillText(r.name.toUpperCase(), mmOX + r.x * mmScale, mmOY + r.z * mmScale + 6);
  g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(mmOX + m.button.x * mmScale, mmOY + m.button.z * mmScale, 7, 0, 7); g.fill();
}
function drawMap(c, big) {
  const g = c.getContext('2d'), h = H(), m = game.map, k = c.width / 1100;
  g.clearRect(0, 0, c.width, c.height); g.drawImage(mmBase, 0, 0, c.width, c.height);
  const P = (x, z) => [(mmOX + x * mmScale) * k, (mmOY + z * mmScale) * k];
  const blink = Math.sin(performance.now() / 150) > 0;
  if (!h.imp) for (const id of h.tasks) if (!h.done.has(id)) { const t = m.tasks[id]; const [x, y] = P(t.x, t.z); g.fillStyle = '#ffd84a'; g.font = `900 ${big ? 26 : 34}px sans-serif`; g.textAlign = 'center'; g.fillText('!', x, y + 10); }
  if (game.sab && blink) { const pts = game.sab.type === 'lights' ? [m.lights] : m.valves; for (const s of pts) { const [x, y] = P(s.x, s.z); g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(x, y, big ? 12 : 16, 0, 7); g.fill(); } }
  if (h.imp && big) for (const v of m.vents) { const [x, y] = P(v.x, v.z); g.fillStyle = '#8a95a0'; g.fillRect(x - 6, y - 4, 12, 8); }
  const [x, y] = P(h.x, h.z);
  g.fillStyle = h.color; g.shadowColor = h.color; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, big ? 10 : 16, 0, 7); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
}

// ------------------------------------------------------------------ events from the game
function humanSees(x, z) { const h = H(); if (!h.alive) return true; return Math.hypot(x - h.x, z - h.z) <= visR + 0.3 && game.los(h.x, h.z, x, z); }
function handleEvents() {
  const h = H();
  for (const e of game.events) {
    if (e.type === 'kill') {
      const k = game.players[e.killer], v = game.players[e.victim];
      const near = e.victim === me || e.killer === me || humanSees(e.x, e.z);
      if (near) sfx.kill(); else { const d = Math.hypot(e.x - h.x, e.z - h.z); if (d < 18) sfx.splash(1, 0.25 * (1 - d / 18), (e.x - h.x) / 18); }
      world.burst(e.x, 0.7, e.z, 40, 3.2);
      world.wetSpot(e.x, e.z, 2.4, 99999);
      const b = new Puddle(v.color, '', world); b.dead = 1; b.group.position.set(e.x, 0, e.z); b.heading = Math.random() * 6; world.scene.add(b.group); bodyModels.set(v.id, b);
      models[v.id].setGhost(true); if (models[v.id].label) models[v.id].label.material.opacity = 0.5;
      if (e.victim === me) { killedFx = { t: 0, killer: k.id }; $('flash').style.transition = 'none'; $('flash').style.opacity = 0.75; requestAnimationFrame(() => { $('flash').style.transition = 'opacity 1.6s'; $('flash').style.opacity = 0; }); if (taskPanel) taskPanel.close(); flashBanner(`YOU WERE EVAPORATED<small>by ${k.name}</small>`, 3.5); }
    } else if (e.type === 'report' || e.type === 'emergency') {
      if (taskPanel) taskPanel.close();
      S = 'alert'; stateT = 0; $('m-chat').innerHTML = ''; if (!NET) for (const p of game.players) p.voted = null;
      $('hud').classList.add('hidden'); $('scr-alert').classList.remove('hidden');
      $('alert-txt').innerHTML = e.type === 'report' ? 'DEAD BODY<br>REPORTED' : 'EMERGENCY<br>MEETING';
      const c = $('alert-c'), g = c.getContext('2d'); g.clearRect(0, 0, 600, 300);
      drawPuddleIcon(g, e.type === 'report' ? 200 : 300, 150, 90, game.players[e.by].color);
      if (e.type === 'report') drawPuddleIcon(g, 420, 170, 80, game.players[e.body].color, true);
      if (e.type === 'report') sfx.report(); else sfx.emergency();
      setMood(null);
    } else if (e.type === 'vent' || e.type === 'venthop') {
      if (e.p === me || (e.x != null && humanSees(e.x, e.z))) sfx.vent();
    } else if (e.type === 'sabotage') {
      if (e.kind === 'lights') { sfx.lightsOff(); } else { sfx.heatAlarm(); heatBeep = 1; }
      buildTaskList();
    } else if (e.type === 'fixed') {
      if (e.kind === 'lights') sfx.lightsOn(); else sfx.task();
      buildTaskList();
    } else if (e.type === 'task') buildTaskList();
    else if (e.type === 'win') { endT = e.heat ? 2.5 : 2.2; if (e.heat) { $('flash').style.background = '#ff7a10'; $('flash').style.transition = 'opacity 2s'; $('flash').style.opacity = 0.8; } }
  }
  game.events.length = 0;
}

// ------------------------------------------------------------------ meeting
let MT = null;
function cardIcon(p, dead, size = 62) { const c = document.createElement('canvas'); c.width = c.height = size * 2; drawPuddleIcon(c.getContext('2d'), size, size * 1.08, size * 0.8, p.color, dead); return c; }
function startMeeting() {
  S = 'meeting'; stateT = 0;
  $('scr-alert').classList.add('hidden'); $('scr-meeting').classList.remove('hidden');
  const h = H(), o = game.o, M = game.meeting;
  const discuss = NET ? NET.discuss : Q.has('fastmeet') ? 6 : 30, vote = NET ? NET.vote : Q.has('fastmeet') ? 8 : 40;
  MT = { t: 0, discuss, vote, plan: NET ? [] : planChat(game, discuss), replies: [], phase: 'discuss', voteAt: {}, revealT: -1, sel: -1 };
  for (const p of game.players) { if (!NET) p.voted = null; if (p.ai && p.alive) MT.voteAt[p.id] = discuss + 1.5 + game.R() * (vote - 6); }
  const by = game.players[M.by];
  $('m-title').textContent = 'WHO IS THE IMPOSTER?';
  $('m-sub').textContent = M.body >= 0 ? `${by.name} reported ${game.players[M.body].name}'s body in ${M.room}` : `${by.name} called an emergency meeting`;
  $('m-skip').classList.remove('sel'); $('m-skipvotes').innerHTML = '';
  $('m-hint').textContent = h.alive ? 'Click a puddle to accuse or vouch for them' : 'Ghosts can watch, but nobody can hear you';
  document.querySelector('.mquick').style.display = h.alive ? '' : 'none';
  $('m-skip').style.display = h.alive ? '' : 'none';
  buildCards();
  setMood('meeting');
}
function buildCards() {
  const h = H(), box = $('m-cards'); box.innerHTML = '';
  const order = game.players.slice().sort((a, b) => (b.alive - a.alive) || a.id - b.id);
  for (const p of order) {
    const d = document.createElement('div'); d.className = 'pc' + (p.alive ? '' : ' dead') + (p.id === me ? ' me' : '') + (MT.sel === p.id ? ' sel' : '');
    d.append(cardIcon(p, !p.alive));
    const info = document.createElement('div');
    info.innerHTML = `<div class="pn" style="text-shadow:0 0 10px ${p.color}">${p.name}${p.id === me ? ' (you)' : ''}</div><div class="pr">${p.alive ? (h.imp && p.imp && p.id !== me ? '<span class="imptag">IMPOSTER</span>' : p.colorName) : p.ejected ? 'ejected' : 'dead'}</div>`;
    d.append(info);
    if (p.alive && p.voted != null && MT.revealT < 0) { const v = document.createElement('div'); v.className = 'voted'; v.textContent = 'I VOTED'; d.append(v); }
    if (MT.revealT >= 0) { const dots = document.createElement('div'); dots.className = 'dots'; for (const q of game.players) if (q.alive && q.voted === p.id) { const s = document.createElement('div'); s.className = 'dot'; s.style.background = q.color; s.style.boxShadow = `0 0 6px ${q.color}`; dots.append(s); } d.append(dots); }
    if (h.alive && p.alive && MT.revealT < 0 && MT.sel === p.id) {
      if (MT.phase === 'vote' && h.voted == null) {
        const conf = document.createElement('div'); conf.className = 'conf';
        const y = document.createElement('button'); y.className = 'yes'; y.textContent = '✓'; y.onclick = ev => { ev.stopPropagation(); h.voted = p.id; if (NET) nsend({ t: 'vote', target: p.id }); MT.sel = -1; sfx.vote(); buildCards(); };
        const n = document.createElement('button'); n.className = 'no'; n.textContent = '✕'; n.onclick = ev => { ev.stopPropagation(); MT.sel = -1; buildCards(); };
        conf.append(y, n); d.append(conf);
      } else if (MT.phase === 'discuss' && p.id !== me) {
        const menu = document.createElement('div'); menu.className = 'menu';
        for (const [k, lab] of [['accuse', 'Sus!'], ['vent', 'Saw them vent'], ['with', 'They\'re safe']]) {
          const b = document.createElement('button'); b.textContent = lab;
          b.onclick = ev => { ev.stopPropagation(); say(k, p.id); MT.sel = -1; buildCards(); };
          menu.append(b);
        }
        d.append(menu);
      }
    }
    if (p.alive && h.alive && p.id !== me) d.onclick = () => { if (MT.revealT >= 0 || (MT.phase === 'vote' && h.voted != null)) return; MT.sel = MT.sel === p.id ? -1 : p.id; sfx.blip(); buildCards(); };
    else if (p.id === me && p.alive && MT.phase === 'vote') d.onclick = () => { if (h.voted != null || MT.revealT >= 0) return; MT.sel = MT.sel === p.id ? -1 : p.id; buildCards(); };
    box.append(d);
  }
  if (MT.revealT >= 0) { const sv = $('m-skipvotes'); sv.innerHTML = ''; for (const q of game.players) if (q.alive && q.voted === -1) { const s = document.createElement('div'); s.className = 'dot'; s.style.background = q.color; sv.append(s); } }
}
function chat(pid, text) {
  const p = game.players[pid], box = $('m-chat');
  const m = document.createElement('div'); m.className = 'msg' + (p.id === me ? ' me' : '') + (p.alive ? '' : ' dead');
  m.append(cardIcon(p, !p.alive, 34));
  const b = document.createElement('div'); b.className = 'bub'; b.innerHTML = `<b style="color:${p.color};text-shadow:0 0 1px #000">${p.name}</b>`; b.append(document.createTextNode(text));
  m.append(b); box.append(m); box.scrollTop = box.scrollHeight;
  sfx.blip(p.id === me ? 1300 : 900 + pid * 40, 0.6);
}
function say(kind, target) {
  if (NET) { nsend({ t: 'say', kind, target }); return; }
  chat(me, sayText(game, me, kind, target));
  const replies = humanSays(game, kind, target, me);
  for (const r of replies) MT.replies.push({ at: MT.t + r.delay, pid: r.pid, text: r.text });
}
for (const b of document.querySelectorAll('.mquick button')) b.onclick = () => { if (S === 'meeting' && H().alive && MT.revealT < 0) say(b.dataset.q); };
$('m-skip').onclick = () => { const h = H(); if (S !== 'meeting' || MT.phase !== 'vote' || h.voted != null || !h.alive) return; h.voted = -1; if (NET) nsend({ t: 'vote', target: -1 }); $('m-skip').classList.add('sel'); sfx.vote(); buildCards(); };
function updateMeeting(dt) {
  MT.t += dt;
  const total = MT.discuss + MT.vote;
  while (MT.plan.length && MT.plan[0].at <= MT.t) { const l = MT.plan.shift(); const r = l.gen(); if (r) chat(r.pid, r.text); }
  MT.replies.sort((a, b) => a.at - b.at);
  while (MT.replies.length && MT.replies[0].at <= MT.t) { const r = MT.replies.shift(); if (game.players[r.pid].alive) chat(r.pid, r.text); }
  if (MT.revealT >= 0) {
    MT.revealT += dt;
    if (MT.revealT > 4 && !NET) startEject(MT.result);
    return;
  }
  if (MT.phase === 'discuss') {
    $('m-phase').textContent = `Voting begins in ${Math.ceil(MT.discuss - MT.t)}s`;
    $('m-timer').style.width = (1 - MT.t / MT.discuss) * 100 + '%';
    if (MT.t >= MT.discuss) { MT.phase = 'vote'; MT.sel = -1; sfx.tick(true); buildCards(); }
  } else {
    const left = total - MT.t;
    $('m-phase').textContent = `Voting ends in ${Math.ceil(left)}s`;
    $('m-timer').style.width = Math.max(0, left / MT.vote) * 100 + '%';
    if (left < 5 && Math.floor(left * 2) !== MT.lastTick) { MT.lastTick = Math.floor(left * 2); sfx.tick(); }
    let changed = false;
    const tally = {}; for (const p of game.players) if (p.alive && p.voted >= 0) tally[p.voted] = (tally[p.voted] || 0) + 1;
    for (const p of game.players) if (p.ai && p.alive && p.voted == null && MT.t >= MT.voteAt[p.id]) { p.voted = botVote(game, p, tally); changed = true; sfx.vote(); }
    if (changed) buildCards();
    if (NET) return;               // the server decides when voting ends
    const allIn = game.players.every(p => !p.alive || p.voted != null);
    if (allIn || left <= 0) {
      for (const p of game.players) if (p.alive && p.voted == null) p.voted = -1;
      MT.result = count(game);
      MT.revealT = 0; MT.phase = 'reveal'; MT.sel = -1;
      $('m-phase').textContent = 'Votes are in';
      sfx.reveal(); buildCards();
    }
  }
}

// ------------------------------------------------------------------ eject
let EJ = null;
function startEject(r) {
  const ej = r.ejected >= 0 ? game.players[r.ejected] : null;
  if (!NET) coolDown(game);
  game.endMeeting(r.ejected);
  if (NET) { myTp = -1; if (ej) ej.imp = r.imp; }
  if (ej) { models[ej.id].setGhost(true); models[ej.id].group.visible = false; stats.dunked++; }
  for (const [, b] of bodyModels) { world.scene.remove(b.group); b.dispose(); } bodyModels.clear();
  for (const s of world.spots) { s.m.visible = false; }
  S = 'eject'; stateT = 0;
  $('scr-meeting').classList.add('hidden'); $('scr-alert').classList.add('hidden'); $('hud').classList.add('hidden'); $('scr-role').classList.add('hidden');
  renderPass.scene = lava.scene; renderPass.camera = lava.camera;
  lava.startEject(ej ? { color: ej.color } : null);
  setMood('lava');
  const left = NET ? r.left : game.impAlive();
  const l1 = ej ? `${ej.name} was ${ej.imp ? 'An Imposter.' : 'not An Imposter.'}` : `No one was ejected. ${r.tie ? '(Tie)' : '(Skipped)'}`;
  const l2 = `${left} Imposter${left === 1 ? '' : 's'} remain${left === 1 ? 's' : ''}.`;
  EJ = { l1, l2, start: ej ? 3.1 : 1.2, shown: 0, rev: false, imp: ej && ej.imp };
  $('eject-l1').textContent = ''; $('eject-l2').textContent = '';
  $('eject-txt').classList.remove('hidden');
  if (!ej) lava.t = 4;          // skip the walk
}
function updateEject(dt) {
  const t = lava.t;
  if (t > EJ.start) {
    const n = Math.min(EJ.l1.length + EJ.l2.length, Math.floor((t - EJ.start) * 24));
    if (n > EJ.shown) { EJ.shown = n; if (n % 2) sfx.tick(); }
    $('eject-l1').textContent = EJ.l1.slice(0, n);
    $('eject-l2').textContent = n > EJ.l1.length ? EJ.l2.slice(0, n - EJ.l1.length) : '';
    if (!EJ.rev && n >= EJ.l1.length) { EJ.rev = true; if (EJ.imp) sfx.crewReveal(); }
  }
  if (lava.done || (lava.mode === 'eject' && !lava.actors.length && t > 8.5)) {
    lava.stop(); $('eject-txt').classList.add('hidden');
    if (game.winner) { showEnd(); return; }
    S = 'play'; renderPass.scene = world.scene; renderPass.camera = world.camera;
    $('hud').classList.remove('hidden'); setMood('play'); buildTaskList();
    const h = H(); camPos.set(h.x, 15, h.z + 9.5);
    if (!h.alive) { $('ghostnote').classList.remove('hidden'); $('ghostmsg').textContent = h.imp ? 'your partner has to finish the job.' : 'finish your tasks to help the crew win!'; }
  }
}

// ------------------------------------------------------------------ end
function showEnd() {
  S = 'end'; if (taskPanel) taskPanel.close();
  hideAll(); $('scr-end').classList.remove('hidden');
  $('flash').style.opacity = 0; setTimeout(() => $('flash').style.background = '#ff1a1a', 2000);
  const h = H(), w = game.winner, won = (w.side === 'imp') === h.imp;
  const t = $('end-title'); t.textContent = won ? 'VICTORY' : 'DEFEAT'; t.className = won ? 'win' : 'lose';
  $('end-sub').textContent = (w.side === 'imp' ? 'Imposters win — ' : 'Crewmates win — ') + w.why;
  const box = $('end-players'); box.innerHTML = '';
  for (const p of game.players) {
    const d = document.createElement('div'); d.className = 'ep' + (p.imp ? ' imp' : '');
    d.append(cardIcon(p, !p.alive, 90));
    d.insertAdjacentHTML('beforeend', `<div class="n" style="text-shadow:0 0 10px ${p.color}">${p.name}</div><div class="r" style="color:${p.imp ? '#ff5a4a' : '#8fd8ff'}">${p.imp ? 'IMPOSTER' : 'CREWMATE'}</div><div class="r" style="color:#8fa2b2">${p.alive ? 'alive' : p.ejected ? 'lava' : 'evaporated'}</div>`);
    box.append(d);
  }
  $('b-again').textContent = NET ? 'BACK TO LOBBY' : 'PLAY AGAIN';
  stats.games++; if (won) { stats.wins++; if (h.imp) stats.impWins++; else stats.crewWins++; }
  save();
  if (won) sfx.win(); else sfx.lose();
  setMood('title');
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
const proj = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; if (Q.has('dbg')) document.title = `${fps.toFixed(0)} fps`; }
  stateT += dt; dripCd -= dt;
  const aspect = innerWidth / innerHeight;
  if (S === 'title') lava.update(dt, aspect);
  else if (S === 'eject') { lava.update(dt, aspect); updateEject(dt); }
  else if (game && world) {
    if (S === 'intro' && stateT > (Q.has('auto') ? 0.5 : 4.2)) { S = 'play'; $('scr-role').classList.add('hidden'); $('hud').classList.remove('hidden'); }
    if (S === 'play') playUpdate(dt);
    if (S === 'alert' && stateT > 2.6) startMeeting();
    if (S === 'meeting') updateMeeting(dt);
    if (S !== 'end' && S !== 'pause' && S !== 'map') drawWorld(dt, aspect);
    else if (S === 'map') drawMap($('bigmapc'), true);
  }
  composer.render();
  requestAnimationFrame(frame);
}

function playUpdate(dt) {
  const h = H();
  // movement
  const busy = taskPanel && taskPanel.open;
  let mx = 0, mz = 0;
  if (!busy && h.inVent < 0) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  }
  if (killedFx && killedFx.t < 1.8) { mx = mz = 0; }
  const len = Math.hypot(mx, mz);
  if (len) {
    const sp = SPEED * (h.alive ? 1 : 1.3);
    mx /= len; mz /= len;
    const ox = h.x, oz = h.z;
    game.move(h, mx * sp * dt, mz * sp * dt, !h.alive);
    h.vx = (h.x - ox) / dt; h.vz = (h.z - oz) / dt; h.face = Math.atan2(mx, mz);
    if (h.alive) { stepAcc += Math.hypot(h.x - ox, h.z - oz); if (stepAcc > 0.9) { stepAcc = 0; sfx.step(0.9); } }
  } else { h.vx = h.vz = 0; }
  if (h.holding >= 0) { const v = game.map.valves[h.holding]; if (!game.sab || Math.hypot(h.x - v.x, h.z - v.z) > USE_R + 0.4) { h.holding = -1; if (NET) nsend({ t: 'act', a: 'hold', i: null }); } }
  if (taskPanel && taskPanel.open && taskPanel.at && Math.hypot(h.x - taskPanel.at.x, h.z - taskPanel.at.z) > 2) taskPanel.close();
  if (NET) netPlay(dt); else game.update(dt);
  handleEvents();
  if (killedFx) killedFx.t += dt;
  if (endT >= 0) { endT -= dt; if (endT < 0) showEnd(); }
  // hud
  const use = game.usable(h), body = game.bodyNear(h), kt = game.killTarget(h), vn = game.ventNear(h);
  $('a-use').classList.toggle('on', !!use && !(use.kind === 'task' && h.imp) || h.inVent >= 0);
  $('a-report').classList.toggle('on', !!body);
  $('a-report').classList.toggle('hidden', !h.alive);
  $('a-kill').classList.toggle('hidden', !h.imp || !h.alive);
  $('a-vent').classList.toggle('hidden', !h.imp || !h.alive);
  $('a-sab').classList.toggle('hidden', !h.imp);
  if (h.imp) {
    $('a-kill').classList.toggle('on', !!kt);
    $('kill-cd').textContent = h.killCd > 0 ? Math.ceil(h.killCd) : '';
    $('a-vent').classList.toggle('on', vn >= 0 || h.inVent >= 0);
    const sabReady = !game.sab && game.sabCd <= 0;
    $('a-sab').classList.toggle('on', sabReady);
    $('sab-cd').textContent = game.sab || sabReady ? '' : Math.ceil(game.sabCd);
  }
  $('ventbar').classList.toggle('hidden', h.inVent < 0);
  const room = h.room || roomName(game.map, h.x, h.z);
  if (room !== lastRoom) { lastRoom = room; $('roomname').textContent = room.toUpperCase(); $('roomname').style.opacity = 1; roomT = 2.5; }
  roomT -= dt; if (roomT < 0) $('roomname').style.opacity = 0.35;
  // sabotage banner
  bannerT -= dt;
  if (game.sab) {
    const s = game.sab;
    if (s.type === 'heat') {
      const held = s.held.filter(Boolean).length;
      $('banner').innerHTML = `🔥 HEATWAVE — EVERYONE IS MELTING 🔥<small>${h.imp ? 'Let them boil' : 'Hold BOTH coolant valves at the same time'} · ${Math.ceil(s.t)}s · valves ${held}/2${h.holding >= 0 ? ' · you are holding one' : ''}</small>`;
      $('banner').classList.remove('hidden');
      heatBeep -= dt; if (heatBeep <= 0) { heatBeep = s.t < 10 ? 0.5 : 1; sfx.heatAlarm(); }
      $('heatfx').style.opacity = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    } else {
      $('banner').innerHTML = h.imp ? '💡 Lights are out<small>Crew vision is tiny now</small>' : `💡 LIGHTS SABOTAGED<small>Flip the breakers in ${game.map.lights.room}</small>`;
      $('banner').classList.remove('hidden'); $('heatfx').style.opacity = 0;
    }
  } else { $('heatfx').style.opacity = 0; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  drawMap($('minimap'), false);
}

function drawWorld(dt, aspect) {
  const h = H(), t = world.t;
  const target = game.vision(h);
  visR += (target - visR) * Math.min(1, dt * 1.6);
  const heat = game.sab && game.sab.type === 'heat';
  world.update(dt, h, { lightsOut: game.sab && game.sab.type === 'lights', heat });
  // characters
  game.players.forEach((p, i) => {
    const pd = models[i];
    let vis;
    if (p.alive) vis = p.inVent < 0 && (p.id === me || humanSees(p.x, p.z));
    else vis = !h.alive && !p.ejected;
    pd.group.visible = vis;
    pd.melt = heat ? 1.2 : 0;
    pd.group.position.set(p.x, p.alive ? 0 : 0.35 + Math.sin(t * 2 + i) * 0.12, p.z);
    if (vis) pd.update(dt, t, p.vx, p.vz, p.face);
  });
  for (const [id, b] of bodyModels) { const bd = game.bodies.find(x => x.pid === id); b.group.visible = !!bd && humanSees(b.group.position.x, b.group.position.z); if (b.group.visible) b.update(dt, t, 0, 0, b.heading); }
  // task / fix markers
  let k = 0;
  if (h.alive || !h.imp) for (const id of h.tasks) { if (h.done.has(id) && !h.imp) continue; const tk = game.map.tasks[id]; world.marker(k++, tk.x, tk.z, true, Math.hypot(h.x - tk.x, h.z - tk.z) < USE_R); }
  if (game.sab && !h.imp && h.alive) for (const s of game.sab.type === 'lights' ? [game.map.lights] : game.map.valves) world.marker(k++, s.x, s.z, true, true);
  world.hideMarkers(k);
  // camera
  const C = world.camera; C.aspect = aspect; C.fov = aspect < 1.2 ? 52 : 38;
  let off = new THREE.Vector3(0, 15, 9.5);
  if (S === 'intro') off.set(0, 9 + stateT * 1.4, 6 + stateT * 0.85);
  if (killedFx && killedFx.t < 2.4) { const k2 = Math.sin(Math.min(1, killedFx.t / 2.4) * Math.PI); off.lerp(new THREE.Vector3(0, 5, 4), k2); }
  const want = new THREE.Vector3(h.x, 0, h.z).add(off);
  camPos.lerp(want, Math.min(1, dt * 6));
  C.position.copy(camPos);
  if (heat) { C.position.x += (Math.random() - 0.5) * 0.04; C.position.y += (Math.random() - 0.5) * 0.04; }
  C.lookAt(camPos.x - off.x, 0.4, camPos.z - off.z);
  C.updateProjectionMatrix();
  drawDark();
}

function drawDark() {
  const W = dark.width, Hh = dark.height, h = H();
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, W, Hh);
  if (!h.alive || (S !== 'play' && S !== 'intro' && S !== 'alert')) return;
  const C = world.camera, r = visR;
  const P = (x, z) => { proj.set(x, 0.9, z).project(C); return [(proj.x + 1) / 2 * W, (1 - proj.y) / 2 * Hh]; };
  const [cx, cy] = P(h.x, h.z), [rx] = P(h.x + r, h.z), [, ry1] = P(h.x, h.z + r), [, ry0] = P(h.x, h.z - r);
  const RX = Math.abs(rx - cx), RY = (Math.abs(ry1 - cy) + Math.abs(cy - ry0)) / 2, kk = RY / RX;
  dctx.fillStyle = game.sab && game.sab.type === 'lights' ? 'rgba(1,2,4,.96)' : 'rgba(2,4,8,.86)';
  dctx.fillRect(0, 0, W, Hh);
  dctx.globalCompositeOperation = 'destination-out';
  dctx.save(); dctx.translate(cx, cy); dctx.scale(1, kk);
  const gr = dctx.createRadialGradient(0, 0, 0, 0, 0, RX); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.78, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = gr; dctx.beginPath();
  const N = 180;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let d = 0.2; const stepL = 0.18;
    while (d < r) { if (!game.open(Math.floor(h.x + dx * d), Math.floor(h.z + dz * d))) { d += 0.5; break; } d += stepL; }
    d = Math.min(d, r);
    const [px, py] = P(h.x + dx * d, h.z + dz * d);
    const lx = px - cx, ly = (py - cy) / kk;
    if (i === 0) dctx.moveTo(lx, ly); else dctx.lineTo(lx, ly);
  }
  dctx.closePath(); dctx.fill(); dctx.restore();
  dctx.globalCompositeOperation = 'source-over';
}


// ------------------------------------------------------------------ online
// The server (server.js on Render) runs the real game; this page mirrors it, sends our moves and actions,
// and draws everything the same way as solo.
const SERVER = (window.__server || (location.protocol.startsWith('http') && !Q.has('render') ? location.origin : 'https://puddle-imposter.onrender.com')).replace(/\/$/, '');
let ws = null, lobbyState = null, myTp = 0, posT = 0, listT = null, wantJoin = null;
function nsend(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function netStatus(t, bad) { const e = $('on-status'); e.textContent = t; e.style.color = bad ? '#ff7a6a' : '#8fa2b2'; }
function connect(then) {
  if (ws && ws.readyState === 1) { then && then(); return; }
  if (ws && ws.readyState === 0) { ws.addEventListener('open', () => then && then()); return; }
  netStatus('Connecting… (a sleeping server can take up to a minute to wake up)');
  try { ws = new WebSocket(SERVER.replace(/^http/, 'ws')); } catch { netStatus('Could not reach the server.', true); return; }
  ws.onopen = () => { netStatus('Connected'); nsend({ t: 'me', name: settings.name || COLORS[settings.color].name, color: settings.color }); then && then(); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } onNet(m); };
  ws.onclose = () => {
    ws = null;
    if (NET && S !== 'title' && S !== 'end') { NET = null; toTitle(); flashTitleMsg('Lost connection to the server.'); }
    else if (S === 'online' || S === 'lobby') { netStatus('Disconnected. Try again.', true); showOnline(); }
  };
}
function flashTitleMsg(t) { $('stats').textContent = t; }
function showOnline() {
  hideAll(); S = 'online'; $('scr-online').classList.remove('hidden');
  connect(() => nsend({ t: 'list' }));
  clearInterval(listT); listT = setInterval(() => { if (S === 'online') nsend({ t: 'list' }); else clearInterval(listT); }, 2500);
}
function showLobby() {
  if (!lobbyState) { showOnline(); return; }
  hideAll(); S = 'lobby'; $('scr-lobby').classList.remove('hidden');
  renderPass.scene = lava.scene; renderPass.camera = lava.camera; setMood('title');
  drawLobby();
}
function leaveOnline() { nsend({ t: 'leave' }); NET = null; lobbyState = null; if (taskPanel) taskPanel.close(); }
function inviteLink(code) { const base = location.protocol.startsWith('http') ? location.origin + location.pathname : SERVER + '/'; return `${base}?join=${code}`; }
function drawLobby() {
  const L = lobbyState; if (!L) return;
  const host = L.host === NET?.id || L.host === myNetId;
  $('lb-code').textContent = L.code;
  $('lb-pub').textContent = L.pub ? 'Public lobby — anyone can join from the list' : 'Private lobby — share the code';
  const box = $('lb-players'); box.innerHTML = '';
  for (const p of L.players) {
    const d = document.createElement('div'); d.className = 'lp';
    const c = document.createElement('canvas'); c.width = c.height = 120; drawPuddleIcon(c.getContext('2d'), 60, 64, 40, COLORS[p.color].hex);
    d.append(c); d.insertAdjacentHTML('beforeend', `<div>${p.name}${p.id === myNetId ? ' (you)' : ''}${p.id === L.host ? ' 👑' : ''}</div>`);
    box.append(d);
  }
  const o = L.opts, bots = Math.max(0, o.count - L.players.length);
  $('lb-sum').textContent = `${o.mapId < 0 ? 'Random map' : MAPS[o.mapId].name} · ${o.imps} imposter${o.imps > 1 ? 's' : ''} · ${L.players.length} player${L.players.length > 1 ? 's' : ''} + ${bots} computer puddle${bots === 1 ? '' : 's'} · kill cooldown ${o.killCd}s`;
  $('lb-host').classList.toggle('hidden', !host);
  $('lb-start').classList.toggle('hidden', !host);
  $('lb-wait').classList.toggle('hidden', host);
  $('lb-wait').textContent = L.inGame ? 'A round is still running…' : 'Waiting for the host to start…';
  if (host) {
    const sel = $('lb-map'); if (!sel.options.length) { sel.add(new Option('Random map', -1)); MAPS.forEach(m => sel.add(new Option(m.name, m.id))); }
    sel.value = o.mapId;
    for (const b of $('lb-count').children) b.classList.toggle('on', +b.dataset.v === o.count);
    for (const b of $('lb-imps').children) b.classList.toggle('on', +b.dataset.v === o.imps);
  }
}
let myNetId = 0;
function lobbyOpts(patch) { nsend({ t: 'opts', opts: { ...lobbyState.opts, ...patch } }); }
$('lb-map').onchange = e => lobbyOpts({ mapId: +e.target.value });
for (const b of $('lb-count').children) b.onclick = () => lobbyOpts({ count: +b.dataset.v, imps: Math.min(lobbyState.opts.imps, maxImps(Math.max(+b.dataset.v, lobbyState.players.length))) });
for (const b of $('lb-imps').children) b.onclick = () => lobbyOpts({ imps: Math.min(+b.dataset.v, maxImps(Math.max(lobbyState.opts.count, lobbyState.players.length))) });
$('lb-start').onclick = () => { initAudio(); nsend({ t: 'start' }); };
$('lb-leave').onclick = () => { leaveOnline(); showOnline(); };
$('lb-copy').onclick = () => { const l = inviteLink(lobbyState.code); navigator.clipboard?.writeText(l).then(() => { $('lb-copy').textContent = '✓ Copied'; setTimeout(() => $('lb-copy').textContent = '🔗 Copy invite link', 1500); }).catch(() => prompt('Invite link', l)); };
$('b-online').onclick = () => { initAudio(); save(); showOnline(); };
$('on-back').onclick = () => { leaveOnline(); toTitle(); };
const lobbyCreateOpts = () => ({ mapId: settings.mapId, imps: Math.min(settings.imps, maxImps(settings.count)), count: settings.count, killCd: settings.killCd, smarts: settings.smarts, tasksPer: settings.tasksPer });
$('on-create').onclick = () => connect(() => nsend({ t: 'create', pub: true, opts: lobbyCreateOpts() }));
$('on-private').onclick = () => connect(() => nsend({ t: 'create', pub: false, opts: lobbyCreateOpts() }));
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length === 4) connect(() => nsend({ t: 'join', code: c })); };
$('on-code').addEventListener('keydown', e => { if (e.code === 'Enter') $('on-join').click(); });

function onNet(m) {
  switch (m.t) {
    case 'hello': myNetId = m.id; if (wantJoin) { nsend({ t: 'me', name: settings.name || COLORS[settings.color].name, color: settings.color }); nsend({ t: 'join', code: wantJoin }); wantJoin = null; } break;
    case 'list': {
      const box = $('on-list'); box.innerHTML = '';
      if (!m.rooms.length) box.innerHTML = '<div class="empty">No public lobbies right now — create one!</div>';
      for (const r of m.rooms) {
        const b = document.createElement('button'); b.className = 'lobbyrow';
        b.innerHTML = `<b>${r.name}</b><span>${r.map}</span><span>${r.n}/${r.max}</span><span>${r.inGame ? 'in game' : 'JOIN ▶'}</span>`;
        b.disabled = r.inGame || r.n >= r.max; b.onclick = () => nsend({ t: 'join', code: r.code });
        box.append(b);
      }
      break;
    }
    case 'err': netStatus(m.msg, true); if (S !== 'online' && S !== 'lobby') showOnline(); break;
    case 'lobby': lobbyState = m; if (S === 'online' || S === 'lobby') showLobby(); break;
    case 'left': lobbyState = null; break;
    case 'start': startOnline(m); break;
    case 's': if (game && NET) applySnap(m); break;
    case 'ev': if (game && NET) netEvent(m.e); break;
    case 'meet': if (NET) { NET.discuss = m.discuss; NET.vote = m.vote; } break;
    case 'chat': if (game && NET && MT && (S === 'meeting' || S === 'alert')) chat(m.pid, m.text); break;
    case 'voted': if (game && NET) { const p = game.players[m.pid]; if (p.voted == null) p.voted = -9; if (S === 'meeting') { sfx.vote(); buildCards(); } } break;
    case 'reveal': if (game && NET && MT) { game.players.forEach((p, i) => p.voted = m.votes[i]); MT.result = { ejected: m.ejected, tie: m.tie }; MT.revealT = 0; MT.phase = 'reveal'; MT.sel = -1; $('m-phase').textContent = 'Votes are in'; sfx.reveal(); buildCards(); } break;
    case 'eject': if (game && NET) { if (S === 'alert') startMeeting(); startEject(m); } break;
    case 'win': if (game && NET) {
      game.players.forEach((p, i) => p.imp = m.imps[i]);
      game.winner = { side: m.side, why: m.why };
      if (S === 'play') { endT = m.heat ? 2.5 : 2.2; if (m.heat) { $('flash').style.background = '#ff7a10'; $('flash').style.transition = 'opacity 2s'; $('flash').style.opacity = 0.8; } }
      else if (S !== 'eject') showEnd();
      break;
    }
  }
}
function startOnline(m) {
  initAudio(); NET = { id: myNetId, discuss: 30, vote: 40 };
  me = m.me; myTp = 0;
  game = new Game({ ...m.opts, seed: m.seed, humans: m.humans });
  game.noWin = true;
  for (const p of game.players) { p.imp = m.imps.includes(p.id); p.ai = null; }
  const h = game.players[me]; h.tasks = m.tasks; h.done = new Set();
  const tt = { total: 1, done: 0 }; game.taskTotals = () => tt; game._tt = tt;
  setupGame();
}
function applySnap(m) {
  m.p.forEach((a, i) => {
    const p = game.players[i]; if (!p) return;
    const [x, z, f, vx, vz, alive, inVent, tp, ej, hold] = a;
    p.alive = !!alive; p.inVent = inVent; p.ejected = !!ej;
    if (i === me) { if (tp !== myTp) { myTp = tp; p.x = x; p.z = z; camPos.x += 0; } return; }
    p.tx = x; p.tz = z; p.face = f; p.vx = vx; p.vz = vz; p.holding = hold;
    if (p.tp !== tp) { p.tp = tp; p.x = x; p.z = z; }
  });
  game.bodies = m.b.map(([pid, x, z]) => ({ pid, x, z, room: roomName(game.map, x, z) }));
  const wasSab = game.sab;
  game.sab = m.sab ? { ...m.sab, fixT: 0 } : null;
  if (!!wasSab !== !!game.sab) buildTaskList();
  game.sabCd = m.sabCd; game.buttonCd = m.bcd;
  const tt = game._tt; if (tt.done !== m.done || tt.total !== m.total) { tt.done = m.done; tt.total = m.total; buildTaskList(); }
  const h = H(); h.killCd = m.kc; h.meetings = m.ml;
}
function netEvent(e) {
  if (e.type === 'kill') { const v = game.players[e.victim]; v.alive = false; v.deadT = game.time; }
  if (e.type === 'report' || e.type === 'emergency') { game.state = 'meeting'; game.meeting = e.meeting; for (const p of game.players) p.voted = null; }
  if (e.type === 'win') return;            // the 'win' message carries the roles
  game.events.push(e);
}
// online version of game.update: smooth everyone else toward the server, report where we are
function netPlay(dt) {
  game.time += dt;
  const k = Math.min(1, dt * 12);
  for (const p of game.players) {
    if (p.id === me || p.tx == null) continue;
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    p.room = roomName(game.map, p.x, p.z);
  }
  const h = H(); h.room = roomName(game.map, h.x, h.z);
  posT -= dt;
  if (posT <= 0) { posT = 0.05; nsend({ t: 'pos', x: +h.x.toFixed(2), z: +h.z.toFixed(2), vx: +h.vx.toFixed(2), vz: +h.vz.toFixed(2), f: +h.face.toFixed(2), tp: myTp }); }
}
if (Q.has('join')) { wantJoin = Q.get('join').toUpperCase().slice(0, 4); setTimeout(() => { showOnline(); }, 50); }

// ------------------------------------------------------------------ boot
window.__pi = { get game() { return game; }, get world() { return world; }, get S() { return S; }, lava, startGame, models: () => models, sfx };
$('loading').classList.add('hidden');
toTitle();
if (Q.has('icon')) { /* icon.js handles it */ import('./icon.js').then(m => m.drawIcon(lava, renderPass, renderer)); }
else if (Q.has('auto')) {
  startGame();
  if (Q.has('meeting')) setTimeout(() => game.callMeeting(game.players[1], null), 900);
  if (Q.has('kill')) setTimeout(() => { const h = H(), imp = game.players.find(p => p.imp && !p.human), v = game.players.find(p => !p.imp && !p.human); v.x = h.x + 2; v.z = h.z; imp.x = h.x + 2.5; imp.z = h.z; game.kill(imp, v); }, 900);
  if (Q.has('lights')) setTimeout(() => { game.sabCd = 0; game.sabotage('lights'); }, 900);
  if (Q.has('heat')) setTimeout(() => { game.sabCd = 0; game.sabotage('heat'); }, 900);
  if (Q.has('dead')) setTimeout(() => { const imp = game.players.find(p => p.imp && !p.human) || game.players[1]; if (!H().imp) game.kill(imp, H()); }, 900);
}
if (Q.has('eject')) { setTimeout(() => { if (!game) startGame(); startEject({ ejected: +Q.get('eject') || 1, tie: false }); }, 600); }
requestAnimationFrame(frame);
