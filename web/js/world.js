// Builds a map in 3D: themed floors, walls (south walls cut low so the camera sees in), task stations,
// vents, the emergency button, props, pooled room lights + a following shadow light, and wet effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dropGeo, textSprite } from './puddle.js';

export const THEMES = {
  pump: { floor: 'concrete', floorC: '#7b8084', hall: 'grate', hallC: '#5d6468', wall: '#3f6f78', wallTop: '#c9cdc8', trim: '#e6b81e', light: 0xe2f1ff, hemi: [0xbfd8ea, 0x2a3036], bg: '#05090c', voidC: 'ground', fog: 0x060a0d, outFloor: 'grass', outC: '#4f7a34', fence: 'hedge', ground: 'grass', groundC: '#3d6a2a', nature: 'trees' },
  ice: { floor: 'ice', floorC: '#cfe2ee', hall: 'snow', hallC: '#e8f0f6', wall: '#e3ebf2', wallTop: '#ffffff', trim: '#2b7bd8', light: 0xd6ecff, hemi: [0xe0f0ff, 0x52708a], bg: '#0a1622', voidC: 'ground', fog: 0x0a1622, outFloor: 'snow', outC: '#eef4f8', fence: 'snowbank', ground: 'snow', groundC: '#dde8f0', nature: 'pines' },
  magma: { floor: 'plate', floorC: '#4a4644', hall: 'grate', hallC: '#3a3532', wall: '#5b3523', wallTop: '#2a2421', trim: '#ff6a1a', light: 0xffb27a, hemi: [0xffb080, 0x301008], bg: '#120504', voidC: 'lava', fog: 0x150604, outFloor: 'basalt', outC: '#34302d', fence: 'rocks', nature: 'rocks' },
  spa: { floor: 'mosaic', floorC: '#5aa7b2', hall: 'wood', hallC: '#9a6a42', wall: '#e9dcc3', wallTop: '#f6efe2', trim: '#3f8a7a', light: 0xffe1b8, hemi: [0xffe6c8, 0x403028], bg: '#0f0b08', voidC: 'ground', fog: 0x120d0a, outFloor: 'grass', outC: '#5a8a3a', fence: 'bamboo', ground: 'grass', groundC: '#456f2c', nature: 'blossom' },
  sky: { floor: 'planks', floorC: '#8b5a33', hall: 'plate', hallC: '#6d6f72', wall: '#6b665b', wallTop: '#b38b4d', trim: '#c8a24a', light: 0xfff0d6, hemi: [0xcfe4ff, 0x5a6a7a], bg: '#6fa6d8', voidC: 'sky', fog: 0x9cc3e6, outFloor: 'planks', outC: '#a06c3c', fence: 'rail', nature: 'none' },
  yard: { floor: 'grass', floorC: '#5a9a3a', hall: 'stone', hallC: '#a8a49a', wall: '#c8b89a', wallTop: '#e8dcc0', trim: '#7a5a3a', light: 0xfff2dc, hemi: [0xd8ecff, 0x4a6a30], bg: '#8fc4f0', voidC: 'ground', fog: 0xa8d0f0, outFloor: 'grass', outC: '#5a9a3a', fence: 'hedge', ground: 'grass', groundC: '#4a8a30', nature: 'trees' },
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
    } else if (kind === 'grass') {
      for (let i = 0; i < 9000; i++) { const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 7; g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,60,10' : '150,200,90'},${0.15 + Math.random() * 0.3})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - l); g.stroke(); }
      blotch(g, w, h, 12, 'rgba(90,70,30,.18)', 20, 60); blotch(g, w, h, 14, 'rgba(160,220,90,.12)', 30, 90);
      for (let i = 0; i < 22; i++) { g.fillStyle = ['#ffffff', '#ffe14a', '#ff8ac8', '#b0a0ff'][i % 4]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.2, 0, 7); g.fill(); }
    } else if (kind === 'basalt') {
      speckle(g, w, h, 8000, ['rgba(0,0,0,.25)', 'rgba(120,100,90,.12)'], 3);
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 80; y += (Math.random() - 0.5) * 80; g.lineTo(x, y); } g.strokeStyle = 'rgba(255,90,10,.55)'; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = 'rgba(255,200,80,.5)'; g.lineWidth = 0.8; g.stroke(); }
    } else if (kind === 'stone') {
      for (let y = 0; y < h; y += 64) for (let x = (y / 64 % 2) * 32; x < w + 64; x += 64) { const sh = Math.random() * 30 - 15; g.fillStyle = `rgba(${sh > 0 ? 255 : 0},${sh > 0 ? 255 : 0},${sh > 0 ? 255 : 0},${Math.abs(sh) / 120})`; g.fillRect(x + 2, y + 2, 60, 60); }
      g.strokeStyle = 'rgba(40,36,30,.55)'; g.lineWidth = 3; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 64 % 2) * 32; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
      speckle(g, w, h, 4000, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.08)']); blotch(g, w, h, 10, 'rgba(60,90,40,.18)', 10, 40);
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
    const r = { concrete: 170, grate: 120, ice: 30, snow: 220, plate: 110, mosaic: 60, wood: 140, planks: 150, grass: 235, basalt: 200, stone: 190 }[kind] ?? 150;
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

function fenceMaterial(kind) {
  const c = canvas(256, 128, (g, w, h) => {
    if (kind === 'hedge') { g.fillStyle = '#2f5a22'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,150,50' : '20,50,15'},${0.3 + Math.random() * 0.5})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 4, 2.5, Math.random() * 3, 0, 7); g.fill(); } }
    else if (kind === 'bamboo') { g.fillStyle = '#5a4a20'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 14, 0); gr.addColorStop(0, '#8a9a3a'); gr.addColorStop(0.5, '#d8d880'); gr.addColorStop(1, '#6a7a2a'); g.fillStyle = gr; g.fillRect(x + 1, 0, 14, h); g.fillStyle = 'rgba(60,50,10,.6)'; for (let y = 20 + Math.random() * 20; y < h; y += 40) g.fillRect(x + 1, y, 14, 3); } g.fillStyle = '#3a2a10'; g.fillRect(0, 30, w, 5); g.fillRect(0, 90, w, 5); }
    else if (kind === 'snowbank') { g.fillStyle = '#e8f0f6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, ['rgba(255,255,255,.6)', 'rgba(150,180,210,.25)'], 3); blotch(g, w, h, 10, 'rgba(170,200,230,.3)', 10, 40); }
    else if (kind === 'rocks') { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const sh = 30 + Math.random() * 40; g.fillStyle = `rgb(${sh + 10},${sh},${sh - 5})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 18, 8 + Math.random() * 12, Math.random() * 3, 0, 7); g.fill(); } speckle(g, w, h, 3000, ['rgba(0,0,0,.3)']); }
    else if (kind === 'rail') { g.clearRect(0, 0, w, h); g.fillStyle = '#c8a24a'; g.fillRect(0, 2, w, 12); g.fillRect(0, 60, w, 6); for (let x = 4; x < w; x += 42) g.fillRect(x, 0, 7, h); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 3, w, 3); }
  });
  const t = tex(c, 1); t.repeat.set(1, 1);
  return std(0xffffff, kind === 'rail' ? 0.3 : 0.9, kind === 'rail' ? 0.8 : 0, { map: t, transparent: kind === 'rail', alphaTest: kind === 'rail' ? 0.5 : 0, side: kind === 'rail' ? THREE.DoubleSide : THREE.FrontSide });
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
const place = (g, m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
function lumpyIco() { const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + Math.sin(v.x * 4) * Math.cos(v.z * 3) * 0.12 + Math.sin(v.y * 5) * 0.08); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

export const WALL_H = 2.6, CUT_H = 0.45;
// the small bucket a Bucket carries around (with a scooped puddle's eyes peeking out)
export function carryBucket() {
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0x9aa3aa, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide });
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.42, 20, 1, true), metal); pail.castShadow = true; g.add(pail);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), metal); bot.rotation.x = Math.PI / 2; bot.position.y = -0.21; g.add(bot);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshPhysicalMaterial({ color: 0x5fb6ee, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.85 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.16; g.add(water);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })); e.position.set(sx * 0.08, 0.19, 0.05); g.add(e); const pp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0x000000 })); pp.position.set(sx * 0.08, 0.2, 0.1); g.add(pp); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 20, Math.PI), metal); handle.position.y = 0.2; g.add(handle);
  return g;
}

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 400);
    this.drips = []; this.spots = []; this.rings = []; this.steam = [];
    this.t = 0;
  }
  build(map, envTex, opts = {}) {
    const T = this.T = THEMES[map.def.theme], S = this.scene;
    this.map = map; this.lobby = !!opts.lobby;
    S.background = new THREE.Color(T.bg);
    S.environment = envTex;
    S.fog = map.def.theme === 'sky' ? new THREE.Fog(T.fog, 60, 160) : new THREE.Fog(T.fog, 38, 80);
    const { W, H, grid } = map;
    const outRoom = (i, j) => { const r = map.roomOf[j * W + i]; return r >= 0 && map.rooms[r].out; };
    // ---------------- the outside: lava, clouds, or open ground with trees
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
      // the ship's hull under the decks
      const hull = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 3, H - 6), std(0x5a3a20, 0.8)); hull.position.set(W / 2, -1.55, H / 2); S.add(hull);
    } else {
      const gc = floorCanvases(T.ground, T.groundC);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(W + 120, H + 120), std(0xffffff, 1, 0, { map: tex(gc.map, (W + 120) / 5), envMapIntensity: 0.2 }));
      g.rotation.x = -Math.PI / 2; g.position.set(W / 2, -0.02, H / 2); g.receiveShadow = true; S.add(g);
    }
    this.nature(map, T);
    // ---------------- floors: indoor rooms, outdoor areas, halls
    const fr = floorCanvases(T.floor, T.floorC), hr = floorCanvases(T.hall, T.hallC), or = floorCanvases(T.outFloor, T.outC);
    const floorMat = std(0xffffff, 1, 0.05, { map: tex(fr.map), roughnessMap: tex(fr.rough, 1, false), envMapIntensity: 0.35 });
    const hallMat = std(0xffffff, 1, T.hall === 'grate' || T.hall === 'plate' ? 0.5 : 0.05, { map: tex(hr.map), roughnessMap: tex(hr.rough, 1, false), envMapIntensity: 0.35 });
    const outMat = std(0xffffff, 1, 0, { map: tex(or.map), roughnessMap: tex(or.rough, 1, false), envMapIntensity: 0.25 });
    const fGeos = [], hGeos = [], oGeos = [];
    for (const [x0, z0, x1, z1] of map.halls) { const p = new THREE.PlaneGeometry(x1 - x0, z1 - z0); p.rotateX(-Math.PI / 2); p.translate((x0 + x1) / 2, 0.002, (z0 + z1) / 2); hGeos.push(p); }
    for (const r of map.rooms) { const p = new THREE.PlaneGeometry(r.w, r.d); p.rotateX(-Math.PI / 2); p.translate(r.x, 0.006, r.z); (r.out ? oGeos : fGeos).push(p); }
    const mergeUV = (geos, s) => { const g = mergeGeometries(geos); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s); return g; };
    for (const [geos, mat] of [[fGeos, floorMat], [hGeos, hallMat], [oGeos, outMat]]) if (geos.length) { const m = new THREE.Mesh(mergeUV(geos, 4), mat); m.receiveShadow = true; S.add(m); }
    // ---------------- walls (indoor) and fences (outdoor areas): runs of edges between floor and solid
    const walk = (i, j) => i >= 0 && j >= 0 && i < W && j < H && grid[j * W + i] !== 0;
    const tall = [], low = [], caps = [], fence = [];
    const TH = 0.3, FENCE_H = 1.05;
    const addWall = (x0, z0, x1, z1, h, out) => {
      const w = Math.max(x1 - x0, TH), d = Math.max(z1 - z0, TH);
      if (out) { const fh = Math.min(h, FENCE_H); const g = new THREE.BoxGeometry(w, fh, d); g.translate((x0 + x1) / 2, fh / 2, (z0 + z1) / 2); fence.push(g); return; }
      const g = new THREE.BoxGeometry(w, h, d); g.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      (h > 1 ? tall : low).push(g);
      const c = new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02); c.translate((x0 + x1) / 2, h + 0.03, (z0 + z1) / 2); caps.push(c);
    };
    for (let j = 0; j < H; j++) {
      for (const [dj, off, h] of [[-1, 0, WALL_H], [1, 1, CUT_H]]) {
        let start = -1, type = false;
        for (let i = 0; i <= W; i++) {
          const edge = i < W && walk(i, j) && !walk(i, j + dj), o = edge && outRoom(i, j);
          if (start >= 0 && (!edge || o !== type)) { const z = j + off + (dj < 0 ? -TH / 2 : TH / 2); addWall(start - TH, z - TH / 2, i + TH, z + TH / 2, h, type); start = -1; }
          if (edge && start < 0) { start = i; type = o; }
        }
      }
    }
    for (let i = 0; i < W; i++) {
      for (const [di, off] of [[-1, 0], [1, 1]]) {
        let start = -1, type = false;
        for (let j = 0; j <= H; j++) {
          const edge = j < H && walk(i, j) && !walk(i + di, j), o = edge && outRoom(i, j);
          if (start >= 0 && (!edge || o !== type)) { const x = i + off + (di < 0 ? -TH / 2 : TH / 2); addWall(x - TH / 2, start, x + TH / 2, j, WALL_H, type); start = -1; }
          if (edge && start < 0) { start = j; type = o; }
        }
      }
    }
    const wc = wallCanvas(T);
    const wallMat = std(0xffffff, 0.75, 0.05, { map: tex(wc, 1), envMapIntensity: 0.4 });
    wallMat.map.repeat.set(0.5, 1);
    if (tall.length) { const tallM = new THREE.Mesh(worldUV(mergeGeometries(tall), 2), wallMat); tallM.castShadow = tallM.receiveShadow = true; S.add(tallM); }
    if (low.length) { const lowM = new THREE.Mesh(worldUV(mergeGeometries(low), 2), wallMat); lowM.castShadow = lowM.receiveShadow = true; S.add(lowM); }
    if (caps.length) { const capM = new THREE.Mesh(mergeGeometries(caps), std(T.wallTop, 0.5, 0.2)); capM.receiveShadow = true; S.add(capM); }
    if (fence.length) {
      const fg = mergeGeometries(fence), p = fg.attributes.position, n = fg.attributes.normal, uv = fg.attributes.uv;
      for (let i = 0; i < p.count; i++) { const along = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i); uv.setXY(i, along / 2, Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) / 2 : p.getY(i) / FENCE_H); }
      const fm = new THREE.Mesh(fg, fenceMaterial(T.fence)); fm.castShadow = fm.receiveShadow = true; S.add(fm);
    }
    // ---------------- lighting
    S.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], 0.42));
    this.amb = S.children[S.children.length - 1];
    const sun = this.sun = new THREE.DirectionalLight(T.light, 0.8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    S.add(sun, sun.target);
    this.lamps = [];
    for (const r of map.rooms) if (!r.out) this.lamps.push(new THREE.Vector3(r.x, 2.3, r.z));
    this.pool = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(T.light, 30, 18, 1.6); l.position.set(0, -50, 0); S.add(l); this.pool.push(l); }
    this.alarm = new THREE.PointLight(0xff2a10, 0, 30, 1.2); S.add(this.alarm);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: T.light, emissiveIntensity: 1.4 });
    this.stripMat = stripMat;
    for (const r of map.rooms) if (!r.out) { const s = box(Math.min(4, r.w - 4), 0.08, 0.06, stripMat, r.x, WALL_H - 0.25, r.z0 + 0.05); s.castShadow = false; S.add(s); }
    // ---------------- stations, button, vents, props, decor
    this.stations = new Map();
    this.markers = [];
    this.ventMeshes = []; this.valveMeshes = [];
    if (!this.lobby) {
      for (const t of map.tasks) { const m = this.station(t.type, t); this.stations.set(t.id, m); }
      this.lightsPanel = this.station('lights', map.lights);
      this.valveMeshes = map.valves.map(v => this.station('cool', v));
      this.buildButton(map.button);
      this.ventMeshes = map.vents.map(v => this.buildVent(v));
    } else this.buildFountain(map.button);
    for (const p of map.props) this.prop(p);
    this.decor(map, T);
    this.initFx();
    if (!this.lobby && map.dumps) this.buildDumps(map.dumps);
    // task marker rings (pooled)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    this.markerGeo = new THREE.RingGeometry(0.48, 0.6, 40); this.markerGeo.rotateX(-Math.PI / 2);
    this.markerMat = ringMat;
    // room name decals painted on floors
    if (!this.lobby) for (const r of map.rooms) {
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
  // ------------------------------------------------------------------ outside: trees, rocks, bushes beyond the walls
  nature(map, T) {
    if (T.nature === 'none') return;
    const { W, H } = map, walk = (i, j) => i >= 0 && j >= 0 && i < W && j < H && map.grid[j * W + i] !== 0;
    const spots = [];
    for (let z = -14; z < H + 14; z += 2.4) for (let x = -14; x < W + 14; x += 2.4) {
      const px = x + Math.random() * 1.8, pz = z + Math.random() * 1.8;
      if (Math.random() > 0.5) continue;
      let ok = true; for (let dj = -3; dj <= 3 && ok; dj++) for (let di = -3; di <= 3; di++) if (walk(Math.floor(px) + di, Math.floor(pz) + dj)) { ok = false; break; }
      if (ok) spots.push([px, pz]);
    }
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const inst = (geo, mat, list, f) => { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((sp, i) => { f(dummy, sp, i, col); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (m.instanceColor || col.r >= 0) m.setColorAt(i, col); }); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); return m; };
    const trees = spots.filter(() => Math.random() < 0.6), shrubs = spots.filter(s => !trees.includes(s));
    if (T.nature === 'rocks') {
      inst(new THREE.DodecahedronGeometry(1, 1), std(0xffffff, 0.95, 0, { envMapIntensity: 0.25 }), spots, (d, [x, z], i, c) => { const s = 0.6 + Math.random() * 1.8; d.position.set(x, -0.4 + s * 0.3, z); d.scale.set(s, s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6)); d.rotation.set(Math.random(), Math.random() * 6, Math.random()); const v = 0.12 + Math.random() * 0.1; c.setRGB(v * 1.2, v, v * 0.9, THREE.SRGBColorSpace); });
      return;
    }
    const trunkMat = std(0xffffff, 0.9, 0, { envMapIntensity: 0.25 });
    inst(new THREE.CylinderGeometry(0.16, 0.24, 1, 8), trunkMat, trees, (d, [x, z], i, c) => { const h = 1.6 + Math.random() * 1.6; d.position.set(x, h / 2, z); d.scale.set(1, h, 1); d.rotation.set(0, 0, 0); c.set(T.nature === 'blossom' ? 0x4a3020 : 0x5a3a20); trees[i].h = h; });
    if (T.nature === 'pines') {
      for (let k = 0; k < 3; k++) inst(new THREE.ConeGeometry(1, 1.4, 9), std(0xffffff, 0.8, 0, { envMapIntensity: 0.25 }), trees, (d, sp, i, c) => { const s = (1.4 - k * 0.35) * (0.8 + (i % 5) * 0.08); d.position.set(sp[0], sp.h * 0.55 + k * 0.85, sp[1]); d.scale.set(s, 1, s); d.rotation.set(0, i, 0); c.setRGB(0.12 + k * 0.25, 0.32 + k * 0.2, 0.22 + k * 0.25, THREE.SRGBColorSpace); });
    } else {
      const leaf = lumpyIco();
      inst(leaf, std(0xffffff, 0.85, 0, { envMapIntensity: 0.25 }), trees, (d, sp, i, c) => { const s = 1.1 + Math.random() * 0.9; d.position.set(sp[0], sp.h + s * 0.6, sp[1]); d.scale.set(s, s * 0.85, s); d.rotation.set(Math.random(), Math.random() * 6, 0); if (T.nature === 'blossom' && i % 2) c.setHSL(0.93, 0.6, 0.75 + Math.random() * 0.1, THREE.SRGBColorSpace); else c.setHSL(0.27 + Math.random() * 0.06, 0.5, 0.25 + Math.random() * 0.12, THREE.SRGBColorSpace); });
    }
    inst(lumpyIco(), std(0xffffff, 0.85, 0, { envMapIntensity: 0.25 }), shrubs, (d, [x, z], i, c) => { const s = 0.5 + Math.random() * 0.6; d.position.set(x, s * 0.4, z); d.scale.set(s * 1.3, s, s * 1.2); d.rotation.set(0, Math.random() * 6, 0); if (T.nature === 'pines') c.setRGB(0.9, 0.94, 0.98, THREE.SRGBColorSpace); else c.setHSL(0.28 + Math.random() * 0.05, 0.45, 0.22 + Math.random() * 0.1, THREE.SRGBColorSpace); });
  }
  // ------------------------------------------------------------------ decor: posters, pipes, rugs, clocks, ponds, flowers, grass
  decor(map, T) {
    const S = this.scene, th = map.def.theme, { W } = map;
    const floor = (i, j) => map.grid[j * W + i] === 1, solid = (i, j) => map.grid[j * W + i] === 0;
    const POSTERS = ['STAY WET', 'NO HEATING', 'REPORT SUSPICIOUS PUDDLES', 'HYDRATE', '☂ SAFETY FIRST', 'DRIP DRIP', 'WASH YOUR HANDS', 'EVAPORATION IS NOT AN OPTION'];
    for (const r of map.rooms) {
      if (r.out) continue;
      // posters on the north wall, away from stations and doorways
      const free = []; for (let i = r.x0 + 1; i < r.x1 - 1; i++) if (floor(i, r.z0) && solid(i, r.z0 - 1) && floor(i - 1, r.z0) && floor(i + 1, r.z0)) free.push(i);
      for (let k = 0; k < Math.min(2, free.length >> 2); k++) {
        const i = free[Math.floor((k + 0.5) / 2 * free.length)];
        const txt = POSTERS[Math.floor(Math.random() * POSTERS.length)], hue = Math.floor(Math.random() * 360);
        const c = canvas(256, 320, (g, w, h) => {
          g.fillStyle = `hsl(${hue},55%,45%)`; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(12, 12, w - 24, h - 24);
          g.fillStyle = '#bfe6ff'; g.beginPath(); g.ellipse(w / 2, 150, 70, 80, 0, Math.PI, 0); g.lineTo(w / 2 + 90, 200); g.lineTo(w / 2 - 90, 200); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 - 22, 120, 18, 0, 7); g.arc(w / 2 + 22, 120, 18, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2 - 18, 124, 8, 0, 7); g.arc(w / 2 + 26, 124, 8, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.font = '900 26px "Avenir Next", sans-serif'; g.textAlign = 'center';
          const words = txt.split(' '); let line = '', y = 248; for (const wd of words) { if (g.measureText(line + wd).width > 220) { g.fillText(line, w / 2, y); y += 30; line = ''; } line += wd + ' '; } g.fillText(line, w / 2, y);
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), std(0xffffff, 0.7, 0, { map: tex(c) })); m.position.set(i + 0.5, 1.55, r.z0 + 0.02); S.add(m);
        const fr = box(0.88, 1.08, 0.03, std(0x2a2a2a, 0.5, 0.4), i + 0.5, 1.55, r.z0 + 0.005); fr.castShadow = false; S.add(fr);
      }
      // pipes along the top of the north wall
      if (th === 'pump' || th === 'magma' || th === 'sky') for (const [y, rad, colr] of [[2.25, 0.08, 0x8a949c], [2.05, 0.05, th === 'magma' ? 0xc0501a : 0x2a6aa0]]) {
        const pipe = cyl(rad, rad, r.w - 0.4, std(colr, 0.35, 0.8), r.x, y, r.z0 + 0.15, 12); pipe.rotation.z = Math.PI / 2; S.add(pipe);
        for (let x = r.x0 + 1; x < r.x1; x += 3) S.add(box(0.06, 0.14, 0.2, std(0x444444, 0.5, 0.6), x, y, r.z0 + 0.1));
      }
      // rug in the middle
      if (th === 'spa' || th === 'sky' || th === 'ice' || Math.random() < 0.3) {
        const hue = Math.floor(Math.random() * 360);
        const c = canvas(256, 160, (g, w, h) => { g.fillStyle = `hsl(${hue},45%,35%)`; g.fillRect(0, 0, w, h); g.strokeStyle = `hsl(${hue + 40},60%,70%)`; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52); for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${hue + 180},50%,60%)`; g.beginPath(); g.arc(50 + i * 39, h / 2, 9, 0, 7); g.fill(); } for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(5, r.w - 5), Math.min(3.2, r.d - 5)), std(0xffffff, 0.95, 0, { map: tex(c) })); rug.rotation.x = -Math.PI / 2; rug.position.set(r.x + (r.name === map.button.room ? 0 : 0), 0.009, r.z + (r.name === map.button.room ? 2.6 : 0)); rug.receiveShadow = true; S.add(rug);
      }
      // wall clock
      if (Math.random() < 0.45 && free.length > 6) { const i = free[free.length - 2]; const clk = cyl(0.25, 0.25, 0.05, std(0xf4f0e6, 0.4), i + 0.5, 2.0, r.z0 + 0.04, 24); clk.rotation.x = Math.PI / 2; S.add(clk); const hand = box(0.02, 0.18, 0.01, std(0x111111), i + 0.5, 2.06, r.z0 + 0.075); S.add(hand); }
    }
    // outdoor areas
    for (const r of map.rooms) {
      if (!r.out) continue;
      const kind = T.outFloor;
      if (kind === 'grass') {
        const tufts = []; for (let k = 0; k < r.w * r.d * 0.6; k++) { const x = r.x0 + Math.random() * r.w, z = r.z0 + Math.random() * r.d; if (floor(Math.floor(x), Math.floor(z))) tufts.push([x, z]); }
        const geo = new THREE.ConeGeometry(0.05, 0.28, 4); geo.translate(0, 0.14, 0);
        const m = new THREE.InstancedMesh(geo, std(0xffffff, 0.9), tufts.length * 3), d = new THREE.Object3D(), c = new THREE.Color();
        let n = 0; for (const [x, z] of tufts) for (let b = 0; b < 3; b++) { d.position.set(x + (Math.random() - 0.5) * 0.15, 0, z + (Math.random() - 0.5) * 0.15); d.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6); d.scale.setScalar(0.6 + Math.random() * 0.8); d.updateMatrix(); m.setMatrixAt(n, d.matrix); c.setHSL(0.25 + Math.random() * 0.06, 0.55, 0.25 + Math.random() * 0.15, THREE.SRGBColorSpace); m.setColorAt(n++, c); }
        m.receiveShadow = true; S.add(m);
        // flower patches
        for (let k = 0; k < r.w * r.d / 30; k++) { const x = r.x0 + 1 + Math.random() * (r.w - 2), z = r.z0 + 1 + Math.random() * (r.d - 2); const colr = [0xff5a8a, 0xffe14a, 0xffffff, 0xa08aff][k % 4]; for (let f = 0; f < 6; f++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), std(colr, 0.6)); fl.position.set(x + (Math.random() - 0.5) * 0.7, 0.18, z + (Math.random() - 0.5) * 0.7); S.add(fl); } }
      }
      if (kind === 'basalt') {
        for (let k = 0; k < r.w * r.d / 25; k++) { const v = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff4a0a, emissiveIntensity: 1.2 + Math.random() })); v.rotation.x = -Math.PI / 2; v.position.set(r.x0 + 1 + Math.random() * (r.w - 2), 0.012, r.z0 + 1 + Math.random() * (r.d - 2)); v.scale.set(1, 0.4 + Math.random(), 1); S.add(v); }
      }
      if (kind === 'snow') {
        for (let k = 0; k < r.w * r.d / 20; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf4f8fc, 0.9)); d.scale.set(1 + Math.random(), 0.25, 0.7 + Math.random()); d.position.set(r.x0 + 1 + Math.random() * (r.w - 2), 0, r.z0 + 1 + Math.random() * (r.d - 2)); d.receiveShadow = true; S.add(d); }
      }
      // ponds: shallow water you can splash through
      if (/Pond|Bath|Garden|Courtyard/.test(r.name)) {
        const n = /Pond/.test(r.name) ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const px = r.x + (n > 1 ? (k ? 1 : -1) * r.w * 0.25 : r.w * 0.22), pz = r.z + (n > 1 ? 0 : r.d * 0.18), rad = Math.min(r.d * 0.28, 3.2);
          if (/Courtyard/.test(r.name)) continue;
          const water = new THREE.Mesh(new THREE.CircleGeometry(rad, 40), new THREE.MeshPhysicalMaterial({ color: /Bath/.test(r.name) ? 0x5ac0d0 : 0x2a6a80, roughness: 0.04, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.6 }));
          water.rotation.x = -Math.PI / 2; water.position.set(px, 0.025, pz); water.scale.set(1.3, 1, 1); S.add(water); (this.ponds ||= []).push(water);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.16, 8, 40), std(0x8a857a, 0.9)); rim.rotation.x = -Math.PI / 2; rim.position.set(px, 0.04, pz); rim.scale.set(1.3, 1, 1); rim.receiveShadow = true; S.add(rim);
          if (/Garden/.test(r.name)) for (let f = 0; f < 3; f++) { const koi = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), std(f % 2 ? 0xff7a2a : 0xffffff, 0.4)); koi.scale.set(1, 0.4, 2.2); koi.position.set(px, 0.015, pz); koi.userData.koi = { px, pz, r: rad * 0.6, a: f * 2 }; S.add(koi); (this.kois ||= []).push(koi); }
        }
      }
    }
  }
  buildFountain(b) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    const stone = std(0x7a756c, 0.9);
    g.add(cyl(1.9, 2.0, 0.55, stone, 0, 0.275, 0, 40));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.05, 40), new THREE.MeshPhysicalMaterial({ color: 0x4ab0e0, roughness: 0.03, transparent: true, opacity: 0.8, clearcoat: 1 })); water.position.y = 0.5; g.add(water);
    g.add(cyl(0.18, 0.25, 1.4, stone, 0, 1.0, 0, 16));
    g.add(cyl(0.7, 0.4, 0.2, stone, 0, 1.7, 0, 28));
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.6, 1.3, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); jet.position.y = 1.15; g.add(jet);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.6 })); top.position.y = 2.0; g.add(top);
    this.fountain = { g, jet, top }; this.scene.add(g);
    // the wardrobe: a standing mirror and a clothes rack on the north side
    const r = this.map.rooms[0], wx = r.x, wz = r.z0 + 1.2;
    const w = new THREE.Group(); w.position.set(wx, 0, wz);
    w.add(box(1.3, 2.1, 0.12, std(0x6a4020, 0.6), -0.9, 1.05, 0));
    const mir = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.85), new THREE.MeshStandardMaterial({ color: 0xdfefff, metalness: 1, roughness: 0.05, envMapIntensity: 2 })); mir.position.set(-0.9, 1.05, 0.07); w.add(mir);
    w.add(box(1.6, 0.05, 0.05, std(0x999999, 0.3, 0.9), 0.8, 1.7, 0));
    for (const x of [0.05, 1.55]) w.add(box(0.05, 1.7, 0.05, std(0x999999, 0.3, 0.9), x, 0.85, 0));
    ['#d63030', '#1ab0a0', '#ff7a10', '#3a5f9a', '#2a8a3a'].forEach((c, i) => { const sh = box(0.28, 0.5, 0.05, std(c, 0.85), 0.2 + i * 0.3, 1.38, 0.02); sh.rotation.y = 0.3; w.add(sh); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), std(0xffffff, 0.6, 0, { map: tex(canvas(256, 64, (g2, w2, h2) => { g2.fillStyle = '#2a1a10'; g2.fillRect(0, 0, w2, h2); g2.fillStyle = '#ffd84a'; g2.font = '900 34px "Avenir Next", sans-serif'; g2.textAlign = 'center'; g2.fillText('WARDROBE', w2 / 2, 45); })) })); sign.position.set(0, 2.45, 0); w.add(sign);
    this.scene.add(w); this.wardrobe = { x: wx, z: wz + 1.2 };
    for (let i = Math.floor(wx - 2); i <= Math.floor(wx + 2); i++) this.map.grid[Math.floor(wz) * this.map.W + i] = 2;
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
    const room = this.map.rooms.find(r => r.name === p.room), out = room && room.out;
    if (this.lobby && Math.abs(p.sx - room.x) < 3.5 && p.sz < room.z0 + 2) return;
    const g = new THREE.Group(), th = this.map.def.theme, k = p.kind % 10, k6 = p.kind % 6;
    g.position.set(p.sx, 0, p.sz); g.rotation.y = Math.atan2(p.dx, p.dz) + (p.kind % 3 - 1) * 0.15;
    const wood = std(0x8a6236, 0.75), steel = std(0x7c848c, 0.35, 0.8), paint = std(this.T.trim, 0.5, 0.3);
    const leafy = (c, x, y, z, s) => { const m = new THREE.Mesh(lumpyIco(), std(c, 0.85)); m.position.set(x, y, z); m.scale.setScalar(s); g.add(m); };
    if (out) {
      if (th === 'ice') {
        if (k6 === 0) { g.add(cyl(0.12, 0.16, 1, std(0x5a3a20, 0.9), 0, 0.5, 0)); for (let i = 0; i < 3; i++) place(g, new THREE.Mesh(new THREE.ConeGeometry(0.8 - i * 0.2, 0.9, 9), std(i === 2 ? 0xeef4f8 : 0x2a5a3a, 0.8)), 0, 1.1 + i * 0.6, 0); }
        else if (k6 === 1) { for (const [y, r] of [[0.35, 0.38], [0.95, 0.28], [1.4, 0.2]]) place(g, new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), std(0xf6f9fc, 0.9)), 0, y, 0); const n = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), std(0xff7a1a)); n.rotation.x = Math.PI / 2; n.position.set(0, 1.4, 0.25); g.add(n); g.add(cyl(0.16, 0.16, 0.25, std(0x111111), 0, 1.65, 0)); for (const s of [-1, 1]) place(g, new THREE.Mesh(new THREE.SphereGeometry(0.03), std(0x111111)), s * 0.07, 1.47, 0.18); }
        else if (k6 === 2) { const ice = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1 })); ice.position.y = 0.45; g.add(ice); }
        else if (k6 === 3) { g.add(box(0.85, 0.85, 0.85, wood, 0, 0.425, 0)); g.add(box(0.9, 0.12, 0.9, std(0xf4f8fc, 0.9), 0, 0.9, 0)); }
        else if (k6 === 4) { g.add(cyl(0.05, 0.07, 2.6, std(0x333333, 0.5, 0.7), 0, 1.3, 0)); place(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0a0, emissiveIntensity: 2 })), 0, 2.65, 0); }
        else { const sled = box(0.5, 0.1, 1.1, std(0xc02a2a, 0.5), 0, 0.2, 0); g.add(sled); for (const s of [-1, 1]) g.add(box(0.04, 0.04, 1.2, steel, s * 0.22, 0.05, 0)); }
      } else if (th === 'magma') {
        if (k6 < 2) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 1), std(0x2a2522, 0.95)); r.position.y = 0.4; r.scale.set(1, 0.8 + k6 * 0.4, 1.1); g.add(r); }
        else if (k6 === 2) { g.add(cyl(0.45, 0.6, 0.4, std(0x221a16, 0.95), 0, 0.2, 0)); place(g, new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshStandardMaterial({ color: 0x300800, emissive: 0xff5a10, emissiveIntensity: 2.5 })), 0, 0.41, 0); g.children[g.children.length - 1].rotation.x = -Math.PI / 2; }
        else if (k6 === 3) { g.add(cyl(0.08, 0.14, 1.6, std(0x1a1210, 0.95), 0, 0.8, 0)); for (const [a, l] of [[0.8, 0.7], [-0.6, 0.5]]) { const br = cyl(0.04, 0.06, l, std(0x1a1210, 0.95), Math.sin(a) * l * 0.4, 1.2, 0); br.rotation.z = -a; g.add(br); } }
        else if (k6 === 4) { g.add(cyl(0.32, 0.32, 0.95, std(0x3a3a3a, 0.5, 0.6), 0, 0.475, 0)); g.add(cyl(0.33, 0.33, 0.12, paint, 0, 0.7, 0)); }
        else { g.add(cyl(0.04, 0.04, 1.3, steel, 0, 0.65, 0)); const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), std(0xffffff, 0.6, 0, { map: tex(canvas(128, 110, (c, w, h) => { c.fillStyle = '#ffcc00'; c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w - 4, h - 4); c.lineTo(4, h - 4); c.fill(); c.fillStyle = '#111'; c.font = '900 60px sans-serif'; c.textAlign = 'center'; c.fillText('!', w / 2, h - 18); })), transparent: true, side: THREE.DoubleSide })); sg.position.set(0, 1.4, 0.05); g.add(sg); }
      } else if (th === 'sky') {
        if (k6 === 0) { g.add(cyl(0.32, 0.32, 0.9, std(0x7a4a22, 0.8), 0, 0.45, 0)); for (const y of [0.2, 0.7]) g.add(cyl(0.33, 0.33, 0.05, steel, 0, y, 0)); }
        else if (k6 === 1) { g.add(box(0.85, 0.85, 0.85, wood, 0, 0.425, 0)); g.add(box(0.6, 0.6, 0.6, wood, 0.1, 1.15, 0)); }
        else if (k6 === 2) { const rope = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 24), std(0xc8a870, 0.9)); rope.rotation.x = Math.PI / 2; rope.position.y = 0.08; g.add(rope); const r2 = rope.clone(); r2.scale.setScalar(0.7); r2.position.y = 0.2; g.add(r2); }
        else if (k6 === 3) { g.add(box(0.08, 1.4, 0.08, wood, 0, 0.7, -0.2)); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 24), std(0xff5a2a, 0.6)); ring.position.set(0, 1.0, -0.1); g.add(ring); }
        else if (k6 === 4) { g.add(cyl(0.05, 0.05, 1.2, steel, 0, 0.6, 0)); const sc = cyl(0.06, 0.1, 0.8, std(0xc8a24a, 0.3, 0.9), 0, 1.3, 0.15); sc.rotation.x = 1.1; g.add(sc); }
        else { g.add(cyl(0.35, 0.4, 0.8, std(0x5a3a20, 0.7), 0, 0.4, 0)); for (let i = 0; i < 6; i++) { const sp = box(0.6, 0.06, 0.06, wood, 0, 0.75, 0); sp.rotation.y = i * Math.PI / 3; g.add(sp); } }
      } else {
        // grass areas (pump, spa, yard)
        const blossom = th === 'spa';
        if (k6 === 0) { g.add(cyl(0.14, 0.2, 1.6, std(0x5a3a20, 0.9), 0, 0.8, 0)); leafy(blossom ? 0xf2a8c8 : 0x3a7a2a, 0, 2.0, 0, 0.95); leafy(blossom ? 0xf8c0d8 : 0x4a8a32, 0.4, 1.7, 0.2, 0.6); }
        else if (k6 === 1) { leafy(0x3e7a2c, 0, 0.45, 0, 0.55); leafy(0x4a8a34, 0.35, 0.35, 0.1, 0.4); }
        else if (k6 === 2) { g.add(box(1.5, 0.08, 0.45, wood, 0, 0.45, 0)); g.add(box(1.5, 0.4, 0.06, wood, 0, 0.7, -0.2)); for (const x of [-0.65, 0.65]) g.add(box(0.06, 0.45, 0.4, std(0x222222, 0.5, 0.7), x, 0.22, 0)); }
        else if (k6 === 3) { if (blossom) { g.add(box(0.4, 0.15, 0.4, std(0x9a948a, 0.9), 0, 0.075, 0)); g.add(cyl(0.08, 0.1, 0.6, std(0x9a948a, 0.9), 0, 0.45, 0)); g.add(box(0.4, 0.35, 0.4, std(0x9a948a, 0.9), 0, 0.92, 0)); place(g, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.42), new THREE.MeshStandardMaterial({ color: 0x331a00, emissive: 0xffa040, emissiveIntensity: 1.5 })), 0, 0.92, 0); place(g, new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 4), std(0x9a948a, 0.9)), 0, 1.25, 0); } else { g.add(cyl(0.05, 0.07, 2.6, std(0x2a2a2a, 0.5, 0.7), 0, 1.3, 0)); place(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0a0, emissiveIntensity: 2 })), 0, 2.65, 0); } }
        else if (k6 === 4) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), std(0x8a857a, 0.9)); r.position.y = 0.3; r.scale.set(1.2, 0.7, 1); g.add(r); }
        else { if (blossom) { for (let i = 0; i < 7; i++) { const b = cyl(0.04, 0.05, 2 + Math.random(), std(0x8a9a3a, 0.6), (Math.random() - 0.5) * 0.5, 1.1, (Math.random() - 0.5) * 0.5, 8); g.add(b); } } else { g.add(cyl(0.3, 0.25, 0.5, std(0x9a5a30, 0.8), 0, 0.25, 0)); for (let i = 0; i < 9; i++) place(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std([0xff5a8a, 0xffe14a, 0xffffff][i % 3], 0.6)), Math.cos(i) * 0.18, 0.55 + (i % 3) * 0.05, Math.sin(i) * 0.18); } }
      }
    } else if (th === 'ice' && k < 2) { const ice = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1 })); ice.position.y = 0.45; ice.scale.y = 0.85; g.add(ice); }
    else if (th === 'spa' && k < 2) { g.add(cyl(0.3, 0.22, 0.5, std(0xb05a30, 0.8), 0, 0.25, 0)); for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 6), std(0x2f7a32, 0.7)); l.position.set(Math.cos(i) * 0.12, 0.85, Math.sin(i) * 0.12); l.rotation.set(Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5); g.add(l); } }
    else if (th === 'magma' && k < 2) { g.add(cyl(0.32, 0.32, 0.95, std(0x3a3a3a, 0.5, 0.6), 0, 0.475, 0)); g.add(cyl(0.33, 0.33, 0.12, paint, 0, 0.7, 0)); }
    else if (k === 0 || k === 3) { g.add(box(0.85, 0.85, 0.85, wood, 0, 0.425, 0)); g.add(box(0.87, 0.08, 0.87, std(0x5a3a1a, 0.8), 0, 0.85, 0)); if (k === 3) g.add(box(0.6, 0.6, 0.6, wood, 0.05, 1.15, 0)); }
    else if (k === 1) { g.add(cyl(0.3, 0.3, 0.9, std(0x2a5ea8, 0.45, 0.4), 0, 0.45, 0)); g.add(cyl(0.31, 0.31, 0.05, steel, 0, 0.3, 0)); g.add(cyl(0.31, 0.31, 0.05, steel, 0, 0.62, 0)); }
    else if (k === 2) { g.add(box(0.8, 1.9, 0.5, std(0x4e5a66, 0.5, 0.6), 0, 0.95, -0.1)); g.add(box(0.02, 1.7, 0.02, std(0x222, 0.4), 0, 0.95, 0.16)); }
    else if (k === 4) { g.add(box(1.0, 0.06, 0.6, steel, 0, 0.9, -0.1)); g.add(box(1.0, 0.06, 0.6, steel, 0, 0.45, -0.1)); for (const [x, z] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.15], [0.45, 0.15]]) g.add(box(0.05, 1.8, 0.05, steel, x, 0.9, z)); g.add(box(0.3, 0.3, 0.3, wood, -0.2, 1.08, -0.1)); g.add(cyl(0.12, 0.12, 0.3, std(0xd02020, 0.5), 0.2, 0.6, -0.1)); }
    else if (k === 5) { g.add(cyl(0.45, 0.45, 1.6, std(0x9aa2a8, 0.3, 0.8), 0, 0.8, 0)); place(g, new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, 6.3, 0, 1.57), std(0x9aa2a8, 0.3, 0.8)), 0, 1.6, 0) }
    else if (k === 6) { g.add(box(0.4, 1.0, 0.4, std(0xe8ecef, 0.4), 0, 0.5, 0)); const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 16), new THREE.MeshPhysicalMaterial({ color: 0x6ac8ff, roughness: 0.05, transparent: true, opacity: 0.6 })); bottle.position.y = 1.28; g.add(bottle); }
    else if (k === 7) { const cc = [0x7a2a3a, 0x2a4a7a, 0x4a6a3a][p.kind % 3]; g.add(box(1.7, 0.4, 0.75, std(cc, 0.9), 0, 0.3, 0)); g.add(box(1.7, 0.55, 0.2, std(cc, 0.9), 0, 0.65, -0.28)); for (const x of [-0.8, 0.8]) g.add(box(0.15, 0.55, 0.75, std(cc, 0.9), x, 0.4, 0)); }
    else if (k === 8) { g.add(cyl(0.25, 0.2, 0.45, std(0xd8d0c0, 0.7), 0, 0.225, 0)); const m = new THREE.Mesh(lumpyIco(), std(0x3a7a2a, 0.85)); m.position.y = 0.8; m.scale.set(0.42, 0.55, 0.42); g.add(m); }
    else { g.add(box(1.3, 0.06, 0.7, wood, 0, 0.78, -0.05)); for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.25], [0.6, 0.25]]) g.add(box(0.05, 0.78, 0.05, steel, x, 0.39, z)); g.add(box(0.5, 0.35, 0.04, std(0x111111, 0.4), 0, 1.0, -0.25)); place(g, new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x3ab0ff, emissiveIntensity: 1.3 })), 0, 1.0, -0.225); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }
  // ------------------------------------------------------------------ role effects
  initFx() {
    const S = this.scene;
    const flameTex = new THREE.CanvasTexture(canvas(64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.6, w * 0.55);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,220,120,.95)'); gr.addColorStop(0.55, 'rgba(255,120,20,.6)'); gr.addColorStop(1, 'rgba(200,40,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.9, h * 0.4, w, h * 0.75, w / 2, h); g.bezierCurveTo(0, h * 0.75, w * 0.1, h * 0.4, w / 2, 0); g.fill();
    }));
    const smokeTex = new THREE.CanvasTexture(canvas(64, 64, g => { for (let k = 0; k < 5; k++) { const x = 20 + Math.random() * 24, y = 20 + Math.random() * 24, r = 14 + Math.random() * 14; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); } }));
    this.flames = []; this.smokes = [];
    for (let i = 0; i < 180; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff })); sp.visible = false; S.add(sp); this.flames.push({ sp, v: new THREE.Vector3(), life: 0, max: 1 }); }
    for (let i = 0; i < 90; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0x555555 })); sp.visible = false; S.add(sp); this.smokes.push({ sp, v: new THREE.Vector3(), life: 0, max: 1, steam: false }); }
    this.emitters = [];
    this.fireLight = new THREE.PointLight(0xff7a20, 0, 14, 1.6); this.fireLight.position.set(0, -50, 0); S.add(this.fireLight);
    // rain streaks
    const N = 900, pos = new Float32Array(N * 6);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.55 }));
    this.rainLines.visible = false; this.rainLines.frustumCulled = false; S.add(this.rainLines); this.rainT = 0;
    this.rainDrops = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0 }));
  }
  fire(x, z, dur = 2.2, size = 1) { this.emitters.push({ kind: 'fire', x, z, t: 0, dur, size }); }
  steamFx(x, z, dur = 6) { this.emitters.push({ kind: 'steam', x, z, t: 0, dur, size: 0.7 }); }
  suck(x, z, kx, kz) { this.emitters.push({ kind: 'suck', x, z, kx, kz, t: 0, dur: 0.8 }); }
  swirl(x, z) { for (let i = 0; i < 4; i++) setTimeout(() => this.splash(x, z, 1.4 - i * 0.25), i * 120); this.burst(x, 0.3, z, 14, 1.2); }
  rainAt(x, z) { this.rainT = 4; this.rainC = { x, z }; for (const d of this.rainDrops) { d.x = x + (Math.random() - 0.5) * 34; d.z = z + (Math.random() - 0.5) * 26; d.y = Math.random() * 9; } }
  // a rainbow for a Unicorn: arches up from its foot at (x, z); the unicorn sits on top
  rainbowAt(id, x, z, on) {
    this.rainbows ||= new Map();
    let r = this.rainbows.get(id);
    if (!on) { if (r) r.visible = false; return null; }
    if (!r) {
      r = new THREE.Group();
      const cols = [0xff2a2a, 0xff8a1a, 0xffe32a, 0x3ad83a, 0x2a8aff, 0x5a3aff, 0xb04aff];
      cols.forEach((c, i) => { const band = new THREE.Mesh(new THREE.TorusGeometry(5.2 - i * 0.22, 0.12, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.4 })); r.add(band); });
      const sparkle = new THREE.PointLight(0xffd0ff, 6, 10, 1.6); sparkle.position.set(0, 5, 0); r.add(sparkle);
      this.scene.add(r); this.rainbows.set(id, r);
    }
    r.visible = true; r.position.set(x + 4.6, 0, z); r.userData.top = new THREE.Vector3(x + 4.6, 5.2, z);
    r.scale.y = Math.min(1, (r.scale.y || 0) + 0.05);
    return r;
  }
  buildDumps(dumps) {
    this.dumpMeshes = dumps.map(d => {
      const g = new THREE.Group(); g.position.set(d.x, 0, d.z);
      const metal = std(0x9aa3aa, 0.35, 0.85);
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.58, 1.1, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a939a, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide })); pail.position.y = 0.55; pail.castShadow = pail.receiveShadow = true; g.add(pail);
      g.add(cyl(0.58, 0.58, 0.04, metal, 0, 0.02, 0, 32));
      for (const y of [0.25, 0.85]) { const band = new THREE.Mesh(new THREE.TorusGeometry(y > 0.5 ? 0.72 : 0.62, 0.025, 6, 32), metal); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); }
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 32), metal); rim.rotation.x = Math.PI / 2; rim.position.y = 1.1; g.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.72, 28), new THREE.MeshPhysicalMaterial({ color: 0x1a4a6a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.9; g.add(water);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.025, 6, 24, Math.PI), metal); handle.position.y = 1.1; handle.rotation.y = 0.4; g.add(handle);
      this.scene.add(g); g.userData.water = water; return g;
    });
  }
  updateFx(dt) {
    if (!this.flames) return;
    let lightI = 0, lx = 0, lz = 0;
    for (const e of this.emitters) {
      e.t += dt; const k = 1 - e.t / e.dur;
      if (e.kind === 'fire') {
        lightI = Math.max(lightI, 26 * Math.max(0, k) * (0.8 + Math.random() * 0.4)); lx = e.x; lz = e.z;
        for (let n = 0; n < 3 * e.size; n++) { const f = this.flames.find(f => f.life <= 0); if (!f) break; f.life = f.max = 0.35 + Math.random() * 0.45; f.sp.visible = true; const a = Math.random() * 6.28, r = Math.random() * 0.45 * e.size; f.sp.position.set(e.x + Math.cos(a) * r, 0.1 + Math.random() * 0.4, e.z + Math.sin(a) * r); f.v.set((Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4); f.base = (0.35 + Math.random() * 0.5) * e.size * Math.max(0.3, k + 0.3); }
        if (Math.random() < 0.6) this.puffSmoke(e.x, e.z, false);
      } else if (e.kind === 'steam') { if (Math.random() < 0.25) this.puffSmoke(e.x + (Math.random() - 0.5) * 0.6, e.z + (Math.random() - 0.5) * 0.6, true); }
      else if (e.kind === 'suck') {
        for (let n = 0; n < 3; n++) { const d = this.drips.find(d => !d.on); if (!d) break; const T = 0.35; d.on = true; d.m.visible = true; d.m.position.set(e.x + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.5, e.z + (Math.random() - 0.5) * 0.5); d.v.set((e.kx - d.m.position.x) / T, (0.8 - d.m.position.y + 6 * T * T) / T, (e.kz - d.m.position.z) / T); d.m.scale.setScalar(1.3); }
      }
    }
    this.emitters = this.emitters.filter(e => e.t < e.dur);
    this.fireLight.intensity = lightI; if (lightI > 0) this.fireLight.position.set(lx, 1.2, lz);
    for (const f of this.flames) {
      if (f.life <= 0) continue; f.life -= dt; if (f.life <= 0) { f.sp.visible = false; continue; }
      const k = f.life / f.max; f.sp.position.addScaledVector(f.v, dt); f.v.x += (Math.random() - 0.5) * dt * 3;
      f.sp.scale.set(f.base * (0.6 + k * 0.5), f.base * (1.1 + (1 - k) * 0.8), 1);
      f.sp.material.opacity = Math.min(0.85, k * 1.4); f.sp.material.color.setRGB(1, 0.32 + k * 0.38, 0.06 + k * 0.18);
    }
    for (const m of this.smokes) {
      if (m.life <= 0) continue; m.life -= dt; if (m.life <= 0) { m.sp.visible = false; continue; }
      const k = 1 - m.life / m.max; m.sp.position.addScaledVector(m.v, dt); m.sp.scale.setScalar(0.5 + k * 2.2); m.sp.material.opacity = Math.sin(k * Math.PI) * (m.steam ? 0.35 : 0.5);
    }
    if (this.rainT > 0) {
      this.rainT -= dt; this.rainLines.visible = true;
      const P = this.rainLines.geometry.attributes.position, fade = Math.min(1, this.rainT);
      this.rainLines.material.opacity = 0.55 * fade;
      this.rainDrops.forEach((d, i) => { d.y -= dt * 14; if (d.y < 0) { if (Math.random() < 0.08) this.splash(d.x, d.z, 0.25); d.y = 8 + Math.random() * 2; } P.setXYZ(i * 2, d.x, d.y, d.z); P.setXYZ(i * 2 + 1, d.x + 0.03, d.y + 0.45, d.z + 0.05); });
      P.needsUpdate = true;
      if (Math.random() < dt * 20) this.wetSpot(this.rainC.x + (Math.random() - 0.5) * 30, this.rainC.z + (Math.random() - 0.5) * 22, 0.3 + Math.random() * 0.6, 10);
    } else this.rainLines.visible = false;
  }
  puffSmoke(x, z, steam) {
    const m = this.smokes.find(m => m.life <= 0); if (!m) return;
    m.life = m.max = steam ? 2.5 : 1.8 + Math.random(); m.steam = steam; m.sp.visible = true;
    m.sp.material.color.setHex(steam ? 0xe8eef2 : 0x3a3633);
    m.sp.position.set(x + (Math.random() - 0.5) * 0.4, steam ? 0.3 : 1.2, z + (Math.random() - 0.5) * 0.4); m.v.set((Math.random() - 0.5) * 0.3, steam ? 0.6 : 1.1, (Math.random() - 0.5) * 0.3);
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
    this.outK = (this.outK ?? 0) + ((opts.outdoor ? 1 : 0) - (this.outK ?? 0)) * Math.min(1, dt * 2);
    this.amb.intensity = 0.42 * (1 + this.outK * 0.45) * (opts.lightsOut ? 0.25 : 1);
    this.sun.intensity = 0.8 * (1 + this.outK * 0.6) * (opts.lightsOut ? 0.15 : 1);
    if (this.kois) for (const k of this.kois) { const u = k.userData.koi; u.a += dt * 0.5; k.position.set(u.px + Math.cos(u.a) * u.r * 1.3, 0.03, u.pz + Math.sin(u.a) * u.r); k.rotation.y = -u.a; }
    if (this.fountain) { this.fountain.jet.scale.y = 1 + Math.sin(t * 9) * 0.04; this.fountain.top.scale.setScalar(1 + Math.sin(t * 13) * 0.1); }
    this.stripMat.emissiveIntensity = opts.lightsOut ? 0.1 : 1.4;
    this.sun.position.set(focus.x + 4, 34, focus.z + 6); this.sun.target.position.set(focus.x, 0, focus.z);
    this.alarm.position.set(focus.x, 3, focus.z);
    this.alarm.intensity = opts.heat ? 25 * (0.5 + 0.5 * Math.sin(t * 6)) : 0;
    if (this.buttonMesh) this.buttonMesh.material.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.3;
    if (this.lavaTex) { this.lavaTex.offset.x = t * 0.004; this.lavaTex.offset.y = Math.sin(t * 0.1) * 0.02; }
    if (this.cloudTex) this.cloudTex.offset.x = t * 0.003;
    this.updateFx(dt);
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
