# Puddle Imposter

A 3D social-deduction game about melting water puddles with googly eyes. Most players are **Water** and a few are secretly **Fire**: a Fire kill sets its victim on fire. Whoever gets voted out jumps into the lava pool.

**Special roles:** 🧽 Sponge (Fire, leaves no body), 🪣 Bucket (Fire, scoops puddles and dumps them in 4 big buckets), 🚽 Toilet (Water, flushes from any vent to any vent), 🌧️ Raining (Water, washes away emergencies from anywhere), 🧯 Fire Extinguisher (Water, revives 2 unreported burned bodies per game), 🧊 Ice (Fire, freezes all Water 3× per game; frozen players wait 2 s then smash the screen 12 times), ☁️ Evaporation (Water, leaves its body as vapor for 20 s to spy through walls), 🦄 Unicorn (Water, rides a rainbow into the sky for 15 s to see the whole map; Fire can burn the rainbow's foot), 🫧 Bubble (Water, 3 tracker bubbles that alert you when a tracked puddle kills), 🌊 Underwater (Water, floods the whole map for 15 s so Fire can't kill; 2 per game, 40 s reload).

- **PLAY SOLO**: you plus computer puddles. Runs entirely in the page and works offline in the Mac app.
- **PLAY ONLINE**: real players only (3–12, no computer puddles), with public lobbies, 4-letter codes and invite links.
- **5 maps**: Pump Station, Glacier Lab, Magma Rig, Bathhouse and Sky Tanker. Each has two outdoor areas with fences or hedges, ponds and trees.
- **Walk-around courtyard lobby** for online games: walk with WASD, chat with T, and visit the wardrobe.
- **Wardrobe**: 11 hats, 9 shirts and 8 pets that follow you.
- **Typed meeting chat**: computer puddles react to names plus words like "sus", "vent" and "safe".
- **Role card** with your goal and ability cooldowns.

## Modes
- **Classic**: Fire/Water plus the specials above.
- **🎲 Random Roles** (solo + online): everyone is dealt a random role from 34: the classic specials plus 23 Random-Roles-only roles (Water: Umbrella, Thermometer, Fountain, Water Gun, Lighthouse, Waterslide, Reflection, Plumber, Dam, Ripple, Sonar, Mist, Rubber Duck, Sprinkler, Fire Hydrant; Fire: Heat Haze, Mirage, Smoke, Lava, Hot Coals, Ash Cloud, Will-o'-Wisp, Wildfire).

## Run
- Local server: `cd web && npm install && node server.js`, then open http://localhost:8000
- Mac app: `mac/build.sh` builds `Puddle Imposter.app`. Solo is offline; online play uses https://puddle-imposter.onrender.com
- Render: `render.yaml`, service `puddle-imposter`, rootDir `web`

## Tests
- `node test/maps.mjs`: map layouts
- `node test/sim.mjs 40`: all-computer games
- `node test/roles.mjs 30`: how often each role's ability gets used
- `URL=ws://127.0.0.1:8000 node test/lobby.mjs`: two online clients play a full meeting
