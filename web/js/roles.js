// Teams and special roles. Fire = the imposters, Water = the crew. Pure data (server + page).
export const ROLES = {
  water: { team: 'water', name: 'Water', emoji: '💧', color: '#5ab8ff', goal: 'Finish your tasks, or find every Fire and vote them into the lava.' },
  toilet: { team: 'water', name: 'Toilet', emoji: '🚽', color: '#9ad8ff', goal: 'Water with plumbing: stand on any vent and flush yourself to any other vent on the map.', ability: 'Flush', key: 'F', cd: 20 },
  rain: { team: 'water', name: 'Raining', emoji: '🌧️', color: '#7aa0ff', goal: 'Water that can make it rain from anywhere — washes away any emergency (lights or heatwave).', ability: 'Rain', key: 'F', cd: 40 },
  ext: { team: 'water', name: 'Fire Extinguisher', emoji: '🧯', color: '#ff6a6a', goal: 'Water that can revive 2 burned puddles per game — only if their body hasn\'t been reported yet.', ability: 'Revive', key: 'F', uses: 2 },
  evap: { team: 'water', name: 'Evaporation', emoji: '☁️', color: '#dfeeff', goal: 'Water that can rise out of its body as vapor for 20 seconds — float through walls and spy on the whole map, then snap back into your body. Your body stays behind and can still be burned!', ability: 'Evaporate', key: 'F', cd: 30, dur: 20 },
  fire: { team: 'fire', name: 'Fire', emoji: '🔥', color: '#ff5a1a', goal: 'Set the Water on fire until Fire equals Water. Don\'t get caught.' },
  sponge: { team: 'fire', name: 'Sponge', emoji: '🧽', color: '#ffd23a', goal: 'Fire that soaks puddles up completely — your kills leave no body behind.' },
  ice: { team: 'fire', name: 'Ice', emoji: '🧊', color: '#9ae8ff', goal: 'Fire that can freeze ALL the Water solid — 3 times per game, 30 second reload. Frozen puddles are stuck for at least 2 seconds, then have to spam the screen 12 times to break out.', ability: 'Freeze', key: 'F', cd: 30, uses: 3, minT: 2, breaks: 12 },
  bucket: { team: 'fire', name: 'Bucket', emoji: '🪣', color: '#c0c8d0', goal: 'Fire that scoops puddles into a bucket. Dump them in one of the 4 big buckets so nobody can ever report them.', ability: 'Dump', key: 'F' },
};
export const FIRE_SPECIALS = ['sponge', 'bucket', 'ice'], WATER_SPECIALS = ['toilet', 'rain', 'ext', 'evap'];
export const isFire = r => ROLES[r] && ROLES[r].team === 'fire';
export const roleName = r => (ROLES[r] || ROLES.water).name;
