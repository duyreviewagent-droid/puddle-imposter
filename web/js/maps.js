// The five maps, plus buildMap(): turns a map's rooms + links into a walk grid with task stations, vents,
// the emergency button, sabotage panels and props. Pure data (no three.js) so node tests can use it.

// Task kinds (each has a mini-game in tasks.js)
export const TASK_NAMES = {
  wires: 'Fix Wiring', mop: 'Mop Up Spill', valve: 'Calibrate Valve', upload: 'Upload Data',
  swipe: 'Swipe Card', coolant: 'Fill Coolant', filter: 'Clean Filter', code: 'Enter Code',
};

// rooms: [name, x, z, w, d, tasks]   (x,z = centre in metres; w,d even)
export const MAPS = [
  {
    id: 0, name: 'Pump Station', sub: 'Concrete water-treatment plant', theme: 'pump',
    rooms: [
      ['Mess Hall', 36, 12, 16, 12, ['upload', 'mop']],
      ['Reservoir', 10, 10, 12, 10, ['coolant', 'filter']],
      ['Filtration', 62, 10, 12, 10, ['filter', 'valve']],
      ['Electrical', 12, 30, 10, 10, ['wires', 'code']],
      ['Control Room', 36, 31, 14, 10, ['upload', 'swipe']],
      ['Pump Room', 60, 29, 12, 10, ['valve', 'wires']],
      ['Storage', 10, 48, 12, 10, ['mop', 'swipe']],
      ['Lab', 36, 48, 14, 10, ['code', 'coolant']],
      ['Boiler Room', 62, 48, 12, 10, ['valve', 'filter']],
    ],
    links: [['Mess Hall', 'Reservoir'], ['Mess Hall', 'Filtration'], ['Mess Hall', 'Control Room'], ['Reservoir', 'Electrical'],
      ['Electrical', 'Storage'], ['Storage', 'Lab'], ['Lab', 'Boiler Room'], ['Boiler Room', 'Pump Room'], ['Pump Room', 'Filtration'],
      ['Control Room', 'Lab'], ['Electrical', 'Control Room']],
    button: 'Mess Hall', lights: 'Electrical', cool: ['Pump Room', 'Boiler Room'],
    vents: [['Reservoir', 'Electrical', 'Storage'], ['Filtration', 'Pump Room', 'Boiler Room'], ['Mess Hall', 'Control Room', 'Lab']],
  },
  {
    id: 1, name: 'Glacier Lab', sub: 'Frozen research base on an ice shelf', theme: 'ice',
    rooms: [
      ['Basecamp', 40, 26, 16, 12, ['upload', 'code']],
      ['Ice Core Lab', 12, 10, 12, 10, ['code', 'coolant']],
      ['Greenhouse', 40, 8, 14, 8, ['filter', 'mop']],
      ['Telescope', 68, 10, 12, 10, ['valve', 'upload']],
      ['Generator', 12, 30, 12, 10, ['wires', 'valve']],
      ['Cryo Vault', 70, 30, 12, 10, ['coolant', 'swipe']],
      ['Garage', 14, 50, 14, 10, ['mop', 'wires']],
      ['Comms', 40, 46, 12, 8, ['swipe', 'upload']],
      ['Heat Exchanger', 68, 50, 12, 10, ['valve', 'filter']],
    ],
    links: [['Basecamp', 'Greenhouse'], ['Basecamp', 'Generator'], ['Basecamp', 'Cryo Vault'], ['Basecamp', 'Comms'],
      ['Ice Core Lab', 'Greenhouse'], ['Greenhouse', 'Telescope'], ['Telescope', 'Cryo Vault'], ['Ice Core Lab', 'Generator'],
      ['Generator', 'Garage'], ['Garage', 'Comms'], ['Comms', 'Heat Exchanger'], ['Heat Exchanger', 'Cryo Vault']],
    button: 'Basecamp', lights: 'Generator', cool: ['Heat Exchanger', 'Cryo Vault'],
    vents: [['Ice Core Lab', 'Generator', 'Garage'], ['Telescope', 'Cryo Vault', 'Heat Exchanger'], ['Greenhouse', 'Basecamp', 'Comms']],
  },
  {
    id: 2, name: 'Magma Rig', sub: 'Geothermal drill sitting on a volcano', theme: 'magma',
    rooms: [
      ['Drill Core', 40, 31, 14, 12, ['upload', 'filter']],
      ['Command', 40, 8, 14, 10, ['upload', 'code']],
      ['Thermal Lab', 66, 10, 12, 10, ['coolant', 'code']],
      ['Turbines', 68, 36, 12, 12, ['valve', 'wires']],
      ['Refinery', 54, 54, 14, 10, ['filter', 'mop']],
      ['Barracks', 26, 54, 14, 10, ['mop', 'swipe']],
      ['Magma Pump', 12, 36, 12, 12, ['valve', 'coolant']],
      ['Electrical', 14, 14, 12, 10, ['wires', 'swipe']],
    ],
    links: [['Command', 'Thermal Lab'], ['Thermal Lab', 'Turbines'], ['Turbines', 'Refinery'], ['Refinery', 'Barracks'],
      ['Barracks', 'Magma Pump'], ['Magma Pump', 'Electrical'], ['Electrical', 'Command'],
      ['Drill Core', 'Command'], ['Drill Core', 'Turbines'], ['Drill Core', 'Barracks'], ['Drill Core', 'Magma Pump']],
    button: 'Drill Core', lights: 'Electrical', cool: ['Turbines', 'Magma Pump'],
    vents: [['Command', 'Drill Core', 'Barracks'], ['Electrical', 'Magma Pump'], ['Thermal Lab', 'Turbines', 'Refinery']],
  },
  {
    id: 3, name: 'Bathhouse', sub: 'Steamy tiled spa with hot springs', theme: 'spa',
    rooms: [
      ['Lounge', 36, 28, 14, 12, ['mop', 'code']],
      ['Hot Spring', 12, 12, 14, 12, ['coolant', 'valve']],
      ['Sauna', 36, 8, 12, 10, ['valve', 'filter']],
      ['Cold Plunge', 62, 12, 14, 12, ['coolant', 'filter']],
      ['Laundry', 12, 32, 12, 10, ['mop', 'wires']],
      ['Boiler', 62, 32, 12, 10, ['wires', 'code']],
      ['Massage', 12, 50, 12, 10, ['swipe', 'mop']],
      ['Reception', 36, 50, 16, 8, ['upload', 'swipe']],
      ['Locker Room', 62, 50, 12, 10, ['code', 'upload']],
    ],
    links: [['Lounge', 'Sauna'], ['Lounge', 'Laundry'], ['Lounge', 'Boiler'], ['Lounge', 'Reception'], ['Hot Spring', 'Sauna'],
      ['Sauna', 'Cold Plunge'], ['Hot Spring', 'Laundry'], ['Cold Plunge', 'Boiler'], ['Laundry', 'Massage'], ['Massage', 'Reception'],
      ['Reception', 'Locker Room'], ['Locker Room', 'Boiler']],
    button: 'Lounge', lights: 'Boiler', cool: ['Sauna', 'Cold Plunge'],
    vents: [['Hot Spring', 'Laundry', 'Massage'], ['Cold Plunge', 'Boiler', 'Locker Room'], ['Sauna', 'Lounge', 'Reception']],
  },
  {
    id: 4, name: 'Sky Tanker', sub: 'Water airship drifting above the clouds', theme: 'sky',
    rooms: [
      ['Galley', 38, 24, 16, 12, ['mop', 'upload']],
      ['Bridge', 76, 24, 12, 12, ['upload', 'code']],
      ['Navigation', 58, 10, 12, 10, ['code', 'swipe']],
      ['Ballast Tanks', 58, 38, 12, 10, ['valve', 'coolant']],
      ['Cargo Hold', 38, 46, 14, 8, ['filter', 'swipe']],
      ['Electrical', 22, 10, 10, 10, ['wires', 'code']],
      ['Water Tanks', 22, 38, 10, 10, ['coolant', 'filter']],
      ['Port Engine', 6, 10, 10, 10, ['valve', 'wires']],
      ['Starboard Engine', 6, 38, 10, 10, ['wires', 'valve']],
    ],
    links: [['Bridge', 'Navigation'], ['Bridge', 'Ballast Tanks'], ['Galley', 'Navigation'], ['Galley', 'Ballast Tanks'],
      ['Galley', 'Electrical'], ['Galley', 'Water Tanks'], ['Galley', 'Cargo Hold'], ['Electrical', 'Port Engine'],
      ['Water Tanks', 'Starboard Engine'], ['Port Engine', 'Starboard Engine'], ['Cargo Hold', 'Ballast Tanks']],
    button: 'Galley', lights: 'Electrical', cool: ['Port Engine', 'Ballast Tanks'],
    vents: [['Port Engine', 'Starboard Engine'], ['Electrical', 'Water Tanks', 'Cargo Hold'], ['Navigation', 'Bridge', 'Ballast Tanks']],
  },
];

export const COLORS = [
  { name: 'Red', hex: '#ff2a2a' }, { name: 'Blue', hex: '#2a6bff' }, { name: 'Lime', hex: '#5dff3a' }, { name: 'Pink', hex: '#ff4fd2' },
  { name: 'Orange', hex: '#ff8a1a' }, { name: 'Yellow', hex: '#ffe32a' }, { name: 'Purple', hex: '#9b4dff' }, { name: 'Cyan', hex: '#2af2ff' },
  { name: 'White', hex: '#f4f7ff' }, { name: 'Teal', hex: '#18c79a' }, { name: 'Brown', hex: '#b8743a' }, { name: 'Coral', hex: '#ff7b6b' },
];

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const PAD = 3;
export function buildMap(def) {
  const R = rng(1234 + def.id * 77);
  const rooms = def.rooms.map(([name, x, z, w, d, tasks], i) => ({ i, name, x: x + PAD, z: z + PAD, w, d, tasks, x0: x + PAD - w / 2, z0: z + PAD - d / 2, x1: x + PAD + w / 2, z1: z + PAD + d / 2 }));
  const byName = n => { const r = rooms.find(r => r.name === n); if (!r) throw new Error('no room ' + n); return r; };
  let W = 0, H = 0;
  for (const r of rooms) { W = Math.max(W, r.x1 + PAD); H = Math.max(H, r.z1 + PAD); }
  const grid = new Uint8Array(W * H);          // 0 solid, 1 floor, 2 blocked by furniture
  const roomOf = new Int8Array(W * H).fill(-1);
  const idx = (i, j) => j * W + i;
  const fill = (x0, z0, x1, z1, room) => {
    for (let j = Math.max(0, Math.floor(z0)); j < Math.min(H, Math.ceil(z1)); j++)
      for (let i = Math.max(0, Math.floor(x0)); i < Math.min(W, Math.ceil(x1)); i++) { grid[idx(i, j)] = 1; if (room >= 0) roomOf[idx(i, j)] = room; }
  };
  const halls = [];
  for (const [a, b] of def.links) {
    const A = byName(a), B = byName(b);
    // horizontal leg at A.z, then vertical leg at B.x (3 m wide)
    halls.push([Math.min(A.x, B.x) - 1, A.z - 1, Math.max(A.x, B.x) + 2, A.z + 2]);
    halls.push([B.x - 1, Math.min(A.z, B.z) - 1, B.x + 2, Math.max(A.z, B.z) + 2]);
  }
  for (const h of halls) fill(h[0], h[1], h[2], h[3], -1);
  for (const r of rooms) fill(r.x0, r.z0, r.x1, r.z1, r.i);

  const walk = (i, j) => i >= 0 && j >= 0 && i < W && j < H && grid[idx(i, j)] === 1;
  const inRoom = (i, j, r) => roomOf[idx(i, j)] === r.i;
  // door cells: room cells that touch walkable cells outside the room
  const reserved = new Uint8Array(W * H);
  const reserve = (ci, cj, rad) => { for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) if (i >= 0 && j >= 0 && i < W && j < H) reserved[idx(i, j)] = 1; };
  for (const r of rooms) for (let j = r.z0; j < r.z1; j++) for (let i = r.x0; i < r.x1; i++)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (walk(a, b) && !inRoom(a, b, r)) reserve(i, j, 2); }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (grid[idx(i, j)] === 1 && roomOf[idx(i, j)] < 0) reserved[idx(i, j)] = 1;

  // wall-hugging slots in a room: [cell i, j, dir di, dj] — the station sits on the cell, you stand at cell+dir
  const slots = (r, side) => {
    const out = [];
    if (side === 'n') for (let i = r.x0 + 1; i < r.x1 - 1; i++) out.push([i, r.z0, 0, 1]);
    if (side === 'w') for (let j = r.z0 + 1; j < r.z1 - 1; j++) out.push([r.x0, j, 1, 0]);
    if (side === 'e') for (let j = r.z0 + 1; j < r.z1 - 1; j++) out.push([r.x1 - 1, j, -1, 0]);
    if (side === 's') for (let i = r.x0 + 1; i < r.x1 - 1; i++) out.push([i, r.z1 - 1, 0, -1]);
    return out.filter(([i, j, di, dj]) => walk(i, j) && !reserved[idx(i, j)] && !reserved[idx(i + di, j + dj)] && !walk(i - di, j - dj));
  };
  const takeSlot = (r, sides) => {
    for (const s of sides) {
      const c = slots(r, s);
      if (c.length) {
        const pick = c[Math.floor(c.length / 2 + (R() - 0.5) * c.length * 0.8)] || c[0];
        const [i, j, di, dj] = pick;
        grid[idx(i, j)] = 2; reserve(i, j, 1); reserve(i + di, j + dj, 1);
        return { si: i, sj: j, sx: i + 0.5, sz: j + 0.5, x: i + di + 0.5, z: j + dj + 0.5, dx: di, dz: dj, room: r.name };
      }
    }
    return null;
  };
  const floorSpot = (r, rad = 1) => {
    for (let tries = 0; tries < 200; tries++) {
      const i = r.x0 + 2 + Math.floor(R() * (r.w - 4)), j = r.z0 + 2 + Math.floor(R() * (r.d - 4));
      if (walk(i, j) && !reserved[idx(i, j)]) { reserve(i, j, rad); return { x: i + 0.5, z: j + 0.5, room: r.name, si: i, sj: j }; }
    }
    return { x: r.x + 0.5, z: r.z + 0.5, room: r.name };
  };

  // emergency button (blocks its own cell), centre of its room
  const br = byName(def.button);
  const button = { x: br.x, z: br.z, room: br.name };
  for (const [i, j] of [[br.x - 1, br.z - 1], [br.x, br.z - 1], [br.x - 1, br.z], [br.x, br.z]]) grid[idx(i, j)] = 2;
  reserve(br.x, br.z, 3);
  // sabotage panels
  const lights = takeSlot(byName(def.lights), ['n', 'w', 'e', 's']);
  const valves = def.cool.map(n => takeSlot(byName(n), ['n', 'e', 'w', 's']));
  // tasks
  const tasks = [];
  for (const r of rooms) for (const type of r.tasks) {
    if (type === 'mop') { const s = floorSpot(r, 1); tasks.push({ type, ...s, dx: 0, dz: 0 }); continue; }
    const s = takeSlot(r, ['n', 'w', 'e', 's']);
    if (s) tasks.push({ type, ...s });
  }
  tasks.forEach((t, i) => t.id = i);
  // vents (a floor grate, walk over it)
  const vents = [];
  for (const group of def.vents) {
    const ids = group.map(n => { const v = { ...floorSpot(byName(n), 1), links: [] }; vents.push(v); return vents.length - 1; });
    for (const a of ids) vents[a].links = ids.filter(b => b !== a);
  }
  // props along walls
  const props = [];
  const keyCells = () => [[button.x, button.z + 2], ...tasks.map(t => [Math.floor(t.x), Math.floor(t.z)]), [Math.floor(lights.x), Math.floor(lights.z)], ...valves.map(v => [Math.floor(v.x), Math.floor(v.z)]), ...vents.map(v => [Math.floor(v.x), Math.floor(v.z)])];
  const connected = () => {
    const seen = new Uint8Array(W * H), q = [idx(button.x, button.z + 2)]; seen[q[0]] = 1;
    while (q.length) { const c = q.pop(), i = c % W, j = (c / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = idx(i + di, j + dj); if (walk(i + di, j + dj) && !seen[n]) { seen[n] = 1; q.push(n); } } }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (grid[idx(i, j)] === 1 && !seen[idx(i, j)]) return false;
    return keyCells().every(([i, j]) => seen[idx(i, j)]);
  };
  for (const r of rooms) {
    const n = Math.round(r.w * r.d / 22);
    for (let k = 0; k < n; k++) {
      const s = takeSlot(r, [['w', 'e', 's', 'n'][Math.floor(R() * 4)], 'w', 'e', 's']);
      if (!s) break;
      if (!connected()) { grid[idx(s.si, s.sj)] = 1; continue; }
      props.push({ ...s, kind: Math.floor(R() * 1000) });
    }
  }
  return { def, W, H, grid, roomOf, rooms, halls, button, lights, valves, tasks, vents, props, walk, idx };
}

export function roomName(m, x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  if (i < 0 || j < 0 || i >= m.W || j >= m.H) return 'Outside';
  const r = m.roomOf[j * m.W + i];
  return r >= 0 ? m.rooms[r].name : 'Hallway';
}
