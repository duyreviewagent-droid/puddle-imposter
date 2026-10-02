// Puddle Imposter — online server: serves the game, runs lobbies (public list, 4-letter codes, invite links)
// and plays each match with the same game.js + meeting.js that run in the page for PLAY SOLO.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, USE_R } from './js/game.js';
import { planChat, humanSays, sayText, parseSay, botVote, count, coolDown } from './js/meeting.js';
import { COLORS, MAPS } from './js/maps.js';
import { cleanCos } from './js/cosdata.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const MAX = 12, MIN = 3, TICK = 1 / 30, DISCUSS = 30, VOTE = 40;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  const file = path.join(ROOT, path.normalize(url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT) || file.includes('node_modules') || file.endsWith('server.js') || file.includes('package')) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

const rooms = new Map();
let nextId = 1;
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c)); return c; };
const OPT_KEYS = { mapId: [-1, 4], imps: [1, 3], count: [4, 12], killCd: [10, 60], smarts: [0, 2], tasksPer: [2, 10] };
function cleanOpts(o = {}, base = {}) {
  const out = { mapId: -1, imps: 2, count: 10, killCd: 25, smarts: 1, tasksPer: 6, ...base };
  for (const [k, [a, b]] of Object.entries(OPT_KEYS)) if (Number.isFinite(+o[k])) out[k] = Math.max(a, Math.min(b, Math.round(+o[k])));
  if (o.mode === 'random' || o.mode === 'classic') out.mode = o.mode; if (!out.mode) out.mode = 'classic';
  if (o.special != null) out.special = +o.special ? 1 : 0;
  return out;
}

class Room {
  constructor(host, pub, opts) {
    this.code = newCode(); this.pub = pub; this.clients = []; this.host = host.id;
    this.opts = cleanOpts(opts); this.game = null; this.state = 'lobby'; this.snapT = 0;
    rooms.set(this.code, this);
  }
  listing() { const h = this.clients.find(c => c.id === this.host); return { code: this.code, name: (h ? h.name : 'Puddle') + "'s lobby", n: this.clients.length, max: MAX, map: this.opts.mapId < 0 ? 'Random map' : MAPS[this.opts.mapId].name, inGame: this.state !== 'lobby' }; }
  all(m) { const s = JSON.stringify(m); for (const c of this.clients) send(c.ws, s); }
  lobby() { this.all({ t: 'lobby', code: this.code, pub: this.pub, host: this.host, opts: this.opts, inGame: this.state !== 'lobby', players: this.clients.map(c => ({ id: c.id, name: c.name, color: c.color, cos: c.cos })) }); }
  freeColor(want) { const used = new Set(this.clients.map(c => c.color)); if (!used.has(want)) return want; return COLORS.findIndex((_, i) => !used.has(i)); }
  join(c) {
    if (this.clients.length >= MAX) return send(c.ws, { t: 'err', msg: `That lobby is full (${MAX} puddles).` });
    if (this.state !== 'lobby') return send(c.ws, { t: 'err', msg: 'That lobby is mid-game. Try again when the round ends.' });
    c.color = this.freeColor(c.color); c.room = this; this.clients.push(c);
    this.lobby();
  }
  leave(c) {
    this.clients = this.clients.filter(x => x !== c); c.room = null;
    if (this.game && c.slot != null) {           // no bots online: whoever leaves just disappears from the round
      const g = this.game, p = g.players[c.slot];
      if (p && p.alive) { p.alive = false; p.ejected = true; p.left = true; p.carry = -1; this.all({ t: 'chat', pid: p.id, text: '(left the game)' }); g.checkWin(); if (g.winner && this.state === 'play') { this.flush(); this.finish(); } }
    }
    if (!this.clients.length) { rooms.delete(this.code); return; }
    if (this.host === c.id) this.host = this.clients[0].id;
    this.lobby();
  }
  start() {
    if (this.state !== 'lobby') return;
    if (this.clients.length < MIN) { const h = this.clients.find(c => c.id === this.host); if (h) send(h.ws, { t: 'err', msg: `Online games are real players only — you need at least ${MIN} puddles in the lobby (now ${this.clients.length}). Share the code!` }); return; }
    const o = this.opts, mapId = o.mapId < 0 ? Math.floor(Math.random() * MAPS.length) : o.mapId;
    const seed = Math.floor(Math.random() * 1e9);
    const humans = this.clients.map(c => ({ name: c.name, color: c.color, cos: c.cos }));
    const imps = Math.max(1, Math.min(o.imps, Math.floor((humans.length - 1) / 3) || 1));
    const g = this.game = new Game({ ...o, imps, mapId, seed, humans, count: humans.length });     // no computer puddles online
    this.state = 'play'; this.M = null; this.ejectT = 0;
    this.clients.forEach((c, i) => {
      c.slot = i; c.tp = 0; c.lastSay = 0;
      const p = g.players[i];
      send(c.ws, { t: 'start', me: i, seed, opts: { ...o, mapId, imps: g.o.imps, count: g.players.length }, humans, imps: p.imp ? g.players.filter(q => q.imp).map(q => q.id) : [], fireRoles: p.imp ? g.players.filter(q => q.imp).map(q => [q.id, q.role]) : [], role: p.role, tasks: p.tasks });
    });
    this.lobby();
  }
  input(c, m) {
    const g = this.game; if (!g || c.slot == null) return;
    const p = g.players[c.slot]; if (!p || !p.human) return;
    if (m.t === 'pos') {
      if (this.state !== 'play' || (m.tp | 0) !== (p.tp || 0) || p.inVent >= 0 || p.frozen > 0 || p.spirit || p.sky) return;     // while evaporated the body stays put
      const x = +m.x, z = +m.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      if (Math.hypot(x - p.x, z - p.z) > 4) return;          // no teleporting
      if (p.alive && (!g.open(Math.floor(x), Math.floor(z)))) return;
      p.x = x; p.z = z; p.vx = +m.vx || 0; p.vz = +m.vz || 0; p.face = +m.f || 0;
      return;
    }
    if (m.t === 'say') {
      if (!this.M || !p.alive || g.muted === p.id || this.M.revealT >= 0 || g.time + this.M.t - c.lastSay < 1) return;
      c.lastSay = g.time + this.M.t;
      let kind = clean(m.kind, 10), target = m.target == null ? null : m.target | 0, text;
      if (kind === 'text') {                       // typed message
        text = clean(m.text, 120); if (!text) return;
        ({ kind, target } = parseSay(g, p.id, text));
        this.all({ t: 'chat', pid: p.id, text });
        if (kind) for (const r of humanSays(g, kind, target, p.id)) this.M.replies.push({ at: this.M.t + r.delay, pid: r.pid, text: r.text });
        return;
      }
      if (target != null && !g.players[target]) return;
      text = sayText(g, p.id, kind, target); if (!text) return;
      this.all({ t: 'chat', pid: p.id, text });
      for (const r of humanSays(g, kind, target, p.id)) this.M.replies.push({ at: this.M.t + r.delay, pid: r.pid, text: r.text });
      return;
    }
    if (m.t === 'vote') {
      if (!this.M || this.M.phase !== 'vote' || !p.alive || p.voted != null) return;
      const v = m.target | 0; if (v >= 0 && !(g.players[v] && g.players[v].alive)) return;
      p.voted = v; this.all({ t: 'voted', pid: p.id });
      return;
    }
    if (m.t !== 'act' || this.state !== 'play') return;
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    switch (m.a) {
      case 'task': { const id = m.id | 0, t = g.map.tasks[id]; if (t && near(t.x, t.z, USE_R + 1.2)) g.completeTask(p, id); break; }
      case 'lights': if (p.alive && near(g.map.lights.x, g.map.lights.z, USE_R + 1.2)) g.fixLights(); break;
      case 'hold': p.holding = m.i == null ? -1 : m.i | 0; break;
      case 'button': { const u = g.usable(p); if (u && u.kind === 'button') g.callMeeting(p, null); break; }
      case 'report': { const b = g.bodyNear(p); if (b) g.callMeeting(p, b); break; }
      case 'kill': { const v = g.killTarget(p); if (v) g.kill(p, v); break; }
      case 'vent': {
        if (!p.imp || !p.alive) break;
        if (m.op === 'in') { const v = g.ventNear(p); if (v >= 0 && p.inVent < 0) g.ventIn(p, v); }
        else if (m.op === 'out' && p.inVent >= 0) g.ventOut(p);
        else if (m.op === 'hop' && p.inVent >= 0) { const j = m.j | 0; if (g.map.vents[p.inVent].links.includes(j)) g.ventHop(p, j); }
        break;
      }
      case 'ability': {
        if (m.op === 'dump') g.dump(p);
        else if (m.op === 'flush') g.flush(p, m.j | 0);
        else if (m.op === 'rain') g.rain(p);
        else if (m.op === 'revive') g.revive(p);
        else if (m.op === 'freeze') g.freeze(p);
        else if (m.op === 'evaporate') g.evaporate(p);
        else if (m.op === 'return') g.condense(p);
        else if (m.op === 'rainbow') g.rainbow(p);
        else if (m.op === 'land') g.land(p);
        else if (m.op === 'bubble') g.bubble(p);
        else if (m.op === 'flood') g.floodMap(p);
        else if (m.op === 'meteor') g.meteor(p, m.target | 0);
        else if (m.op === 'use') g.useAbility(p, m.arg == null ? undefined : m.arg | 0);
        else if (m.op === 'break') { const now = Date.now(); if (now - (c.lastBreak || 0) > 55) { c.lastBreak = now; g.breakIce(p); } }
        break;
      }
      case 'sab': if (p.imp && (m.kind === 'lights' || m.kind === 'heat')) g.sabotage(m.kind); break;
    }
  }
  flush() {
    const g = this.game;
    for (const e of g.events) {
      // private events: only the player they're for (or only the Fire team) hears about them
      if (e.type === 'bubbleAlert' || e.type === 'bubble' || e.to != null) { const to = e.type === 'bubble' ? e.p : e.to; const c = this.clients.find(c => c.slot === to); if (c) send(c.ws, { t: 'ev', e }); continue; }
      if (e.toFire) { for (const c of this.clients) if (c.slot != null && g.players[c.slot] && g.players[c.slot].imp) send(c.ws, { t: 'ev', e }); continue; }
      const out = { ...e };
      if (e.type === 'report' || e.type === 'emergency') out.meeting = g.meeting;
      this.all({ t: 'ev', e: out });
      if (e.type === 'report' || e.type === 'emergency') this.beginMeeting();
    }
    g.events.length = 0;
  }
  beginMeeting() {
    const g = this.game;
    this.state = 'meeting';
    this.M = { t: -2.6, phase: 'discuss', plan: planChat(g, DISCUSS), replies: [], voteAt: {}, revealT: -1 };
    for (const p of g.players) { p.voted = null; p.holding = -1; if (p.ai && p.alive) this.M.voteAt[p.id] = DISCUSS + 1.5 + g.R() * (VOTE - 6); }
    this.all({ t: 'meet', discuss: DISCUSS, vote: VOTE });
  }
  meetingTick(dt) {
    const g = this.game, M = this.M;
    M.t += dt;
    while (M.plan.length && M.plan[0].at <= M.t) { const r = M.plan.shift().gen(); if (r) this.all({ t: 'chat', pid: r.pid, text: r.text }); }
    M.replies.sort((a, b) => a.at - b.at);
    while (M.replies.length && M.replies[0].at <= M.t) { const r = M.replies.shift(); if (g.players[r.pid].alive) this.all({ t: 'chat', pid: r.pid, text: r.text }); }
    if (M.revealT >= 0) {
      M.revealT += dt;
      if (M.revealT > 4) {
        const ej = M.result.ejected;
        coolDown(g); g.endMeeting(ej);
        this.state = 'eject'; this.ejectT = ej >= 0 ? 10 : 6.5; this.M = null;
        this.all({ t: 'eject', ejected: ej, tie: M.result.tie, imp: ej >= 0 && g.players[ej].imp, role: ej >= 0 && g.players[ej].imp ? g.players[ej].role : null, left: g.impAlive() });
        g.events = g.events.filter(e => e.type !== 'win');
      }
      return;
    }
    if (M.phase === 'discuss' && M.t >= DISCUSS) M.phase = 'vote';
    if (M.phase !== 'vote') return;
    const tally = {}; for (const p of g.players) if (p.alive && p.voted >= 0) tally[p.voted] = (tally[p.voted] || 0) + 1;
    for (const p of g.players) if (p.ai && p.alive && p.voted == null && M.t >= M.voteAt[p.id]) { p.voted = botVote(g, p, tally); this.all({ t: 'voted', pid: p.id }); }
    if (g.players.every(p => !p.alive || p.voted != null) || M.t >= DISCUSS + VOTE) {
      for (const p of g.players) if (p.alive && p.voted == null) p.voted = -1;
      M.result = count(g); M.revealT = 0; M.phase = 'reveal';
      this.all({ t: 'reveal', votes: g.players.map(p => p.alive ? p.voted : null), ejected: M.result.ejected, tie: M.result.tie });
    }
  }
  tick(dt) {
    const g = this.game;
    if (!g) {                     // walk-around lobby: share where everyone is standing
      this.lsT = (this.lsT || 0) - dt;
      if (this.lsT <= 0 && this.clients.length > 1) { this.lsT = 1 / 12; this.all({ t: 'ls', p: this.clients.map(c => [c.id, c.lx, c.lz, c.lf, c.lvx, c.lvz]) }); }
      return;
    }
    if (this.state === 'play') { g.update(dt); this.flush(); }
    else if (this.state === 'meeting') this.meetingTick(dt);
    else if (this.state === 'eject') { this.ejectT -= dt; if (this.ejectT <= 0) { if (g.winner) this.finish(); else { this.state = 'play'; g.state = 'play'; this.all({ t: 'resume' }); } } }
    if (g.winner && this.state === 'play') { this.flush(); this.finish(); return; }
    this.snapT -= dt;
    if (this.snapT <= 0 && this.game) { this.snapT = 1 / 15; this.snapshot(); }
  }
  finish() {
    const g = this.game;
    this.all({ t: 'win', side: g.winner.side, why: g.winner.why, heat: !!g.winner.heat, imps: g.players.map(p => p.imp), roles: g.players.map(p => p.role), names: g.players.map(p => p.name) });
    this.game = null; this.state = 'lobby';
    for (const c of this.clients) c.slot = null;
    this.lobby();
  }
  snapshot() {
    const g = this.game, r2 = v => Math.round(v * 100) / 100;
    const { total, done } = g.taskTotals();
    const base = { t: 's', p: g.players.map(p => [r2(p.x), r2(p.z), r2(p.face), r2(p.vx), r2(p.vz), p.alive ? 1 : 0, p.inVent, p.tp || 0, p.ejected ? 1 : 0, p.holding, p.carry >= 0 ? 1 : 0, p.frozen > 0 ? 1 : 0, p.breaks || 0, p.sky ? 1 : 0, p.invis > 0 ? 1 : 0, p.disguise ? p.disguise.id : -1]),
      b: g.bodies.map(b => [b.pid, r2(b.x), r2(b.z)]), sab: g.sab ? { type: g.sab.type, t: r2(g.sab.t), held: g.sab.held } : null, sabCd: r2(g.sabCd), bcd: r2(g.buttonCd), done, total, fl: g.flood ? r2(g.flood.t) : 0, mt: g.meteors.map(m => [m.id, r2(m.x), r2(m.z), r2(m.t)]), mu: g.muted };
    const traps = g.traps.map(t => [t.id, r2(t.x), r2(t.z)]);
    for (const c of this.clients) { const p = c.slot != null && g.players[c.slot]; if (p) send(c.ws, { ...base, kc: r2(p.killCd), ml: p.meetings, ac: r2(p.abilCd), us: p.uses, sp: p.spirit ? r2(p.spirit.t) : 0, sk: p.sky ? r2(p.sky.t) : 0, tr: p.tracks, ch: p.charges ?? 0, cht: r2(p.chargeT || 0), st: r2(p.stun || 0), bl: r2(p.blind || 0), sh: p.shield ? 1 : 0, sn: p.snitchOn ? 1 : 0, ph: r2(p.phase || 0), trp: p.imp ? traps : undefined }); }
  }
}

const wss = new WebSocketServer({ server, maxPayload: 8192 });
wss.on('connection', ws => {
  const c = { id: nextId++, ws, name: 'Puddle', color: 0, cos: cleanCos(null), room: null, slot: null, lx: 0, lz: 0, lf: 0, lvx: 0, lvz: 0 };
  send(ws, { t: 'hello', id: c.id });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const r = c.room;
    switch (m.t) {
      case 'me': c.cos = cleanCos(m.cos); c.name = clean(m.name, 12) || 'Puddle'; c.color = Math.max(0, Math.min(COLORS.length - 1, m.color | 0)); if (r && r.state === 'lobby') { c.color = r.freeColor(c.color); r.lobby(); } break;
      case 'list': send(ws, { t: 'list', rooms: [...rooms.values()].filter(x => x.pub).map(x => x.listing()) }); break;
      case 'create': { if (r) r.leave(c); const nr = new Room(c, !!m.pub, m.opts); nr.join(c); break; }
      case 'join': { const nr = rooms.get(clean(m.code, 4).toUpperCase()); if (!nr) { send(ws, { t: 'err', msg: 'No lobby with that code.' }); break; } if (r !== nr) { if (r) r.leave(c); nr.join(c); } break; }
      case 'leave': if (r) r.leave(c); send(ws, { t: 'left' }); break;
      case 'opts': if (r && r.host === c.id && r.state === 'lobby') { r.opts = cleanOpts(m.opts, r.opts); r.lobby(); } break;
      case 'start': if (r && r.host === c.id) r.start(); break;
      case 'lchat': if (r && r.state === 'lobby') { const text = clean(m.text, 100); if (text && Date.now() - (c.lastL || 0) > 600) { c.lastL = Date.now(); r.all({ t: 'lchat', id: c.id, text }); } } break;
      case 'lpos': if (r && r.state === 'lobby') { for (const k of ['x', 'z', 'f', 'vx', 'vz']) { const v = +m[k]; if (Number.isFinite(v)) c['l' + k] = Math.max(-5, Math.min(80, v)); } } break;
      default: if (r) r.input(c, m);
    }
  });
  ws.on('close', () => { if (c.room) c.room.leave(c); });
});
setInterval(() => { for (const r of rooms.values()) { try { r.tick(TICK); } catch (e) { console.error('room', r.code, e); } } }, TICK * 1000);
server.listen(PORT, () => console.log('Puddle Imposter server on :' + PORT));
