// Puddle Imposter — rendering, controls, HUD, meetings, the lava ejection and menus.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game, SPEED, USE_R } from './game.js';
import { MAPS, COLORS, TASK_NAMES, buildMap, roomName, LOBBY } from './maps.js';
import { HATS, SHIRTS, PETS, buildPet, updatePet, cleanCos, shirtCanvas } from './cosmetics.js';
import { World, THEMES, carryBucket } from './world.js';
import { Puddle, drawPuddleIcon, setEnv } from './puddle.js';
import { LavaPit } from './eject.js';
import { openTask } from './tasks.js';
import { planChat, humanSays, sayText, parseSay, botVote, count, coolDown } from './meeting.js';
import { ROLES, isFire } from './roles.js';
import { initAudio, sfx, setMood, setMusic, setSfx, audio } from './audio.js';

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

// ------------------------------------------------------------------ renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.has('lq') ? 0.75 : 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
setEnv(env);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.45, 1.05);   // only real light sources glow
// ambient occlusion: soft contact shadows in corners, under furniture and around puddles
const gtao = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
gtao.blendIntensity = 0.85;
composer.addPass(renderPass); if (!Q.has('lq') && !Q.has('noao')) composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass());
function setView(scene, camera) { renderPass.scene = gtao.scene = scene; renderPass.camera = gtao.camera = camera; gtao.enabled = scene !== lava.scene; }
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
const DEF = { mapId: -1, role: 'random', imps: 2, count: 10, killCd: 25, smarts: 1, tasksPer: 6, special: 1, color: 1, name: '', cos: { hat: 'none', shirt: 'none', pet: 'none' } };
const settings = { ...DEF, ...LS.get('pi.settings', {}) };
settings.cos = cleanCos(settings.cos);
if (settings.role === 'crew') settings.role = 'water'; if (settings.role === 'imp') settings.role = 'fire'; if (!ROLES[settings.role]) settings.role = 'random';
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
  $('o-rolesel').value = settings.role; $('o-rolesel').onchange = e => { settings.role = e.target.value; sfx.blip(); save(); };
  for (const b of $('o-imps').children) b.style.opacity = +b.dataset.v > maxImps(settings.count) ? 0.3 : 1;
  $('nm').value = settings.name;
  $('stats').textContent = stats.games ? `Games ${stats.games} · Wins ${stats.wins} (Water ${stats.crewWins}, Fire ${stats.impWins}) · Puddles dunked ${stats.dunked}` : '';
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
let bubblePing = null, spirit = null, spiritModel = null, pets = [], S = 'title', game = null, world = null, models = [], bodyModels = new Map(), taskPanel = null, stateT = 0, killedFx = null;
let camPos = new THREE.Vector3(), visR = 7.5, stepAcc = 0, heatBeep = 0, lastRoom = '', roomT = 0, endT = -1, dripCd = 0;
let me = 0, NET = null;          // NET is set while playing online
const H = () => game.players[me];
const CAM = { y: 12.2, z: 7.7 };      // a little closer than before

function disposeScene(sc) {
  sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); } });
}
function toTitle() {
  dctx.clearRect(0, 0, dark.width, dark.height);
  if (taskPanel) taskPanel.close();
  S = 'title'; hideAll(); $('scr-title').classList.remove('hidden');
  lava.stop(); lava.showTitle(COLORS.slice(0, 7).map(c => c.hex));
  setView(lava.scene, lava.camera);
  setMood('title'); buildTitle();
}
function hideAll() { for (const id of ['scr-wardrobe', 'scr-online', 'scr-lobby', 'scr-title', 'scr-role', 'hud', 'scr-alert', 'scr-meeting', 'scr-end', 'eject-txt', 'bigmap', 'scr-pause', 'scr-help']) $(id).classList.add('hidden'); }

function startGame() {
  initAudio(); save();
  if (NET) leaveOnline();
  me = 0;
  const mapId = Q.has('map') ? +Q.get('map') : settings.mapId >= 0 ? settings.mapId : Math.floor(Math.random() * MAPS.length);
  const role = Q.get('role') || settings.role;
  game = new Game({ mapId, role, imps: Math.min(settings.imps, maxImps(settings.count)), count: settings.count, killCd: settings.killCd, smarts: settings.smarts, tasksPer: settings.tasksPer, special: settings.special !== 0, color: settings.color, cos: settings.cos, name: settings.name || COLORS[settings.color].name });
  setupGame();
}
function setupGame() {
  if (world) disposeScene(world.scene);
  world = new World(); world.build(game.map, env);
  world.onDrip = pos => { const h = H(); const d = Math.hypot(pos.x - h.x, pos.z - h.z); if (d < 7 && dripCd <= 0) { dripCd = 0.08; sfx.drip(0.35 * (1 - d / 7), (pos.x - h.x) / 7); } };
  const h = H();
  models = game.players.map(p => {
    const lc = h.imp && p.imp ? '#ff3a2a' : null;
    const pd = new Puddle(p.color, p.name, world, lc); pd.setCos(p.cos); world.scene.add(pd.group); return pd;
  });
  pets = game.players.map(p => { if (!p.cos || p.cos.pet === 'none') return null; const pet = buildPet(p.cos.pet); world.scene.add(pet); return pet; });
  bodyModels = new Map(); killedFx = null; endT = -1; visR = game.vision(h);
  lava.stop();
  setView(world.scene, world.camera);
  camPos.set(h.x, CAM.y, h.z + CAM.z);
  // role reveal
  hideAll(); S = 'intro'; stateT = 0;
  $('scr-role').classList.remove('hidden');
  const RI = ROLES[h.role] || ROLES.water;
  const t = $('role-title'); t.textContent = RI.emoji + ' ' + RI.name.toUpperCase(); t.className = 'roletitle ' + (h.imp ? 'fire' : 'water');
  const ni = game.o.imps;
  $('role-sub').textContent = RI.goal + (h.imp ? '' : `  (${ni} Fire hiding among you)`);
  $('role-map').textContent = game.map.def.name.toUpperCase();
  const team = h.imp ? game.players.filter(p => p.imp) : game.players;
  const rc = $('role-team'), g = rc.getContext('2d'); g.clearRect(0, 0, rc.width, rc.height);
  const n = team.length, sp = Math.min(120, 1000 / n);
  team.forEach((p, i) => { const x = rc.width / 2 + (i - (n - 1) / 2) * sp, s = p.id === me ? 70 : 52; drawPuddleIcon(g, x, 170 - (p.id === me ? 10 : 0), s, p.color, false, p.cos); g.font = '700 18px "Avenir Next", sans-serif'; g.fillStyle = h.imp ? '#ff6a5a' : '#fff'; g.textAlign = 'center'; g.fillText(p.name, x, 270); });
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
    if (e.code === 'KeyF') doAbility();
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
$('a-abil').onclick = () => doAbility();
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
    if (h.imp) { sfx.bad(); flashBanner('Fire can only fake tasks', 1.6); return; }
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
  if (h.imp) html += `<div class="imp">Burn the Water and sabotage.</div><div style="color:#9fb4c4;font-size:12px">Fake tasks:</div>`;
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
  if (h.role === 'ext' && h.alive && h.uses > 0) for (const b of game.bodies) { if (b.reported || Math.hypot(b.x - h.x, b.z - h.z) > 16) continue; const [bx, by] = P(b.x, b.z); g.font = `${big ? 26 : 34}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText('💨', bx, by + 10); }
  if (h.role === 'bubble') for (const id of h.tracks || []) { const q = game.players[id]; if (!q.alive) continue; const [bx, by] = P(q.x, q.z); g.fillStyle = q.color; g.beginPath(); g.arc(bx, by, big ? 9 : 13, 0, 7); g.fill(); g.strokeStyle = '#bfe8ff'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, (big ? 14 : 19) + Math.sin(performance.now() / 200) * 2, 0, 7); g.stroke(); }
  if (bubblePing && bubblePing.t > 0) { const [bx, by] = P(bubblePing.x, bubblePing.z); g.strokeStyle = '#ff3a2a'; g.lineWidth = 4; g.beginPath(); g.arc(bx, by, 10 + (3 - bubblePing.t) * 20 % 30, 0, 7); g.stroke(); }
  if (h.sky) for (const q of game.players) { if (!q.alive || q.id === me) continue; const [bx, by] = P(q.x, q.z); g.fillStyle = q.color; g.beginPath(); g.arc(bx, by, big ? 7 : 10, 0, 7); g.fill(); }
  if (h.role === 'bucket') for (const d of game.map.dumps) { const [bx, by] = P(d.x, d.z); g.font = `${big ? 22 : 30}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText('🪣', bx, by + 8); }
  const [x, y] = P(h.x, h.z);
  g.fillStyle = h.color; g.shadowColor = h.color; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, big ? 10 : 16, 0, 7); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
}

// ------------------------------------------------------------------ events from the game
function humanSees(x, z) { const h = H(); if (!h.alive || h.spirit || h.sky) return true; return Math.hypot(x - h.x, z - h.z) <= visR + 0.3 && game.los(h.x, h.z, x, z); }
function handleEvents() {
  const h = H();
  for (const e of game.events) {
    if (e.type === 'kill') {
      const k = game.players[e.killer], v = game.players[e.victim];
      const near = e.victim === me || e.killer === me || humanSees(e.x, e.z);
      if (!near) { const d = Math.hypot(e.x - h.x, e.z - h.z); if (d < 18) sfx.splash(1, 0.25 * (1 - d / 18), (e.x - h.x) / 18); }
      const style = e.style || 'fire';
      world.rainbowAt(e.victim, 0, 0, false);
      if (style === 'fire') {
        world.fire(e.x, e.z, 2.6, 1.1); world.steamFx(e.x, e.z, 9); world.burst(e.x, 0.7, e.z, 26, 2.4);
        if (near) { sfx.burn(); }
        world.wetSpot(e.x, e.z, 2.4, 99999);
        const b = new Puddle(v.color, '', world); b.dead = 1; b.setCos(v.cos); b.group.position.set(e.x, 0, e.z); b.heading = Math.random() * 6; world.scene.add(b.group); bodyModels.set(v.id, b);
        b.body.material.color.setHex(0x9aa4ac); b.body.material.attenuationColor.setHex(0x3a2e26); b.body.material.attenuationDistance = 0.35;       // scorched, steaming
      } else if (style === 'sponge') { world.suck(e.x, e.z, e.kx, e.kz); if (near) sfx.slurp(); }
      else { world.burst(e.x, 0.5, e.z, 20, 1.6); world.wetSpot(e.x, e.z, 1.2, 20); if (near) sfx.scoop(); }
      models[v.id].setGhost(true); if (models[v.id].label) models[v.id].label.material.opacity = 0.5;
      if (e.victim === me) { killedFx = { t: 0, killer: k.id }; $('flash').style.transition = 'none'; $('flash').style.opacity = 0.75; requestAnimationFrame(() => { $('flash').style.transition = 'opacity 1.6s'; $('flash').style.opacity = 0; }); if (taskPanel) taskPanel.close(); flashBanner(`${e.sky ? '🌈🔥 FIRE BURNED YOUR RAINBOW — YOU FELL' : { sponge: '🧽 YOU WERE SOAKED UP', bucket: '🪣 YOU WERE SCOOPED INTO A BUCKET' }[e.style] || '🔥 YOU WERE SET ON FIRE'}<small>by ${k.name}</small>`, 3.5); }
    } else if (e.type === 'report' || e.type === 'emergency') {
      if (taskPanel) taskPanel.close();
      S = 'alert'; stateT = 0; $('m-chat').innerHTML = ''; if (!NET) for (const p of game.players) p.voted = null;
      $('hud').classList.add('hidden'); $('scr-alert').classList.remove('hidden');
      $('alert-txt').innerHTML = e.type === 'report' ? 'DEAD BODY<br>REPORTED' : 'EMERGENCY<br>MEETING';
      const c = $('alert-c'), g = c.getContext('2d'); g.clearRect(0, 0, 600, 300);
      drawPuddleIcon(g, e.type === 'report' ? 200 : 300, 150, 90, game.players[e.by].color, false, game.players[e.by].cos);
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
    } else if (e.type === 'dump') { if (humanSees(e.x, e.z) || e.p === me) { sfx.dump(); world.burst(e.x, 1.0, e.z, 18, 1.5); } }
    else if (e.type === 'flush') { world.swirl(e.x, e.z); world.swirl(e.x2, e.z2); if (e.p === me || humanSees(e.x, e.z) || humanSees(e.x2, e.z2)) sfx.flush(); }
    else if (e.type === 'rain') { world.rainAt(e.x, e.z); sfx.rain(); flashBanner(`🌧️ IT STARTED RAINING<small>${e.kind === 'heat' ? 'The heatwave' : 'The blackout'} was washed away!</small>`, 3); buildTaskList(); }
    else if (e.type === 'revive') {
      const v = game.players[e.victim]; v.alive = true;
      models[v.id].setGhost(false); if (models[v.id].label) models[v.id].label.material.opacity = 1;
      const bm = bodyModels.get(v.id); if (bm) { world.scene.remove(bm.group); bm.dispose(); bodyModels.delete(v.id); }
      world.steamFx(e.x, e.z, 3); world.burst(e.x, 0.6, e.z, 24, 2);
      if (e.victim === me || e.p === me || humanSees(e.x, e.z)) sfx.revive();
      if (e.victim === me) { killedFx = null; $('ghostnote').classList.add('hidden'); flashBanner(`🧯 YOU WERE REVIVED<small>by ${game.players[e.p].name}</small>`, 3.5); buildTaskList(); }
    }
    else if (e.type === 'freeze') {
      sfx.freeze(); iceShards = [];
      flashBanner(h.imp ? `🧊 ${e.p === me ? 'YOU FROZE' : game.players[e.p].name + ' FROZE'} ALL THE WATER<small>${e.p === me ? e.uses + ' freezes left' : 'go get them'}</small>` : '🧊 AN ICE FROZE ALL THE WATER<small>wait 2 seconds, then smash the screen 12 times to break out</small>', 3);
      if (NET && !h.imp && h.alive) { h.frozen = 1; h.iceT = 0; h.breaks = 0; }
      if (taskPanel) taskPanel.close();
    }
    else if (e.type === 'thaw') { if (e.p === me) { sfx.thaw(); $('iceov').classList.add('hidden'); } else if (humanSees(game.players[e.p].x, game.players[e.p].z)) sfx.thaw(); if (NET) game.players[e.p].frozen = 0; }
    else if (e.type === 'evap') { world.steamFx(e.x, e.z, 1.5); world.burst(e.x, 0.9, e.z, 10, 0.8); if (e.p === me) { sfx.whoosh(); sfx.revive(); } }
    else if (e.type === 'condense') { if (e.p === me) { spirit = null; h.spirit = null; sfx.drip(1); sfx.splash(0.6, 0.7); flashBanner('💧 BACK IN YOUR BODY', 1.5); } world.burst(e.x, 1.4, e.z, 12, 0.6); }
    else if (e.type === 'rainbow') { if (e.p === me) { sfx.revive(); flashBanner('🦄 UP THE RAINBOW!<small>you can see the whole map · F to slide back down</small>', 2.5); } else if (humanSees(e.x, e.z)) sfx.revive(); }
    else if (e.type === 'land') { world.rainbowAt(e.p, 0, 0, false); if (e.p === me) { sfx.whoosh(); h.sky = null; } }
    else if (e.type === 'bubble') { if (e.p === me) { sfx.drip(1); sfx.blip(1800); flashBanner(`🫧 TRACKER ON ${game.players[e.q].name.toUpperCase()}<small>${e.left} bubble${e.left === 1 ? '' : 's'} left</small>`, 2); if (NET && !(h.tracks || []).includes(e.q)) (h.tracks ||= []).push(e.q); } }
    else if (e.type === 'bubbleAlert') { if (e.to === me) { sfx.heatAlarm(); flashBanner(`🫧 ${game.players[e.killer].name.toUpperCase()} JUST KILLED!<small>in ${e.room} — your bubble saw it</small>`, 3); bubblePing = { x: e.x, z: e.z, t: 3 }; } }
    else if (e.type === 'task') buildTaskList();
    else if (e.type === 'win') { endT = e.heat ? 2.5 : 2.2; if (e.heat) { $('flash').style.background = '#ff7a10'; $('flash').style.transition = 'opacity 2s'; $('flash').style.opacity = 0.8; } }
  }
  game.events.length = 0;
}

// ------------------------------------------------------------------ meeting
let MT = null;
function cardIcon(p, dead, size = 62) { const c = document.createElement('canvas'); c.width = c.height = size * 2; drawPuddleIcon(c.getContext('2d'), size, size * 1.08, size * 0.8, p.color, dead, p.cos); return c; }
function startMeeting() {
  S = 'meeting'; stateT = 0;
  $('scr-alert').classList.add('hidden'); $('scr-meeting').classList.remove('hidden');
  const h = H(), o = game.o, M = game.meeting;
  const discuss = NET ? NET.discuss : Q.has('fastmeet') ? 6 : 30, vote = NET ? NET.vote : Q.has('fastmeet') ? 8 : 40;
  MT = { t: 0, discuss, vote, plan: NET ? [] : planChat(game, discuss), replies: [], phase: 'discuss', voteAt: {}, revealT: -1, sel: -1 };
  for (const p of game.players) { if (!NET) p.voted = null; if (p.ai && p.alive) MT.voteAt[p.id] = discuss + 1.5 + game.R() * (vote - 6); }
  const by = game.players[M.by];
  $('m-title').textContent = 'WHO IS FIRE?';
  $('m-sub').textContent = M.body >= 0 ? `${by.name} reported ${game.players[M.body].name}'s body in ${M.room}` : `${by.name} called an emergency meeting`;
  $('m-skip').classList.remove('sel'); $('m-skipvotes').innerHTML = '';
  $('m-hint').textContent = h.alive ? 'Click a puddle to accuse or vouch for them' : 'Ghosts can watch, but nobody can hear you';
  document.querySelector('.mquick').style.display = h.alive ? '' : 'none'; document.querySelector('.mchat .mtype').style.display = h.alive ? '' : 'none'; $('m-input').value = '';
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
    info.innerHTML = `<div class="pn" style="text-shadow:0 0 10px ${p.color}">${p.name}${p.id === me ? ' (you)' : ''}</div><div class="pr">${p.alive ? (h.imp && p.imp && p.id !== me ? `<span class="imptag">🔥 ${ROLES[p.role].name.toUpperCase()}</span>` : p.colorName) : p.ejected ? 'ejected' : 'dead'}</div>`;
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
  setView(lava.scene, lava.camera);
  lava.startEject(ej ? { color: ej.color, cos: ej.cos } : null);
  setMood('lava');
  const left = NET ? r.left : game.impAlive();
  const ejRole = ej && ej.imp ? (NET ? r.role : ej.role) : null;
  const l1 = ej ? (ej.imp ? `${ej.name} was Fire${ejRole && ejRole !== 'fire' ? ' — the ' + ROLES[ejRole].name : ''}.` : `${ej.name} was not Fire.`) : `No one was ejected. ${r.tie ? '(Tie)' : '(Skipped)'}`;
  const l2 = `${left} Fire remain${left === 1 ? 's' : ''}.`;
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
    S = 'play'; setView(world.scene, world.camera);
    $('hud').classList.remove('hidden'); setMood('play'); buildTaskList();
    const h = H(); camPos.set(h.x, CAM.y, h.z + CAM.z);
    if (!h.alive) { $('ghostnote').classList.remove('hidden'); $('ghostmsg').textContent = h.imp ? 'your partner has to finish the job.' : 'finish your tasks to help the Water win!'; }
  }
}

// ------------------------------------------------------------------ end
function showEnd() {
  S = 'end'; if (taskPanel) taskPanel.close();
  hideAll(); $('scr-end').classList.remove('hidden');
  $('flash').style.opacity = 0; setTimeout(() => $('flash').style.background = '#ff1a1a', 2000);
  const h = H(), w = game.winner, won = (w.side === 'imp') === h.imp;
  const t = $('end-title'); t.textContent = won ? 'VICTORY' : 'DEFEAT'; t.className = won ? 'win' : 'lose';
  $('end-sub').textContent = (w.side === 'imp' ? '🔥 Fire wins — ' : '💧 Water wins — ') + w.why;
  const box = $('end-players'); box.innerHTML = '';
  for (const p of game.players) {
    const d = document.createElement('div'); d.className = 'ep' + (p.imp ? ' imp' : '');
    d.append(cardIcon(p, !p.alive, 90));
    d.insertAdjacentHTML('beforeend', `<div class="n" style="text-shadow:0 0 10px ${p.color}">${p.name}</div><div class="r" style="color:${p.imp ? '#ff5a4a' : '#8fd8ff'}">${(ROLES[p.role] || ROLES.water).emoji} ${(ROLES[p.role] || (p.imp ? ROLES.fire : ROLES.water)).name.toUpperCase()}</div><div class="r" style="color:#8fa2b2">${p.alive ? 'alive' : p.ejected ? 'lava' : 'evaporated'}</div>`);
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
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; if (Q.has('dbg')) { document.title = `${fps.toFixed(0)} fps`; let d = $('dbgfps'); if (!d) { d = document.createElement('div'); d.id = 'dbgfps'; d.style.cssText = 'position:fixed;left:50%;top:6px;z-index:99;font:800 22px monospace;color:#0f0;background:#000a;padding:2px 8px'; document.body.append(d); } d.textContent = `${fps.toFixed(0)} fps`; } }
  stateT += dt; dripCd -= dt;
  const aspect = innerWidth / innerHeight;
  if (S === 'title' || S === 'online' || S === 'wardrobe') lava.update(dt, aspect);
  else if (S === 'lobby') lobbyUpdate(dt, aspect);
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
  if (Q.has('copytest')) setTimeout(() => copyText(Q.get('copytest')), 1500);
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
  if (h.frozen > 0) { mx = mz = 0; }
  if (h.sky) { mx = mz = 0; $('banner').innerHTML = `🦄 ON THE RAINBOW — ${Math.max(0, Math.ceil(h.sky.t))}s<small>you can see everyone · F to slide down · if Fire burns the bottom, you fall!</small>`; $('banner').classList.remove('hidden'); bannerT = 0.2; }
  iceOverlay(dt);
  if (h.spirit && spirit) {
    const l2 = Math.hypot(mx, mz);
    if (l2) { const ox = spirit.x, oz = spirit.z; game.move(spirit, mx / l2 * SPEED * 1.7 * dt, mz / l2 * SPEED * 1.7 * dt, true); spirit.vx = (spirit.x - ox) / dt; spirit.vz = (spirit.z - oz) / dt; spirit.face = Math.atan2(mx, mz); } else spirit.vx = spirit.vz = 0;
    mx = mz = 0;
    $('banner').innerHTML = `☁️ YOU ARE VAPOR — ${Math.max(0, Math.ceil(h.spirit.t))}s<small>float through walls and spy · press F to go back to your body (it can still be burned!)</small>`; $('banner').classList.remove('hidden'); bannerT = 0.2;
  } else if (!h.spirit && spirit) spirit = null;
  const len = Math.hypot(mx, mz);
  if (len) {
    const sp = SPEED * (h.alive ? (h.carry >= 0 ? 0.72 : 1) : 1.3);
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
      $('banner').innerHTML = h.imp ? '💡 Lights are out<small>Water can barely see now</small>' : `💡 LIGHTS SABOTAGED<small>Flip the breakers in ${game.map.lights.room}</small>`;
      $('banner').classList.remove('hidden'); $('heatfx').style.opacity = 0;
    }
  } else { $('heatfx').style.opacity = 0; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  drawMap($('minimap'), false);
  roleCard(); abilityHud(h); if (bubblePing) bubblePing.t -= dt;
}

function drawWorld(dt, aspect) {
  const h = H(), t = world.t;
  const target = game.vision(h);
  visR += (target - visR) * Math.min(1, dt * 1.6);
  const heat = game.sab && game.sab.type === 'heat';
  const hr = game.map.rooms.find(r => r.name === h.room);
  world.update(dt, spirit && h.spirit ? spirit : h.sky ? { x: game.map.W / 2, z: game.map.H / 2 } : h, { lightsOut: game.sab && game.sab.type === 'lights', heat, outdoor: !!(hr && hr.out) || !!h.sky });
  // characters
  game.players.forEach((p, i) => {
    const pd = models[i];
    let vis;
    if (p.alive) vis = p.inVent < 0 && (p.id === me || humanSees(p.x, p.z));
    else vis = !h.alive && !p.ejected;
    pd.group.visible = vis;
    pd.melt = heat ? 1.2 : 0;
    pd.setFrozen(p.alive && p.frozen > 0);
    pd.group.position.set(p.x, p.alive ? 0 : 0.35 + Math.sin(t * 2 + i) * 0.12, p.z);
    if (vis) pd.update(dt, t, p.vx, p.vz, p.face);
    const rb = world.rainbowAt(p.id, p.x, p.z, !!(p.sky && p.alive));
    if (rb) { pd.group.visible = true; pd.group.position.copy(rb.userData.top); if (!pd.horn) { pd.horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.7, roughness: 0.25, emissive: 0xffc040, emissiveIntensity: 0.4 })); pd.horn.position.set(0, 1.18, 0.12); pd.horn.rotation.x = 0.35; pd.lean.add(pd.horn); } }
    if (pd.horn) pd.horn.visible = !!(p.sky && p.alive) || (p.role === 'unicorn' && p.id === me && p.alive);
    if (h.role === 'bubble' && (h.tracks || []).includes(p.id)) { if (!pd.track) { pd.track = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 0.05, roughness: 0, iridescence: 1, iridescenceIOR: 1.6, transparent: true, opacity: 0.9 })); pd.group.add(pd.track); } pd.track.visible = p.alive; pd.track.position.set(Math.sin(t * 2) * 0.3, 2.05 + Math.sin(t * 3) * 0.08, 0); }
    if (p.carry >= 0 && p.alive && !pd.bucket) { pd.bucket = carryBucket(); pd.bucket.position.set(0.58, 0.42, 0.12); pd.lean.add(pd.bucket); }
    if (pd.bucket) { pd.bucket.visible = p.carry >= 0 && p.alive; pd.bucket.rotation.z = Math.sin(t * 9) * 0.12; }
    if (pets[i]) updatePet(pets[i], p, dt, t, vis && p.alive);
  });
  for (const [id, b] of bodyModels) { const bd = game.bodies.find(x => x.pid === id); b.group.visible = !!bd && humanSees(b.group.position.x, b.group.position.z); if (b.group.visible) b.update(dt, t, 0, 0, b.heading); }
  // my vapor self while evaporated
  if (spirit && h.spirit) {
    if (!spiritModel || spiritModel.color.getHexString() !== new THREE.Color(h.color).getHexString()) { if (spiritModel) world.scene.remove(spiritModel.group); spiritModel = new Puddle(h.color, '☁️ ' + h.name, null); spiritModel.setGhost(true); spiritModel.setCos(h.cos); world.scene.add(spiritModel.group); }
    spiritModel.group.visible = true; spiritModel.group.position.set(spirit.x, 0.6 + Math.sin(t * 2) * 0.15, spirit.z); spiritModel.update(dt, t, spirit.vx, spirit.vz, spirit.face);
    if (Math.random() < dt * 8) world.puffSmoke(spirit.x, spirit.z, true);
    models[me].lookDown = 1;
  } else { if (spiritModel) spiritModel.group.visible = false; if (models[me]) models[me].lookDown = 0; }
  // task / fix markers
  let k = 0;
  if (h.alive || !h.imp) for (const id of h.tasks) { if (h.done.has(id) && !h.imp) continue; const tk = game.map.tasks[id]; world.marker(k++, tk.x, tk.z, true, Math.hypot(h.x - tk.x, h.z - tk.z) < USE_R); }
  if (game.sab && !h.imp && h.alive) for (const s of game.sab.type === 'lights' ? [game.map.lights] : game.map.valves) world.marker(k++, s.x, s.z, true, true);
  world.hideMarkers(k);
  // camera
  const C = world.camera; C.aspect = aspect; C.fov = aspect < 1.2 ? 52 : 38;
  let off = new THREE.Vector3(0, CAM.y * (spirit && h.spirit ? 1.25 : 1), CAM.z * (spirit && h.spirit ? 1.25 : 1));
  if (S === 'intro') off.set(0, 9 + stateT * 1.4, 6 + stateT * 0.85);
  if (killedFx && killedFx.t < 2.4) { const k2 = Math.sin(Math.min(1, killedFx.t / 2.4) * Math.PI); off.lerp(new THREE.Vector3(0, 5, 4), k2); }
  const focus = spirit && h.spirit ? spirit : h;
  if (h.sky) { const M = game.map, span = Math.max(M.W, M.H / aspect * 1.6); off.set(0, span * 1.25, span * 0.45); focus.__c = { x: M.W / 2, z: M.H / 2 }; }
  const fc = h.sky ? { x: game.map.W / 2, z: game.map.H / 2 } : focus;
  const want = new THREE.Vector3(fc.x, 0, fc.z).add(off);
  camPos.lerp(want, Math.min(1, dt * 6));
  C.position.copy(camPos);
  if (heat) { C.position.x += (Math.random() - 0.5) * 0.04; C.position.y += (Math.random() - 0.5) * 0.04; }
  C.lookAt(camPos.x - off.x, 0.4, camPos.z - off.z);
  C.far = h.sky ? 600 : 400; C.updateProjectionMatrix();
  const F = world.scene.fog; if (F) { F.userData ||= { near: F.near, far: F.far }; F.near = h.sky ? 500 : F.userData.near; F.far = h.sky ? 900 : F.userData.far; }
  drawDark();
}

function drawDark() {
  const W = dark.width, Hh = dark.height, h = H();
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, W, Hh);
  if (!h.alive || h.spirit || h.sky || (S !== 'play' && S !== 'intro' && S !== 'alert')) return;
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



// ------------------------------------------------------------------ special role abilities (F)
function doAbility() {
  const h = H(); if (S !== 'play' || !h.alive) return;
  const a = game.ability(h);
  if (!a) { if (['toilet', 'rain', 'ext', 'bucket', 'ice', 'evap', 'unicorn', 'bubble'].includes(h.role)) sfx.bad(); return; }
  if (a.kind === 'rainbow') { if (NET) { h.sky = { t: ROLES.unicorn.dur }; nsend({ t: 'act', a: 'ability', op: 'rainbow' }); } else game.rainbow(h); return; }
  if (a.kind === 'land') { if (NET) nsend({ t: 'act', a: 'ability', op: 'land' }); else game.land(h); return; }
  if (a.kind === 'bubble') { if (NET) nsend({ t: 'act', a: 'ability', op: 'bubble' }); else game.bubble(h); return; }
  if (a.kind === 'evaporate') { spirit = { x: h.x, z: h.z, vx: 0, vz: 0, face: h.face }; if (NET) { h.spirit = { t: ROLES.evap.dur }; nsend({ t: 'act', a: 'ability', op: 'evaporate' }); } else game.evaporate(h); return; }
  if (a.kind === 'return') { if (NET) { nsend({ t: 'act', a: 'ability', op: 'return' }); } else game.condense(h); return; }
  if (a.kind === 'freeze') { if (NET) nsend({ t: 'act', a: 'ability', op: 'freeze' }); else game.freeze(h); return; }
  if (a.kind === 'dump') { if (NET) nsend({ t: 'act', a: 'ability', op: 'dump' }); else game.dump(h); }
  else if (a.kind === 'rain') { if (NET) nsend({ t: 'act', a: 'ability', op: 'rain' }); else game.rain(h); }
  else if (a.kind === 'revive') { if (NET) nsend({ t: 'act', a: 'ability', op: 'revive' }); else game.revive(h); }
  else if (a.kind === 'flush') openFlush(a.i);
}
function openFlush(from) {
  const list = $('flush-list'); list.innerHTML = '';
  game.map.vents.forEach((v, j) => {
    if (j === from) return;
    const b = document.createElement('button'); b.textContent = '🚽 ' + roomName(game.map, v.x, v.z);
    b.onclick = () => { $('flushpick').classList.add('hidden'); const h = H(); if (NET) nsend({ t: 'act', a: 'ability', op: 'flush', j }); else game.flush(h, j); };
    list.append(b);
  });
  $('flushpick').classList.remove('hidden'); sfx.blip(900);
}
$('flush-x').onclick = () => $('flushpick').classList.add('hidden');
function abilityHud(h) {
  const has = ['toilet', 'rain', 'ext', 'bucket', 'ice', 'evap', 'unicorn', 'bubble'].includes(h.role) && h.alive;
  $('a-abil').classList.toggle('hidden', !has);
  if (!has) return;
  const I = { toilet: ['🚽', 'FLUSH'], rain: ['🌧️', 'RAIN'], ext: ['🧯', 'REVIVE'], bucket: ['🪣', 'DUMP'], ice: ['🧊', 'FREEZE'], evap: h.spirit ? ['💧', 'RETURN'] : ['☁️', 'VAPOR'], unicorn: h.sky ? ['⬇️', 'SLIDE DOWN'] : ['🦄', 'RAINBOW'], bubble: ['🫧', 'BUBBLE'] }[h.role];
  $('abil-ic').textContent = I[0]; $('abil-lab').textContent = I[1];
  $('a-abil').classList.toggle('on', !!game.ability(h));
  const cdMax = ROLES[h.role].cd || 1;
  const timed = h.role === 'toilet' || h.role === 'rain' || h.role === 'ice' || (h.role === 'evap' && !h.spirit) || (h.role === 'unicorn' && !h.sky);
  $('abil-cd').textContent = h.role === 'bubble' ? String(3 - (h.tracks || []).length) : h.role === 'ice' && h.uses <= 0 ? '0' : timed && h.abilCd > 0 ? Math.ceil(h.abilCd) : h.role === 'ext' ? (h.uses > 0 ? '' : '0') : '';
  $('a-abil').style.setProperty('--cd', timed ? Math.max(0, h.abilCd / cdMax) : 0);
  const K = { sponge: ['🧽', 'SOAK'], bucket: ['🪣', 'SCOOP'] }[h.role] || ['🔥', 'BURN'];
  $('kill-ic').textContent = K[0]; $('kill-lab').textContent = K[1];
}

// ------------------------------------------------------------------ frozen by Ice: frost over the screen, smash it 12 times
let iceShards = [], iceShake = 0;
function iceOverlay(dt) {
  const h = H(), ov = $('iceov');
  if (!(h.frozen > 0) || !h.alive || S !== 'play') { ov.classList.add('hidden'); return; }
  ov.classList.remove('hidden');
  const c = $('ice-c'), W = innerWidth, Hh = innerHeight;
  if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
  const g = c.getContext('2d'); g.clearRect(0, 0, W, Hh);
  const gr = g.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.15, W / 2, Hh / 2, Math.max(W, Hh) * 0.7);
  gr.addColorStop(0, 'rgba(200,235,255,.25)'); gr.addColorStop(0.6, 'rgba(190,230,255,.55)'); gr.addColorStop(1, 'rgba(230,248,255,.92)');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  // frost feathers around the edges
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, ex = W / 2 + Math.cos(a) * W * 0.62, ey = Hh / 2 + Math.sin(a) * Hh * 0.62; g.beginPath(); g.moveTo(ex, ey); for (let k = 0; k < 4; k++) g.lineTo(ex - Math.cos(a + k) * 40 * (k + 1), ey - Math.sin(a - k) * 40 * (k + 1)); g.stroke(); }
  // cracks from every smash
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.5;
  for (const s of iceShards) for (const l of s) { g.beginPath(); g.moveTo(l[0][0], l[0][1]); for (const pt of l) g.lineTo(pt[0], pt[1]); g.stroke(); }
  const left = Math.max(0, ROLES.ice.minT - (h.iceT || 0)), n = h.breaks || 0;
  $('ice-txt').innerHTML = left > 0 ? `🧊 FROZEN SOLID<small>the ice is too thick… ${left.toFixed(1)}s</small>` : `🧊 SMASH THE ICE!<small>click / tap the screen · ${n} / ${ROLES.ice.breaks}</small>`;
  iceShake -= dt; if (iceShake <= 0) ov.classList.remove('shake');
}
function smashIce(x, y) {
  const h = H(); if (!(h.frozen > 0) || S !== 'play') return;
  ov_shake();
  if ((h.iceT || 0) < ROLES.ice.minT) { sfx.tick(); return; }
  // a little star of cracks where you hit
  const lines = []; for (let k = 0; k < 6; k++) { let px = x, py = y; const a = k / 6 * Math.PI * 2 + Math.random(), l = [[px, py]]; for (let s = 0; s < 5; s++) { px += Math.cos(a + (Math.random() - 0.5) * 0.8) * (25 + Math.random() * 40); py += Math.sin(a + (Math.random() - 0.5) * 0.8) * (25 + Math.random() * 40); l.push([px, py]); } lines.push(l); }
  iceShards.push(lines);
  sfx.zap(); sfx.blip(2400 + Math.random() * 600, 0.6);
  if (NET) { h.breaks = (h.breaks || 0) + 1; nsend({ t: 'act', a: 'break' }); }
  else game.breakIce(h);
}
function ov_shake() { const ov = $('iceov'); ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); iceShake = 0.15; }
$('iceov').addEventListener('pointerdown', e => smashIce(e.clientX, e.clientY));
addEventListener('keydown', e => { if (S === 'play' && game && H().frozen > 0 && (e.code === 'Space' || e.code === 'KeyE')) smashIce(innerWidth * (0.3 + Math.random() * 0.4), innerHeight * (0.3 + Math.random() * 0.4)); });

// ------------------------------------------------------------------ role card (bottom-left): your goal + abilities with cooldowns
let rcKey = '';
function roleCard() {
  const h = H(), o = game.o, card = $('rolecard');
  const ready = (v, max) => v > 0 ? `<b class="cd">${Math.ceil(v)}s</b>` : '<b class="rd">ready</b>';
  let role, goal, ab;
  const RI = ROLES[h.role] || ROLES.water;
  const abil = () => {
    if (h.role === 'toilet') return `<div class="ab"><span>🚽 Flush from any vent [F]</span>${ready(h.abilCd)}</div>`;
    if (h.role === 'rain') return `<div class="ab"><span>🌧️ Rain away emergencies [F]</span>${game.sab ? ready(h.abilCd) : '<b class="cd">no emergency</b>'}</div>`;
    if (h.role === 'ext') return `<div class="ab"><span>🧯 Revive a burned body [F]</span><b class="${h.uses > 0 ? 'rd' : 'cd'}">${h.uses} left</b></div>`;
    if (h.role === 'unicorn') return `<div class="ab"><span>🦄 Ride the rainbow / slide down [F]</span>${h.sky ? `<b class="cd">${Math.ceil(h.sky.t)}s in the sky</b>` : ready(h.abilCd)}</div>`;
    if (h.role === 'bubble') return `<div class="ab"><span>🫧 Bubble someone nearby [F]</span><b class="rd">${3 - (h.tracks || []).length} left</b></div><div class="ab"><span>Tracking</span><b class="rd">${(h.tracks || []).map(i => game.players[i].name).join(', ') || 'nobody yet'}</b></div>`;
    if (h.role === 'evap') return `<div class="ab"><span>☁️ Evaporate / return [F]</span>${h.spirit ? `<b class="cd">${Math.ceil(h.spirit.t)}s left</b>` : ready(h.abilCd)}</div>`;
    if (h.role === 'ice') return `<div class="ab"><span>🧊 Freeze all Water [F]</span>${h.uses > 0 ? ready(h.abilCd) : '<b class="cd">used up</b>'}</div><div class="ab"><span>Freezes left</span><b class="rd">${h.uses} / 3</b></div>`;
    if (h.role === 'bucket') return `<div class="ab"><span>🪣 Dump at a big bucket [F]</span><b class="${h.carry >= 0 ? 'cd' : 'rd'}">${h.carry >= 0 ? 'FULL' : 'empty'}</b></div>`;
    return '';
  };
  if (!h.alive) {
    role = '👻 ' + (h.imp ? 'FIRE GHOST' : 'WATER GHOST');
    goal = h.imp ? 'You can still sabotage. Your partners finish the job.' : 'Float through walls and finish your tasks — the Water still needs them.';
    ab = h.imp ? `<div class="ab"><span>☠ Sabotage [1 / 2]</span>${game.sab ? '<b class="cd">active</b>' : ready(game.sabCd)}</div>` : `<div class="ab"><span>✋ Do tasks [E]</span><b class="rd">${h.tasks.filter(t => !h.done.has(t)).length} left</b></div>`;
  } else if (h.imp) {
    role = RI.emoji + ' ' + RI.name.toUpperCase() + (h.role !== 'fire' ? ' · FIRE' : '');
    goal = RI.goal;
    const kn = h.role === 'sponge' ? '🧽 Soak up [Q]' : h.role === 'bucket' ? '🪣 Scoop [Q]' : '🔥 Burn [Q]';
    ab = `<div class="ab"><span>${kn}</span>${h.carry >= 0 ? '<b class="cd">bucket full</b>' : ready(h.killCd)}</div>${abil()}<div class="ab"><span>▦ Vent [V]</span><b class="rd">${h.carry >= 0 ? 'too heavy' : h.inVent >= 0 ? 'inside' : 'ready'}</b></div><div class="ab"><span>☠ Sabotage [1 lights / 2 heat]</span>${game.sab ? '<b class="cd">active</b>' : ready(game.sabCd)}</div>`;
  } else {
    role = RI.emoji + ' ' + RI.name.toUpperCase() + (h.role !== 'water' ? ' · WATER' : '');
    goal = RI.goal;
    ab = `${abil()}<div class="ab"><span>✋ Use / tasks [E]</span><b class="rd">${h.tasks.filter(t => !h.done.has(t)).length} left</b></div><div class="ab"><span>📣 Report body [R]</span><b class="rd">ready</b></div><div class="ab"><span>🔴 Emergency button</span>${h.meetings > 0 ? (game.buttonCd > 0 ? ready(game.buttonCd) : `<b class="rd">${h.meetings} left</b>`) : '<b class="cd">used</b>'}</div>`;
  }
  const key = role + ab;
  if (key !== rcKey) { rcKey = key; $('rc-role').textContent = role; $('rc-goal').textContent = goal; $('rc-abil').innerHTML = ab; card.className = !h.alive ? 'ghost' : h.imp ? 'imp' : ''; }
  $('a-kill').style.setProperty('--cd', h.imp ? Math.max(0, h.killCd / o.killCd) : 0);
  $('a-sab').style.setProperty('--cd', game.sab ? 1 : Math.max(0, Math.min(1, game.sabCd / 35)));
}

// ------------------------------------------------------------------ wardrobe: hats, shirts and pets
let wardTab = 'hat', wardFrom = 'title';
function sendMe() { nsend({ t: 'me', name: settings.name || COLORS[settings.color].name, color: settings.color, cos: settings.cos }); }
function openWardrobe(from) {
  initAudio(); wardFrom = from;
  $('scr-wardrobe').classList.remove('hidden');
  if (from === 'title') { $('scr-title').classList.add('hidden'); S = 'wardrobe'; lava.showWardrobe(COLORS[settings.color].hex, settings.cos); setView(lava.scene, lava.camera); }
  else { $('scr-lobby').classList.add('hidden'); lobbyWard = true; }
  buildWardrobe();
}
function closeWardrobe() {
  $('scr-wardrobe').classList.add('hidden'); save();
  if (wardFrom === 'title') toTitle(); else { lobbyWard = false; $('scr-lobby').classList.remove('hidden'); }
}
function buildWardrobe() {
  for (const b of document.querySelectorAll('.wtabs b')) { b.classList.toggle('on', b.dataset.t === wardTab); b.onclick = () => { wardTab = b.dataset.t; sfx.blip(); buildWardrobe(); }; }
  const list = wardTab === 'hat' ? HATS : wardTab === 'shirt' ? SHIRTS : PETS, box = $('w-items'); box.innerHTML = '';
  for (const it of list) {
    const d = document.createElement('div'); d.className = 'wi' + (settings.cos[wardTab] === it.id ? ' sel' : '');
    if (wardTab === 'shirt') { if (it.id === 'none') d.innerHTML = '<div class="em">🚫</div>'; else { const c = shirtCanvas(it.id); c.style.cssText = ''; d.append(c); } }
    else d.innerHTML = `<div class="em">${it.emoji || '🚫'}</div>`;
    d.insertAdjacentHTML('beforeend', `<div>${it.name}</div>`);
    d.onclick = () => { settings.cos = { ...settings.cos, [wardTab]: it.id }; sfx.blip(1200); applyCos(); buildWardrobe(); };
    box.append(d);
  }
}
function applyCos() {
  save();
  if (wardFrom === 'title') lava.showWardrobe(COLORS[settings.color].hex, settings.cos);
  if (ws && ws.readyState === 1) sendMe();
}
$('b-ward').onclick = () => openWardrobe('title');
$('w-done').onclick = () => closeWardrobe();
$('lb-ward').onclick = () => openWardrobe('lobby');

// ------------------------------------------------------------------ walk-around courtyard lobby (online)
let lobbyMap = null, lobbyWorld = null, lobbyCol = null, lobbyWard = false, lposT = 0;
const lobbyModels = new Map(), lobbyMe = { x: 0, z: 0, vx: 0, vz: 0, face: 0 };
function enterLobbyWorld() {
  if (!lobbyWorld) {
    lobbyMap = buildMap(LOBBY);
    lobbyWorld = new World(); lobbyWorld.build(lobbyMap, env, { lobby: true });
    lobbyCol = Object.create(Game.prototype); lobbyCol.map = lobbyMap;
    const b = lobbyMap.button, a = Math.random() * Math.PI * 2;
    lobbyMe.x = b.x + Math.sin(a) * 4; lobbyMe.z = b.z + Math.cos(a) * 4; lobbyMe.face = a;
    camPos.set(lobbyMe.x, CAM.y, lobbyMe.z + CAM.z);
  }
  setView(lobbyWorld.scene, lobbyWorld.camera);
  dctx.clearRect(0, 0, dark.width, dark.height);
  syncLobbyModels();
}
function syncLobbyModels() {
  if (!lobbyWorld || !lobbyState) return;
  const seen = new Set();
  for (const p of lobbyState.players) {
    seen.add(p.id);
    const key = p.name + p.color + JSON.stringify(p.cos);
    let L = lobbyModels.get(p.id);
    if (L && L.key !== key) { lobbyWorld.scene.remove(L.pd.group); L.pd.dispose(); if (L.pet) lobbyWorld.scene.remove(L.pet); L = null; }
    if (!L) {
      const pd = new Puddle(COLORS[p.color].hex, p.name + (p.id === lobbyState.host ? ' 👑' : ''), lobbyWorld); pd.setCos(p.cos); lobbyWorld.scene.add(pd.group);
      const pet = p.cos && p.cos.pet !== 'none' ? buildPet(p.cos.pet) : null; if (pet) lobbyWorld.scene.add(pet);
      const old = lobbyModels.get(p.id);
      L = { key, pd, pet, x: old ? old.x : lobbyMe.x, z: old ? old.z : lobbyMe.z, tx: null, tz: null, vx: 0, vz: 0, face: 0 };
      if (p.id !== myNetId) { const b = lobbyMap.button, a = p.id * 2.1; L.x = b.x + Math.sin(a) * 4; L.z = b.z + Math.cos(a) * 4; }
      lobbyModels.set(p.id, L);
    }
  }
  for (const [id, L] of lobbyModels) if (!seen.has(id)) { lobbyWorld.scene.remove(L.pd.group); L.pd.dispose(); if (L.pet) lobbyWorld.scene.remove(L.pet); lobbyModels.delete(id); }
}
function lobbyUpdate(dt, aspect) {
  if (!lobbyWorld) return;
  const me = lobbyMe;
  let mx = 0, mz = 0;
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (!lobbyWard && !typing) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  }
  const len = Math.hypot(mx, mz);
  if (len) {
    const ox = me.x, oz = me.z; lobbyCol.move(me, mx / len * SPEED * dt, mz / len * SPEED * dt);
    me.vx = (me.x - ox) / dt; me.vz = (me.z - oz) / dt; me.face = Math.atan2(mx, mz);
    stepAcc += Math.hypot(me.x - ox, me.z - oz); if (stepAcc > 0.9) { stepAcc = 0; sfx.step(0.8); }
  } else { me.vx = me.vz = 0; }
  lposT -= dt; if (lposT <= 0) { lposT = 1 / 12; nsend({ t: 'lpos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), f: +me.face.toFixed(2), vx: +me.vx.toFixed(2), vz: +me.vz.toFixed(2) }); }
  const w = lobbyWorld, t = w.t, k = Math.min(1, dt * 12);
  for (const [id, L] of lobbyModels) {
    if (id === myNetId) { L.x = me.x; L.z = me.z; L.vx = me.vx; L.vz = me.vz; L.face = me.face; }
    else if (L.tx != null) { L.x += (L.tx - L.x) * k; L.z += (L.tz - L.z) * k; }
    L.pd.group.position.set(L.x, 0, L.z); L.pd.update(dt, t, L.vx, L.vz, L.face);
    if (L.pet) updatePet(L.pet, L, dt, t, true);
    if (L.bub) { L.bubT -= dt; if (L.bubT < 0) { L.pd.group.remove(L.bub); L.bub.material.map.dispose(); L.bub = null; } }
  }
  w.update(dt, me, { outdoor: true });
  // wardrobe prompt
  const nearW = w.wardrobe && Math.hypot(me.x - w.wardrobe.x, me.z - w.wardrobe.z) < 2.2;
  $('lb-hint2') && ($('lb-hint2').style.opacity = nearW ? 1 : 0);
  if (nearW && !lobbyWard && (keys.has('KeyE') || keys.has('Space'))) { keys.delete('KeyE'); keys.delete('Space'); openWardrobe('lobby'); }
  const C = w.camera; C.aspect = aspect; C.fov = aspect < 1.2 ? 52 : 38;
  const off = lobbyWard ? new THREE.Vector3(0, 4.2, 5.2) : new THREE.Vector3(0, CAM.y, CAM.z);
  const tx = me.x + (lobbyWard ? 1.6 : 0);
  camPos.lerp(new THREE.Vector3(tx, 0, me.z).add(off), Math.min(1, dt * 5));
  C.position.copy(camPos); C.lookAt(camPos.x - off.x, lobbyWard ? 0.9 : 0.4, camPos.z - off.z); C.updateProjectionMatrix();
}


// ------------------------------------------------------------------ typing your own messages
function sendTyped() {
  const inp = $('m-input'), text = inp.value.trim().slice(0, 120); inp.value = '';
  if (!text || S !== 'meeting' || !H().alive || (MT && MT.revealT >= 0)) return;
  if (NET) { nsend({ t: 'say', kind: 'text', text }); return; }
  chat(me, text);
  const { kind, target } = parseSay(game, me, text);
  if (kind) for (const r of humanSays(game, kind, target, me)) MT.replies.push({ at: MT.t + r.delay, pid: r.pid, text: r.text });
}
$('m-send').onclick = sendTyped;
$('m-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') sendTyped(); if (e.code === 'Escape') e.target.blur(); });
function sendLobbyChat() { const inp = $('lb-input'), text = inp.value.trim().slice(0, 100); inp.value = ''; inp.blur(); if (text) nsend({ t: 'lchat', text }); }
$('lb-send').onclick = sendLobbyChat;
$('lb-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') sendLobbyChat(); if (e.code === 'Escape') e.target.blur(); });
addEventListener('keydown', e => { if (S === 'lobby' && !lobbyWard && e.code === 'KeyT' && document.activeElement !== $('lb-input')) { e.preventDefault(); $('lb-input').focus(); } });
function bubble(text) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); const font = '700 34px "Avenir Next", sans-serif';
  g.font = font; const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { if (g.measureText(line + w).width > 420 && line) { lines.push(line.trim()); line = ''; } line += w + ' '; } lines.push(line.trim());
  const w = Math.min(480, Math.max(...lines.map(l => g.measureText(l).width))) + 40, h = lines.length * 42 + 30;
  c.width = w; c.height = h + 18; g.font = font;
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 18); g.fill(); g.beginPath(); g.moveTo(w / 2 - 14, h - 4); g.lineTo(w / 2, h + 14); g.lineTo(w / 2 + 14, h - 4); g.fill();
  g.fillStyle = '#16202a'; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, w / 2, 30 + i * 42));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(c.width / 140, c.height / 140, 1); sp.renderOrder = 30;
  return sp;
}
function lobbyBubble(id, text) {
  const L = lobbyModels.get(id); if (!L) return;
  if (L.bub) { L.pd.group.remove(L.bub); L.bub.material.map.dispose(); }
  L.bub = bubble(text); L.bub.position.y = 2.5 + L.bub.scale.y / 2; L.pd.group.add(L.bub); L.bubT = 6;
  sfx.blip(id === myNetId ? 1300 : 900, 0.5);
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
  ws.onopen = () => { netStatus('Connected'); sendMe(); then && then(); };
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
  hideAll(); S = 'lobby'; $('scr-lobby').classList.remove('hidden'); lobbyWard = false;
  enterLobbyWorld(); setMood('title');
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
    const c = document.createElement('canvas'); c.width = c.height = 120; drawPuddleIcon(c.getContext('2d'), 60, 68, 40, COLORS[p.color].hex, false, p.cos);
    d.append(c); d.insertAdjacentHTML('beforeend', `<div>${p.name}${p.id === myNetId ? ' (you)' : ''}${p.id === L.host ? ' 👑' : ''}</div>`);
    box.append(d);
  }
  const o = L.opts, n = L.players.length, fire = Math.max(1, Math.min(o.imps, Math.floor((n - 1) / 3) || 1));
  $('lb-sum').textContent = `${o.mapId < 0 ? 'Random map' : MAPS[o.mapId].name} · ${n} real player${n > 1 ? 's' : ''} (no computer puddles) · ${fire} Fire · kill cooldown ${o.killCd}s`;
  $('lb-start').disabled = n < 3; $('lb-start').style.opacity = n < 3 ? 0.45 : 1;
  $('lb-start').innerHTML = n < 3 ? `▶ START GAME<small style="display:block;font-size:12px">need ${3 - n} more player${3 - n > 1 ? 's' : ''} — share the code</small>` : '▶ START GAME';
  $('lb-host').classList.toggle('hidden', !host);
  $('lb-start').classList.toggle('hidden', !host);
  $('lb-wait').classList.toggle('hidden', host);
  $('lb-wait').textContent = L.inGame ? 'A round is still running…' : 'Waiting for the host to start…';
  if (host) {
    const sel = $('lb-map'); if (!sel.options.length) { sel.add(new Option('Random map', -1)); MAPS.forEach(m => sel.add(new Option(m.name, m.id))); }
    sel.value = o.mapId;
    for (const b of $('lb-imps').children) b.classList.toggle('on', +b.dataset.v === o.imps);
  }
}
let myNetId = 0;
function lobbyOpts(patch) { nsend({ t: 'opts', opts: { ...lobbyState.opts, ...patch } }); }
$('lb-map').onchange = e => lobbyOpts({ mapId: +e.target.value });
for (const b of $('lb-imps').children) b.onclick = () => lobbyOpts({ imps: +b.dataset.v });
$('lb-start').onclick = () => { initAudio(); nsend({ t: 'start' }); };
$('lb-leave').onclick = () => { leaveOnline(); showOnline(); };
// copy that works everywhere: the Mac app's native clipboard, the browser clipboard, or the old select-and-copy trick
function copyText(t) {
  try { if (window.webkit?.messageHandlers?.copy) { window.webkit.messageHandlers.copy.postMessage(t); return true; } } catch { }
  try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true; } catch { }
  navigator.clipboard?.writeText(t).catch(() => { }); return true;
}
$('lb-copy').onclick = () => { copyText(inviteLink(lobbyState.code)); $('lb-copy').textContent = '✓ Copied!'; sfx.blip(1300); setTimeout(() => $('lb-copy').textContent = '🔗 Copy invite link', 1500); };
$('lb-code').onclick = () => { copyText(lobbyState.code); $('lb-code').style.opacity = 0.5; setTimeout(() => $('lb-code').style.opacity = 1, 300); };
$('b-online').onclick = () => { initAudio(); save(); showOnline(); };
$('on-back').onclick = () => { leaveOnline(); toTitle(); };
const lobbyCreateOpts = () => ({ special: settings.special, mapId: settings.mapId, imps: Math.min(settings.imps, maxImps(settings.count)), count: settings.count, killCd: settings.killCd, smarts: settings.smarts, tasksPer: settings.tasksPer });
$('on-create').onclick = () => connect(() => nsend({ t: 'create', pub: true, opts: lobbyCreateOpts() }));
$('on-private').onclick = () => connect(() => nsend({ t: 'create', pub: false, opts: lobbyCreateOpts() }));
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length === 4) connect(() => nsend({ t: 'join', code: c })); };
$('on-code').addEventListener('keydown', e => { if (e.code === 'Enter') $('on-join').click(); });

function onNet(m) {
  switch (m.t) {
    case 'hello': myNetId = m.id; if (wantJoin) { sendMe(); nsend({ t: 'join', code: wantJoin }); wantJoin = null; } break;
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
    case 'lobby': lobbyState = m; if (S === 'online') showLobby(); else if (S === 'lobby') { drawLobby(); syncLobbyModels(); } break;
    case 'lchat': if (S === 'lobby') lobbyBubble(m.id, m.text); break;
    case 'ls': if (S === 'lobby') for (const [id, x, z, f, vx, vz] of m.p) { const L = lobbyModels.get(id); if (L && id !== myNetId) { L.tx = x; L.tz = z; L.face = f; L.vx = vx; L.vz = vz; } } break;
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
      game.players.forEach((p, i) => { p.imp = m.imps[i]; if (m.roles) p.role = m.roles[i]; });
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
  for (const p of game.players) { p.imp = m.imps.includes(p.id); p.ai = null; p.role = p.imp ? 'fire' : 'water'; }
  for (const [id, r] of m.fireRoles || []) game.players[id].role = r;
  game.players[me].role = m.role || game.players[me].role;
  const h = game.players[me]; h.tasks = m.tasks; h.done = new Set();
  const tt = { total: 1, done: 0 }; game.taskTotals = () => tt; game._tt = tt;
  setupGame();
}
function applySnap(m) {
  m.p.forEach((a, i) => {
    const p = game.players[i]; if (!p) return;
    const [x, z, f, vx, vz, alive, inVent, tp, ej, hold, carry, frozen, breaks, sky] = a;
    if (i !== me) p.sky = sky ? { t: 1 } : null;
    p.alive = !!alive; p.inVent = inVent; p.ejected = !!ej; p.carry = carry ? 1 : -1;
    if (frozen && !p.frozen) { p.frozen = 1; p.iceT = 0; p.breaks = 0; } if (!frozen) p.frozen = 0; if (frozen && i === me) p.breaks = Math.max(p.breaks || 0, breaks || 0);
    if (i === me) { if (tp !== myTp) { myTp = tp; p.x = x; p.z = z; camPos.x += 0; } return; }
    p.tx = x; p.tz = z; p.face = f; p.vx = vx; p.vz = vz; p.holding = hold;
    if (p.tp !== tp) { p.tp = tp; p.x = x; p.z = z; }
  });
  game.bodies = m.b.map(([pid, x, z]) => ({ pid, x, z, style: 'fire', room: roomName(game.map, x, z) }));
  const wasSab = game.sab;
  game.sab = m.sab ? { ...m.sab, fixT: 0 } : null;
  if (!!wasSab !== !!game.sab) buildTaskList();
  game.sabCd = m.sabCd; game.buttonCd = m.bcd;
  const tt = game._tt; if (tt.done !== m.done || tt.total !== m.total) { tt.done = m.done; tt.total = m.total; buildTaskList(); }
  const h = H(); h.killCd = m.kc; h.meetings = m.ml; h.abilCd = m.ac ?? 0; h.uses = m.us ?? 0; if (m.sk > 0) h.sky = { t: m.sk }; else if (h.sky && h.sky.t < ROLES.unicorn.dur - 1) h.sky = null; if (m.tr) h.tracks = m.tr;
  if (m.sp > 0) h.spirit = { t: m.sp }; else if (h.spirit && m.sp === 0 && h.spirit.t < ROLES.evap.dur - 1) h.spirit = null;
}
function netEvent(e) {
  if (e.type === 'kill') { const v = game.players[e.victim]; v.alive = false; v.deadT = game.time; }
  if (e.type === 'revive') { const v = game.players[e.victim]; v.alive = true; }
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
  if (h.frozen > 0) h.iceT = (h.iceT || 0) + dt;
  if (h.spirit) h.spirit.t -= dt;
  if (h.sky) h.sky.t -= dt;
  posT -= dt;
  if (posT <= 0 && !h.spirit && !h.sky) { posT = 0.05; nsend({ t: 'pos', x: +h.x.toFixed(2), z: +h.z.toFixed(2), vx: +h.vx.toFixed(2), vz: +h.vz.toFixed(2), f: +h.face.toFixed(2), tp: myTp }); }
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
  if (Q.has('kill')) setTimeout(() => { const h = H(), imp = game.players.find(p => p.imp && !p.human), v = game.players.find(p => !p.imp && !p.human); v.x = h.x + 2; v.z = h.z; imp.x = h.x + 3.2; imp.z = h.z; if (ROLES[Q.get('kill')]) imp.role = Q.get('kill'); if (Q.get('kill') === 'me') { h.imp = true; game.kill(h, v); } else game.kill(imp, v); }, Q.has('killdelay') ? +Q.get('killdelay') : 900);
  if (Q.has('lights')) setTimeout(() => { game.sabCd = 0; game.sabotage('lights'); }, 900);
  if (Q.has('heat')) setTimeout(() => { game.sabCd = 0; game.sabotage('heat'); }, 900);
  if (Q.has('dead')) setTimeout(() => { const imp = game.players.find(p => p.imp && !p.human) || game.players[1]; if (!H().imp) game.kill(imp, H()); }, 900);
}
if (Q.has('eject')) { setTimeout(() => { if (!game) startGame(); startEject({ ejected: +Q.get('eject') || 1, tie: false }); }, 600); }
requestAnimationFrame(frame);
