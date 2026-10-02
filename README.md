# Puddle Imposter

A 3D social-deduction game about melting water puddles with googly eyes. One or more of the crew is an imposter. Whoever gets voted out jumps into the lava pool.

- **PLAY SOLO**: you plus computer puddles. Runs entirely in the page and works offline in the Mac app.
- **PLAY ONLINE**: public lobbies, 4-letter codes and invite links. Up to 12 people, and computer puddles fill the empty seats.
- **5 maps**: Pump Station, Glacier Lab, Magma Rig, Bathhouse and Sky Tanker. Each has two outdoor areas with fences or hedges, ponds and trees.
- **Walk-around courtyard lobby** for online games: walk with WASD, chat with T, and visit the wardrobe.
- **Wardrobe**: 11 hats, 9 shirts and 8 pets that follow you.
- **Typed meeting chat**: computer puddles react to names plus words like "sus", "vent" and "safe".
- **Role card** with your goal and ability cooldowns.

## Run
- Local server: `cd web && npm install && node server.js`, then open http://localhost:8000
- Mac app: `mac/build.sh` builds `Puddle Imposter.app`. Solo is offline; online play uses https://puddle-imposter.onrender.com
- Render: `render.yaml`, service `puddle-imposter`, rootDir `web`

## Tests
- `node test/maps.mjs`: map layouts
- `node test/sim.mjs 40`: all-computer games
- `URL=ws://127.0.0.1:8000 node test/lobby.mjs`: two online clients play a full meeting
