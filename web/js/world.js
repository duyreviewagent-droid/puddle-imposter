// Builds a map in 3D: themed floors, walls (south walls cut low so the camera sees in), task stations,
// vents, the emergency button, props, pooled room lights + a following shadow light, and wet effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dropGeo, textSprite } from './puddle.js';

export const THEMES = {
  pump: { floor: 'concrete', floorC: '#7b8084', hall: 'grate', hallC: '#5d6468', wall: '#3f6f78', wallTop: '#c9cdc8', trim: '#e6b81e', light: 0xe2f1ff, hemi: [0xbfd8ea, 0x2a3036], bg: '#05090c', voidC: '#0b1115', fog: 0x060a0d },
  ice: { floor: 'ice', floorC: '#cfe2ee', hall: 'snow', hallC: '#e8f0f6', wall: '#e3ebf2', wallTop: '#ffffff', trim: '#2b7bd8', light: 0xd6ecff, hemi: [0xe0f0ff, 0x52708a], bg: '#0a1622', voidC: '#dfeaf2', fog: 0x0a1622 },
  magma: { floor: 'plate', floorC: '#4a4644', hall: 'grate', hallC: '#3a3532', wall: '#5b3523', wallTop: '#2a2421', trim: '#ff6a1a', light: 0xffb27a, hemi: [0xffb080, 0x301008], bg: '#120504', voidC: 'lava', fog: 0x150604 },
  spa: { floor: 'mosaic', floorC: '#5aa7b2', hall: 'wood', hallC: '#9a6a42', wall: '#e9dcc3', wallTop: '#f6efe2', trim: '#3f8a7a', light: 0xffe1b8, hemi: [0xffe6c8, 0x403028], bg: '#0f0b08', voidC: '#2a1f18', fog: 0x120d0a },
  sky: { floor: 'planks', floorC: '#8b5a33', hall: 'plate', hallC: '#6d6f72', wall: '#6b665b', wallTop: '#b38b4d', trim: '#c8a24a', light: 0xfff0d6, hemi: [0xcfe4ff, 0x5a6a7a], bg: '#6fa6d8', voidC: 'sky', fog: 0x9cc3e6 },
};

// ------------------------------------------------------------------ procedural textures
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, rep = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t;
}
function speckle(g, w, h, n, cols, size = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = Math.random() * size + 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function blotch(g, w, h, n, col, rmin, rmax) {
  for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, r = rmin + Math.random() * (rmax - rmin); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
}
// returns { map, rough } canvases for a floor kind; 512px = 4 m
function floorCanvases(kind, base) {
  const S = 512;
  const map = canvas(S, S, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (kind === 'concrete') {
      speckle(g, w, h, 9000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.07)']);
      blotch(g, w, h, 18, 'rgba(0,0,0,.10)', 30, 90); blotch(g, w, h, 10, 'rgba(255,255,255,.05)', 30, 80);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    } else if (kind === 'grate') {
      g.fillStyle = 'rgba(0,0,0,.55)';
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) g.fillRect(x + 3, y + 3, 10, 10);
      g.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
      blotch(g, w, h, 8, 'rgba(90,50,20,.18)', 20, 70);
    } else if (kind === 'ice') {
      speckle(g, w, h, 4000, ['rgba(255,255,255,.35)', 'rgba(120,170,210,.15)']);
      blotch(g, w, h, 14, 'rgba(140,190,230,.25)', 30, 100);
      g.strokeStyle = 'rgba(80,130,180,.35)'; g.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    } else if (kind === 'snow') {
      speckle(g, w, h, 9000, ['rgba(255,255,255,.5)', 'rgba(150,180,210,.15)'], 3);
      blotch(g, w, h, 20, 'rgba(160,190,220,.2)', 20, 80);
    } else if (kind === 'plate') {
      for (let y = 0; y < h; y += 24) for (let x = (y / 24 % 2) * 12; x < w; x += 24) {
        g.fillStyle = 'rgba(255,255,255,.10)'; g.save(); g.translate(x, y); g.rotate(0.6); g.fillRect(-6, -2, 12, 4); g.restore();
      }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; g.strokeRect(1, 1, w / 2 - 2, h - 2); g.strokeRect(w / 2 + 1, 1, w / 2 - 2, h - 2);
      g.fillStyle = 'rgba(0,0,0,.4)'; for (const [x, y] of [[10, 10], [w / 2 - 10, 10], [10, h - 10], [w / 2 - 10, h - 10], [w / 2 + 10, 10], [w - 10, 10], [w / 2 + 10, h - 10], [w - 10, h - 10]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      blotch(g, w, h, 10, 'rgba(110,60,20,.2)', 20, 80); speckle(g, w, h, 3000, ['rgba(0,0,0,.1)']);
    } else if (kind === 'mosaic') {
      const cols = ['#4f9ea9', '#5fb3bd', '#3f8a96', '#6cc0c6', '#3d7f8c', '#8fd2d0'];
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x + 1, y + 1, 14, 14); }
      g.fillStyle = 'rgba(230,220,200,.9)'; for (let y = 0; y < h; y += 16) { g.fillRect(0, y, w, 1.5); g.fillRect(y, 0, 1.5, h); }
      g.strokeStyle = '#d9c9a3'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    } else if (kind === 'wood' || kind === 'planks') {
      const bw = kind === 'planks' ? 64 : 42;
      for (let x = 0; x < w; x += bw) {
        const sh = (Math.random() - 0.5) * 30; g.fillStyle = `rgba(${sh > 0 ? 255 : 0},${sh > 0 ? 220 : 0},${sh > 0 ? 180 : 0},${Math.abs(sh) / 160})`; g.fillRect(x, 0, bw, h);
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,30,10,${0.05 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const yy = Math.random() * h; g.moveTo(x + Math.random() * bw, 0); g.bezierCurveTo(x + Math.random() * bw, yy, x + Math.random() * bw, yy, x + Math.random() * bw, h); g.stroke(); }
        g.fillStyle = 'rgba(30,15,5,.7)'; g.fillRect(x, 0, 2, h);
        const cut = Math.random() * h; g.fillRect(x, cut, bw, 2);
        g.fillStyle = 'rgba(20,20,20,.6)'; for (const yy of [cut - 8, cut + 10]) { g.beginPath(); g.arc(x + 8, yy, 2.5, 0, 7); g.arc(x + bw - 8, yy, 2.5, 0, 7); g.fill(); }
      }
    }
  });
  const rough = canvas(S, S, (g, w, h) => {
    const r = { concrete: 170, grate: 120, ice: 30, snow: 220, plate: 110, mosaic: 60, wood: 140, planks: 150 }[kind] ?? 150;
    g.fillStyle = `rgb(${r},${r},${r})`; g.fillRect(0, 0, w, h);
    blotch(g, w, h, 14, 'rgba(0,0,0,.45)', 30, 110); // damp, shiny patches
    speckle(g, w, h, 3000, ['rgba(255,255,255,.1)', 'rgba(0,0,0,.1)']);
  });
  return { map, rough };
}
function wallCanvas(T) {
  return canvas(256, 512, (g, w, h) => {
    g.fillStyle = T.wall; g.fillRect(0, 0, w, h);
    // panels with seams
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, 3, h); g.fillRect(w / 2, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(4, 0, 2, h);
    // lower kick band + trim stripe
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, h * 0.82, w, h * 0.18);
    g.fillStyle = T.trim; g.fillRect(0, h * 0.62, w, 10);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h * 0.62 + 10, w, 3);
    blotch(g, w, h, 6, 'rgba(0,0,0,.12)', 20, 60);
    // drip stains down from the top
    for (let i = 0; i < 5; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, 0, 0, h * 0.6); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + Math.random() * 6, h * (0.3 + Math.random() * 0.4)); }
    speckle(g, w, h, 1500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.06)']);
  });
}
function lavaCanvas() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#1a0a06'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      let x = Math.random() * w, y = Math.random() * h; g.lineCap = 'round';
      for (let k = 0; k < 8; k++) {
        const nx = x + (Math.random() - 0.5) * 80, ny = y + (Math.random() - 0.5) * 80;
        g.strokeStyle = 'rgba(255,90,10,.85)'; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        g.strokeStyle = 'rgba(255,220,120,.7)'; g.lineWidth = 1; g.stroke();
        x = nx; y = ny;
      }
    }
    blotch(g, w, h, 20, 'rgba(255,80,0,.35)', 20, 70);
  });
}
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = canvas(128, 128, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#fff'; g.filter = 'blur(4px)';
    g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * 6.283, r = 38 + Math.sin(a * 3) * 6 + Math.sin(a * 7 + 1) * 4; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(64 + (Math.random() - 0.5) * 80, 64 + (Math.random() - 0.5) * 80, 6 + Math.random() * 6, 0, 7); g.fill(); }
  });
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}

// world-space box-projected UVs (1 unit = 1 m / scale)
function worldUV(geo, scale = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (ny > 0.5) { uv[i * 2] = x / scale; uv[i * 2 + 1] = z / scale; }
    else if (nx > 0.5) { uv[i * 2] = z / scale; uv[i * 2 + 1] = y / 2.6; }
    else { uv[i * 2] = x / scale; uv[i * 2 + 1] = y / 2.6; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

export const WALL_H = 2.6, CUT_H = 0.45;

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 400);
    this.drips = []; this.spots = []; this.rings = []; this.steam = [];
    this.t = 0;
  }
  build(map, envTex) {
    const T = this.T = THEMES[map.def.theme], S = this.scene;
    this.map = map;
    S.background = new THREE.Color(T.bg);
    S.environment = envTex;
    S.fog = map.def.theme === 'sky' ? new THREE.Fog(T.fog, 60, 160) : new THREE.Fog(T.fog, 38, 70);
    const { W, H, grid } = map;
    // ---------------- void / outside
    if (T.voidC === 'lava') {
      const lt = tex(lavaCanvas(), W / 12);
      this.lavaTex = lt;
      const lava = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, H + 80), new THREE.MeshStandardMaterial({ color: 0x1a0806, emissive: 0xff5a12, emissiveMap: lt, emissiveIntensity: 1.4, map: lt, roughness: 0.9 }));
      lava.rotation.x = -Math.PI / 2; lava.position.set(W / 2, -0.6, H / 2); S.add(lava);
    } else if (T.voidC === 'sky') {
      const ct = tex(canvas(512, 512, (g, w, h) => { g.fillStyle = '#8fb8e0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }), 3);
      this.cloudTex = ct;
      const clouds = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ map: ct, fog: true }));
      clouds.rotation.x = -Math.PI / 2; clouds.position.set(W / 2, -40, H / 2); S.add(clouds);
    } else {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, H + 80), std(T.voidC, 0.95));
      g.rotation.x = -Math.PI / 2; g.position.set(W / 2, -0.02, H / 2); g.receiveShadow = true; S.add(g);
    }
    // ---------------- floors (rooms on top of halls)
    const fr = floorCanvases(T.floor, T.floorC), hr = floorCanvases(T.hall, T.hallC);
    const floorMat = std(0xffffff, 1, 0.05, { map: tex(fr.map), roughnessMap: tex(fr.rough, 1, false), envMapIntensity: 0.35 });
    const hallMat = std(0xffffff, 1, T.hall === 'grate' || T.hall === 'plate' ? 0.5 : 0.05, { map: tex(hr.map), roughnessMap: tex(hr.rough, 1, false), envMapIntensity: 0.35 });
    const fGeos = [], hGeos = [];
    for (const [x0, z0, x1, z1] of map.halls) { const p = new THREE.PlaneGeometry(x1 - x0, z1 - z0); p.rotateX(-Math.PI / 2); p.translate((x0 + x1) / 2, 0.002, (z0 + z1) / 2); hGeos.push(p); }
    for (const r of map.rooms) { const p = new THREE.PlaneGeometry(r.w, r.d); p.rotateX(-Math.PI / 2); p.translate(r.x, 0.006, r.z); fGeos.push(p); }
    const mergeUV = (geos, s) => { const g = mergeGeometries(geos); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s); return g; };
    const floors = new THREE.Mesh(mergeUV(fGeos, 4), floorMat); floors.receiveShadow = true; S.add(floors);
    const hallsM = new THREE.Mesh(mergeUV(hGeos, 4), hallMat); hallsM.receiveShadow = true; S.add(hallsM);
    // solid ground between rooms: low dark slabs (top-down look)
    // ---------------- walls: runs of edges between floor and solid
    const walk = (i, j) => i >= 0 && j >= 0 && i < W && j < H && grid[j * W + i] !== 0;
    const tall = [], low = [], caps = [];
    const TH = 0.3;
    const addWall = (x0, z0, x1, z1, h) => {
      const w = Math.max(x1 - x0, TH), d = Math.max(z1 - z0, TH);
      const g = new THREE.BoxGeometry(w, h, d); g.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      (h > 1 ? tall : low).push(g);
      const c = new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02); c.translate((x0 + x1) / 2, h + 0.03, (z0 + z1) / 2); caps.push(c);
    };
    // north edges (floor cell with solid above it: wall faces camera) and south edges (cut low)
    for (let j = 0; j < H; j++) {
      for (const [dj, off, h] of [[-1, 0, WALL_H], [1, 1, CUT_H]]) {
        let start = -1;
        for (let i = 0; i <= W; i++) {
          const edge = i < W && walk(i, j) && !walk(i, j + dj);
          if (edge && start < 0) start = i;
          if (!edge && start >= 0) {
            const z = j + off + (dj < 0 ? -TH / 2 : TH / 2);
            addWall(start - TH, z - TH / 2, i + TH, z + TH / 2, h); start = -1;
          }
        }
      }
    }
    for (let i = 0; i < W; i++) {
      for (const [di, off] of [[-1, 0], [1, 1]]) {
        let start = -1;
        for (let j = 0; j <= H; j++) {
          const edge = j < H && walk(i, j) && !walk(i + di, j);
          if (edge && start < 0) start = j;
          if (!edge && start >= 0) {
            const x = i + off + (di < 0 ? -TH / 2 : TH / 2);
            // side walls step down to the cut height where they meet a south edge
            const southOpen = !walk(i, j);
            addWall(x - TH / 2, start, x + TH / 2, j - (southOpen ? 0 : 0), WALL_H); start = -1;
          }
        }
      }
    }
    const wc = wallCanvas(T);
    const wallMat = std(0xffffff, 0.75, 0.05, { map: tex(wc, 1), envMapIntensity: 0.4 });
    wallMat.map.repeat.set(0.5, 1);
    const tallM = new THREE.Mesh(worldUV(mergeGeometries(tall), 2), wallMat); tallM.castShadow = tallM.receiveShadow = true; S.add(tallM);
    if (low.length) { const lowM = new THREE.Mesh(worldUV(mergeGeometries(low), 2), wallMat); lowM.castShadow = lowM.receiveShadow = true; S.add(lowM); }
    const capM = new THREE.Mesh(mergeGeometries(caps), std(T.wallTop, 0.5, 0.2)); capM.receiveShadow = true; S.add(capM);
    // ---------------- lighting
    S.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], 0.42));
    this.amb = S.children[S.children.length - 1];
    const sun = this.sun = new THREE.DirectionalLight(T.light, 0.8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    S.add(sun, sun.target);
    this.lamps = [];
    for (const r of map.rooms) this.lamps.push(new THREE.Vector3(r.x, 2.3, r.z));
    this.pool = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(T.light, 30, 18, 1.6); l.position.set(0, -50, 0); S.add(l); this.pool.push(l); }
    this.alarm = new THREE.PointLight(0xff2a10, 0, 30, 1.2); S.add(this.alarm);
    // ceiling light strips on north walls (emissive)
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: T.light, emissiveIntensity: 1.4 });
    this.stripMat = stripMat;
    for (const r of map.rooms) { const s = box(Math.min(4, r.w - 4), 0.08, 0.06, stripMat, r.x, WALL_H - 0.25, r.z0 + 0.05); s.castShadow = false; S.add(s); }
    // ---------------- stations, button, vents, props
    this.stations = new Map();
    this.markers = [];
    for (const t of map.tasks) { const m = this.station(t.type, t); this.stations.set(t.id, m); }
    this.lightsPanel = this.station('lights', map.lights);
    this.valveMeshes = map.valves.map(v => this.station('cool', v));
    this.buildButton(map.button);
    this.ventMeshes = map.vents.map(v => this.buildVent(v));
    for (const p of map.props) this.prop(p);
    // task marker rings (pooled)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    this.markerGeo = new THREE.RingGeometry(0.48, 0.6, 40); this.markerGeo.rotateX(-Math.PI / 2);
    this.markerMat = ringMat;
    // room name decals painted on floors
    for (const r of map.rooms) {
      const c = canvas(512, 96, (g, w, h) => { g.font = '800 64px "Avenir Next", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(r.name.toUpperCase(), w / 2, h / 2); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.9), new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.6 }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.012, r.z1 - 1.3); S.add(m);
    }
    // pools for effects
    const wetMat = () => new THREE.MeshStandardMaterial({ color: 0x0a1c2a, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0, alphaMap: blobTexture(), depthWrite: false, envMapIntensity: 2.5 });
    const spotGeo = new THREE.PlaneGeometry(1, 1); spotGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(spotGeo, wetMat()); m.visible = false; m.renderOrder = -1; m.receiveShadow = true; S.add(m); this.spots.push({ m, life: 0, max: 1 }); }
    this.spotI = 0;
    const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.02, transparent: true, opacity: 0.75, clearcoat: 1, envMapIntensity: 2.5 });
    for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(dropGeo, dropMat); m.visible = false; S.add(m); this.drips.push({ m, v: new THREE.Vector3(), on: false }); }
    const ringGeo = new THREE.RingGeometry(0.7, 1, 32); ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; S.add(m); this.rings.push({ m, life: 0 }); }
    this.ringI = 0;
    // steam (spa + magma)
    if (T === THEMES.spa || T === THEMES.magma) {
      const st = new THREE.CanvasTexture(canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
      for (let i = 0; i < 60; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: T === THEMES.magma ? 0xffb090 : 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        const r = map.rooms[i % map.rooms.length];
        s.userData = { x: r.x0 + Math.random() * r.w, z: r.z0 + Math.random() * r.d, t: Math.random() * 6 };
        S.add(s); this.steam.push(s);
      }
    }
  }
  // ------------------------------------------------------------------ stations
  station(type, s) {
    const g = new THREE.Group(), T = this.T;
    g.position.set(s.sx, 0, s.sz);
    g.rotation.y = Math.atan2(s.dx, s.dz);      // local +z faces into the room
    const metal = std(0x8a9096, 0.35, 0.8), dark = std(0x24282c, 0.5, 0.6);
    const screen = (c, w = 0.7, h = 0.45, y = 1.25) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 1.6 })); m.position.set(0, y, 0.21); return m; };
    if (type === 'mop') {
      // a spreading sludge spill + bucket
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.15, transparent: true, opacity: 0.85, alphaMap: blobTexture(), depthWrite: false }));
      spill.rotation.x = -Math.PI / 2; spill.position.y = 0.015; g.add(spill);
      const b = cyl(0.2, 0.16, 0.35, std(0xe2c21a, 0.5), 0.9, 0.18, 0.6); g.add(b);
      const mop = cyl(0.02, 0.02, 1.3, std(0x9a7a4a, 0.7), 0.95, 0.75, 0.55); mop.rotation.z = 0.25; g.add(mop);
      g.position.set(s.x, 0, s.z); g.rotation.y = 0; g.userData.spill = spill;
    } else if (type === 'wires') {
      g.add(box(0.9, 1.3, 0.35, std(0x5d6670, 0.5, 0.6), 0, 1.0, 0));
      g.add(box(0.8, 1.15, 0.02, dark, 0, 1.0, 0.18));
      for (let k = 0; k < 4; k++) { const w = cyl(0.025, 0.025, 1.1, std(['#e22', '#22e', '#ee2', '#e2e'][k], 0.4), -0.25 + k * 0.17, 1.0, 0.22, 8); g.add(w); }
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xff3020 })); led.position.set(0.32, 1.55, 0.2); g.add(led); g.userData.led = led;
    } else if (type === 'valve' || type === 'cool') {
      const pipe = cyl(0.14, 0.14, WALL_H, metal, 0, WALL_H / 2, -0.05); g.add(pipe);
      const h = cyl(0.16, 0.16, 0.5, std(0x666b70, 0.4, 0.8), 0, 1.15, 0.12); h.rotation.x = Math.PI / 2; g.add(h);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(type === 'cool' ? 0.36 : 0.26, 0.04, 10, 28), std(type === 'cool' ? 0xd42020 : 0xc23a1a, 0.4, 0.3));
      wheel.position.set(0, 1.15, 0.38); g.add(wheel); g.userData.wheel = wheel;
      for (let k = 0; k < 3; k++) { const sp = box(type === 'cool' ? 0.7 : 0.5, 0.03, 0.03, wheel.material, 0, 1.15, 0.38); sp.rotation.z = k * Math.PI / 3; g.add(sp); }
      const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshStandardMaterial({ color: 0xf2f2e6, emissive: type === 'cool' ? 0xff3010 : 0x000000, emissiveIntensity: 0.3 })); gauge.position.set(0.35, 1.65, 0.2); g.add(gauge);
      if (type === 'cool') { const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({ map: tex(canvas(256, 96, (c, w, h) => { c.fillStyle = '#ffcc00'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = '900 44px sans-serif'; c.textAlign = 'center'; c.fillText('COOLANT', w / 2, 64); })) })); sign.position.set(0, 1.9, 0.12); g.add(sign); }
    } else if (type === 'upload') {
      g.add(box(1.1, 0.9, 0.5, std(0x3b4148, 0.45, 0.5), 0, 0.45, 0.05));
      g.add(box(1.0, 0.65, 0.1, dark, 0, 1.25, -0.05));
      const sc = screen(0x2a9fff, 0.88, 0.54, 1.25); sc.position.z = 0.01; g.add(sc); g.userData.screen = sc;
      g.add(box(0.7, 0.03, 0.25, std(0x1a1a1a, 0.6), 0, 0.92, 0.15));
    } else if (type === 'swipe') {
      g.add(box(0.4, 1.4, 0.3, std(0x50565c, 0.4, 0.7), 0, 0.7, 0));
      g.add(box(0.3, 0.2, 0.1, dark, 0, 1.15, 0.18));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.035), new THREE.MeshBasicMaterial({ color: 0x20ff60 })); led.position.set(0, 1.35, 0.17); g.add(led); g.userData.led = led;
    } else if (type === 'coolant') {
      g.add(cyl(0.4, 0.4, 1.8, std(0xc8d2da, 0.25, 0.85), 0, 0.9, 0));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x20b0ff, emissiveIntensity: 1.4 })); win.position.set(0, 0.95, 0.405); g.add(win);
      g.add(cyl(0.42, 0.42, 0.08, std(0x333333, 0.5, 0.6), 0, 1.8, 0));
    } else if (type === 'filter') {
      g.add(box(1.3, 1.6, 0.4, std(0x7a8288, 0.45, 0.6), 0, 0.8, 0));
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshStandardMaterial({ map: tex(canvas(128, 128, (c, w, h) => { c.fillStyle = '#222'; c.fillRect(0, 0, w, h); c.fillStyle = '#556'; for (let y = 4; y < h; y += 10) c.fillRect(4, y, w - 8, 5); c.fillStyle = 'rgba(120,90,40,.6)'; for (let i = 0; i < 30; i++) c.fillRect(Math.random() * w, Math.random() * h, 6, 3); })), metalness: 0.5, roughness: 0.5 })); gr.position.set(0, 0.85, 0.205); g.add(gr);
    } else if (type === 'code') {
      g.add(box(0.6, 0.9, 0.12, std(0x3c4248, 0.4, 0.7), 0, 1.25, -0.05));
      const kp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: tex(canvas(128, 160, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#30ff8a'; c.fillRect(10, 8, w - 20, 26); for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { c.fillStyle = '#ccc'; c.fillRect(14 + x * 36, 44 + y * 28, 28, 22); } })), emissive: 0x30ff8a, emissiveIntensity: 0.15 })); kp.position.set(0, 1.25, 0.02); g.add(kp);
    } else if (type === 'lights') {
      g.add(box(1.0, 1.4, 0.3, std(0x5a5f63, 0.5, 0.6), 0, 1.2, 0));
      const doorTex = tex(canvas(128, 160, (c, w, h) => { c.fillStyle = '#555b60'; c.fillRect(0, 0, w, h); for (let i = -10; i < 20; i++) { c.fillStyle = i % 2 ? '#ffcc00' : '#111'; c.beginPath(); c.moveTo(i * 14, h - 24); c.lineTo(i * 14 + 14, h - 24); c.lineTo(i * 14 + 28, h); c.lineTo(i * 14 + 14, h); c.fill(); } c.fillStyle = '#ffcc00'; c.font = '900 60px sans-serif'; c.textAlign = 'center'; c.fillText('⚡', w / 2, 80); }));
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), std(0xffffff, 0.5, 0.4, { map: doorTex })); d.position.set(0, 1.2, 0.16); g.add(d);
    }
    this.scene.add(g);
    return g;
  }
  buildButton(b) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    g.add(cyl(0.95, 1.05, 0.85, std(0x5a5f66, 0.35, 0.7), 0, 0.425, 0, 40));
    g.add(cyl(1.0, 1.0, 0.06, std(0x2a2d31, 0.4, 0.6), 0, 0.88, 0, 40));
    const btn = cyl(0.28, 0.3, 0.14, new THREE.MeshStandardMaterial({ color: 0xc00000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 }), 0, 0.97, 0, 28); g.add(btn);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1, envMapIntensity: 2 }));
    dome.position.y = 0.91; g.add(dome);
    this.buttonMesh = btn;
    this.scene.add(g);
  }
  buildVent(v) {
    const g = new THREE.Group(); g.position.set(v.x, 0, v.z);
    g.add(box(1.1, 0.06, 0.8, std(0x2a2e33, 0.5, 0.7), 0, 0.03, 0));
    for (let k = 0; k < 6; k++) g.add(box(1.0, 0.05, 0.05, std(0x8a9299, 0.3, 0.85), 0, 0.07, -0.3 + k * 0.12));
    const lid = new THREE.Group(); g.add(lid); g.userData.lid = lid;
    this.scene.add(g);
    return g;
  }
  prop(p) {
    const g = new THREE.Group(), th = this.map.def.theme, k = p.kind % 6;
    g.position.set(p.sx, 0, p.sz); g.rotation.y = Math.atan2(p.dx, p.dz) + (p.kind % 3 - 1) * 0.15;
    const wood = std(0x8a6236, 0.75), steel = std(0x7c848c, 0.35, 0.8), paint = std(this.T.trim, 0.5, 0.3);
    if (th === 'ice' && k < 2) { const ice = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1 })); ice.position.y = 0.45; ice.scale.y = 0.85; ice.castShadow = true; g.add(ice); }
    else if (th === 'spa' && k < 2) { g.add(cyl(0.3, 0.22, 0.5, std(0xb05a30, 0.8), 0, 0.25, 0)); for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 6), std(0x2f7a32, 0.7)); l.position.set(Math.cos(i) * 0.12, 0.85, Math.sin(i) * 0.12); l.rotation.set(Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5); l.castShadow = true; g.add(l); } }
    else if (th === 'magma' && k < 2) { g.add(cyl(0.32, 0.32, 0.95, std(0x3a3a3a, 0.5, 0.6), 0, 0.475, 0)); const band = cyl(0.33, 0.33, 0.12, paint, 0, 0.7, 0); g.add(band); }
    else if (k === 0 || k === 3) { g.add(box(0.85, 0.85, 0.85, wood, 0, 0.425, 0)); g.add(box(0.87, 0.08, 0.87, std(0x5a3a1a, 0.8), 0, 0.85, 0)); if (k === 3) g.add(box(0.6, 0.6, 0.6, wood, 0.05, 1.15, 0)); }
    else if (k === 1) { g.add(cyl(0.3, 0.3, 0.9, std(0x2a5ea8, 0.45, 0.4), 0, 0.45, 0)); g.add(cyl(0.31, 0.31, 0.05, steel, 0, 0.3, 0)); g.add(cyl(0.31, 0.31, 0.05, steel, 0, 0.62, 0)); }
    else if (k === 2) { g.add(box(0.8, 1.9, 0.5, std(0x4e5a66, 0.5, 0.6), 0, 0.95, -0.1)); g.add(box(0.02, 1.7, 0.02, std(0x222, 0.4), 0, 0.95, 0.16)); }
    else if (k === 4) { g.add(box(1.0, 0.06, 0.6, steel, 0, 0.9, -0.1)); g.add(box(1.0, 0.06, 0.6, steel, 0, 0.45, -0.1)); for (const [x, z] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.15], [0.45, 0.15]]) g.add(box(0.05, 1.8, 0.05, steel, x, 0.9, z)); g.add(box(0.3, 0.3, 0.3, wood, -0.2, 1.08, -0.1)); g.add(cyl(0.12, 0.12, 0.3, std(0xd02020, 0.5), 0.2, 0.6, -0.1)); }
    else { g.add(cyl(0.45, 0.45, 1.6, std(0x9aa2a8, 0.3, 0.8), 0, 0.8, 0)); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, 6.3, 0, 1.57), std(0x9aa2a8, 0.3, 0.8))); g.children[g.children.length - 1].position.y = 1.6; }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }
  // ------------------------------------------------------------------ effects
  wetSpot(x, z, size, life) {
    const s = this.spots[this.spotI++ % this.spots.length];
    s.m.visible = true; s.m.position.set(x, 0.014 + (this.spotI % 7) * 0.0005, z); s.m.scale.set(size, 1, size * (0.7 + Math.random() * 0.5)); s.m.rotation.y = Math.random() * 6;
    s.life = s.max = life; s.m.material.opacity = 0.7;
  }
  spawnDrip(pos, heading) {
    const d = this.drips.find(d => !d.on); if (!d) return;
    const a = heading + Math.PI + (Math.random() - 0.5) * 2.2, r = 0.42;
    d.on = true; d.m.visible = true;
    d.m.position.set(pos.x + Math.sin(a) * r, pos.y + 0.3 + Math.random() * 0.3, pos.z + Math.cos(a) * r);
    d.v.set(Math.sin(a) * 0.4, 0.2, Math.cos(a) * 0.4);
    d.m.scale.set(1, 1.4, 1);
  }
  splash(x, z, size = 1) {
    const r = this.rings[this.ringI++ % this.rings.length];
    r.m.visible = true; r.m.position.set(x, 0.03, z); r.life = 1; r.size = size; r.m.scale.setScalar(0.1);
  }
  burst(x, y, z, n = 30, speed = 3) {
    for (let i = 0; i < n; i++) {
      const d = this.drips.find(d => !d.on); if (!d) return;
      const a = Math.random() * 6.283, up = 1 + Math.random() * 3;
      d.on = true; d.m.visible = true; d.m.position.set(x, y, z);
      d.v.set(Math.cos(a) * speed * Math.random(), up, Math.sin(a) * speed * Math.random());
      d.m.scale.setScalar(1 + Math.random() * 1.5);
    }
    this.splash(x, z, 2.2);
  }
  marker(i, x, z, on, near) {
    let m = this.markers[i];
    if (!m) { m = new THREE.Mesh(this.markerGeo, this.markerMat.clone()); this.scene.add(m); this.markers[i] = m; }
    m.visible = on; if (!on) return;
    m.position.set(x, 0.05, z);
    const s = 1 + Math.sin(this.t * 4) * 0.08 + (near ? 0.25 : 0);
    m.scale.set(s, 1, s); m.material.opacity = near ? 1 : 0.6;
  }
  hideMarkers(from) { for (let i = from; i < this.markers.length; i++) this.markers[i].visible = false; }
  update(dt, focus, opts = {}) {
    this.t += dt;
    const t = this.t;
    // lights: nearest room lamps follow the player
    const lamps = this.lamps.slice().sort((a, b) => (a.x - focus.x) ** 2 + (a.z - focus.z) ** 2 - ((b.x - focus.x) ** 2 + (b.z - focus.z) ** 2));
    const dim = opts.lightsOut ? 0.12 : 1;
    this.pool.forEach((l, i) => { l.position.copy(lamps[i] || new THREE.Vector3(0, -50, 0)); l.intensity = 14 * dim * (1 + Math.sin(t * 37 + i) * 0.01); });
    this.amb.intensity = 0.42 * (opts.lightsOut ? 0.25 : 1);
    this.sun.intensity = 0.8 * (opts.lightsOut ? 0.15 : 1);
    this.stripMat.emissiveIntensity = opts.lightsOut ? 0.1 : 1.4;
    this.sun.position.set(focus.x + 8, 30, focus.z + 12); this.sun.target.position.set(focus.x, 0, focus.z);
    this.alarm.position.set(focus.x, 3, focus.z);
    this.alarm.intensity = opts.heat ? 25 * (0.5 + 0.5 * Math.sin(t * 6)) : 0;
    if (this.buttonMesh) this.buttonMesh.material.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.3;
    if (this.lavaTex) { this.lavaTex.offset.x = t * 0.004; this.lavaTex.offset.y = Math.sin(t * 0.1) * 0.02; }
    if (this.cloudTex) this.cloudTex.offset.x = t * 0.003;
    for (const [, g] of this.stations) { if (g.userData.led) g.userData.led.material.color.setHex(Math.sin(t * 5 + g.position.x) > 0 ? 0x30ff60 : 0x103018); }
    for (const v of this.valveMeshes) v.userData.wheel.rotation.z = opts.heat ? t * 2 : 0;
    // drips
    for (const d of this.drips) {
      if (!d.on) continue;
      d.v.y -= 12 * dt; d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < 0.03) {
        d.on = false; d.m.visible = false;
        this.wetSpot(d.m.position.x, d.m.position.z, 0.12 + Math.random() * 0.12, 5);
        if (Math.random() < 0.5) this.splash(d.m.position.x, d.m.position.z, 0.25);
        this.onDrip && this.onDrip(d.m.position);
      }
    }
    for (const s of this.spots) {
      if (!s.m.visible) continue;
      s.life -= dt; if (s.life <= 0) { s.m.visible = false; continue; }
      s.m.material.opacity = 0.7 * Math.min(1, s.life / s.max * 2);
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.life -= dt * 2.2; if (r.life <= 0) { r.m.visible = false; continue; }
      r.m.scale.setScalar((1 - r.life) * r.size + 0.05); r.m.material.opacity = r.life * 0.45;
    }
    for (const s of this.steam) {
      const u = s.userData; u.t += dt; const k = (u.t % 6) / 6;
      s.position.set(u.x + Math.sin(u.t * 0.5) * 0.4, 0.3 + k * 2.4, u.z); s.scale.setScalar(1 + k * 2.5); s.material.opacity = Math.sin(k * Math.PI) * 0.18;
    }
  }
}
