// node test/sim.mjs [games] [mapId|-1] — all-computer games; prints winner, time, meetings, ejections
import { Game } from '../web/js/game.js';
import { planChat, botVote, count, coolDown } from '../web/js/meeting.js';
const N = +process.argv[2] || 20, MAP = process.argv[3] != null ? +process.argv[3] : -1;
const res = { crew: 0, imp: 0 }, why = {}; let T = 0, meet = 0, good = 0, bad = 0, kills = 0, sabs = 0;
for (let k = 0; k < N; k++) {
  const g = new Game({ mapId: MAP < 0 ? k % 5 : MAP, seed: 1000 + k });
  const h = g.players[0]; h.ai = g.newAI(h);
  let steps = 0;
  while (g.state !== 'over' && steps < 60 * 60 * 25) {
    g.update(1 / 30); steps++;
    for (const e of g.events) { if (e.type === 'kill') kills++; if (e.type === 'sabotage') sabs++; }
    g.events.length = 0;
    if (g.state === 'meeting') {
      meet++;
      const lines = planChat(g, 30); for (const l of lines) l.gen();
      const tally = {};
      for (const p of g.players) if (p.alive) { p.voted = botVote(g, p, tally); if (p.voted >= 0) tally[p.voted] = (tally[p.voted] || 0) + 1; }
      const c = count(g);
      if (c.ejected >= 0) (g.players[c.ejected].imp ? good++ : bad++);
      coolDown(g); g.endMeeting(c.ejected);
    }
  }
  const w = g.winner ? g.winner.side : 'timeout'; res[w] = (res[w] || 0) + 1; why[g.winner?.why || 'timeout'] = (why[g.winner?.why || 'timeout'] || 0) + 1; T += g.time;
}
console.log(res, why, 'avg time', (T / N).toFixed(0) + 's', 'meetings/game', (meet / N).toFixed(1), 'eject imp', good, 'eject crew', bad, 'kills/game', (kills / N).toFixed(1), 'sabs/game', (sabs/N).toFixed(1));
