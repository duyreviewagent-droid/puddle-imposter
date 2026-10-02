import { MAPS, buildMap } from '../web/js/maps.js';
for (const d of MAPS) {
  const m = buildMap(d);
  const per = {}; for (const t of m.tasks) per[t.room] = (per[t.room]||0)+1;
  console.log(d.name, m.W+'x'+m.H, 'tasks', m.tasks.length, 'props', m.props.length, 'vents', m.vents.length, 'lights', !!m.lights, 'valves', m.valves.every(Boolean));
  const want = d.rooms.reduce((a,r)=>a+r[5].length,0); if (want!==m.tasks.length) console.log('  MISSING tasks', want, m.tasks.length);
  if (process.argv[2]==d.id) { let s=''; for (let j=0;j<m.H;j++){ for(let i=0;i<m.W;i++){ const g=m.grid[j*m.W+i]; s+= g===0?' ':g===2?'#':'.'; } s+='\n'; } console.log(s); }
}
