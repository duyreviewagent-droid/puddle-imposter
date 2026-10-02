// The lava pit: a volcanic cavern with a stone diving ledge over a bubbling lava pool.
// Voted-out puddles walk the ledge, look down, jump in and boil away in a burst of steam.
import * as THREE from 'three';
import { Puddle } from './puddle.js';
import { buildPet, updatePet, randomCos } from './cosmetics.js';
import { sfx, lavaAmbience } from './audio.js';

const NOISE = `
vec2 hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(hash2(i),f), dot(hash2(i+vec2(1,0)),f-vec2(1,0)),u.x), mix(dot(hash2(i+vec2(0,1)),f-vec2(0,1)), dot(hash2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y)*0.5+0.5; }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }`;

function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uHit: { value: new THREE.Vector2(99, 99) } },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW; ${NOISE}
      void main(){ vUv = uv; vec3 p = position; float n = fbm(uv*6.0 + uTime*0.05);
        p.z += (n-0.5)*0.35 + sin(uv.x*30.0+uTime*0.8)*0.03;
        vec4 w = modelMatrix*vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform float uFlash; uniform vec2 uHit; varying vec2 vUv; varying vec3 vW; ${NOISE}
      void main(){
        vec2 uv = vUv*5.0;
        vec2 warp = vec2(fbm(uv*0.8 + uTime*0.04), fbm(uv*0.8 - uTime*0.03 + 7.0));
        float n = fbm(uv + warp*1.6 + vec2(uTime*0.03, uTime*0.015));
        float crust = smoothstep(0.43, 0.55, n);
        float cracks = 1.0 - smoothstep(0.0, 0.05, abs(fbm(uv*3.0 + warp) - 0.5));
        vec3 hot = mix(vec3(0.85,0.09,0.0), vec3(1.7,0.5,0.04), pow(1.0-n, 2.5));
        vec3 cold = vec3(0.025,0.01,0.007) + vec3(1.3,0.22,0.01)*cracks;
        vec3 c = mix(hot, cold, crust);
        float pulse = 0.85 + 0.15*sin(uTime*1.7 + n*12.0);
        float hit = exp(-length(vW.xz-uHit)*0.6);
        c *= pulse; c += vec3(1.0,0.6,0.2)*hit*uFlash*4.0;
        gl_FragColor = vec4(c, 1.0); }`,
  });
}
function rockMat() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2a2420'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.25)' : 'rgba(120,100,90,.12)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 0.92, metalness: 0, bumpMap: t, bumpScale: 2 });
}
function lumpy(geo, amt, seed = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 1.3 + seed) * Math.cos(v.y * 1.1 + seed * 2) * Math.sin(v.z * 1.7) + Math.sin(v.x * 3.1 + v.z * 2.3) * 0.4;
    v.multiplyScalar(1 + n * amt); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}

export class LavaPit {
  constructor() {
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x070201);
    S.fog = new THREE.FogExp2(0x1a0603, 0.02);
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
    this.lava = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 140, 140), lavaMaterial());
    this.lava.rotation.x = -Math.PI / 2; S.add(this.lava);
    const rock = rockMat();
    // cavern walls
    const cave = new THREE.Mesh(lumpy(new THREE.SphereGeometry(30, 64, 40), 0.12, 3), rock); cave.material.side = THREE.BackSide; cave.scale.set(1, 0.6, 1); cave.position.y = 4; S.add(cave);
    const rock2 = rock.clone(); rock2.side = THREE.FrontSide;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + Math.random() * 0.3, r = 15 + Math.random() * 8;
      const b = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(2 + Math.random() * 3, 3), 0.25, i), rock2);
      b.position.set(Math.cos(a) * r, Math.random() * 2 - 0.5, Math.sin(a) * r - 4); b.rotation.set(Math.random(), Math.random(), Math.random()); b.scale.y = 0.7 + Math.random(); S.add(b);
    }
    // stalactites
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.3 + Math.random() * 0.6, 2 + Math.random() * 5, 7), rock2);
      s.rotation.x = Math.PI; s.position.set((Math.random() - 0.5) * 50, 14 + Math.random() * 3, (Math.random() - 0.5) * 40 - 6); S.add(s);
    }
    // the ledge: a rough stone slab sticking out over the pool, on a pillar
    const ledge = new THREE.Mesh(lumpy(new THREE.BoxGeometry(12, 1, 2.4, 24, 4, 6), 0.03, 9), rock2);
    ledge.position.set(-9, 2.5, 0); ledge.castShadow = ledge.receiveShadow = true; S.add(ledge);
    const pillar = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(2.2, 3.5, 8, 18, 6), 0.1, 4), rock2);
    pillar.position.set(-13, -1.5, 0); S.add(pillar);
    this.ledgeTop = 3.0; this.edgeX = -3.3;
    // glowing rim where lava meets the rocks
    // lights
    S.add(new THREE.HemisphereLight(0x5a2a1a, 0x000000, 0.4));
    const lavaLight = this.lavaLight = new THREE.PointLight(0xff5a14, 45, 40, 1.6); lavaLight.position.set(0, 1.5, 0); S.add(lavaLight);
    const under = new THREE.PointLight(0xff3008, 20, 25, 1.8); under.position.set(-6, 1.2, 3); S.add(under);
    const key = new THREE.DirectionalLight(0x8fb0ff, 0.35); key.position.set(-6, 20, 10); S.add(key);
    this.flashLight = new THREE.PointLight(0xffc070, 0, 20, 1.5); S.add(this.flashLight);
    // embers
    const N = 400, pos = new Float32Array(N * 3); this.emb = [];
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 20; this.emb.push(0.4 + Math.random() * 1.2); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ec = document.createElement('canvas'); ec.width = ec.height = 32; const g = ec.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,140,40,.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ size: 0.18, map: new THREE.CanvasTexture(ec), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
    S.add(this.embers);
    // steam puffs
    const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d');
    for (let k = 0; k < 6; k++) { const x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 26 + Math.random() * 20; const g2 = sg.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(255,255,255,.55)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = g2; sg.fillRect(0, 0, 128, 128); }
    const steamTex = new THREE.CanvasTexture(sc);
    this.puffs = [];
    for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffe0d0 })); s.visible = false; S.add(s); this.puffs.push({ s, v: new THREE.Vector3(), life: 0, max: 1 }); }
    // drops (splash)
    this.dropsG = new THREE.Group(); S.add(this.dropsG); this.drops = [];
    const dm = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xff8020, emissiveIntensity: 3 });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dm); m.visible = false; this.dropsG.add(m); this.drops.push({ m, v: new THREE.Vector3(), on: false }); }
    this.t = 0; this.actors = []; this.mode = 'idle';
  }
  puff(x, y, z, n, spread = 1, rise = 2) {
    for (let i = 0; i < n; i++) {
      const p = this.puffs.find(p => p.life <= 0); if (!p) return;
      p.s.visible = true; p.s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread);
      p.v.set((Math.random() - 0.5) * 1.5, rise * (0.6 + Math.random()), (Math.random() - 0.5) * 1.5);
      p.life = p.max = 1.5 + Math.random() * 2; p.s.scale.setScalar(0.5);
    }
  }
  clearActors() { for (const a of this.actors) { this.scene.remove(a.pd.group); a.pd.dispose(); if (a.pet) this.scene.remove(a.pet); } this.actors = []; }
  addPet(A, id) { if (!id || id === 'none') return; A.pet = buildPet(id); A.pet.scale.setScalar(0.9); this.scene.add(A.pet); A.petOwner = { x: 0, z: 0, face: 0 }; }
  // wardrobe preview: just you, up close
  showWardrobe(color, cos) {
    this.clearActors(); this.mode = 'wardrobe'; this.t = 0;
    const pd = new Puddle(color); pd.setGlow(true); pd.setCos(cos);
    pd.group.position.set(-8, this.ledgeTop, 0.3); this.scene.add(pd.group);
    const A = { pd, x: -8, face: 0.25 }; this.actors.push(A); this.addPet(A, cos && cos.pet);
  }
  // title screen: a few puddles waiting on the ledge
  showTitle(colors) {
    this.clearActors(); this.mode = 'title'; this.t = 0;
    colors.forEach((c, i) => {
      const pd = new Puddle(c); pd.setGlow(true); pd.setCos(randomCos());
      const x = -12.5 + i * 1.45; pd.group.position.set(x, this.ledgeTop, (i % 2) * 0.5 - 0.25); pd.group.scale.setScalar(0.85);
      this.scene.add(pd.group); this.actors.push({ pd, x, face: Math.PI / 2 + (Math.random() - 0.5), turnT: Math.random() * 3 });
    });
  }
  // eject cinematic. player = {color, name} or null for "no one"; text lines shown by the caller
  startEject(player) {
    this.clearActors(); this.mode = 'eject'; this.t = 0; this.done = false; this.splashed = false;
    lavaAmbience(true);
    if (player) {
      const pd = new Puddle(player.color); pd.setGlow(true); pd.setCos(player.cos);
      pd.group.position.set(-13.5, this.ledgeTop, 0); this.scene.add(pd.group);
      const A = { pd, x: -13.5, y: this.ledgeTop, face: Math.PI / 2, ej: true }; this.actors.push(A);
      this.addPet(A, player.cos && player.cos.pet);
    }
  }
  stop() { lavaAmbience(false); this.clearActors(); this.mode = 'idle'; }
  update(dt, aspect) {
    this.t += dt; const t = this.t;
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    const L = this.lava.material.uniforms; L.uTime.value += dt; L.uFlash.value = Math.max(0, L.uFlash.value - dt * 0.8);
    this.lavaLight.intensity = 42 + Math.sin(t * 7) * 5 + Math.sin(t * 13.3) * 4;
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 160);
    // embers rise and wrap
    const p = this.embers.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.emb[i] * dt; let x = p.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.3;
      if (y > 13) { y = 0.2; x = (Math.random() - 0.5) * 30; }
      p.setXY(i, x, y);
    }
    p.needsUpdate = true;
    for (const q of this.puffs) {
      if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) { q.s.visible = false; continue; }
      q.s.position.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 0.4);
      const k = 1 - q.life / q.max; q.s.scale.setScalar(0.6 + k * 4); q.s.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.5;
    }
    for (const d of this.drops) { if (!d.on) continue; d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); if (d.m.position.y < 0) { d.on = false; d.m.visible = false; } }
    // ambient steam from the surface
    if (Math.random() < dt * 3) this.puff((Math.random() - 0.5) * 20, 0.2, (Math.random() - 0.5) * 10 - 2, 1, 1, 1);
    const C = this.camera;
    if (this.mode === 'title') {
      const a = t * 0.05;
      C.position.set(-6 + Math.sin(a) * 4, 5.5 + Math.sin(t * 0.13) * 0.4, 11 + Math.cos(a) * 2); C.lookAt(-6, 2.2, 0);
      for (const A of this.actors) {
        A.turnT -= dt; if (A.turnT < 0) { A.turnT = 1.5 + Math.random() * 3; A.face = Math.PI / 2 + (Math.random() - 0.5) * 2.4; }
        A.pd.lookDown = 0.3 + Math.sin(t + A.x) * 0.2;
        A.pd.update(dt, t, 0, 0, A.face);
      }
    } else if (this.mode === 'wardrobe') {
      C.position.set(-7.1 + Math.sin(t * 0.3) * 0.6, this.ledgeTop + 1.9, 4.6); C.lookAt(-7.1, this.ledgeTop + 0.75, 0);
      const A = this.actors[0];
      if (A) { A.pd.update(dt, t, 0, 0, 0.25 + Math.sin(t * 0.6) * 0.5); if (A.pet) { A.petOwner.x = -9.6; A.petOwner.z = 1.45; A.petOwner.face = 0; updatePet(A.pet, A.petOwner, dt, t, true); A.pet.position.y = this.ledgeTop; A.pet.rotation.y = -0.4; } }
    } else if (this.mode === 'eject') {
      const A = this.actors[0];
      C.position.set(-5 + Math.min(t, 6) * 0.3, 5.2, 10.5); C.lookAt(-4.5 + Math.min(t, 6) * 0.35, 2.4, 0);
      if (A) {
        const pd = A.pd; let vx = 0;
        if (t < 3.1) { A.x = Math.min(this.edgeX, -13.5 + t * 3.3); vx = 3.3; pd.group.position.set(A.x, this.ledgeTop, 0); if (Math.floor(t * 3.3 / 0.9) !== A.st) { A.st = Math.floor(t * 3.3 / 0.9); sfx.step(0.8); } }
        else if (t < 4.4) { pd.lookDown = Math.min(1, (t - 3.1) * 2); pd.group.position.x = this.edgeX + Math.sin(t * 40) * 0.01; if (!A.sq) { A.sq = 1; sfx.squeak(); } }
        else if (t < 5.25) {
          if (!A.jumped) { A.jumped = 1; sfx.whoosh(); }
          const k = (t - 4.4) / 0.85; const x0 = this.edgeX, x1 = 1.2;
          pd.group.position.set(x0 + (x1 - x0) * k, this.ledgeTop + 1.6 * Math.sin(k * Math.PI) * (1 - k) + (0.2 - this.ledgeTop) * k * k, 0);
          pd.group.rotation.z = -k * 1.2; vx = 4;
        } else if (!this.splashed) {
          this.splashed = true; pd.group.visible = false;
          sfx.sizzle(1.3); sfx.splash(2, 0.8);
          L.uFlash.value = 1; L.uHit.value.set(1.2, 0); this.flashLight.position.set(1.2, 1.5, 0); this.flashLight.intensity = 250;
          this.puff(1.2, 0.3, 0, 40, 2, 4);
          for (const d of this.drops) { d.on = true; d.m.visible = true; d.m.position.set(1.2, 0.2, 0); const a = Math.random() * 6.28, s = Math.random() * 4; d.v.set(Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s); }
          // the eyes bob on the surface for a moment
          A.eyes = pd.eyes.map(E => { const e = E.e.clone(); e.position.set(1.2 + E.side * 0.18, 0.12, 0.2); e.rotation.set(-1.2, 0, 0); this.scene.add(e); return e; });
        } else if (A.eyes) {
          const k = t - 5.25;
          A.eyes.forEach((e, i) => { e.position.y = 0.12 + Math.sin(k * 3 + i) * 0.05 - Math.max(0, k - 1.6) * 0.35; e.rotation.z = Math.sin(k * 2 + i) * 0.4; });
          if (k > 1.6 && !A.popped) { A.popped = 1; sfx.bubble(1); sfx.sizzle(0.4); this.puff(1.2, 0.2, 0.2, 6, 0.6, 2); }
          if (k > 2.6) { A.eyes.forEach(e => this.scene.remove(e)); A.eyes = null; }
        }
        if (pd.group.visible) pd.update(dt, t, vx, 0, Math.PI / 2);
        if (A.pet) { A.petOwner.x = Math.min(A.x, this.edgeX - 1.2); A.petOwner.z = 0; A.petOwner.face = Math.PI / 2; updatePet(A.pet, A.petOwner, dt, t, true); A.pet.position.y = this.ledgeTop; if (t > 4.4) A.pet.rotation.y = Math.PI / 2; }
      }
      if (t > 9.2) this.done = true;
    }
  }
}
