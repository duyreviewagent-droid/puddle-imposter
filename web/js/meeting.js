// Meeting brains: what the computer puddles say, how it moves everyone's suspicion, and how they vote.
// Pure logic (the screen lives in ui.js).
import { TASK_NAMES } from './maps.js';

const pick = (R, a) => a[Math.floor(R() * a.length)];
const nm = (g, id) => g.players[id].name;
// what the witness saw happen, by killer role (anyone who watched knows how it looked)
const verb = (g, id) => ({ sponge: 'SOAK UP', bucket: 'SCOOP UP' })[g.players[id].role] || 'BURN';

function trust(l, speaker) { return Math.max(0, Math.min(1, 1 - l.ai.sus[speaker] / 100)); }
export function accuse(g, speaker, target, amount) {
  for (const l of g.players) {
    if (!l.ai || !l.alive || l.id === speaker || l.imp) continue;
    if (l.id === target) { l.ai.sus[speaker] += amount * 0.6; continue; }   // I know it wasn't me — you're lying
    if (l.ai.cleared && l.ai.cleared.has(target)) { l.ai.sus[speaker] += amount * 0.5; continue; }   // I saw them far away — you're lying
    l.ai.sus[target] += amount * (0.35 + 0.65 * trust(l, speaker));
  }
}
export function vouch(g, speaker, target, amount) {
  for (const l of g.players) {
    if (!l.ai || !l.alive || l.id === speaker || l.imp || l.id === target) continue;
    l.ai.sus[target] -= amount * trust(l, speaker);
  }
}
// group opinion of a player (average suspicion among living computer crew)
export function groupSus(g, id) {
  let s = 0, n = 0;
  for (const l of g.players) if (l.ai && l.alive && !l.imp && l.id !== id) { s += l.ai.sus[id]; n++; }
  return n ? s / n : 0;
}

// Returns a list of { at (seconds into discussion), gen: () => {pid, text} | null }
// detective work at the start of a meeting: alibis and opportunity from each bot's memory of sightings
export function deduce(g) {
  const M = g.meeting; if (!M || M.body < 0) return;
  const v = g.players[M.body], body = g.bodies.find(b => b.pid === M.body) || { x: v.x, z: v.z };
  for (const p of g.players) {
    if (!p.ai || !p.alive || p.imp || g.o.smarts < 1) continue;
    const A = p.ai, lastAlive = A.seen[v.id] ? A.seen[v.id].t : M.t - 45, from = Math.max(lastAlive, M.t - 60);
    for (const q of g.players) {
      if (q === p || !q.alive) continue;
      const win = A.hist[q.id].filter(s => s.t >= from - 2 && s.t <= M.t);
      if (!win.length) continue;
      const near = win.some(s => Math.hypot(s.x - body.x, s.z - body.z) < 7);
      const far = win.every(s => Math.hypot(s.x - body.x, s.z - body.z) > 14) && win.length >= Math.min(6, (M.t - from) * 0.4);
      if (far && !near) { A.sus[q.id] -= 25; A.cleared.add(q.id); A.claims.push({ kind: 'alibi', who: q.id, t: g.time }); }
      else if (near) { A.sus[q.id] += 18; A.claims.push({ kind: 'near', who: q.id, room: M.room, t: g.time }); }
    }
  }
}
export function planChat(g, dur) {
  const R = g.R, M = g.meeting, lines = [];
  deduce(g);
  const living = g.players.filter(p => p.alive && p.ai);
  const add = (at, gen) => lines.push({ at, gen });
  const caller = g.players[M.by];
  // opener
  if (caller.ai) add(0.8, () => {
    if (M.body >= 0) {
      const lie = caller.imp;
      return { pid: caller.id, text: pick(R, [`${nm(g, M.body)} is DEAD in ${M.room}!!`, `found ${nm(g, M.body)}'s puddle in ${M.room}`, `body in ${M.room}. it's ${nm(g, M.body)}`]) + (lie ? '' : '') };
    }
    const c = caller.ai.claims.find(c => c.kind === 'vent' || c.kind === 'kill');
    if (c) { accuse(g, caller.id, c.who, c.kind === 'kill' ? 70 : 60); return { pid: caller.id, text: c.kind === 'kill' ? `I SAW ${nm(g, c.who).toUpperCase()} ${verb(g, c.who)} ${nm(g, c.victim)} in ${c.room}!!!` : `${nm(g, c.who).toUpperCase()} VENTED in ${c.room}!! I saw it` }; }
    return { pid: caller.id, text: pick(R, ['emergency meeting, something feels off', 'who is the fire??', 'just checking in. where is everyone?']) };
  });
  // everyone talks once (some twice)
  let t = 2.2;
  const order = living.slice().sort(() => R() - 0.5);
  for (const p of order) {
    add(t, () => statement(g, p)); t += 1.2 + R() * 2.0;
    if (t > dur - 3) break;
  }
  // reactions sprinkled in
  for (let k = 0; k < 4; k++) {
    const p = pick(R, living); if (!p) break;
    add(1.5 + R() * (dur - 4), () => p.alive ? { pid: p.id, text: pick(R, ['where?', 'who', 'wait what', 'hmm', 'i was doing tasks', 'skip?', "don't skip", 'vote them out', 'no evidence = skip', 'sus', 'bro']) } : null);
  }
  lines.sort((a, b) => a.at - b.at);
  return lines;
}

function statement(g, p) {
  const R = g.R, A = p.ai, M = g.meeting;
  if (!p.alive) return null;
  if (!p.imp) {
    const recent = A.claims.filter(c => g.time - c.t < 120);
    const k = recent.find(c => c.kind === 'kill' && g.players[c.who].alive);
    if (k && M.by !== p.id) { accuse(g, p.id, k.who, 70); return { pid: p.id, text: `it was ${nm(g, k.who).toUpperCase()}. I watched them ${verb(g, k.who).toLowerCase()} ${nm(g, k.victim)} in ${k.room}` }; }
    const fl = g.lastFlood && g.time - g.lastFlood < 90;
    if (fl && R() < 0.15) return { pid: p.id, text: pick(R, ['thank you whoever flooded the map 🌊', 'the underwater one saved us', 'flooding was so clutch']) };
    const fr = recent.find(c => c.kind === 'frozen');
    if (fr && R() < 0.35) return { pid: p.id, text: pick(R, ['someone FROZE everyone, there is an Ice among us', 'I got frozen solid and couldn\'t move', 'ice froze me again 🧊 vote carefully']) };
    const bm = recent.find(c => c.kind === 'burnedMe' && g.players[c.who].alive);
    if (bm) { accuse(g, p.id, bm.who, 85); return { pid: p.id, text: `${nm(g, bm.who).toUpperCase()} SET ME ON FIRE in ${bm.room}!! someone put me out` }; }
    const cr = recent.find(c => c.kind === 'carry' && g.players[c.who].alive);
    if (cr && M.by !== p.id && pick(R, [1, 1, 0])) { accuse(g, p.id, cr.who, 45); return { pid: p.id, text: `${nm(g, cr.who)} was carrying a FULL BUCKET in ${cr.room}… with eyes in it` }; }
    const v = recent.find(c => c.kind === 'vent' && g.players[c.who].alive);
    if (v && M.by !== p.id) { accuse(g, p.id, v.who, 55); return { pid: p.id, text: `${nm(g, v.who)} VENTED in ${v.room}` }; }
    const al = recent.find(c => c.kind === 'alibi' && g.players[c.who].alive && R() < 0.5);
    if (al) { vouch(g, p.id, al.who, 15); return { pid: p.id, text: `${nm(g, al.who)} was nowhere near — I saw them on the other side of the map` }; }
    const n = recent.find(c => c.kind === 'near' && g.players[c.who].alive);
    if (n) { accuse(g, p.id, n.who, 22); return { pid: p.id, text: `${nm(g, n.who)} was right next to the body` }; }
    // somebody I saw near the body's room shortly before
    if (M.body >= 0) {
      const seen = A.seen.map((s, id) => ({ s, id })).filter(o => o.s && o.id !== p.id && g.players[o.id].alive && o.s.room === M.room && M.t - o.s.t < 25 && o.s.t < M.t);
      if (seen.length && R() < 0.75) { const o = pick(R, seen); accuse(g, p.id, o.id, 18); return { pid: p.id, text: `I saw ${nm(g, o.id)} in ${M.room} a bit before` }; }
    }
    // alibi
    let best = -1, bw = 3;
    A.with.forEach((w, id) => { if (w > bw && g.players[id].alive && id !== p.id) { bw = w; best = id; } });
    if (best >= 0 && R() < 0.7) { vouch(g, p.id, best, 12); return { pid: p.id, text: `I was with ${nm(g, best)} the whole time, they're clear` }; }
    // most suspected
    let top = -1, ts = 40; A.sus.forEach((s, id) => { if (s > ts && g.players[id].alive && id !== p.id) { ts = s; top = id; } });
    if (top >= 0) { accuse(g, p.id, top, 12); return { pid: p.id, text: pick(R, [`${nm(g, top)} is kinda sus`, `I'm voting ${nm(g, top)}`, `${nm(g, top)} has been acting weird`]) }; }
    const t = A.lastTask;
    return { pid: p.id, text: t ? `I was doing ${TASK_NAMES[t.type].toLowerCase()} in ${t.room}` : pick(R, ["didn't see anything", 'I was in ' + p.room, 'no info, sorry']) };
  }
  // imposter: defend if accused, otherwise frame someone or fake an alibi
  const myHeat = groupSus(g, p.id);
  if (myHeat > 35) {
    const accuser = g.players.filter(q => q.alive && !q.imp && q.ai && q.ai.sus[p.id] > 60)[0];
    if (accuser && R() < 0.6) { accuse(g, p.id, accuser.id, 20); return { pid: p.id, text: pick(R, [`${accuser.name} is lying, that's so sus`, `it wasn't me! ${accuser.name} is trying to frame me`, `${accuser.name} self reported I bet`]) }; }
    vouch(g, p.id, p.id, 6);
    return { pid: p.id, text: pick(R, ["wasn't me I was doing tasks", 'I literally just did wires', 'why would I burn them', 'I was across the map']) };
  }
  const crew = g.players.filter(q => q.alive && !q.imp && q.id !== p.id);
  if (crew.length && R() < 0.45 + g.o.smarts * 0.1) {
    // pile on whoever is already suspected, else pick someone
    const target = crew.slice().sort((a, b) => groupSus(g, b.id) - groupSus(g, a.id))[R() < 0.6 ? 0 : Math.floor(R() * crew.length)];
    accuse(g, p.id, target.id, 10);
    return { pid: p.id, text: pick(R, [`${target.name} was following me around`, `I saw ${target.name} near ${g.meeting.room}`, `${target.name} is sus ngl`, `${target.name} hasn't done any tasks`]) };
  }
  const t = g.map.tasks[p.tasks[Math.floor(R() * p.tasks.length)]];
  return { pid: p.id, text: `I was doing ${TASK_NAMES[t.type].toLowerCase()} in ${t.room}` };
}

// what a quick-chat button says
export function sayText(g, pid, kind, target) {
  const t = target != null && g.players[target] ? g.players[target].name : '';
  const p = g.players[pid], tk = g.map.tasks[p.tasks[0]];
  return { accuse: `${t} is FIRE!`, vent: `I saw ${t} VENT!!`, with: `${t} is safe, I was with them`, where: 'where?', skipq: 'skip? no proof', tasks: `I was doing tasks in ${tk ? tk.room : p.room}` }[kind] || '';
}
// a human used quick chat: move the computer puddles' suspicion and line up their replies
export function humanSays(g, kind, target, speaker = 0) {
  const h = g.players[speaker];
  if (kind === 'accuse') accuse(g, speaker, target, 30);
  if (kind === 'vent') accuse(g, speaker, target, 50);
  if (kind === 'with') vouch(g, speaker, target, 15);
  const R = g.R, replies = [];
  if ((kind === 'accuse' || kind === 'vent') && g.players[target].ai && g.players[target].alive) {
    const t = g.players[target];
    replies.push({ delay: 1 + R() * 1.5, pid: t.id, text: pick(R, ['WHAT?? no', 'it wasn\'t me!!', `${h.name} is sus for saying that`, 'I was doing tasks!!']) });
    const other = g.players.filter(q => q.alive && q.ai && q.id !== t.id && !q.imp);
    const o = other[Math.floor(R() * other.length)];
    if (o) replies.push({ delay: 2.5 + R() * 2, pid: o.id, text: o.ai.sus[t.id] > 40 ? pick(R, [`yeah ${t.name} sus`, `voting ${t.name}`, 'ok I believe you']) : pick(R, [`why ${t.name}?`, 'proof?', 'hmm not sure']) });
  }
  if (kind === 'where') { const o = g.players.find(q => q.alive && q.ai && q.id === g.meeting.by); if (o) replies.push({ delay: 1.2, pid: o.id, text: g.meeting.body >= 0 ? `${g.meeting.room}` : 'no body, emergency' }); }
  return replies;
}

// how a computer puddle votes. Returns a player id, or -1 for skip.
export function botVote(g, p, tally) {
  const R = g.R, alive = g.players.filter(q => q.alive && q.id !== p.id);
  if (!p.imp) {
    let best = -1, bs = 44 + (2 - g.o.smarts) * 5;
    for (const q of alive) { const s = p.ai.sus[q.id] + (tally[q.id] || 0) * 4 + (R() - 0.5) * 8; if (s > bs) { bs = s; best = q.id; } }
    return best;
  }
  // a partner everyone already suspects is doomed — voting them out too makes you look like Water
  if (g.o.smarts > 0) { const doomed = alive.find(q => q.imp && groupSus(g, q.id) > 70 && (tally[q.id] || 0) >= 2); if (doomed && R() < 0.6) return doomed.id; }
  const crew = alive.filter(q => !q.imp);
  let best = -1, bs = 22;
  for (const q of crew) { const s = groupSus(g, q.id) + (tally[q.id] || 0) * 8; if (s > bs) { bs = s; best = q.id; } }
  if (best < 0 && R() < 0.15 && crew.length) best = crew[Math.floor(R() * crew.length)].id;
  return best;
}
export function count(g) {
  const tally = {}; let skip = 0;
  for (const p of g.players) { if (!p.alive || p.voted == null) continue; if (p.voted < 0) skip++; else tally[p.voted] = (tally[p.voted] || 0) + 1; }
  let top = -1, tv = 0, tie = false;
  for (const [id, v] of Object.entries(tally)) { if (v > tv) { tv = v; top = +id; tie = false; } else if (v === tv) tie = true; }
  const ejected = top >= 0 && !tie && tv > skip ? top : -1;
  return { tally, skip, ejected, tie };
}
// after a meeting, suspicion cools down (except for things people actually saw)
export function coolDown(g) {
  for (const p of g.players) if (p.ai) for (let i = 0; i < g.n; i++) if (p.ai.sus[i] < 90) p.ai.sus[i] *= 0.55;
}

// typed chat: work out who a message is about and what it claims, so the computer puddles can react
export function parseSay(g, pid, text) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
  let target = null;
  for (const p of g.players) {
    if (p.id === pid || !p.alive) continue;
    for (const n of [p.name, p.colorName]) if (n && t.includes(' ' + n.toLowerCase() + ' ')) { target = p.id; break; }
    if (target != null) break;
  }
  let kind = null;
  if (/ where /.test(t)) kind = 'where';
  if (target != null) {
    if (/vent/.test(t)) kind = 'vent';
    else if (/ (safe|with|clear|innocent|trust|not (him|her|them|it)|wasn t|wasnt) /.test(t)) kind = 'with';
    else if (/(sus|kill|fire|burn|ice|froze|freeze|imposter|impostor|imp |vote|did it|saw|liar|lying|faking|fake|bucket|sponge)/.test(t)) kind = 'accuse';
  }
  return { kind, target };
}
