// The puddle person: a melting dome of water standing in its own puddle, two white googly eyes with
// jiggling pupils, a coloured outer glow (rim shell + floor halo), drips that fall and leave wet spots.
import * as THREE from 'three';
import { buildHat, buildShirt, drawCos2D } from './cosmetics.js';

const SEG = 30, RINGS = 22;
// profile: [radius, height] from the puddle rim (v=0) up to the top (v=1)
const PROFILE = [[0.70, 0.0], [0.69, 0.025], [0.62, 0.06], [0.50, 0.11], [0.43, 0.2], [0.41, 0.33], [0.42, 0.48], [0.42, 0.62], [0.40, 0.75], [0.35, 0.87], [0.26, 0.97], [0.14, 1.03], [0.0, 1.05]];
export function profile(v) {
  const f = v * (PROFILE.length - 1), i = Math.min(PROFILE.length - 2, Math.floor(f)), t = f - i;
  const a = PROFILE[i], b = PROFILE[i + 1], s = t * t * (3 - 2 * t);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
}
// cheap smooth noise
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

let envMap = null;
export function setEnv(e) { envMap = e; }

const waterMat = () => new THREE.MeshPhysicalMaterial({
  color: 0x5fb6ee, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.02,
  ior: 1.33, specularIntensity: 1, specularColor: 0xffffff, envMapIntensity: 1.1, depthWrite: false, side: THREE.DoubleSide,
});
const coreMat = () => new THREE.MeshStandardMaterial({ color: 0x1f6fb0, roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });

function glowMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: 2.2 }, uStr: { value: 1.6 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPow; uniform float uStr; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uColor * f * uStr, f); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
}

let haloTex = null;
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c); return haloTex;
}

export function textSprite(text, color = '#fff', size = 40) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `800 ${size}px "Avenir Next", "Helvetica Neue", sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width + 24); c.width = w; c.height = size + 20;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, w / 2, c.height / 2);
  g.fillStyle = color; g.fillText(text, w / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, depthTest: false, transparent: true }));
  s.scale.set(w / 110, c.height / 110, 1); s.renderOrder = 20;
  return s;
}

const eyeGeo = new THREE.SphereGeometry(0.125, 24, 16);
const pupilGeo = new THREE.SphereGeometry(0.062, 16, 12);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0 });
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.08, metalness: 0.1 });
const dropGeo = new THREE.SphereGeometry(0.045, 10, 8);

export class Puddle {
  constructor(color, name = '', world = null, labelColor = null) {
    this.color = new THREE.Color(color); this.world = world;
    this.group = new THREE.Group();
    // body geometry: a surface of revolution, re-shaped every frame
    const g = new THREE.BufferGeometry();
    const n = (SEG + 1) * (RINGS + 1);
    this.pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const uv = new Float32Array(n * 2), ind = [];
    for (let r = 0; r <= RINGS; r++) for (let s = 0; s <= SEG; s++) { uv[(r * (SEG + 1) + s) * 2] = s / SEG; uv[(r * (SEG + 1) + s) * 2 + 1] = r / RINGS; }
    for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEG; s++) {
      const a = r * (SEG + 1) + s, b = a + SEG + 1;
      ind.push(a, a + 1, b, b, a + 1, b + 1);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(ind);
    this.geo = g;
    this.phase = Math.random() * 100;
    this.body = new THREE.Mesh(g, waterMat()); this.body.castShadow = true; this.body.renderOrder = 2;
    this.core = new THREE.Mesh(g, coreMat()); this.core.scale.setScalar(0.72); this.core.position.y = 0.04; this.core.renderOrder = 1;
    this.glow = new THREE.Mesh(g, glowMat(color)); this.glow.scale.setScalar(1.1); this.glow.renderOrder = 3;
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: halo(), color: this.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = 0.03; this.halo.renderOrder = 0;
    this.lean = new THREE.Group();
    this.lean.add(this.body, this.core, this.glow);
    this.group.add(this.halo, this.lean);
    // eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat); e.scale.set(1, 1, 0.75); e.castShadow = true;
      const p = new THREE.Mesh(pupilGeo, pupilMat);
      e.add(p);
      this.lean.add(e);
      this.eyes.push({ e, p, side, ox: 0, oy: 0, vx: 0, vy: 0, rnd: Math.random() * 10 });
    }
    if (name) { this.label = textSprite(name, labelColor || '#' + this.color.getHexString()); this.label.position.y = 1.75; this.group.add(this.label); }
    // state
    this.vel = new THREE.Vector2(); this.leanV = new THREE.Vector2(); this.leanX = 0; this.leanZ = 0; this.leanVX = 0; this.leanVZ = 0;
    this.squash = 1; this.squashV = 0; this.melt = 0; this.dead = 0; this.ghost = false; this.lookDown = 0;
    this.dripT = Math.random(); this.trailDist = 0;
    this.heading = 0;
    this.shape(0);
  }
  setCos(cos) {
    for (const k of ['hat', 'shirt']) if (this[k]) { this.body.remove(this[k]); this[k].traverse(o => { if (o.geometry) o.geometry.dispose(); }); this[k] = null; }
    this.cos = cos || null; if (!cos) return;
    if (cos.hat && cos.hat !== 'none') { this.hat = buildHat(cos.hat); this.body.add(this.hat); }
    if (cos.shirt && cos.shirt !== 'none') { this.shirt = buildShirt(cos.shirt, profile); this.body.add(this.shirt); }
    this.placeCos();
  }
  placeCos() {
    const d = this.dead, sq = this.squash;
    if (this.hat) {
      this.hat.visible = !this.ghost;
      if (d > 0.5) { this.hat.position.set(0.75, 0.06, 0.25); this.hat.rotation.set(0, 0, 1.25); }
      else { this.hat.position.set(0, 1.03 * sq - 0.02, 0); this.hat.rotation.set(0, 0, 0); }
    }
    if (this.shirt) { this.shirt.visible = !this.ghost && d < 0.5; this.shirt.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); }
  }
  setGlow(on) { this.glow.visible = on; this.halo.visible = on; }
  setGhost(on) {
    this.ghost = on;
    this.body.material.opacity = on ? 0.16 : 0.58; this.core.visible = !on; this.halo.material.opacity = on ? 0.15 : 0.55;
    this.glow.material.uniforms.uStr.value = on ? 0.6 : 1.6;
    this.body.castShadow = !on;
  }
  // build the melting surface for time t
  shape(t) {
    const P = this.pos, ph = this.phase, sp = Math.min(1, this.vel.length() / 4);
    const deadF = this.dead, sq = this.squash;
    const meltF = 0.6 + this.melt;
    for (let r = 0; r <= RINGS; r++) {
      const v = r / RINGS;
      let [rad, y] = profile(v);
      // dead: collapse into a flat puddle
      y = y * (1 - deadF * 0.88) * sq;
      rad = rad * (1 + deadF * (v < 0.3 ? 0.55 : 0.2)) / Math.sqrt(sq);
      for (let s = 0; s <= SEG; s++) {
        const a = (s % SEG) / SEG * Math.PI * 2;
        // drips running down: vertical streak bulges, stronger low down
        const streak = Math.pow(Math.max(0, Math.sin(a * 5 + ph + Math.sin(a * 3 + ph) * 0.8)), 6) * 0.06 * meltF * (1 - v) * (v > 0.12 ? 1 : v / 0.12);
        // rim wobble (the puddle) and gentle slosh everywhere
        const rim = v < 0.25 ? (noise1(a * 2.2 + ph + t * 0.6) - 0.5) * 0.24 * (1 - v / 0.25) * (1 + sp) : 0;
        const slosh = Math.sin(t * 3.1 + a * 2 + ph) * 0.012 + Math.sin(t * 5.3 - a * 3 + v * 5) * 0.008 * (1 + sp * 2);
        const R = Math.max(0, rad * (1 + rim + slosh) + streak * (rad > 0.05 ? 1 : 0));
        const k = (r * (SEG + 1) + s) * 3;
        P[k] = Math.cos(a) * R; P[k + 1] = y + (v > 0.95 ? Math.sin(t * 2.4 + ph) * 0.01 : 0); P[k + 2] = Math.sin(a) * R;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  // dt seconds; vx,vz world velocity; face = heading radians (0 = +z)
  update(dt, t, vx, vz, face) {
    this.vel.set(vx, vz);
    let d = face - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * 10);
    this.lean.rotation.y = this.heading;
    // lean into motion with a springy slosh (local space)
    const c = Math.cos(-this.heading), s = Math.sin(-this.heading);
    const lx = vx * c - vz * s, lz = vx * s + vz * c;
    const tx = lz * 0.05, tz = -lx * 0.05;
    this.leanVX += ((tx - this.leanX) * 60 - this.leanVX * 7) * dt; this.leanX += this.leanVX * dt;
    this.leanVZ += ((tz - this.leanZ) * 60 - this.leanVZ * 7) * dt; this.leanZ += this.leanVZ * dt;
    this.body.rotation.x = this.core.rotation.x = this.glow.rotation.x = this.leanX * (1 - this.dead);
    this.body.rotation.z = this.core.rotation.z = this.glow.rotation.z = this.leanZ * (1 - this.dead);
    // squash bounce while walking
    const sp = Math.hypot(vx, vz);
    const target = 1 + (sp > 0.3 ? Math.sin(t * 13 + this.phase) * 0.05 : 0);
    this.squashV += ((target - this.squash) * 120 - this.squashV * 10) * dt; this.squash += this.squashV * dt;
    this.shape(t);
    if (this.cos) this.placeCos();
    // eyes ride the surface near the top-front
    const ey = (0.78 * (1 - this.dead * 0.86)) * this.squash;
    const [er] = profile(0.66);
    for (const E of this.eyes) {
      const a = E.side * 0.36;
      const R = er * (1 + this.dead * 0.25) * 0.95;
      const ex = Math.sin(a) * R + this.leanZ * -0.5 * (1 - this.dead), ez = Math.cos(a) * R;
      if (this.dead) E.e.position.set(Math.sin(a) * 0.17 + E.side * 0.03, 0.15, 0.08 + Math.cos(a) * 0.02);
      else E.e.position.set(ex, ey + this.leanX * 0.3, ez);
      E.e.rotation.set(this.dead ? -1.3 : -this.lookDown * 0.6, a, 0);
      // googly pupil: spring + gravity + inertia from movement
      const jx = -lx * 0.03 + Math.sin(t * 0.7 + E.rnd) * 0.004, jy = -0.02 - this.lookDown * 0.06 + Math.abs(this.squashV) * 0.002;
      E.vx += ((jx - E.ox) * 90 - E.vx * 6) * dt + (Math.random() - 0.5) * sp * 0.3;
      E.vy += ((jy - E.oy) * 90 - E.vy * 6) * dt + this.squashV * 0.02;
      E.ox += E.vx * dt; E.oy += E.vy * dt;
      const m = Math.hypot(E.ox, E.oy), lim = 0.055;
      if (m > lim) { E.ox *= lim / m; E.oy *= lim / m; E.vx *= -0.4; E.vy *= -0.4; }
      E.p.position.set(E.ox, E.oy, 0.105);
    }
    // drips + wet trail
    if (this.world && !this.ghost && !this.dead) {
      this.dripT -= dt * (0.6 + sp * 0.5 + this.melt * 2);
      if (this.dripT < 0) { this.dripT = 0.4 + Math.random() * 1.2; this.world.spawnDrip(this.group.position, this.heading); }
      this.trailDist += sp * dt;
      if (this.trailDist > 0.55) { this.trailDist = 0; this.world.wetSpot(this.group.position.x + (Math.random() - 0.5) * 0.3, this.group.position.z + (Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.25, 7); }
    }
  }
  dispose() {
    this.geo.dispose(); this.body.material.dispose(); this.core.material.dispose(); this.glow.material.dispose(); this.halo.material.dispose();
    if (this.label) { this.label.material.map.dispose(); this.label.material.dispose(); }
  }
}

// a small 2D drawing of a puddle with googly eyes (meeting cards, menus)
export function drawPuddleIcon(g, cx, cy, s, color, dead = false, cos = null) {
  g.save();
  g.shadowColor = color; g.shadowBlur = s * 0.6;
  const body = g.createLinearGradient(cx, cy - s, cx, cy + s * 0.6);
  body.addColorStop(0, 'rgba(190,235,255,.95)'); body.addColorStop(1, 'rgba(60,150,220,.9)');
  g.fillStyle = body;
  g.beginPath();
  if (dead) {
    g.ellipse(cx, cy + s * 0.35, s * 0.95, s * 0.3, 0, 0, 7);
  } else {
    g.moveTo(cx - s * 0.95, cy + s * 0.55);
    g.bezierCurveTo(cx - s * 0.7, cy + s * 0.35, cx - s * 0.5, cy + s * 0.3, cx - s * 0.48, cy);
    g.bezierCurveTo(cx - s * 0.5, cy - s * 0.9, cx + s * 0.5, cy - s * 0.9, cx + s * 0.48, cy);
    g.bezierCurveTo(cx + s * 0.5, cy + s * 0.3, cx + s * 0.7, cy + s * 0.35, cx + s * 0.95, cy + s * 0.55);
    g.bezierCurveTo(cx + s * 0.6, cy + s * 0.72, cx - s * 0.6, cy + s * 0.72, cx - s * 0.95, cy + s * 0.55);
  }
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = color; g.lineWidth = Math.max(2, s * 0.07); g.stroke();
  // shine
  g.fillStyle = 'rgba(255,255,255,.55)';
  if (!dead) { g.beginPath(); g.ellipse(cx - s * 0.22, cy - s * 0.45, s * 0.08, s * 0.18, 0.4, 0, 7); g.fill(); }
  const ey = dead ? cy + s * 0.28 : cy - s * 0.2;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * s * 0.2;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, s * 0.17, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#000'; g.beginPath(); g.arc(ex + (dead ? sx * s * 0.06 : s * 0.03), ey + (dead ? -s * 0.03 : s * 0.05), s * 0.08, 0, 7); g.fill();
  }
  if (dead) { g.strokeStyle = '#ff3b3b'; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(cx - s * 0.8, cy - s * 0.7); g.lineTo(cx + s * 0.8, cy + s * 0.7); g.stroke(); }
  g.restore();
  drawCos2D(g, cx, cy, s, cos, dead);
}

export { dropGeo };
