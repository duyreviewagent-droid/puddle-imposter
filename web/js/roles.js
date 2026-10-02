// Teams and special roles. Fire = the imposters, Water = the crew. Pure data (server + page).
export const ROLES = {
  water: { team: 'water', name: 'Water', emoji: '💧', color: '#5ab8ff', goal: 'Finish your tasks, or find every Fire and vote them into the lava.' },
  toilet: { team: 'water', name: 'Toilet', emoji: '🚽', color: '#9ad8ff', goal: 'Water with plumbing: stand on any vent and flush yourself to any other vent on the map.', ability: 'Flush', key: 'F', cd: 20 },
  rain: { team: 'water', name: 'Raining', emoji: '🌧️', color: '#7aa0ff', goal: 'Water that can make it rain from anywhere — washes away any emergency (lights or heatwave).', ability: 'Rain', key: 'F', cd: 40 },
  ext: { team: 'water', name: 'Fire Extinguisher', emoji: '🧯', color: '#ff6a6a', goal: 'Water that can revive 2 burned puddles per game — only if their body hasn\'t been reported yet.', ability: 'Revive', key: 'F', uses: 2 },
  evap: { team: 'water', name: 'Evaporation', emoji: '☁️', color: '#dfeeff', goal: 'Water that can rise out of its body as vapor for 20 seconds — float through walls and spy on the whole map, then snap back into your body. Your body stays behind and can still be burned!', ability: 'Evaporate', key: 'F', cd: 30, dur: 20 },
  unicorn: { team: 'water', name: 'Unicorn', emoji: '🦄', color: '#ffb0f0', goal: 'Water that rides a rainbow into the sky for 15 seconds and sees the whole map and every player. Slide back down any time — but if Fire sets the bottom of your rainbow on fire, you fall and die.', ability: 'Rainbow', key: 'F', cd: 30, dur: 15 },
  bubble: { team: 'water', name: 'Bubble', emoji: '🫧', color: '#bfe8ff', goal: 'Water that sticks up to 3 tracker bubbles on other puddles. You see them on your map, and if one of them kills, you get an alert for 3 seconds.', ability: 'Bubble', key: 'F', uses: 3 },
  underwater: { team: 'water', name: 'Underwater', emoji: '🌊', color: '#2a9aff', goal: 'Water that floods the WHOLE map for 15 seconds — while it\'s underwater, Fire can\'t kill anyone. 2 floods per game, 40 second reload.', ability: 'Flood', key: 'F', cd: 40, uses: 2, dur: 15 },
  fire: { team: 'fire', name: 'Fire', emoji: '🔥', color: '#ff5a1a', goal: 'Set the Water on fire until Fire equals Water. Don\'t get caught.' },
  sponge: { team: 'fire', name: 'Sponge', emoji: '🧽', color: '#ffd23a', goal: 'Fire that soaks puddles up completely — your kills leave no body behind.' },
  ice: { team: 'fire', name: 'Ice', emoji: '🧊', color: '#9ae8ff', goal: 'Fire that can freeze ALL the Water solid — 3 times per game, 30 second reload. Frozen puddles are stuck for at least 2 seconds, then have to spam the screen 12 times to break out.', ability: 'Freeze', key: 'F', cd: 30, uses: 3, minT: 2, breaks: 12 },
  eruption: { team: 'fire', name: 'Eruption', emoji: '🌋', color: '#ff6a1a', goal: 'Fire that calls down asteroids on any Water puddle on the map. A red circle warns them for 2 seconds — if they don\'t run, they burn. Start with 2, earn one every 45 s, stack up to 3.', ability: 'Asteroid', key: 'F', cd: 8, start: 2, max: 3, recharge: 45, warn: 2, radius: 1.7 },
  bucket: { team: 'fire', name: 'Bucket', emoji: '🪣', color: '#c0c8d0', goal: 'Fire that scoops puddles into a bucket. Dump them in one of the 4 big buckets so nobody can ever report them.', ability: 'Dump', key: 'F' },
};
// ---- Random Roles mode only (23 more) — `act` = what F does: 'near' (closest puddle), 'pick' (choose anyone), 'self', or none (passive)
const X = (team, name, emoji, goal, extra = {}) => ({ team, name, emoji, goal, extra: true, ...extra });
Object.assign(ROLES, {
  medic: X('water', 'Medic', '💉', 'Press F next to someone to give them a shield — the next Fire attack on them fails. 1 use.', { ability: 'Shield', act: 'near', uses: 1 }),
  detective: X('water', 'Detective', '🔎', 'Press F next to someone to find out if they have killed since the last meeting. 2 uses.', { ability: 'Inspect', act: 'near', uses: 2 }),
  mayor: X('water', 'Mayor', '🎩', 'Your vote counts twice in meetings.'),
  sheriff: X('water', 'Sheriff', '🤠', 'Press F next to someone to shoot them. If they are Fire, they die. If they are Water… you die. 1 shot.', { ability: 'Shoot', act: 'near', uses: 1 }),
  lookout: X('water', 'Lookout', '🔭', 'You see much further than everyone else.'),
  speedy: X('water', 'Speedy', '💨', 'You move 30% faster.'),
  snitch: X('water', 'Snitch', '📢', 'Finish all your tasks and every Fire shows up on your map — but the Fire get warned.'),
  mechanic: X('water', 'Mechanic', '🔧', 'You can use the vents like Fire (V). Careful — anyone who sees you vent will think you are Fire.'),
  bodyguard: X('water', 'Bodyguard', '🛡️', 'If Fire attacks someone right next to you, you take the hit instead.'),
  psychic: X('water', 'Psychic', '🔮', 'Press F to sense which room a Fire is in right now. 40 s reload.', { ability: 'Sense', act: 'self', cd: 40 }),
  radar: X('water', 'Radar', '📡', 'Every living puddle shows up on your map as a dot (no colours).'),
  medium: X('water', 'Medium', '👻', 'At the start of every meeting the spirits tell you one puddle who is definitely Water.'),
  clover: X('water', 'Lucky Clover', '🍀', 'The first time Fire attacks you, you survive.'),
  alarm: X('water', 'Alarm', '🚨', 'Whenever someone is killed within 12 m of you, your alarm goes off.'),
  hydrant: X('water', 'Hydrant', '🚒', 'Press F to blast water around you — everyone within 4.5 m is stunned for 3 s. 40 s reload.', { ability: 'Blast', act: 'self', cd: 40 }),
  shadow: X('fire', 'Shadow', '🌑', 'Press F to turn invisible for 8 s. Nobody can see you — or witness your kills. 40 s reload.', { ability: 'Vanish', act: 'self', cd: 40 }),
  morph: X('fire', 'Morph', '🎭', 'Press F to disguise as another puddle for 15 s. Witnesses will blame them! 45 s reload.', { ability: 'Disguise', act: 'self', cd: 45 }),
  smoke: X('fire', 'Smoke', '💨', 'Press F to throw a smoke bomb — everyone within 7 m is nearly blind for 6 s. 40 s reload.', { ability: 'Smoke', act: 'self', cd: 40 }),
  lava: X('fire', 'Lava', '🫕', 'Your kill cooldown is 35% shorter.'),
  trap: X('fire', 'Trapper', '🪤', 'Press F to hide a fire trap at your feet. The first Water to step on it burns. 3 traps per game.', { ability: 'Trap', act: 'self', uses: 3, cd: 10 }),
  silencer: X('fire', 'Silencer', '🤐', 'Press F to pick someone who can\'t talk in the next meeting. Once per round.', { ability: 'Mute', act: 'pick' }),
  phantom: X('fire', 'Phantom', '🫥', 'Press F to slip through walls for 6 s. 40 s reload.', { ability: 'Phase', act: 'self', cd: 40 }),
  hacker: X('fire', 'Hacker', '💻', 'Every Water puddle shows on your map, and sabotages reload twice as fast.'),
});
export const FIRE_EXTRA = Object.keys(ROLES).filter(r => ROLES[r].extra && ROLES[r].team === 'fire');
export const WATER_EXTRA = Object.keys(ROLES).filter(r => ROLES[r].extra && ROLES[r].team === 'water');
export const FIRE_SPECIALS = ['sponge', 'bucket', 'ice', 'eruption'], WATER_SPECIALS = ['toilet', 'rain', 'ext', 'evap', 'unicorn', 'bubble', 'underwater'];
export const isFire = r => ROLES[r] && ROLES[r].team === 'fire';
export const roleName = r => (ROLES[r] || ROLES.water).name;
