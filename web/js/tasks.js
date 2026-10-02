// Task mini-games, drawn on a canvas panel over the game. openTask(type, done, close) → { close() }
import { sfx } from './audio.js';
import { TASK_NAMES } from './maps.js';

const W = 560, H = 440;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function panelBG(g, tint = '#3b434b') {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, tint); gr.addColorStop(1, '#1d2227');
  g.fillStyle = gr; rr(g, 0, 0, W, H, 18); g.fill();
  // brushed metal streaks
  g.save(); rr(g, 0, 0, W, H, 18); g.clip();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(0, Math.random() * H, W, 1); }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2; rr(g, 2, 2, W - 4, H - 4, 16); g.stroke();
  for (const [x, y] of [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]]) { const s = g.createRadialGradient(x - 1, y - 1, 0, x, y, 6); s.addColorStop(0, '#ddd'); s.addColorStop(1, '#555'); g.fillStyle = s; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.strokeStyle = '#333'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.stroke(); }
}
function label(g, text, x, y, size = 18, color = '#e8eef4', align = 'center') { g.font = `700 ${size}px "Avenir Next", "Helvetica Neue", sans-serif`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(text, x, y); }
function screenRect(g, x, y, w, h, glow = '#1a3a2a') { g.fillStyle = '#05080a'; rr(g, x, y, w, h, 8); g.fill(); const gr = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h)); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; rr(g, x, y, w, h, 8); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke(); }

export function openTask(type, onDone, onClose) {
  const wrap = document.createElement('div'); wrap.className = 'taskwrap';
  const box = document.createElement('div'); box.className = 'taskbox';
  const title = document.createElement('div'); title.className = 'tasktitle'; title.textContent = type === 'lights' ? 'Fix Lights' : TASK_NAMES[type];
  const x = document.createElement('button'); x.className = 'taskx'; x.textContent = '✕';
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; c.style.width = W + 'px'; c.style.height = H + 'px';
  box.append(title, x, c); wrap.append(box); document.body.append(wrap);
  const g = c.getContext('2d'); g.scale(2, 2);
  let alive = true, finished = false, last = performance.now(), mouse = { x: 0, y: 0, down: false };
  const pos = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  const close = () => { if (!alive) return; alive = false; wrap.remove(); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); if (!finished) onClose && onClose(); };
  const finish = () => { if (finished) return; finished = true; sfx.task(); setTimeout(() => { onDone && onDone(); close(); }, 650); };
  x.onclick = close;
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  const game = GAMES[type](g, finish);
  c.addEventListener('pointerdown', e => { const p = pos(e); mouse = { ...p, down: true }; game.down && game.down(p); });
  c.addEventListener('pointermove', e => { const p = pos(e); mouse.x = p.x; mouse.y = p.y; game.move && game.move(p, mouse.down); });
  const up = e => { if (!mouse.down) return; mouse.down = false; const p = pos(e); game.up && game.up(p); };
  window.addEventListener('pointerup', up);
  const key = e => { if (e.code === 'Escape') { close(); e.stopPropagation(); return; } game.key && game.key(e); };
  window.addEventListener('keydown', key);
  const loop = () => {
    if (!alive) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    game.draw(dt, mouse);
    if (finished) { g.fillStyle = 'rgba(40,255,120,.12)'; rr(g, 0, 0, W, H, 18); g.fill(); label(g, '✓ TASK COMPLETE', W / 2, H / 2, 34, '#5dff9a'); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { close, get open() { return alive; } };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const WIRE = ['#ff3030', '#2f6bff', '#ffd21a', '#ff3cf0'];

const GAMES = {
  wires(g, finish) {
    const L = shuffle([0, 1, 2, 3]), Rr = shuffle([0, 1, 2, 3]);
    const ly = i => 90 + i * 80, done = new Set(); let drag = null;
    return {
      down(p) { L.forEach((c, i) => { if (!done.has(c) && Math.hypot(p.x - 60, p.y - ly(i)) < 28) drag = { c, i }; }); },
      up(p) {
        if (!drag) return;
        Rr.forEach((c, i) => { if (Math.hypot(p.x - (W - 60), p.y - ly(i)) < 32) { if (c === drag.c) { done.add(c); sfx.zap(); if (done.size === 4) finish(); } else sfx.bad(); } });
        drag = null;
      },
      draw(dt, m) {
        panelBG(g, '#3a3f45');
        g.fillStyle = '#15181b'; rr(g, 110, 40, W - 220, H - 80, 10); g.fill();
        const wire = (x0, y0, x1, y1, col) => { g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 18; g.beginPath(); g.moveTo(x0, y0 + 3); g.bezierCurveTo(x0 + 120, y0 + 3, x1 - 120, y1 + 3, x1, y1 + 3); g.stroke(); g.strokeStyle = col; g.lineWidth = 14; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + 120, y0, x1 - 120, y1, x1, y1); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0 - 4); g.bezierCurveTo(x0 + 120, y0 - 4, x1 - 120, y1 - 4, x1, y1 - 4); g.stroke(); };
        L.forEach((c, i) => { g.fillStyle = WIRE[c]; g.fillRect(0, ly(i) - 9, 50, 18); g.fillStyle = '#c9a54a'; g.fillRect(48, ly(i) - 12, 22, 24); });
        Rr.forEach((c, i) => { g.fillStyle = WIRE[c]; g.fillRect(W - 50, ly(i) - 9, 50, 18); g.fillStyle = '#c9a54a'; g.fillRect(W - 70, ly(i) - 12, 22, 24); const lit = done.has(c); g.fillStyle = lit ? '#ffe680' : '#3a3410'; g.beginPath(); g.arc(W - 90, ly(i) - 26, 6, 0, 7); g.fill(); });
        for (const c of done) wire(70, ly(L.indexOf(c)), W - 70, ly(Rr.indexOf(c)), WIRE[c]);
        if (drag) wire(70, ly(drag.i), m.x, m.y, WIRE[drag.c]);
        label(g, 'Drag each wire to its matching colour', W / 2, H - 20, 14, '#9aa6b0');
      },
    };
  },
  mop(g, finish) {
    const dirt = document.createElement('canvas'); dirt.width = W; dirt.height = H; const d = dirt.getContext('2d');
    for (let i = 0; i < 26; i++) { const x = 120 + Math.random() * (W - 240), y = 110 + Math.random() * (H - 220), r = 30 + Math.random() * 60; const gr = d.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,48,20,.95)'); gr.addColorStop(0.7, 'rgba(90,64,28,.85)'); gr.addColorStop(1, 'rgba(90,64,28,0)'); d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill(); }
    for (let i = 0; i < 300; i++) { d.fillStyle = `rgba(${40 + Math.random() * 40},${30 + Math.random() * 20},10,.6)`; d.beginPath(); d.arc(150 + Math.random() * (W - 300), 130 + Math.random() * (H - 260), Math.random() * 4, 0, 7); d.fill(); }
    let left = 1, chk = 0, scrubT = 0, base = -1;
    const coverage = () => { const px = d.getImageData(0, 0, W, H).data; let s = 0; for (let i = 3; i < px.length; i += 4 * 37) s += px[i] > 40 ? 1 : 0; return s; };
    base = coverage();
    const floor = document.createElement('canvas'); floor.width = W; floor.height = H; { const f = floor.getContext('2d'); f.fillStyle = '#7d8286'; f.fillRect(0, 0, W, H); for (let i = 0; i < 4000; i++) { f.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'; f.fillRect(Math.random() * W, Math.random() * H, 2, 2); } f.strokeStyle = 'rgba(0,0,0,.3)'; f.lineWidth = 2; for (let x = 0; x < W; x += 140) { f.beginPath(); f.moveTo(x, 0); f.lineTo(x, H); f.stroke(); } }
    return {
      move(p, down) {
        if (!down || left < 0.04) return;
        d.globalCompositeOperation = 'destination-out'; const gr = d.createRadialGradient(p.x, p.y, 0, p.x, p.y, 42); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.beginPath(); d.arc(p.x, p.y, 42, 0, 7); d.fill(); d.globalCompositeOperation = 'source-over';
        scrubT -= 1; if (scrubT < 0) { scrubT = 4; sfx.scrub(); }
      },
      draw(dt, m) {
        g.save(); rr(g, 0, 0, W, H, 18); g.clip(); g.drawImage(floor, 0, 0); g.drawImage(dirt, 0, 0); g.restore();
        chk -= dt; if (chk < 0) { chk = 0.25; left = coverage() / Math.max(1, base); if (left < 0.04) finish(); }
        // mop head under the cursor
        if (m.x > 0) { g.save(); g.translate(m.x, m.y); g.fillStyle = '#ddd6c0'; for (let i = 0; i < 14; i++) { g.rotate(0.45); g.fillRect(-4, 0, 8, 34 + Math.sin(i) * 6); } g.fillStyle = '#5a4a36'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.restore(); }
        g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, W / 2 - 110, 12, 220, 30, 8); g.fill();
        label(g, `Clean: ${Math.round((1 - left) * 100)}%`, W / 2, 27, 16);
      },
    };
  },
  valve(g, finish) {
    let stage = 0, ang = 0, flash = 0; const zones = [0, 1, 2].map(() => Math.random() * Math.PI * 2), speeds = [1.6, 2.3, 3.1];
    const btn = { x: W / 2 - 70, y: H - 80, w: 140, h: 50 };
    return {
      down(p) {
        if (p.x > btn.x && p.x < btn.x + btn.w && p.y > btn.y && p.y < btn.y + btn.h && stage < 3) {
          const dz = Math.atan2(Math.sin(ang - zones[stage]), Math.cos(ang - zones[stage]));
          if (Math.abs(dz) < 0.32) { stage++; sfx.blip(900 + stage * 200); if (stage === 3) finish(); } else { sfx.bad(); flash = 0.4; }
        }
      },
      draw(dt) {
        panelBG(g, '#3e3a36');
        if (stage < 3) ang += speeds[stage] * dt;
        for (let i = 0; i < 3; i++) {
          const cx = 110 + i * 170, cy = 190, r = 70;
          g.fillStyle = '#e9e4d6'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 6; g.stroke();
          g.strokeStyle = 'rgba(40,220,90,.85)'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, r - 14, zones[i] - 0.32 - Math.PI / 2, zones[i] + 0.32 - Math.PI / 2); g.stroke();
          for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); g.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12)); g.stroke(); }
          const a = (i < stage ? zones[i] : i === stage ? ang : 0) - Math.PI / 2;
          g.strokeStyle = i < stage ? '#1aa64a' : '#c41a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); g.stroke();
          g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
          label(g, i < stage ? 'LOCKED' : i === stage ? 'ACTIVE' : '—', cx, cy + r + 24, 14, i < stage ? '#5dff9a' : '#ccc');
        }
        flash -= dt;
        g.fillStyle = flash > 0 ? '#a01818' : '#2a6a3a'; rr(g, btn.x, btn.y, btn.w, btn.h, 10); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
        label(g, 'LOCK', W / 2, btn.y + 25, 20);
        label(g, 'Lock each needle inside the green zone', W / 2, 40, 15, '#b8c2ca');
      },
    };
  },
  upload(g, finish) {
    let prog = -1, t = 0;
    const btn = { x: W / 2 - 90, y: 300, w: 180, h: 54 };
    return {
      down(p) { if (prog < 0 && p.x > btn.x && p.x < btn.x + btn.w && p.y > btn.y && p.y < btn.y + btn.h) { prog = 0; sfx.blip(1300); } },
      draw(dt) {
        panelBG(g, '#2e3a46'); screenRect(g, 40, 40, W - 80, H - 80, '#0a2a4a');
        t += dt;
        // two folders and flying files
        const fold = (x, lab) => { g.fillStyle = '#e8b84a'; rr(g, x - 50, 110, 100, 72, 6); g.fill(); g.fillStyle = '#f5cd6a'; rr(g, x - 50, 100, 44, 18, 4); g.fill(); label(g, lab, x, 205, 13, '#9fd0ff'); };
        fold(150, 'Local'); fold(W - 150, 'Puddle Cloud');
        if (prog >= 0 && prog < 1) { prog += dt / 7.5; for (let k = 0; k < 3; k++) { const f = ((t * 0.9 + k / 3) % 1); const x = 150 + (W - 300) * f, y = 140 - Math.sin(f * Math.PI) * 60; g.fillStyle = '#fff'; g.fillRect(x - 10, y - 13, 20, 26); g.fillStyle = '#9ab'; g.fillRect(x - 6, y - 6, 12, 2); g.fillRect(x - 6, y, 12, 2); } if (Math.random() < dt * 4) sfx.tick(); if (prog >= 1) { prog = 1; finish(); } }
        g.fillStyle = '#0c1824'; rr(g, 80, 240, W - 160, 24, 6); g.fill();
        g.fillStyle = '#2aa0ff'; rr(g, 82, 242, (W - 164) * Math.max(0, prog), 20, 5); g.fill();
        label(g, prog < 0 ? 'Ready' : prog < 1 ? `Uploading… ${Math.floor(prog * 100)}%   ETA ${Math.ceil((1 - prog) * 7.5)}s` : 'Complete', W / 2, 228, 14, '#9fd0ff');
        if (prog < 0) { g.fillStyle = '#1e7ad6'; rr(g, btn.x, btn.y, btn.w, btn.h, 10); g.fill(); label(g, 'UPLOAD', W / 2, btn.y + 27, 20); }
      },
    };
  },
  swipe(g, finish) {
    let state = 'wallet', card = { x: 130, y: 330 }, startT = 0, msg = 'Drag the card out of the wallet', msgCol = '#cfd6dc', drag = false, t = 0, startX = 0;
    return {
      down(p) {
        if (state === 'wallet' && Math.hypot(p.x - card.x, p.y - card.y) < 80) { state = 'ready'; card = { x: 90, y: 180 }; msg = 'Swipe it through the reader'; msgCol = '#cfd6dc'; sfx.blip(800); return; }
        if (state === 'ready' && Math.abs(p.x - card.x) < 70 && Math.abs(p.y - card.y) < 50) { drag = true; startT = t; startX = p.x; }
      },
      move(p, down) { if (drag && down) card.x = Math.max(90, Math.min(W - 90, card.x + (p.x - (card.lx ?? p.x)))); card.lx = p.x; },
      up() {
        if (!drag) return; drag = false; card.lx = undefined;
        const dur = t - startT;
        if (card.x < W - 110) { msg = 'Bad read. Swipe all the way.'; msgCol = '#ff6b6b'; sfx.bad(); }
        else if (dur < 0.45) { msg = 'Too fast. Try again.'; msgCol = '#ff6b6b'; sfx.bad(); }
        else if (dur > 1.3) { msg = 'Too slow. Try again.'; msgCol = '#ff6b6b'; sfx.bad(); }
        else { msg = 'Accepted. Thank you.'; msgCol = '#5dff9a'; state = 'done'; finish(); }
        if (state !== 'done') card.x = 90;
      },
      draw(dt) {
        t += dt; panelBG(g, '#40464c');
        screenRect(g, 60, 30, W - 120, 50, '#0a3a1a'); label(g, msg, W / 2, 55, 17, msgCol);
        // reader
        g.fillStyle = '#23272b'; rr(g, 30, 130, W - 60, 110, 12); g.fill(); g.fillStyle = '#0c0e10'; g.fillRect(40, 175, W - 80, 14);
        g.fillStyle = state === 'done' ? '#2aff70' : '#ff3a3a'; g.beginPath(); g.arc(W - 60, 150, 7, 0, 7); g.fill();
        if (state === 'wallet') { g.fillStyle = '#5a3a22'; rr(g, 40, 290, 200, 120, 14); g.fill(); g.fillStyle = '#4a2e1a'; rr(g, 40, 330, 200, 80, 14); g.fill(); }
        const cx = card.x, cy = state === 'wallet' ? 300 : card.y;
        g.save(); g.translate(cx, cy);
        const gr = g.createLinearGradient(-80, -50, 80, 50); gr.addColorStop(0, '#4fb4ff'); gr.addColorStop(1, '#1a5aa8'); g.fillStyle = gr; rr(g, -80, -50, 160, 100, 10); g.fill();
        g.fillStyle = '#e8d07a'; rr(g, -66, -20, 30, 24, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '800 13px sans-serif'; g.textAlign = 'left'; g.fillText('PUDDLE CREW ID', -66, -32); g.fillStyle = '#bfe4ff'; g.beginPath(); g.arc(40, 10, 22, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(33, 6, 6, 0, 7); g.arc(47, 6, 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(34, 8, 3, 0, 7); g.arc(48, 8, 3, 0, 7); g.fill();
        g.restore();
        if (state === 'wallet') { g.fillStyle = '#4a2e1a'; rr(g, 40, 340, 200, 70, 14); g.fill(); }
      },
    };
  },
  coolant(g, finish) {
    let level = 0, hold = false, target = 0.55 + Math.random() * 0.25, state = 'fill', pourT = 0, msg = 'Hold to pour. Stop on the line.', bad = 0;
    const btn = { x: W - 170, y: H - 110, w: 120, h: 70 };
    return {
      down(p) { if (p.x > btn.x && p.x < btn.x + btn.w && p.y > btn.y && p.y < btn.y + btn.h && state === 'fill') hold = true; },
      up() {
        if (!hold) return; hold = false;
        if (Math.abs(level - target) < 0.045) { state = 'done'; msg = 'Coolant level stable'; finish(); }
        else if (level > target) { msg = 'Overfilled! Draining…'; sfx.bad(); state = 'drain'; bad = 1; }
      },
      draw(dt) {
        panelBG(g, '#2f3e46');
        if (hold) { level = Math.min(1, level + dt * 0.22); pourT -= dt; if (pourT < 0) { pourT = 0.18; sfx.pour(0.2); } if (level >= 1) { hold = false; msg = 'Overfilled! Draining…'; sfx.bad(); state = 'drain'; } }
        if (state === 'drain') { level -= dt * 0.6; if (level <= 0) { level = 0; state = 'fill'; msg = 'Hold to pour. Stop on the line.'; } }
        const tx = 150, ty = 50, tw = 160, th = 330;
        g.fillStyle = 'rgba(200,230,255,.08)'; rr(g, tx, ty, tw, th, 20); g.fill(); g.strokeStyle = '#9ab'; g.lineWidth = 4; g.stroke();
        g.save(); rr(g, tx + 4, ty + 4, tw - 8, th - 8, 16); g.clip();
        const ly = ty + th - (th - 8) * level;
        const gr = g.createLinearGradient(0, ly, 0, ty + th); gr.addColorStop(0, '#5fd0ff'); gr.addColorStop(1, '#1a5aa0'); g.fillStyle = gr;
        g.beginPath(); g.moveTo(tx, ty + th); for (let x = tx; x <= tx + tw; x += 8) g.lineTo(x, ly + Math.sin(x * 0.08 + performance.now() / 200) * (hold ? 4 : 1.5)); g.lineTo(tx + tw, ty + th); g.fill();
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(tx + 20 + ((i * 37 + performance.now() / 30) % (tw - 40)), ly + 20 + ((i * 53 + performance.now() / 10) % Math.max(10, ty + th - ly - 30)), 2 + i % 3, 0, 7); g.fill(); }
        g.restore();
        const tyy = ty + th - (th - 8) * target;
        g.strokeStyle = '#ffd21a'; g.lineWidth = 3; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(tx - 20, tyy); g.lineTo(tx + tw + 20, tyy); g.stroke(); g.setLineDash([]);
        label(g, '◀ FILL LINE', tx + tw + 70, tyy, 14, '#ffd21a');
        if (hold) { g.fillStyle = 'rgba(95,208,255,.8)'; g.fillRect(tx + tw / 2 - 5, ty - 10, 10, ly - ty + 10); }
        g.fillStyle = hold ? '#1a6a9a' : '#2a8ad0'; rr(g, btn.x, btn.y, btn.w, btn.h, 12); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke(); label(g, 'HOLD', btn.x + btn.w / 2, btn.y + btn.h / 2, 22);
        label(g, msg, W / 2, 24, 15, state === 'drain' ? '#ff6b6b' : '#cfe6f2');
      },
    };
  },
  filter(g, finish) {
    const junk = []; for (let i = 0; i < 9; i++) junk.push({ x: 200 + Math.random() * 300, y: 90 + Math.random() * 280, r: Math.random() * 6, k: i % 3, vx: 0, vy: 0, gone: false });
    let drag = null, t = 0;
    return {
      down(p) { for (const j of junk) if (!j.gone && Math.hypot(p.x - j.x, p.y - j.y) < 28) drag = j; },
      move(p, down) { if (drag && down) { drag.x = p.x; drag.y = p.y; if (p.x < 90) { drag.gone = true; drag = null; sfx.whoosh(); if (junk.every(j => j.gone)) finish(); } } },
      up() { drag = null; },
      draw(dt) {
        t += dt; panelBG(g, '#3a4046');
        g.fillStyle = '#111'; rr(g, 20, 60, 70, 320, 10); g.fill(); label(g, '◀ OUT', 55, 220, 14, '#ff9a5a');
        g.fillStyle = '#20262b'; rr(g, 100, 40, W - 130, H - 80, 12); g.fill();
        g.strokeStyle = '#3a444c'; g.lineWidth = 2; for (let x = 110; x < W - 30; x += 14) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, H - 50); g.stroke(); }
        for (const j of junk) {
          if (j.gone) continue;
          if (j !== drag) { j.x += Math.sin(t * 2 + j.r) * 0.3; j.y += Math.cos(t * 1.7 + j.r) * 0.3; }
          g.save(); g.translate(j.x, j.y); g.rotate(t * 0.3 + j.r);
          if (j.k === 0) { g.fillStyle = '#6a8a2a'; g.beginPath(); g.ellipse(0, 0, 26, 12, 0, 0, 7); g.fill(); g.strokeStyle = '#3a5a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-24, 0); g.lineTo(24, 0); g.stroke(); }
          else if (j.k === 1) { g.fillStyle = '#5a4630'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = 16 + Math.sin(k * 3) * 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); }
          else { g.fillStyle = '#9a9a8a'; g.fillRect(-18, -10, 36, 20); g.fillStyle = '#7a7a6a'; g.fillRect(-18, -2, 36, 3); }
          g.restore();
        }
        label(g, 'Drag the gunk out of the filter', W / 2 + 40, 24, 15, '#b8c2ca');
      },
    };
  },
  code(g, finish) {
    const code = String(Math.floor(10000 + Math.random() * 89999)); let typed = '', msg = '', flash = 0;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'];
    const kx = i => 300 + (i % 3) * 70, ky = i => 130 + Math.floor(i / 3) * 66;
    const press = k => {
      if (k === 'C') { typed = ''; sfx.blip(700); return; }
      if (k === '✓') { if (typed === code) { msg = 'ACCEPTED'; finish(); } else { msg = 'WRONG'; flash = 0.5; typed = ''; sfx.bad(); } return; }
      if (typed.length < 5) { typed += k; sfx.blip(900 + +k * 60); }
    };
    return {
      down(p) { keys.forEach((k, i) => { if (Math.abs(p.x - kx(i)) < 30 && Math.abs(p.y - ky(i)) < 28) press(k); }); },
      key(e) { if (/^Digit\d$/.test(e.code)) press(e.code.slice(5)); else if (e.code === 'Enter') press('✓'); else if (e.code === 'Backspace') press('C'); e.preventDefault(); e.stopPropagation(); },
      draw(dt) {
        panelBG(g, '#3a3f45'); flash -= dt;
        // sticky note with the code
        g.save(); g.translate(130, 210); g.rotate(-0.08); g.fillStyle = '#ffe66a'; g.fillRect(-90, -80, 180, 160); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-90, 60, 180, 20);
        g.fillStyle = '#2a2a6a'; g.font = '700 16px "Marker Felt", "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillText('door code:', 0, -40); g.font = '700 38px "Marker Felt", "Comic Sans MS", cursive'; g.fillText(code, 0, 10); g.restore();
        screenRect(g, 260, 40, 210, 56, flash > 0 ? '#5a0a0a' : '#0a3a1a'); label(g, msg && !typed ? msg : typed.padEnd(5, '_').split('').join(' '), 365, 68, 26, flash > 0 ? '#ff5a5a' : '#4aff8a');
        keys.forEach((k, i) => { g.fillStyle = k === '✓' ? '#2a7a3a' : k === 'C' ? '#7a2a2a' : '#c9ced3'; rr(g, kx(i) - 28, ky(i) - 26, 56, 52, 8); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke(); label(g, k, kx(i), ky(i), 22, k === '✓' || k === 'C' ? '#fff' : '#222'); });
      },
    };
  },
  lights(g, finish) {
    const on = [0, 1, 2, 3, 4].map(() => Math.random() < 0.5); if (on.every(Boolean)) on[2] = false;
    return {
      down(p) { on.forEach((v, i) => { const x = 90 + i * 95; if (Math.abs(p.x - x) < 30 && p.y > 150 && p.y < 330) { on[i] = !on[i]; sfx.blip(on[i] ? 1200 : 600); if (on.every(Boolean)) finish(); } }); },
      draw() {
        panelBG(g, '#45403a');
        label(g, 'Flip every breaker UP', W / 2, 40, 18, '#ffd21a');
        on.forEach((v, i) => {
          const x = 90 + i * 95;
          g.fillStyle = v ? '#3aff6a' : '#3a1010'; g.beginPath(); g.arc(x, 110, 10, 0, 7); g.fill();
          g.fillStyle = '#16191c'; rr(g, x - 26, 150, 52, 180, 8); g.fill();
          const y = v ? 170 : 250; g.fillStyle = '#d8dde2'; rr(g, x - 20, y, 40, 60, 6); g.fill(); g.fillStyle = '#9aa'; g.fillRect(x - 14, y + 26, 28, 6);
        });
      },
    };
  },
};
