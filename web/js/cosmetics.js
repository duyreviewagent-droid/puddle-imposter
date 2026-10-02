// Hats, shirts and pets. 3D builders for the puddle + flat drawings for menus and meeting cards.
import * as THREE from 'three';
import { HATS, SHIRTS, PETS } from './cosdata.js';
export { HATS, SHIRTS, PETS, randomCos, cleanCos } from './cosdata.js';

const std = (color, rough = 0.5, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

// ------------------------------------------------------------------ hats (sit on top of the dome, local y=0 is the top)
export function buildHat(id) {
  const g = new THREE.Group();
  if (id === 'cap') {
    const red = std(0xd42a2a, 0.6);
    g.add(M(new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, -0.07, 0));
    const brim = M(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), red, 0, -0.06, 0.12); brim.scale.set(1, 1, 1.3); g.add(brim);
    g.add(M(new THREE.SphereGeometry(0.03, 8, 6), std(0xffffff), 0, 0.2, 0));
  } else if (id === 'tophat') {
    const blk = std(0x111111, 0.35, 0.1);
    g.add(M(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 28), blk, 0, -0.04, 0));
    g.add(M(new THREE.CylinderGeometry(0.2, 0.21, 0.38, 28), blk, 0, 0.15, 0));
    g.add(M(new THREE.CylinderGeometry(0.212, 0.212, 0.06, 28), std(0x9a1020, 0.5), 0, 0.0, 0));
  } else if (id === 'crown') {
    const gold = std(0xffc83a, 0.25, 0.9);
    g.add(M(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 24, 1, true), gold, 0, 0.0, 0));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(M(new THREE.ConeGeometry(0.05, 0.13, 6), gold, Math.cos(a) * 0.21, 0.13, Math.sin(a) * 0.21)); g.add(M(new THREE.SphereGeometry(0.025, 8, 6), std([0xff2040, 0x20a0ff, 0x20e070][i % 3], 0.2, 0.3), Math.cos(a) * 0.222, 0.0, Math.sin(a) * 0.222)); }
  } else if (id === 'grad') {
    const blk = std(0x1a1a22, 0.6);
    g.add(M(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 20), blk, 0, 0, 0));
    const board = M(new THREE.BoxGeometry(0.55, 0.03, 0.55), blk, 0, 0.07, 0); board.rotation.y = Math.PI / 4; g.add(board);
    const tassel = M(new THREE.CylinderGeometry(0.012, 0.012, 0.22), std(0xffd030), 0.22, -0.03, 0); g.add(tassel);
  } else if (id === 'sunhat') {
    const straw = std(0xe8c27a, 0.85);
    g.add(M(new THREE.CylinderGeometry(0.5, 0.52, 0.03, 32), straw, 0, -0.05, 0));
    g.add(M(new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw, 0, -0.05, 0));
    g.add(M(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 24), std(0xff5a9a, 0.6), 0, 0.0, 0));
  } else if (id === 'helmet') {
    const olive = std(0x55602e, 0.75);
    const h = M(new THREE.SphereGeometry(0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), olive, 0, -0.1, 0); h.scale.y = 0.9; g.add(h);
    g.add(M(new THREE.TorusGeometry(0.31, 0.03, 8, 28), olive, 0, -0.1, 0)); g.children[1].rotation.x = Math.PI / 2;
  } else if (id === 'bow') {
    const pink = std(0xff4fa0, 0.45);
    for (const s of [-1, 1]) { const l = M(new THREE.SphereGeometry(0.14, 16, 10), pink, s * 0.14, 0.02, 0); l.scale.set(1.2, 0.8, 0.5); g.add(l); }
    g.add(M(new THREE.SphereGeometry(0.06, 12, 8), pink, 0, 0.02, 0));
  } else if (id === 'flower') {
    const pet = std(0xff8ac8, 0.6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = M(new THREE.SphereGeometry(0.08, 12, 8), pet, Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1); p.scale.y = 0.4; g.add(p); }
    g.add(M(new THREE.SphereGeometry(0.06, 12, 8), std(0xffd030, 0.5), 0, 0.04, 0));
    g.position.x = 0.12;
  } else if (id === 'headphones') {
    const band = M(new THREE.TorusGeometry(0.36, 0.03, 8, 28, Math.PI), std(0x222222, 0.4), 0, -0.25, 0); g.add(band);
    for (const s of [-1, 1]) { const cup = M(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20), std(0x30c0ff, 0.35, 0.2), s * 0.37, -0.28, 0); cup.rotation.z = Math.PI / 2; g.add(cup); }
  } else if (id === 'party') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffd030' : '#ff3a8a'; x.fillRect(0, i * 8, 64, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    g.add(M(new THREE.ConeGeometry(0.16, 0.42, 20), std(0xffffff, 0.6, 0, { map: t }), 0, 0.18, 0));
    g.add(M(new THREE.SphereGeometry(0.05, 10, 8), std(0x30e0ff), 0, 0.4, 0));
  } else if (id === 'duck') {
    const y = std(0xffd23a, 0.55);
    const body = M(new THREE.SphereGeometry(0.15, 16, 12), y, 0, 0.08, -0.02); body.scale.set(1, 0.8, 1.2); g.add(body);
    g.add(M(new THREE.SphereGeometry(0.09, 14, 10), y, 0, 0.22, 0.1));
    const beak = M(new THREE.ConeGeometry(0.035, 0.09, 8), std(0xff8a1a), 0, 0.21, 0.2); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const s of [-1, 1]) g.add(M(new THREE.SphereGeometry(0.015, 6, 6), std(0x000000), s * 0.04, 0.25, 0.17));
  }
  return g;
}

// ------------------------------------------------------------------ shirts (a band of cloth around the middle)
export function shirtCanvas(id) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const s = SHIRTS.find(s => s.id === id) || SHIRTS[0];
  g.fillStyle = s.c || '#fff'; g.fillRect(0, 0, 256, 128);
  if (id === 'stripes') { g.fillStyle = '#1a2a5a'; for (let y = 0; y < 128; y += 22) g.fillRect(0, y, 256, 11); }
  if (id === 'hawaii') { for (let i = 0; i < 26; i++) { const x = Math.random() * 256, y = Math.random() * 128; g.fillStyle = ['#ff5a8a', '#ffd030', '#ffffff'][i % 3]; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 6, y + Math.sin(k * 1.26) * 6, 5, 0, 7); g.fill(); } g.fillStyle = '#ff8a1a'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  if (id === 'tux') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(128 - 30, 0); g.lineTo(128 + 30, 0); g.lineTo(128, 110); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(112, 10); g.lineTo(144, 10); g.lineTo(128, 24); g.fill(); g.fillStyle = '#c01020'; g.beginPath(); g.moveTo(110, 4); g.lineTo(128, 12); g.lineTo(110, 20); g.moveTo(146, 4); g.lineTo(128, 12); g.lineTo(146, 20); g.fill(); g.fillStyle = '#ddd'; for (const y of [40, 62, 84]) { g.beginPath(); g.arc(128, y, 3, 0, 7); g.fill(); } }
  if (id === 'hoodie') { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(90, 60, 76, 40); g.strokeStyle = '#eee'; g.lineWidth = 3; g.beginPath(); g.moveTo(118, 0); g.lineTo(116, 40); g.moveTo(138, 0); g.lineTo(140, 40); g.stroke(); }
  if (id === 'life') { g.fillStyle = '#ffffff'; g.fillRect(0, 40, 256, 10); g.fillRect(0, 80, 256, 10); g.fillStyle = '#222'; g.fillRect(126, 0, 4, 128); }
  if (id === 'overalls') { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, 256, 30); g.fillStyle = '#3a5f9a'; g.fillRect(96, 0, 18, 30); g.fillRect(142, 0, 18, 30); g.fillStyle = '#ffd030'; for (const x of [105, 151]) { g.beginPath(); g.arc(x, 30, 5, 0, 7); g.fill(); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(104, 50, 48, 36); }
  if (id === 'sweater') { g.fillStyle = '#c02020'; g.fillRect(0, 20, 256, 16); g.fillRect(0, 92, 256, 16); g.fillStyle = '#fff'; for (let x = 0; x < 256; x += 32) { g.save(); g.translate(x + 16, 64); for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.fillRect(-1.5, 0, 3, 12); } g.restore(); } }
  if (id === 'camo') { for (const [col, n] of [['#3a4a1e', 18], ['#2a2016', 12], ['#8a9a5a', 12]]) for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 128, 10 + Math.random() * 18, 6 + Math.random() * 10, Math.random() * 3, 0, 7); g.fill(); } }
  // fabric shading
  for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  return c;
}
const shirtCache = new Map();
export function buildShirt(id, profile) {
  if (!shirtCache.has(id)) { const t = new THREE.CanvasTexture(shirtCanvas(id)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; shirtCache.set(id, t); }
  const pts = [];
  for (let k = 0; k <= 10; k++) { const v = 0.24 + k / 10 * 0.31; const [r, y] = profile(v); pts.push(new THREE.Vector2(r * 1.07 + 0.012, y)); }
  const geo = new THREE.LatheGeometry(pts, 36);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: shirtCache.get(id), roughness: 0.85, side: THREE.DoubleSide }));
  m.castShadow = true; m.rotation.y = -Math.PI / 2;        // pattern centre faces forward
  return m;
}

// ------------------------------------------------------------------ pets (follow you around)
export function buildPet(id) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body; g.userData.fly = id === 'bee' || id === 'jelly';
  const eye = (x, y, z, s = 0.035) => { body.add(M(new THREE.SphereGeometry(s, 10, 8), std(0xffffff, 0.2), x, y, z)); body.add(M(new THREE.SphereGeometry(s * 0.5, 8, 6), std(0x000000, 0.1), x, y, z + s * 0.7)); };
  if (id === 'duckling') {
    const y = std(0xffd23a, 0.6);
    const b = M(new THREE.SphereGeometry(0.17, 16, 12), y, 0, 0.16, 0); b.scale.set(1, 0.85, 1.2); body.add(b);
    body.add(M(new THREE.SphereGeometry(0.11, 14, 10), y, 0, 0.33, 0.1));
    const beak = M(new THREE.ConeGeometry(0.04, 0.1, 8), std(0xff8a1a), 0, 0.32, 0.23); beak.rotation.x = Math.PI / 2; body.add(beak);
    eye(-0.05, 0.37, 0.18, 0.025); eye(0.05, 0.37, 0.18, 0.025);
  } else if (id === 'frog') {
    const gr = std(0x3ab04a, 0.4);
    const b = M(new THREE.SphereGeometry(0.18, 16, 12), gr, 0, 0.12, 0); b.scale.set(1.1, 0.7, 1); body.add(b);
    eye(-0.08, 0.24, 0.08, 0.05); eye(0.08, 0.24, 0.08, 0.05);
    for (const s of [-1, 1]) body.add(M(new THREE.SphereGeometry(0.07, 10, 8), gr, s * 0.15, 0.04, 0.1));
  } else if (id === 'crab') {
    const r = std(0xe0402a, 0.45);
    const b = M(new THREE.SphereGeometry(0.17, 16, 10), r, 0, 0.12, 0); b.scale.set(1.3, 0.55, 1); body.add(b);
    for (const s of [-1, 1]) { body.add(M(new THREE.SphereGeometry(0.07, 10, 8), r, s * 0.25, 0.14, 0.12)); for (let k = 0; k < 3; k++) { const l = M(new THREE.CylinderGeometry(0.015, 0.015, 0.16), r, s * 0.2, 0.05, -0.08 + k * 0.07); l.rotation.z = s * 1.0; body.add(l); } }
    eye(-0.05, 0.22, 0.12, 0.03); eye(0.05, 0.22, 0.12, 0.03);
  } else if (id === 'droplet') {
    const w = new THREE.MeshPhysicalMaterial({ color: 0x5fb6ee, roughness: 0.03, transparent: true, opacity: 0.7, clearcoat: 1 });
    const b = M(new THREE.SphereGeometry(0.16, 20, 14), w, 0, 0.15, 0); b.scale.set(1.1, 0.9, 1.1); body.add(b);
    const tip = M(new THREE.ConeGeometry(0.1, 0.2, 16), w, 0, 0.33, 0); body.add(tip);
    eye(-0.05, 0.2, 0.14, 0.04); eye(0.05, 0.2, 0.14, 0.04);
  } else if (id === 'snail') {
    const sk = std(0xc8b088, 0.5);
    const b = M(new THREE.CapsuleGeometry(0.06, 0.3, 6, 12), sk, 0, 0.06, 0.02); b.rotation.x = Math.PI / 2; body.add(b);
    const sh = M(new THREE.TorusGeometry(0.1, 0.06, 10, 20), std(0xa0522d, 0.4), 0, 0.17, -0.05); sh.rotation.y = Math.PI / 2; body.add(sh);
    for (const s of [-1, 1]) { const st = M(new THREE.CylinderGeometry(0.01, 0.01, 0.12), sk, s * 0.03, 0.15, 0.2); body.add(st); body.add(M(new THREE.SphereGeometry(0.02, 8, 6), std(0x111111), s * 0.03, 0.22, 0.2)); }
  } else if (id === 'jelly') {
    const j = new THREE.MeshPhysicalMaterial({ color: 0xd08aff, roughness: 0.1, transparent: true, opacity: 0.6, emissive: 0x8a3aff, emissiveIntensity: 0.6 });
    body.add(M(new THREE.SphereGeometry(0.17, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), j, 0, 0.3, 0));
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const t = M(new THREE.CylinderGeometry(0.012, 0.004, 0.25), j, Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1); body.add(t); }
    eye(-0.05, 0.36, 0.13, 0.03); eye(0.05, 0.36, 0.13, 0.03);
  } else if (id === 'goldfish') {
    body.add(M(new THREE.SphereGeometry(0.19, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1 }), 0, 0.2, 0));
    const fish = M(new THREE.SphereGeometry(0.06, 12, 8), std(0xff7a1a, 0.4), 0, 0.18, 0); fish.scale.set(1.4, 1, 0.6); body.add(fish); g.userData.fish = fish;
    body.add(M(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20), std(0x3a7aff, 0.5), 0, 0.03, 0));
  } else if (id === 'bee') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#111' : '#ffd020'; x.fillRect(i * 8, 0, 8, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const b = M(new THREE.SphereGeometry(0.1, 16, 12), std(0xffffff, 0.5, 0, { map: t }), 0, 0, 0); b.scale.set(1, 0.9, 1.4); b.rotation.y = Math.PI / 2; body.add(b);
    for (const s of [-1, 1]) { const w = M(new THREE.SphereGeometry(0.07, 10, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), s * 0.08, 0.08, -0.02); w.scale.set(1, 0.3, 0.6); body.add(w); g.userData['w' + s] = w; }
    eye(-0.04, 0.03, 0.12, 0.025); eye(0.04, 0.03, 0.12, 0.025);
    body.position.y = 0.6;
  }
  return g;
}
// pets trail their owner with a little hop
export function updatePet(pet, owner, dt, t, vis) {
  const u = pet.userData; pet.visible = vis; if (!vis && u.placed) return;
  const back = 0.95, tx = owner.x - Math.sin(owner.face) * back + Math.cos(owner.face) * 0.45, tz = owner.z - Math.cos(owner.face) * back - Math.sin(owner.face) * 0.45;
  if (!u.placed) { pet.position.set(tx, 0, tz); u.placed = true; }
  const dx = tx - pet.position.x, dz = tz - pet.position.z, d = Math.hypot(dx, dz);
  const k = Math.min(1, dt * (d > 3 ? 8 : 4));
  pet.position.x += dx * k; pet.position.z += dz * k;
  const moving = d > 0.15;
  if (moving) pet.rotation.y = Math.atan2(dx, dz);
  const b = u.body;
  if (u.fly) b.position.y = (b.userData.base ??= b.position.y) + Math.sin(t * 3 + pet.id) * 0.06 + 0.1;
  else b.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.08 : 0;
  if (u['w-1']) { u['w-1'].rotation.z = Math.sin(t * 60) * 0.6; u.w1.rotation.z = -Math.sin(t * 60) * 0.6; }
  if (u.fish) { u.fish.position.x = Math.sin(t * 1.5) * 0.06; u.fish.rotation.y = Math.cos(t * 1.5) > 0 ? 0 : Math.PI; }
}

// ------------------------------------------------------------------ flat versions (meeting cards, wardrobe)
export function drawCos2D(g, cx, cy, s, cos, dead) {
  if (!cos) return;
  const sh = SHIRTS.find(x => x.id === cos.shirt);
  if (sh && sh.id !== 'none' && !dead) {
    g.save();
    g.beginPath(); g.rect(cx - s, cy + s * 0.02, s * 2, s * 0.36); g.clip();
    g.beginPath(); g.ellipse(cx, cy + s * 0.2, s * 0.53, s * 0.5, 0, 0, 7);
    const pat = g.createPattern(shirtCanvas(sh.id), 'repeat'); g.fillStyle = pat || sh.c; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, s * 0.03); g.stroke();
    g.restore();
  }
  const hat = HATS.find(x => x.id === cos.hat);
  g.fillStyle = '#000';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (hat && hat.emoji) { g.font = `${Math.round(s * 0.62)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; if (dead) g.fillText(hat.emoji, cx + s * 0.75, cy + s * 0.35); else g.fillText(hat.emoji, cx, cy - s * 0.78); }
  const pet = PETS.find(x => x.id === cos.pet);
  if (pet && pet.emoji && !dead) { g.font = `${Math.round(s * 0.42)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.fillText(pet.emoji, cx + s * 0.85, cy + s * 0.5); }
}
