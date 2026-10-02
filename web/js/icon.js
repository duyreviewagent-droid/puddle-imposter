// ?icon=1 — draws the app icon (1024²): a red-glowing water puddle with googly eyes over a lava pool.
import { drawPuddleIcon } from './puddle.js';

export function drawIcon() {
  document.body.innerHTML = '';
  document.body.style.background = '#000';
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  c.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  document.body.append(c);
  const g = c.getContext('2d');
  const R = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  R(0, 0, 1024, 1024, 220); g.save(); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, '#12060a'); bg.addColorStop(0.55, '#2a0a06'); bg.addColorStop(1, '#ff5a0a');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
  // lava pool
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 1024, y = 760 + Math.random() * 280, r = 20 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const hot = Math.random() < 0.6;
    gr.addColorStop(0, hot ? 'rgba(255,200,80,.9)' : 'rgba(40,8,4,.9)'); gr.addColorStop(1, hot ? 'rgba(255,60,0,0)' : 'rgba(20,4,2,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // embers
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,${120 + Math.random() * 120},40,${Math.random()})`; g.beginPath(); g.arc(Math.random() * 1024, Math.random() * 760, 2 + Math.random() * 5, 0, 7); g.fill(); }
  // steam
  for (let i = 0; i < 14; i++) { const x = 300 + Math.random() * 420, y = 640 + Math.random() * 140, r = 60 + Math.random() * 80; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,230,210,.28)'); gr.addColorStop(1, 'rgba(255,230,210,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // the puddle, big, glowing red
  g.save(); g.shadowColor = '#ff2a1a'; g.shadowBlur = 120; drawPuddleIcon(g, 512, 470, 360, '#ff2a1a'); g.restore();
  drawPuddleIcon(g, 512, 470, 360, '#ff3a2a');
  // drips falling off
  g.fillStyle = 'rgba(170,225,255,.9)';
  for (const [x, y, r] of [[250, 720, 22], [790, 700, 18], [690, 780, 14], [330, 800, 12]]) { g.beginPath(); g.moveTo(x, y - r * 2.2); g.quadraticCurveTo(x + r, y, x, y + r); g.quadraticCurveTo(x - r, y, x, y - r * 2.2); g.fill(); }
  g.restore();
  document.title = 'icon ready';
}
