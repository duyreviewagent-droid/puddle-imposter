// Teams and special roles. Fire = the imposters, Water = the crew. Pure data (server + page).
export const ROLES = {
  water: { team: 'water', name: 'Water', emoji: '💧', color: '#5ab8ff', goal: 'Finish your tasks, or find every Fire and vote them into the lava.' },
  toilet: { team: 'water', name: 'Toilet', emoji: '🚽', color: '#9ad8ff', goal: 'Water with plumbing: stand on any vent and flush yourself to any other vent on the map.', ability: 'Flush', key: 'F', cd: 20 },
  rain: { team: 'water', name: 'Raining', emoji: '🌧️', color: '#7aa0ff', goal: 'Water that can make it rain from anywhere — washes away any emergency (lights or heatwave).', ability: 'Rain', key: 'F', cd: 40 },
  ext: { team: 'water', name: 'Fire Extinguisher', emoji: '🧯', color: '#ff6a6a', goal: 'Water that can revive 2 burned puddles per game — only if their body hasn\'t been reported yet.', ability: 'Revive', key: 'F', uses: 2 },
  fire: { team: 'fire', name: 'Fire', emoji: '🔥', color: '#ff5a1a', goal: 'Set the Water on fire until Fire equals Water. Don\'t get caught.' },
  sponge: { team: 'fire', name: 'Sponge', emoji: '🧽', color: '#ffd23a', goal: 'Fire that soaks puddles up completely — your kills leave no body behind.' },
  bucket: { team: 'fire', name: 'Bucket', emoji: '🪣', color: '#c0c8d0', goal: 'Fire that scoops puddles into a bucket. Dump them in one of the 4 big buckets so nobody can ever report them.', ability: 'Dump', key: 'F' },
};
export const FIRE_SPECIALS = ['sponge', 'bucket'], WATER_SPECIALS = ['toilet', 'rain', 'ext'];
export const isFire = r => ROLES[r] && ROLES[r].team === 'fire';
export const roleName = r => (ROLES[r] || ROLES.water).name;
