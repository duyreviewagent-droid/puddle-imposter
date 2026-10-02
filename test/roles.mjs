// node test/roles.mjs [games] — counts how often each special role's ability happens in all-computer games
import { Game } from '../web/js/game.js';
import { planChat, botVote, count, coolDown } from '../web/js/meeting.js';
const N = +process.argv[2] || 30, c = {}, roles = {};
for (let k = 0; k < N; k++) {
  const g = new Game({ mapId: k % 5, seed: 77 + k, count: 10 }); const h = g.players[0]; h.ai = g.newAI(h);
  for (const p of g.players) roles[p.role] = (roles[p.role] || 0) + 1;
  let s = 0;
  while (g.state !== 'over' && s < 60 * 60 * 20) {
    g.update(1 / 30); s++;
    for (const e of g.events) { const key = e.type === 'kill' ? 'kill:' + e.style : e.type; c[key] = (c[key] || 0) + 1; }
    g.events.length = 0;
    if (g.state === 'meeting') { for (const l of planChat(g, 30)) l.gen(); const t = {}; for (const p of g.players) if (p.alive) { p.voted = botVote(g, p, t); if (p.voted >= 0) t[p.voted] = (t[p.voted] || 0) + 1; } const r = count(g); coolDown(g); g.endMeeting(r.ejected); }
  }
}
console.log('roles dealt', roles); console.log('events', c);
