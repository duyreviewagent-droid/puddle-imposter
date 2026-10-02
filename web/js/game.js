// Rules + computer puddles. No three.js here: the main loop reads positions and events from this.
import { MAPS, buildMap, roomName, COLORS, TASK_NAMES, rng } from './maps.js';
import { randomCos, cleanCos } from './cosdata.js';
import { ROLES, FIRE_SPECIALS, WATER_SPECIALS, isFire } from './roles.js';

export const SPEED = 4.2, RAD = 0.3, KILL_R = 1.7, REPORT_R = 2.8, USE_R = 1.45, VENT_R = 1.0;
export const VIS = 7.5, VIS_LOW = 2.6, VIS_IMP = 10.5;
const BOT_NAMES = ['Drizzle', 'Splash', 'Puddles', 'Droplet', 'Soggy', 'Misty', 'Ripple', 'Slosh', 'Bubbles', 'Dewey', 'Sprinkle', 'Damp'];
const TASK_TIME = { wires: 6, mop: 7, valve: 5, upload: 9, swipe: 4, coolant: 6, filter: 6, code: 5 };

export class Game {
  constructor(o) {
    this.o = o = { mapId: 0, count: 10, imps: 2, role: 'random', color: 0, name: 'You', killCd: 25, tasksPer: 6, discuss: 30, vote: 40, heatTime: 45, smarts: 1, seed: Date.now() & 0xffffff, ...o };
    this.R = rng(o.seed);
    this.map = buildMap(MAPS[o.mapId]);
    this.time = 0; this.state = 'play'; this.events = []; this.bodies = []; this.sab = null; this.sabCd = 20; this.buttonCd = 15;
    this.meetingN = 0; this.winner = null;
    const R = this.R, M = this.map;
    // humans first (online games have several), then computer puddles in the colours nobody picked
    const humans = o.humans || [{ name: o.name, color: o.color, cos: o.cos }];
    const cols = COLORS.map((c, i) => i).filter(i => !humans.some(h => h.color === i)).sort(() => R() - 0.5);
    const names = BOT_NAMES.slice().sort(() => R() - 0.5);
    this.players = [];
    const total = Math.max(o.count, humans.length);
    for (let i = 0; i < total; i++) {
      const hu = humans[i], ci = hu ? hu.color : cols[i - humans.length];
      this.players.push({ id: i, human: !!hu, name: hu ? (hu.name || COLORS[ci].name) : COLORS[ci].name, nick: hu ? hu.name : names[i], color: COLORS[ci].hex, colorName: COLORS[ci].name, cos: hu ? cleanCos(hu.cos) : randomCos(R),
        imp: false, alive: true, x: 0, z: 0, vx: 0, vz: 0, face: 0, tasks: [], done: new Set(), meetings: 1, killCd: 12, inVent: -1, holding: -1, voted: null, ai: null, room: '' });
    }
    // roles
    const order = this.players.map(p => p.id).sort(() => R() - 0.5);
    let impIds = [];
    o.imps = Math.min(o.imps, Math.max(1, Math.floor((total - 1) / 3)));
    if (humans.length > 1) impIds = order.slice(0, o.imps);
    else if (o.role === 'imp' || isFire(o.role)) impIds = [0, ...order.filter(i => i !== 0).slice(0, o.imps - 1)];
    else if (o.role === 'crew' || (ROLES[o.role] && !isFire(o.role))) impIds = order.filter(i => i !== 0).slice(0, o.imps);
    else impIds = order.slice(0, o.imps);
    for (const i of impIds) this.players[i].imp = true;
    // special roles: Fire can be Sponge/Bucket, Water can be Toilet/Raining/Fire Extinguisher
    for (const p of this.players) { p.role = p.imp ? 'fire' : 'water'; p.abilCd = 10; p.uses = 2; p.carry = -1; }
    if (o.special !== false) {
      const give = (list, team) => {
        const pool = this.players.filter(p => p.imp === (team === 'fire') && p.role === (team === 'fire' ? 'fire' : 'water') && !(humans.length === 1 && p.id === 0 && ROLES[o.role] && o.role !== 'water' && o.role !== 'fire'));
        // Water gets at most one special per 3 Water players (they're info-heavy); Fire can all be special
        let cap = team === 'fire' ? 99 : Math.max(1, Math.floor(pool.length / 3));
        for (const r of list.slice().sort(() => R() - 0.5)) { if (!pool.length || cap <= 0 || R() > (team === 'fire' ? 0.6 : 0.7)) continue; const k = Math.floor(R() * pool.length); pool[k].role = r; pool.splice(k, 1); cap--; }
      };
      if (humans.length === 1 && ROLES[o.role] && o.role !== 'water' && o.role !== 'fire') this.players[0].role = o.role;
      give(FIRE_SPECIALS.filter(r => r !== this.players[0].role), 'fire'); give(WATER_SPECIALS.filter(r => r !== this.players[0].role), 'water');
    }
    for (const p of this.players) { p.frozen = 0; p.tracks = []; if (p.role === 'ice') p.uses = ROLES.ice.uses; }
    // tasks: everyone gets a list (imposters get a fake one)
    for (const p of this.players) {
      const pool = M.tasks.map(t => t.id).sort(() => R() - 0.5);
      p.tasks = pool.slice(0, Math.min(o.tasksPer, pool.length));
    }
    this.n = this.players.length;
    for (const p of this.players) if (!p.human) p.ai = this.newAI(p);
    this.spawn();
  }
  newAI(p) {
    return { mode: 'idle', path: null, pi: 0, wait: 1 + this.R() * 2, goal: null, seen: new Array(this.n).fill(null), with: new Float32Array(this.n), sus: new Float32Array(this.n),
      claims: [], lastTask: null, lastRoomT: [], stuckT: 0, lx: 0, lz: 0, thinkT: this.R() * 0.3, aggro: 0.4 + this.R() * 0.6, huntT: 0, target: -1, ventHop: 0, fakeT: 0 };
  }
  spawn() {
    const b = this.map.button, alive = this.players;
    alive.forEach((p, k) => { p.tp = (p.tp || 0) + 1; const a = k / alive.length * Math.PI * 2; p.x = b.x + Math.sin(a) * 2.6; p.z = b.z + Math.cos(a) * 2.6; p.face = a; p.vx = p.vz = 0; p.inVent = -1; p.holding = -1; if (p.ai) { p.ai.mode = 'idle'; p.ai.path = null; p.ai.wait = 0.5 + this.R() * 2; } });
  }
  get human() { return this.players[0]; }
  emit(e) { this.events.push(e); }
  living() { return this.players.filter(p => p.alive); }
  crewAlive() { return this.players.filter(p => p.alive && !p.imp).length; }
  impAlive() { return this.players.filter(p => p.alive && p.imp).length; }
  taskTotals() {
    let total = 0, done = 0;
    for (const p of this.players) if (!p.imp) { total += p.tasks.length; done += p.done.size; }
    return { total, done };
  }
  // ------------------------------------------------------------------ grid helpers
  free(i, j) { const M = this.map; return i >= 0 && j >= 0 && i < M.W && j < M.H && M.grid[j * M.W + i] === 1; }
  open(i, j) { const M = this.map; return i >= 0 && j >= 0 && i < M.W && j < M.H && M.grid[j * M.W + i] !== 0; }
  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let k = 1; k < n; k++) { const t = k / n; if (!this.open(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false; }
    return true;
  }
  vision(p) { if (!p.alive) return 999; if (p.imp) return VIS_IMP; return this.sab && this.sab.type === 'lights' ? VIS_LOW : VIS; }
  canSee(p, x, z) { const d = Math.hypot(x - p.x, z - p.z); return d <= this.vision(p) && this.los(p.x, p.z, x, z); }
  sees(p, q) { return q.alive && q.inVent < 0 && this.canSee(p, q.x, q.z); }
  move(p, dx, dz, ghost = false) {
    if (ghost) { p.x = Math.max(1, Math.min(this.map.W - 1, p.x + dx)); p.z = Math.max(1, Math.min(this.map.H - 1, p.z + dz)); return; }
    p.x += dx; this.collide(p); p.z += dz; this.collide(p);
  }
  collide(p) {
    const i0 = Math.floor(p.x - RAD), i1 = Math.floor(p.x + RAD), j0 = Math.floor(p.z - RAD), j1 = Math.floor(p.z + RAD);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (this.free(i, j)) continue;
      const cx = Math.max(i, Math.min(i + 1, p.x)), cz = Math.max(j, Math.min(j + 1, p.z));
      let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < RAD) {
        if (d < 1e-5) { dx = p.x - (i + 0.5); dz = p.z - (j + 0.5); d = Math.hypot(dx, dz) || 1; p.x = i + 0.5 + dx / d * (0.5 + RAD); p.z = j + 0.5 + dz / d * (0.5 + RAD); }
        else { p.x = cx + dx / d * RAD; p.z = cz + dz / d * RAD; }
      }
    }
  }
  // A* on the walk grid (8-way, no corner cutting), then string-pulled
  path(ax, az, bx, bz) {
    const M = this.map, W = M.W, H = M.H;
    let si = Math.floor(ax), sj = Math.floor(az), ti = Math.floor(bx), tj = Math.floor(bz);
    if (!this.free(ti, tj)) { const c = this.nearFree(ti, tj); if (!c) return null; [ti, tj] = c; }
    if (!this.free(si, sj)) { const c = this.nearFree(si, sj); if (c) [si, sj] = c; }
    const N = W * H, g = this._g || (this._g = new Float32Array(N)), from = this._f || (this._f = new Int32Array(N)), closed = this._c || (this._c = new Uint8Array(N));
    g.fill(1e9); closed.fill(0); from.fill(-1);
    const start = sj * W + si, goal = tj * W + ti;
    const heap = [[0, start]]; g[start] = 0;
    const push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const pa = (k - 1) >> 1; if (heap[pa][0] <= heap[k][0]) break; [heap[pa], heap[k]] = [heap[k], heap[pa]]; k = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.length) {
      const [, c] = pop(); if (closed[c]) continue; closed[c] = 1;
      if (c === goal) { found = true; break; }
      const ci = c % W, cj = (c / W) | 0;
      for (const [di, dj, cost] of DIRS) {
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const n = nj * W + ni, ng = g[c] + cost;
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(ng + Math.hypot(ti - ni, tj - nj), n); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = goal; c !== -1; c = from[c]) cells.push([c % W + 0.5, ((c / W) | 0) + 0.5]);
    cells.reverse();
    cells[cells.length - 1] = [bx, bz];
    // string pulling with a body-width clear check
    const out = []; let a = [ax, az], k = 0;
    while (k < cells.length - 1) {
      let far = k + 1;
      for (let m = cells.length - 1; m > k + 1; m--) if (this.clear(a[0], a[1], cells[m][0], cells[m][1])) { far = m; break; }
      out.push(cells[far]); a = cells[far]; k = far;
    }
    if (!out.length) out.push([bx, bz]);
    return out;
  }
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az); if (d < 0.01) return true;
    const n = Math.ceil(d / 0.2), px = -(bz - az) / d * 0.36, pz = (bx - ax) / d * 0.36;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.free(Math.floor(x), Math.floor(z)) || !this.free(Math.floor(x + px), Math.floor(z + pz)) || !this.free(Math.floor(x - px), Math.floor(z - pz))) return false;
    }
    return true;
  }
  nearFree(i, j) { for (let r = 1; r < 4; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.free(i + di, j + dj)) return [i + di, j + dj]; return null; }

  // ------------------------------------------------------------------ what a player can interact with
  usable(p) {
    if (p.frozen > 0 || p.spirit || p.sky) return null;
    const M = this.map, out = [];
    const d = (x, z) => Math.hypot(p.x - x, p.z - z);
    if (this.sab && this.sab.type === 'lights' && p.alive && !p.imp && d(M.lights.x, M.lights.z) < USE_R + 0.3) out.push({ kind: 'lights', d: d(M.lights.x, M.lights.z) });
    if (this.sab && this.sab.type === 'heat' && p.alive && !p.imp) M.valves.forEach((v, i) => { if (d(v.x, v.z) < USE_R + 0.3) out.push({ kind: 'valve', i, d: d(v.x, v.z) }); });
    for (const id of p.tasks) {
      if (p.done.has(id)) continue;
      const t = M.tasks[id]; const dd = d(t.x, t.z);
      if (dd < USE_R + (t.type === 'mop' ? 0.5 : 0)) out.push({ kind: 'task', id, d: dd, fake: p.imp });
    }
    if (p.alive && p.meetings > 0 && this.buttonCd <= 0 && !(this.sab && this.sab.type === 'heat') && d(M.button.x, M.button.z) < 2.0) out.push({ kind: 'button', d: d(M.button.x, M.button.z) - 0.5 });
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
  }
  dumpNear(p) { if (p.carry < 0) return -1; let best = -1, bd = 1.8; this.map.dumps.forEach((v, i) => { const dd = Math.hypot(p.x - v.x, p.z - v.z); if (dd < bd) { bd = dd; best = i; } }); return best; }
  anyVentNear(p) { let best = -1, bd = VENT_R; this.map.vents.forEach((v, i) => { const dd = Math.hypot(p.x - v.x, p.z - v.z); if (dd < bd) { bd = dd; best = i; } }); return best; }
  reviveTarget(p) { if (p.role !== 'ext' || !p.alive || p.uses <= 0) return null; let best = null, bd = REPORT_R; for (const b of this.bodies) { if (b.reported || b.style !== 'fire') continue; const dd = Math.hypot(p.x - b.x, p.z - b.z); if (dd < bd && this.los(p.x, p.z, b.x, b.z)) { bd = dd; best = b; } } return best; }
  // what the role's special button would do right now (or null)
  ability(p) {
    if (!p.alive) return null;
    if (p.role === 'bucket') { const d = this.dumpNear(p); return d >= 0 ? { kind: 'dump', i: d } : null; }
    if (p.role === 'toilet') { const v = this.anyVentNear(p); return v >= 0 && p.abilCd <= 0 && p.inVent < 0 ? { kind: 'flush', i: v } : null; }
    if (p.frozen > 0) return null;
    if (p.role === 'rain') return this.sab && p.abilCd <= 0 ? { kind: 'rain' } : null;
    if (p.role === 'ext') { const b = this.reviveTarget(p); return b ? { kind: 'revive', body: b } : null; }
    if (p.role === 'unicorn') return p.sky ? { kind: 'land' } : p.abilCd <= 0 && p.inVent < 0 ? { kind: 'rainbow' } : null;
    if (p.role === 'bubble') { if (p.tracks.length >= ROLES.bubble.uses) return null; const q = this.bubbleTarget(p); return q ? { kind: 'bubble', q } : null; }
    if (p.role === 'evap') return p.spirit ? { kind: 'return' } : p.abilCd <= 0 && p.inVent < 0 ? { kind: 'evaporate' } : null;
    if (p.role === 'ice') return p.uses > 0 && p.abilCd <= 0 && p.inVent < 0 ? { kind: 'freeze' } : null;
    return null;
  }
  dump(p) { const d = this.dumpNear(p); if (d < 0) return; const v = this.map.dumps[d]; this.emit({ type: 'dump', p: p.id, victim: p.carry, x: v.x, z: v.z }); p.carry = -1; }
  flush(p, j) {
    const i = this.anyVentNear(p); if (p.role !== 'toilet' || i < 0 || p.abilCd > 0 || !this.map.vents[j] || i === j) return;
    const a = this.map.vents[i], b = this.map.vents[j];
    p.x = b.x; p.z = b.z; p.tp = (p.tp || 0) + 1; p.abilCd = ROLES.toilet.cd; p.holding = -1;
    this.emit({ type: 'flush', p: p.id, x: a.x, z: a.z, x2: b.x, z2: b.z });
  }
  freeze(p) {
    if (p.role !== 'ice' || !p.alive || p.uses <= 0 || p.abilCd > 0 || this.state !== 'play') return;
    p.uses--; p.abilCd = ROLES.ice.cd;
    for (const q of this.players) if (q.alive && !q.imp) { q.frozen = 1; q.iceT = 0; q.breaks = 0; q.holding = -1; q.vx = q.vz = 0; q.breakSpeed = 3 + this.R() * 5; }
    this.emit({ type: 'freeze', p: p.id, uses: p.uses });
  }
  // one click/tap on the ice. Only counts after the first 2 seconds; 12 of them and you're free
  breakIce(q) {
    if (!(q.frozen > 0) || q.iceT < ROLES.ice.minT) return;
    q.breaks++;
    if (q.breaks >= ROLES.ice.breaks) { q.frozen = 0; this.emit({ type: 'thaw', p: q.id }); }
  }
  // Unicorn: up a rainbow into the sky (the rainbow's foot stays at p.x/p.z, where Fire can burn it)
  rainbow(p) {
    if (p.role !== 'unicorn' || !p.alive || p.sky || p.abilCd > 0 || p.frozen > 0 || this.state !== 'play') return;
    p.sky = { t: ROLES.unicorn.dur }; p.holding = -1; p.vx = p.vz = 0;
    this.emit({ type: 'rainbow', p: p.id, x: p.x, z: p.z });
  }
  land(p) { if (!p.sky) return; p.sky = null; p.abilCd = ROLES.unicorn.cd; this.emit({ type: 'land', p: p.id, x: p.x, z: p.z }); }
  // Bubble: stick a tracker on someone close by
  bubbleTarget(p) { let best = null, bd = 2.6; for (const q of this.players) { if (q === p || !q.alive || q.inVent >= 0 || p.tracks.includes(q.id)) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd && this.los(p.x, p.z, q.x, q.z)) { bd = d; best = q; } } return best; }
  bubble(p) {
    if (p.role !== 'bubble' || !p.alive || p.tracks.length >= ROLES.bubble.uses || p.frozen > 0) return;
    const q = this.bubbleTarget(p); if (!q) return;
    p.tracks.push(q.id); this.emit({ type: 'bubble', p: p.id, q: q.id, left: ROLES.bubble.uses - p.tracks.length });
  }
  // Evaporation: leave the body as vapor (the body stays where it is), come back later
  evaporate(p) {
    if (p.role !== 'evap' || !p.alive || p.spirit || p.abilCd > 0 || p.frozen > 0 || this.state !== 'play') return;
    p.spirit = { t: ROLES.evap.dur }; p.holding = -1; p.vx = p.vz = 0;
    this.emit({ type: 'evap', p: p.id, x: p.x, z: p.z });
  }
  condense(p) {
    if (!p.spirit) return;
    p.spirit = null; p.abilCd = ROLES.evap.cd;
    this.emit({ type: 'condense', p: p.id, x: p.x, z: p.z });
  }
  rain(p) {
    if (p.role !== 'rain' || !this.sab || p.abilCd > 0 || !p.alive) return;
    const kind = this.sab.type; this.sab = null; this.sabCd = 30; p.abilCd = ROLES.rain.cd;
    this.emit({ type: 'rain', p: p.id, kind, x: p.x, z: p.z });
  }
  revive(p) {
    const b = this.reviveTarget(p); if (!b) return;
    const v = this.players[b.pid]; if (!v || v.ejected) return;
    this.bodies = this.bodies.filter(x => x !== b); p.uses--;
    v.alive = true; v.x = b.x; v.z = b.z; v.tp = (v.tp || 0) + 1; v.inVent = -1; v.carry = -1;
    this.emit({ type: 'revive', p: p.id, victim: v.id, x: b.x, z: b.z });
    if (v.ai) {               // they remember who set them on fire
      v.ai.claims.push({ kind: 'burnedMe', who: b.killer, room: b.room, t: this.time }); v.ai.sus[b.killer] = 100;
      if (v.meetings > 0) { v.ai.mode = 'button'; v.ai.path = null; } else { v.ai.mode = 'idle'; }
    }
    if (p.ai) { p.ai.sus[b.killer] = Math.max(p.ai.sus[b.killer], 60); }
  }
  ventNear(p) { if (!p.imp || !p.alive || p.carry >= 0) return -1; let best = -1, bd = VENT_R; this.map.vents.forEach((v, i) => { const dd = Math.hypot(p.x - v.x, p.z - v.z); if (dd < bd) { bd = dd; best = i; } }); return best; }
  bodyNear(p) { if (!p.alive || p.frozen > 0 || p.spirit || p.sky) return null; let best = null, bd = REPORT_R; for (const b of this.bodies) { const dd = Math.hypot(p.x - b.x, p.z - b.z); if (dd < bd && this.los(p.x, p.z, b.x, b.z)) { bd = dd; best = b; } } return best; }
  killTarget(p) {
    if (!p.imp || !p.alive || p.inVent >= 0 || p.killCd > 0 || p.carry >= 0) return null;
    let best = null, bd = KILL_R;
    for (const q of this.players) { if (!q.alive || q.imp || q.inVent >= 0) continue; const dd = Math.hypot(p.x - q.x, p.z - q.z); if (dd < bd && this.los(p.x, p.z, q.x, q.z)) { bd = dd; best = q; } }
    return best;
  }
  // ------------------------------------------------------------------ actions
  completeTask(p, id) {
    if (p.done.has(id) || !p.tasks.includes(id)) return;
    if (p.imp) { p.done.add(id); return; }          // fake: nothing counts
    p.done.add(id); if (p.ai) p.ai.lastTask = this.map.tasks[id];
    this.emit({ type: 'task', p: p.id });
    this.checkWin();
  }
  kill(k, v) {
    if (!v.alive || this.state !== 'play') return;
    const fromSky = !!v.sky;
    v.alive = false; v.deadT = this.time; v.holding = -1; if (v.spirit) { v.spirit = null; } v.sky = null;
    const style = k.role === 'sponge' ? 'sponge' : k.role === 'bucket' ? 'bucket' : 'fire';
    if (style === 'fire') this.bodies.push({ pid: v.id, x: v.x, z: v.z, t: this.time, room: roomName(this.map, v.x, v.z), style, killer: k.id });
    if (style === 'bucket') k.carry = v.id;
    if (style === 'fire') { k.x = v.x; k.z = v.z; k.tp = (k.tp || 0) + 1; }
    k.killCd = this.o.killCd;
    this.emit({ type: 'kill', killer: k.id, victim: v.id, x: v.x, z: v.z, style, kx: k.x, kz: k.z, sky: fromSky });
    // Bubble trackers: whoever has a bubble on the killer gets an alert
    for (const w of this.players) {
      if (w.role !== 'bubble' || !w.alive || w === k || !w.tracks.includes(k.id)) continue;
      this.emit({ type: 'bubbleAlert', to: w.id, killer: k.id, x: v.x, z: v.z, room: roomName(this.map, v.x, v.z) });
      if (w.ai) { w.ai.claims.push({ kind: 'kill', who: k.id, victim: v.id, room: roomName(this.map, v.x, v.z), t: this.time }); w.ai.sus[k.id] = 100; if (style === 'fire') { w.ai.mode = 'report'; w.ai.goal = { x: v.x, z: v.z }; } else if (w.meetings > 0) w.ai.mode = 'button'; w.ai.path = null; }
    }
    // witnesses
    for (const w of this.players) {
      if (!w.alive || w === k || !w.ai || w.imp) continue;
      if (w.spirit || w.sky || this.canSee(w, k.x, k.z)) {
        w.ai.claims.push({ kind: 'kill', who: k.id, victim: v.id, room: roomName(this.map, k.x, k.z), t: this.time });
        w.ai.sus[k.id] = 100;
        if (style === 'fire') { w.ai.mode = 'report'; w.ai.goal = { x: v.x, z: v.z }; w.ai.path = null; }
        else if (w.meetings > 0 && this.buttonCd <= 0) { w.ai.mode = 'button'; w.ai.path = null; }
      }
    }
    if (v.ai) { v.ai.mode = 'idle'; v.ai.path = null; }
    this.checkWin();
  }
  ventIn(p, i) {
    p.inVent = i; const v = this.map.vents[i]; p.x = v.x; p.z = v.z; p.vx = p.vz = 0; p.tp = (p.tp || 0) + 1;
    this.emit({ type: 'vent', p: p.id, x: v.x, z: v.z });
    this.ventWitness(p, v);
  }
  ventOut(p) { const v = this.map.vents[p.inVent]; p.inVent = -1; this.emit({ type: 'vent', p: p.id, x: v.x, z: v.z }); this.ventWitness(p, v); }
  ventHop(p, j) { const v = this.map.vents[j]; p.inVent = j; p.x = v.x; p.z = v.z; p.tp = (p.tp || 0) + 1; this.emit({ type: 'venthop', p: p.id }); }
  ventWitness(p, v) {
    for (const w of this.players) {
      if (!w.alive || w === p || !w.ai || w.imp) continue;
      if (w.spirit || w.sky || this.canSee(w, v.x, v.z)) {
        w.ai.claims.push({ kind: 'vent', who: p.id, room: roomName(this.map, v.x, v.z), t: this.time });
        w.ai.sus[p.id] = Math.max(w.ai.sus[p.id], 92);
        if (w.meetings > 0 && this.buttonCd <= 0) { w.ai.mode = 'button'; w.ai.path = null; }
      }
    }
  }
  sabotage(type) {
    if (this.sab || this.sabCd > 0 || this.state !== 'play') return false;
    this.sab = { type, t: type === 'heat' ? this.o.heatTime : 0, held: [false, false], fixT: 0 };
    this.emit({ type: 'sabotage', kind: type });
    // computer crew go and fix it
    const crew = this.players.filter(p => p.ai && p.alive && !p.imp);
    const M = this.map;
    if (type === 'heat') {
      const used = new Set();
      M.valves.forEach((v, i) => {
        const c = crew.filter(p => !used.has(p.id)).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
        if (c) { used.add(c.id); c.ai.mode = 'fix'; c.ai.goal = { x: v.x, z: v.z, valve: i }; c.ai.path = null; }
      });
    } else {
      const c = crew.sort((a, b) => Math.hypot(a.x - M.lights.x, a.z - M.lights.z) - Math.hypot(b.x - M.lights.x, b.z - M.lights.z))[0];
      if (c) { c.ai.mode = 'fix'; c.ai.goal = { x: M.lights.x, z: M.lights.z, lights: true, delay: 3 + this.R() * 5 }; c.ai.path = null; }
    }
    return true;
  }
  fixLights() { if (this.sab && this.sab.type === 'lights') { this.sab = null; this.sabCd = 30; this.emit({ type: 'fixed', kind: 'lights' }); } }
  callMeeting(p, body) {
    if (this.state !== 'play') return;
    if (!body) { p.meetings--; }
    for (const b of this.bodies) b.reported = true;
    this.state = 'meeting'; this.meetingN++;
    this.meeting = { by: p.id, body: body ? body.pid : -1, room: body ? body.room : roomName(this.map, p.x, p.z), t: this.time };
    this.emit({ type: body ? 'report' : 'emergency', by: p.id, body: body ? body.pid : -1 });
  }
  // called by the meeting screen when votes are in
  endMeeting(ejectId) {
    if (ejectId >= 0) { const p = this.players[ejectId]; p.alive = false; p.ejected = true; p.deadT = this.time; p.carry = -1; }
    for (const p of this.players) { p.carry = -1; p.frozen = 0; if (p.spirit) { p.spirit = null; p.abilCd = ROLES.evap.cd; } if (p.sky) { p.sky = null; p.abilCd = ROLES.unicorn.cd; } }      // a meeting empties every bucket and thaws everyone
    this.bodies = []; this.sab = null; this.sabCd = 15; this.buttonCd = 15;
    for (const p of this.players) { p.killCd = this.o.killCd; p.voted = null; if (p.ai) { p.ai.claims = p.ai.claims.filter(c => this.time - c.t < 1); p.ai.with.fill(0); } }
    this.spawn();
    this.state = 'play';
    this.checkWin();
  }
  checkWin() {
    if (this.winner || this.noWin) return;     // online clients wait for the server's verdict
    const imp = this.impAlive(), crew = this.crewAlive(), { total, done } = this.taskTotals();
    let w = null;
    if (imp === 0) w = { side: 'crew', why: 'Every Fire was dunked in the lava' };
    else if (imp >= crew) w = { side: 'imp', why: 'Fire now equals the Water' };
    else if (done >= total) w = { side: 'crew', why: 'All tasks completed' };
    if (w) { this.winner = w; this.state = 'over'; this.emit({ type: 'win', ...w }); }
  }

  // ------------------------------------------------------------------ simulation
  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt; this.buttonCd -= dt; if (!this.sab) this.sabCd -= dt;
    for (const p of this.players) { if (p.alive) { p.killCd = Math.max(0, p.killCd - dt); p.abilCd = Math.max(0, p.abilCd - dt); }
      if (p.spirit) { p.spirit.t -= dt; if (p.spirit.t <= 0 || !p.alive) this.condense(p); }
      if (p.sky) { p.sky.t -= dt; if (p.sky.t <= 0) this.land(p); }
      if (p.frozen > 0) {
        p.iceT += dt;
        if (p.ai && p.iceT >= ROLES.ice.minT && this.R() < dt * p.breakSpeed) this.breakIce(p);     // computer puddles spam their way out
        if (p.iceT > 30 && p.frozen > 0) { p.frozen = 0; this.emit({ type: 'thaw', p: p.id }); }   // safety net
      } p.room = roomName(this.map, p.x, p.z); }
    // sabotage timers
    if (this.sab && this.sab.type === 'heat') {
      this.sab.t -= dt;
      const held = this.map.valves.map((v, i) => this.players.some(p => p.alive && !p.imp && p.holding === i && Math.hypot(p.x - v.x, p.z - v.z) < USE_R + 0.4));
      this.sab.held = held;
      if (held[0] && held[1]) { this.sab.fixT += dt; if (this.sab.fixT > 0.6) { this.sab = null; this.sabCd = 35; this.emit({ type: 'fixed', kind: 'heat' }); } }
      else if (this.sab.t <= 0 && !this.noWin) { this.winner = { side: 'imp', why: 'Heatwave — all the Water evaporated' }; this.state = 'over'; this.emit({ type: 'win', ...this.winner, heat: true }); return; }
    }
    for (const p of this.players) if (p.ai) this.think(p, dt);
  }
  think(p, dt) {
    const A = p.ai, M = this.map;
    if (!p.alive) {                 // ghost crew keep doing tasks; ghost imposters drift
      if (p.imp || p.ejected) { p.vx = p.vz = 0; return; }
      if (A.mode === 'doing') { A.wait -= dt; if (A.wait <= 0) { this.completeTask(p, A.task); A.mode = 'idle'; } p.vx = p.vz = 0; return; }
      const next = p.tasks.find(id => !p.done.has(id));
      if (next === undefined) { p.vx = p.vz = 0; return; }
      const t = M.tasks[next], dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { A.mode = 'doing'; A.task = next; A.wait = TASK_TIME[t.type]; p.vx = p.vz = 0; return; }
      const s = Math.min(d, SPEED * 0.8 * dt); p.vx = dx / d * SPEED * 0.8; p.vz = dz / d * SPEED * 0.8;
      this.move(p, dx / d * s, dz / d * s, true); p.face = Math.atan2(dx, dz); return;
    }
    if (p.sky) { p.vx = p.vz = 0; const c = p.ai.claims.find(c => (c.kind === 'kill' || c.kind === 'vent') && this.time - c.t < 0.5); if (c && p.sky.t < 12) this.land(p); return; }
    if (p.role === 'unicorn' && p.abilCd <= 0 && !this.sab && (A.mode === 'idle' || A.mode === 'doing') && this.R() < dt * 0.08) { this.rainbow(p); return; }
    if (p.role === 'bubble' && p.tracks.length < 3 && this.R() < dt * 0.6 && this.bubbleTarget(p)) this.bubble(p);
    if (p.spirit) { p.vx = p.vz = 0; const c = p.ai.claims.find(c => (c.kind === 'kill' || c.kind === 'vent') && this.time - c.t < 0.5); if (c && p.spirit.t < 17) this.condense(p); return; }
    if (p.role === 'evap' && p.abilCd <= 0 && !this.sab && (A.mode === 'idle' || A.mode === 'doing') && this.R() < dt * 0.08) { this.evaporate(p); return; }
    if (p.frozen > 0) { p.vx = p.vz = 0; p.holding = -1; if (!A.sawFreeze) { A.sawFreeze = true; A.claims.push({ kind: 'frozen', t: this.time }); } return; }
    A.sawFreeze = false;
    // perception
    A.thinkT -= dt;
    if (A.thinkT <= 0) {
      A.thinkT = 0.2;
      for (const q of this.players) {
        if (q === p || !q.alive) continue;
        if (this.sees(p, q)) {
          A.seen[q.id] = { t: this.time, x: q.x, z: q.z, room: q.room }; A.with[q.id] += 0.2;
          if (!p.imp && q.carry >= 0 && A.sus[q.id] < 75) { A.sus[q.id] = 75; A.claims.push({ kind: 'carry', who: q.id, room: q.room, t: this.time }); }
        }
        else A.with[q.id] = Math.max(0, A.with[q.id] - 0.1);
      }
      // the Fire Extinguisher smells smoke: senses burned bodies nearby, even through walls
      if (p.role === 'ext' && p.uses > 0 && A.mode !== 'revive') { const b = this.bodies.find(b => !b.reported && b.style === 'fire' && Math.hypot(b.x - p.x, b.z - p.z) < 16); if (b) { A.mode = 'revive'; A.goal = { x: b.x, z: b.z }; A.path = null; } }
      // bodies
      if (A.mode !== 'report' && A.mode !== 'flee') for (const b of this.bodies) {
        if (b.reported || !this.canSee(p, b.x, b.z)) continue;
        if (!p.imp && p.role === 'ext' && p.uses > 0 && b.style === 'fire' && A.mode !== 'revive') { A.mode = 'revive'; A.goal = { x: b.x, z: b.z }; A.path = null; break; }
        if (!p.imp && A.mode !== 'revive') {
          // who was close to the body when I found it
          for (const q of this.players) if (q !== p && q.alive && this.sees(p, q) && Math.hypot(q.x - b.x, q.z - b.z) < 5) { A.sus[q.id] += 30; A.claims.push({ kind: 'near', who: q.id, room: b.room, t: this.time }); }
          A.mode = 'report'; A.goal = { x: b.x, z: b.z }; A.path = null; break;
        } else if (!A.seenBody?.has(b)) {
          (A.seenBody ||= new Set()).add(b);
          const watchers = this.players.filter(q => q !== p && q.alive && !q.imp && this.sees(q, p)).length;
          if (watchers === 0 && this.R() < 0.2 + 0.15 * this.o.smarts) { A.mode = 'report'; A.goal = { x: b.x, z: b.z }; A.path = null; break; }
        }
      }
      if (p.imp) this.impThink(p);
      if (p.role === 'rain' && this.sab && p.abilCd <= 0) { this.sab.rainT = (this.sab.rainT ?? (3 + this.R() * 6)) - 0.2; if (this.sab.rainT <= 0) this.rain(p); }
      if (!p.imp && this.sab && A.mode !== 'fix' && A.mode !== 'report' && this.R() < 0.02) {
        // a random computer crew member also heads over to help
        const M2 = this.map;
        if (this.sab.type === 'heat') { const i = this.R() < 0.5 ? 0 : 1, v = M2.valves[i]; A.mode = 'fix'; A.goal = { x: v.x, z: v.z, valve: i }; A.path = null; }
      }
    }
    if (this.sab == null && A.mode === 'fix') { A.mode = 'idle'; p.holding = -1; }
    // modes
    switch (A.mode) {
      case 'idle': {
        p.vx = p.vz = 0; A.wait -= dt; if (A.wait > 0) break;
        const next = this.nextTask(p);
        if (next != null) {
          const t = M.tasks[next]; A.mode = 'task'; A.task = next; A.goal = { x: t.x, z: t.z }; A.path = null;
          if (p.role === 'toilet' && p.abilCd <= 0 && Math.hypot(t.x - p.x, t.z - p.z) > 22) {
            const near = (x, z) => M.vents.map((v, i) => [Math.hypot(v.x - x, v.z - z), i]).sort((a, b) => a[0] - b[0])[0];
            const [d1, v1] = near(p.x, p.z), [d2, v2] = near(t.x, t.z);
            if (v1 !== v2 && d1 + d2 + 4 < Math.hypot(t.x - p.x, t.z - p.z)) { A.mode = 'toiletgo'; A.fromVent = v1; A.toVent = v2; A.goal = { x: M.vents[v1].x, z: M.vents[v1].z }; }
          }
        }
        else { const r = M.rooms[Math.floor(this.R() * M.rooms.length)]; A.mode = 'wander'; A.goal = { x: r.x + (this.R() - 0.5) * (r.w - 4), z: r.z + (this.R() - 0.5) * (r.d - 4) }; A.path = null; }
        break;
      }
      case 'revive': {
        const b = this.bodies.find(b => !b.reported && Math.hypot(b.x - A.goal.x, b.z - A.goal.z) < 0.5);
        if (!b) { A.mode = 'idle'; break; }
        this.walk(p, dt);
        if (Math.hypot(p.x - b.x, p.z - b.z) < REPORT_R - 0.6) { p.vx = p.vz = 0; this.revive(p); A.mode = 'idle'; A.wait = 1; }
        break;
      }
      case 'dump': {
        if (p.carry < 0) { A.mode = 'idle'; break; }
        const arrived = this.walk(p, dt);
        if (arrived || this.dumpNear(p) >= 0) { p.vx = p.vz = 0; this.dump(p); A.mode = 'idle'; A.wait = 0.5; }
        break;
      }
      case 'toiletgo': {
        if (this.walk(p, dt) || this.anyVentNear(p) === A.fromVent) {
          if (p.abilCd <= 0 && this.anyVentNear(p) >= 0) this.flush(p, A.toVent);
          const t = M.tasks[A.task]; A.mode = 'task'; A.goal = { x: t.x, z: t.z }; A.path = null;
        }
        break;
      }
      case 'task': if (this.walk(p, dt)) { A.mode = 'doing'; const t = M.tasks[A.task]; A.wait = TASK_TIME[t.type] * (1.0 + this.R() * 0.7); p.face = Math.atan2(-t.dx, -t.dz); } break;
      case 'doing': p.vx = p.vz = 0; A.wait -= dt; if (A.wait <= 0) { this.completeTask(p, A.task); this.roam(p); } break;
      case 'wander': if (this.walk(p, dt)) { A.mode = 'idle'; A.wait = 1 + this.R() * 4; } break;
      case 'report': {
        const b = this.bodies.find(b => !b.reported && Math.hypot(b.x - A.goal.x, b.z - A.goal.z) < 0.5);
        if (!b) { A.mode = 'idle'; break; }
        this.walk(p, dt);
        if (Math.hypot(p.x - b.x, p.z - b.z) < REPORT_R - 0.4) { p.vx = p.vz = 0; this.callMeeting(p, b); }
        break;
      }
      case 'button': {
        const B = M.button; A.goal = { x: B.x, z: B.z + 1.6 };
        if (this.walk(p, dt) || Math.hypot(p.x - B.x, p.z - B.z) < 1.9) { p.vx = p.vz = 0; if (p.meetings > 0 && this.buttonCd <= 0 && !(this.sab && this.sab.type === 'heat')) this.callMeeting(p, null); else A.mode = 'idle'; }
        break;
      }
      case 'fix': {
        if (this.walk(p, dt)) {
          p.vx = p.vz = 0;
          if (A.goal.lights) { A.goal.delay -= dt; if (A.goal.delay <= 0) { this.fixLights(); A.mode = 'idle'; } }
          else p.holding = A.goal.valve;
        }
        break;
      }
      case 'hunt': {
        const q = this.players[A.target];
        A.huntT -= dt;
        if (!q || !q.alive || q.inVent >= 0 || A.huntT <= 0 || p.killCd > 0) { A.mode = 'idle'; break; }
        if (Math.hypot(p.x - q.x, p.z - q.z) < KILL_R - 0.2 && this.los(p.x, p.z, q.x, q.z)) {
          if (this.witnesses(p, q) === 0) { this.kill(p, q); this.afterKill(p); }
          else if (this.R() < 0.02) { A.mode = 'idle'; }
          p.vx = p.vz = 0; break;
        }
        A.repath = (A.repath || 0) - dt;
        if (A.repath <= 0 || !A.path) { A.repath = 0.4; A.goal = { x: q.x, z: q.z }; A.path = null; }
        this.walk(p, dt, 1.06);
        break;
      }
      case 'flee': if (this.walk(p, dt, 1.05)) { if (A.vent != null && Math.hypot(p.x - M.vents[A.vent].x, p.z - M.vents[A.vent].z) < VENT_R) { this.ventIn(p, A.vent); A.mode = 'vent'; A.wait = 0.8 + this.R() * 1.5; A.ventHop = this.R() < 0.7 ? 1 : 0; } else { A.mode = 'idle'; A.wait = this.R(); } } break;
      case 'vent': {
        p.vx = p.vz = 0; A.wait -= dt;
        if (A.wait > 0) break;
        if (A.ventHop > 0) { A.ventHop--; const l = M.vents[p.inVent].links; this.ventHop(p, l[Math.floor(this.R() * l.length)]); A.wait = 0.6 + this.R(); break; }
        // only come out when nobody is looking
        const look = this.players.some(q => q !== p && q.alive && !q.imp && this.canSee(q, p.x, p.z));
        if (!look || A.wait < -6) { this.ventOut(p); A.mode = 'idle'; A.wait = 0.2; }
        break;
      }
    }
    // unstick
    A.stuckT += dt;
    if (A.stuckT > 1.5) { A.stuckT = 0; if ((A.mode === 'task' || A.mode === 'wander' || A.mode === 'flee') && Math.hypot(p.x - A.lx, p.z - A.lz) < 0.3) { A.path = null; if (A.mode === 'wander' || A.mode === 'flee') A.mode = 'idle'; } A.lx = p.x; A.lz = p.z; }
  }
  // after a task: sometimes wander to another room first (people don't beeline task to task)
  roam(p) {
    const A = p.ai, M = this.map;
    if (this.R() < 0.55) { const r = M.rooms[Math.floor(this.R() * M.rooms.length)]; A.mode = 'wander'; A.goal = { x: r.x + (this.R() - 0.5) * (r.w - 4), z: r.z + (this.R() - 0.5) * (r.d - 4) }; A.path = null; }
    else { A.mode = 'idle'; A.wait = 0.5 + this.R() * 2; }
  }
  nextTask(p) {
    const left = p.tasks.filter(id => !p.done.has(id));
    if (!left.length) {
      // imposters keep faking: recycle their fake list
      if (p.imp) { p.done.clear(); return p.tasks[Math.floor(this.R() * p.tasks.length)]; }
      return null;
    }
    const M = this.map;
    left.sort((a, b) => Math.hypot(M.tasks[a].x - p.x, M.tasks[a].z - p.z) - Math.hypot(M.tasks[b].x - p.x, M.tasks[b].z - p.z));
    return this.R() < 0.7 ? left[0] : left[Math.floor(this.R() * left.length)];
  }
  // follow A.goal; returns true on arrival
  walk(p, dt, speedMul = 1) {
    const A = p.ai;
    if (!A.path) { A.path = this.path(p.x, p.z, A.goal.x, A.goal.z); A.pi = 0; if (!A.path) { A.mode = 'idle'; A.wait = 0.5; return false; } }
    const wp = A.path[A.pi];
    if (!wp) return true;
    const dx = wp[0] - p.x, dz = wp[1] - p.z, d = Math.hypot(dx, dz);
    const sp = SPEED * 0.94 * speedMul * (p.carry >= 0 ? 0.72 : 1);
    if (d < 0.12) { A.pi++; if (A.pi >= A.path.length) { p.vx = p.vz = 0; return true; } return false; }
    const s = Math.min(d, sp * dt);
    p.vx = dx / d * sp; p.vz = dz / d * sp;
    this.move(p, dx / d * s, dz / d * s);
    p.face = Math.atan2(dx, dz);
    return false;
  }
  witnesses(k, v) {
    let n = 0;
    const blind = k.ai && k.ai.mode === 'hunt' ? k.ai.blind : null;
    for (const w of this.players) {
      if (w === k || w === v || !w.alive || w.imp || w.inVent >= 0) continue;
      if (blind && blind.has(w.id)) continue;       // the imposter didn't notice this one
      if (this.canSee(w, k.x, k.z) || this.canSee(w, v.x, v.z)) n++;
    }
    return n;
  }
  impThink(p) {
    const A = p.ai;
    if (p.inVent >= 0 || A.mode === 'flee' || A.mode === 'vent' || A.mode === 'report') return;
    // sabotage now and then
    if (!this.sab && this.sabCd <= 0 && this.R() < 0.012 * (0.5 + this.o.smarts * 0.5)) this.sabotage(this.R() < 0.6 ? 'lights' : 'heat');
    if (p.role === 'ice' && p.uses > 0 && p.abilCd <= 0 && p.killCd <= 0.5 && this.R() < 0.25) {
      const q = this.players.find(q => q.alive && !q.imp && q.inVent < 0 && Math.hypot(q.x - p.x, q.z - p.z) < 9 && this.sees(p, q));
      if (q) { this.freeze(p); A.mode = 'hunt'; A.target = q.id; A.huntT = 9; A.path = null; A.blind = new Set(this.players.map(w => w.id)); return; }
    }
    if (p.killCd > 0 || A.mode === 'hunt' || p.carry >= 0 || A.mode === 'dump') return;
    const crewLeft = this.crewAlive();
    const urge = A.aggro * (0.45 + this.o.smarts * 0.35) * (crewLeft <= 3 ? 1.6 : 1);
    for (const q of this.players) {
      if (q.imp || !q.alive || q.inVent >= 0) continue;
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d > 8 || !this.sees(p, q)) continue;
      if (this.R() > urge * 0.25) continue;
      const prev = A.mode;
      A.blind = new Set(this.players.filter(w => this.R() < 0.3 - 0.08 * this.o.smarts).map(w => w.id));
      A.mode = 'hunt';
      if (this.witnesses(p, q) === 0) { A.target = q.id; A.huntT = 7; A.path = null; return; }
      A.mode = prev;
    }
  }
  afterKill(p) {
    const A = p.ai, M = this.map;
    if (p.carry >= 0) {          // Bucket: carry them to the nearest big bucket
      const d = M.dumps.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      A.mode = 'dump'; A.goal = { x: d.x, z: d.z }; A.path = null; return;
    }
    let best = -1, bd = 7;
    M.vents.forEach((v, i) => { const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && this.R() < 0.75) { A.mode = 'flee'; A.vent = best; A.goal = { x: M.vents[best].x, z: M.vents[best].z }; A.path = null; return; }
    A.vent = null;
    const far = M.rooms.slice().sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z))[Math.floor(this.R() * 3)];
    A.mode = 'flee'; A.goal = { x: far.x, z: far.z }; A.path = null;
  }
}
export { TASK_NAMES, roomName, COLORS };
