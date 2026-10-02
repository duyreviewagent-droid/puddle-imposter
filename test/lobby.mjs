// node test/lobby.mjs — two clients: create, join by code, start, move, emergency meeting, vote, eject, resume
import { MAPS, buildMap } from '../web/js/maps.js';
const URL = process.env.URL || 'ws://127.0.0.1:8173';
const mk = name => new Promise(res => { const ws = new WebSocket(URL); const c = { ws, name, msgs: [], snap: null }; ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 's') c.snap = m; if (m.t === 'start') c.start = m; }; ws.onopen = () => { ws.send(JSON.stringify({ t: 'me', name, color: 3 })); res(c); }; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 20000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(50); } };
const S = (c, m) => c.ws.send(JSON.stringify(m));
const A = await mk('Alice'), B = await mk('Bob'), C = await mk('Cara');
S(A, { t: 'create', pub: true, opts: { mapId: 2, count: 8, imps: 1 } });
await until(() => A.msgs.find(m => m.t === 'lobby'));
const code = A.msgs.find(m => m.t === 'lobby').code; console.log('lobby', code);
S(B, { t: 'list' }); await until(() => B.msgs.find(m => m.t === 'list')); console.log('public list', JSON.stringify(B.msgs.find(m => m.t === 'list').rooms));
S(A, { t: 'start' }); await until(() => A.msgs.find(m => m.t === 'err')); console.log('start with 1 player refused:', A.msgs.find(m => m.t === 'err').msg.slice(0, 60));
S(B, { t: 'join', code }); await until(() => B.msgs.find(m => m.t === 'lobby'));
S(C, { t: 'join', code }); await until(() => C.msgs.find(m => m.t === 'lobby'));
const lob = B.msgs.filter(m => m.t === 'lobby').pop(); console.log('players', lob.players.map(p => p.name + ':' + p.color).join(', '));
S(A, { t: 'start' }); await until(() => A.start && B.start && C.start);
console.log('players in game', A.start.opts.count, '(bots: none)', 'A slot', A.start.me, 'imps', A.start.imps, '| B slot', B.start.me, 'imps', B.start.imps, 'map', A.start.opts.mapId, 'players', A.start.opts.count);
await until(() => A.snap);
const me = A.snap.p[A.start.me]; console.log('A pos', me[0], me[1], 'tp', me[7]);
for (let i = 0; i < 20; i++) { S(A, { t: 'pos', x: me[0] + 0.1 * i, z: me[1], vx: 2, vz: 0, f: 1.57, tp: me[7] }); await wait(50); }
await wait(200); console.log('A moved to', A.snap.p[A.start.me][0]);
// walk next to the emergency button, wait until it's usable
const btn = buildMap(MAPS[A.start.opts.mapId]).button; let px = A.snap.p[A.start.me][0], pz = A.snap.p[A.start.me][1];
for (let i = 0; i < 40; i++) { const dx = btn.x - px, dz = btn.z + 1.6 - pz, d = Math.hypot(dx, dz); if (d < 0.1) break; const s = Math.min(d, 0.2); px += dx / d * s; pz += dz / d * s; S(A, { t: 'pos', x: px, z: pz, vx: 0, vz: 0, f: 0, tp: A.snap.p[A.start.me][7] }); await wait(50); }
console.log('A near button', A.snap.p[A.start.me].slice(0, 2), 'button', btn.x, btn.z);
await wait(13500);
S(A, { t: 'act', a: 'button' });
await until(() => A.msgs.find(m => m.t === 'ev' && m.e.type === 'emergency'), 3000).catch(() => console.log('no emergency (not close enough?)'));
const ev = A.msgs.find(m => m.t === 'ev' && (m.e.type === 'emergency' || m.e.type === 'report')); console.log('meeting event', ev && ev.e.type, ev && JSON.stringify(ev.e.meeting));
await wait(3500); S(A, { t: 'say', kind: 'text', text: 'bob is sus' }); await until(() => A.msgs.find(m => m.t === 'chat'), 5000); console.log('chat:', A.msgs.filter(m => m.t === 'chat').map(m => m.pid + ': ' + m.text).join(' | '));
await wait(31000);
S(A, { t: 'vote', target: -1 }); S(B, { t: 'vote', target: -1 }); S(C, { t: 'vote', target: -1 });
await until(() => A.msgs.find(m => m.t === 'reveal'), 45000); const rv = A.msgs.find(m => m.t === 'reveal'); console.log('reveal ejected', rv.ejected, 'votes', JSON.stringify(rv.votes));
await until(() => A.msgs.find(m => m.t === 'eject'), 8000); console.log('eject', JSON.stringify(A.msgs.find(m => m.t === 'eject')));
await until(() => A.msgs.find(m => m.t === 'resume' || m.t === 'win'), 15000); console.log('after eject:', A.msgs.find(m => m.t === 'resume' || m.t === 'win').t);
B.ws.close(); await wait(500);
const last = A.msgs.filter(m => m.t === 'lobby').pop(); console.log('after B left, lobby players', last.players.length);
console.log('OK'); process.exit(0);
