import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:/Users/Kamyc/Documents/AI-Do";
const output = path.join(root, "marketing", "aido-60s-saas-demo-female-voiceover.webm");

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logoData = fs.readFileSync(path.join(root, "artifacts/aido/public/landing-logo-transparent.png")).toString("base64");
const coupleData = fs.readFileSync(path.join(root, "artifacts/aido/public/images/default-wedding-couple.jpg")).toString("base64");
const floralData = fs.readFileSync(path.join(root, "artifacts/aido/public/images/floral-bg.png")).toString("base64");
const audioData = fs.readFileSync(path.join(root, "marketing/aido-60s-voiceover-natural.mp3")).toString("base64");
const portalScreens = {
  dashboard: fs.readFileSync(path.join(root, "marketing/portal-screens/dashboard.png")).toString("base64"),
  vendors: fs.readFileSync(path.join(root, "marketing/portal-screens/vendors.png")).toString("base64"),
  guests: fs.readFileSync(path.join(root, "marketing/portal-screens/guests.png")).toString("base64"),
  timeline: fs.readFileSync(path.join(root, "marketing/portal-screens/timeline.png")).toString("base64"),
  documents: fs.readFileSync(path.join(root, "marketing/portal-screens/documents.png")).toString("base64"),
  website: fs.readFileSync(path.join(root, "marketing/portal-screens/website-editor.png")).toString("base64"),
};

await page.setContent(`<!doctype html>
<html>
<body style="margin:0;background:#fff7f2">
<canvas id="c" width="1280" height="720"></canvas>
<audio id="voice" src="data:audio/mpeg;base64,${audioData}"></audio>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const voice = document.getElementById('voice');
const logo = new Image();
const couple = new Image();
const floral = new Image();
const portal = {
  dashboard: new Image(),
  vendors: new Image(),
  guests: new Image(),
  timeline: new Image(),
  documents: new Image(),
  website: new Image(),
};
logo.src = 'data:image/png;base64,${logoData}';
couple.src = 'data:image/jpeg;base64,${coupleData}';
floral.src = 'data:image/png;base64,${floralData}';
portal.dashboard.src = 'data:image/png;base64,${portalScreens.dashboard}';
portal.vendors.src = 'data:image/png;base64,${portalScreens.vendors}';
portal.guests.src = 'data:image/png;base64,${portalScreens.guests}';
portal.timeline.src = 'data:image/png;base64,${portalScreens.timeline}';
portal.documents.src = 'data:image/png;base64,${portalScreens.documents}';
portal.website.src = 'data:image/png;base64,${portalScreens.website}';

const brand = '#8d294d';
const ink = '#24171d';
const muted = '#6f3e54';
const blush = '#fff7f2';
const rose = '#f7d9dc';
const sage = '#6f8f7a';

function clamp(n, min = 0, max = 1) { return Math.max(min, Math.min(max, n)); }
function easeOutCubic(n) { return 1 - Math.pow(1 - clamp(n), 3); }
function easeInOut(n) {
  n = clamp(n);
  return n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2;
}
function lerp(a, b, n) { return a + (b - a) * n; }

const scenes = [
  { eyebrow:'The wedding workspace', title:'Planning gets messy fast.', sub:'Budgets, guests, vendors, RSVPs, documents, and deadlines all competing for attention.', kind:'mess' },
  { eyebrow:'Meet A.IDO', title:'One place for the whole plan.', sub:'A calm command center for couples, planners, and collaborators.', kind:'dashboard' },
  { eyebrow:'Budget + Vendors', title:'Know what is booked, paid, and still due.', sub:'Vendor tracking and budget tools stay connected.', kind:'vendors' },
  { eyebrow:'Guests + Invitations', title:'From guest list to invitation studio.', sub:'Design, preview, and coordinate the guest experience in one place.', kind:'phone' },
  { eyebrow:'Timeline + Checklist', title:'Turn plans into a wedding day schedule.', sub:'Adjust the flow and keep day-of details clear.', kind:'timeline' },
  { eyebrow:'Documents + Contracts', title:'Keep important terms visible.', sub:'Preview files, extract details, and organize by folder, tag, and vendor.', kind:'docs' },
  { eyebrow:'Website + Day-Of', title:'Share the details beautifully.', sub:'Publish your wedding website and keep operations ready for the big day.', kind:'website' },
  { eyebrow:'A smarter wedding planning workspace', title:'Plan smarter. Celebrate easier.', sub:'Budgets, vendors, guests, invitations, timelines, documents, websites, and day-of coordination.', kind:'final' }
];

function roundRect(x,y,w,h,r,fill,stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function text(txt,x,y,size,color=ink,weight='700',font='Inter, Arial',max=520,line=1.18) {
  ctx.font = weight + ' ' + size + 'px ' + font;
  ctx.fillStyle = color;
  const words = txt.split(' ');
  let l = '', yy = y;
  for (const w of words) {
    const test = l ? l + ' ' + w : w;
    if (ctx.measureText(test).width > max && l) { ctx.fillText(l,x,yy); l = w; yy += size*line; }
    else l = test;
  }
  if (l) ctx.fillText(l,x,yy);
}

function title(txt,x,y,size=56,max=500) { text(txt,x,y,size,ink,'700','Georgia, serif',max,1.03); }

function drawImageContain(img, x, y, w, h) {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * ratio;
  const dh = img.naturalHeight * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawBrand() {
  drawImageContain(logo, 42, 18, 76, 76);
  text('aidowedding.net', 1080, 56, 19, muted, '800', 'Inter, Arial', 180);
}

function drawBg() {
  ctx.fillStyle = blush; ctx.fillRect(0,0,1280,720);
  ctx.globalAlpha = 0.16; ctx.drawImage(floral,0,0,1280,720); ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0,0,1280,720);
  g.addColorStop(0,'rgba(255,247,242,0.96)'); g.addColorStop(1,'rgba(247,217,220,0.86)');
  ctx.fillStyle = g; ctx.fillRect(0,0,1280,720);
}

function drawCaption(s, p) {
  return;
}

function copy(s, p) {
  const a = easeOutCubic(p / 0.34);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(-22 * (1 - a), 0);
  roundRect(64, 130, 230, 44, 22, 'rgba(255,255,255,0.78)');
  text(s.eyebrow, 84, 159, 16, brand, '850', 'Inter, Arial', 190);
  title(s.title, 64, 238, 58, 520);
  text(s.sub, 64, 386, 23, '#49313b', '500', 'Inter, Arial', 500, 1.28);
  ctx.restore();
}

function mock(x,y,w,h,name) {
  roundRect(x,y,w,h,8,'rgba(255,255,255,0.94)','rgba(141,41,77,0.14)');
  ctx.fillStyle = '#fff'; ctx.fillRect(x+1,y+1,w-2,50);
  ctx.strokeStyle = 'rgba(141,41,77,0.1)'; ctx.beginPath(); ctx.moveTo(x,y+50); ctx.lineTo(x+w,y+50); ctx.stroke();
  ['#f1b6c4','#e6c1ca','#d69dae'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+22+i*20,y+25,6,0,Math.PI*2);ctx.fill();});
  text(name,x+w-190,y+31,16,brand,'850','Inter, Arial',170);
}

function drawCursor(x, y) {
  ctx.save();
  ctx.shadowColor = 'rgba(36,23,29,0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = brand;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 30);
  ctx.lineTo(x + 8, y + 23);
  ctx.lineTo(x + 14, y + 37);
  ctx.lineTo(x + 25, y + 32);
  ctx.lineTo(x + 18, y + 19);
  ctx.lineTo(x + 29, y + 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawClickPulse(x, y, t) {
  const pulse = clamp(1 - Math.abs(t) / 0.12);
  if (pulse <= 0) return;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = brand;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 13 + (1 - pulse) * 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(141,41,77,0.12)';
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClickthrough(p, points) {
  if (!points.length) return;
  const eased = easeInOut(p);
  const scaled = eased * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - i;
  const point = points.length === 1
    ? points[0]
    : { x: lerp(points[i].x, points[i + 1].x, easeInOut(local)), y: lerp(points[i].y, points[i + 1].y, easeInOut(local)) };

  for (let n = 1; n < points.length; n++) {
    const clickTime = n / (points.length - 1);
    drawClickPulse(points[n].x, points[n].y, eased - clickTime);
  }
  drawCursor(point.x, point.y);
}

function portalWindow(img, x, y, w, h, name, p = 0, points = []) {
  roundRect(x, y, w, h, 8, 'rgba(255,255,255,0.96)', 'rgba(141,41,77,0.16)');
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 1, w - 2, 48);
  ctx.strokeStyle = 'rgba(141,41,77,0.1)';
  ctx.beginPath();
  ctx.moveTo(x, y + 48);
  ctx.lineTo(x + w, y + 48);
  ctx.stroke();
  ['#f1b6c4','#e6c1ca','#d69dae'].forEach((c,i)=>{
    ctx.fillStyle=c;
    ctx.beginPath();
    ctx.arc(x+24+i*20,y+24,6,0,Math.PI*2);
    ctx.fill();
  });
  text(name, x + w - 220, y + 31, 16, brand, '850', 'Inter, Arial', 200);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 16, y + 64, w - 32, h - 82);
  ctx.clip();
  const innerX = x + 16;
  const innerY = y + 64;
  const innerW = w - 32;
  const innerH = h - 82;
  const zoom = 1.015 + Math.sin(easeInOut(p) * Math.PI) * 0.012;
  ctx.translate(innerX + innerW / 2, innerY + innerH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-(innerX + innerW / 2), -(innerY + innerH / 2));
  drawImageContain(img, innerX, innerY, innerW, innerH);
  ctx.restore();
  drawClickthrough(p, points);
}

function metric(x,y,label,val,pct) {
  roundRect(x,y,220,122,8,'#fff','rgba(141,41,77,0.13)');
  text(label,x+18,y+28,14,muted,'800','Inter, Arial',180);
  text(val,x+18,y+72,30,brand,'900','Inter, Arial',180);
  roundRect(x+18,y+92,170,9,8,'#f0dfe4');
  roundRect(x+18,y+92,170*pct,9,8,brand);
}

function drawScene(s, p) {
  drawBg();
  if (s.kind === 'final') {
    const intro = easeOutCubic(p / 0.45);
    ctx.save();
    ctx.globalAlpha = intro;
    ctx.translate(0, 18 * (1 - intro));
    drawImageContain(logo, 465, 220, 350, 240);
    ctx.restore();
    return;
  }
  drawBrand();
  const intro = easeOutCubic(p / 0.5);
  const drift = Math.sin(easeInOut(p) * Math.PI) * 5;
  ctx.save();
  ctx.globalAlpha = intro;
  ctx.translate(0, 26 * (1 - intro) - drift);
  if (s.kind !== 'final') copy(s, p);
  const x=620, y=130;
  if (s.kind==='mess') {
    [['Spreadsheet totals','Version 7 final final'],['Vendor emails','Deposits, due dates, contracts'],['Guest texts','Plus ones, hotels, meals'],['Random notes','Timeline changes everywhere']].forEach((m,i)=>{
      const xx=620+(i%2)*270, yy=180+Math.floor(i/2)*145;
      roundRect(xx,yy,238,112,8,'rgba(255,255,255,0.86)','rgba(141,41,77,0.13)');
      text(m[0],xx+20,yy+36,19,ink,'850','Inter, Arial',196,1.05);
      text(m[1],xx+20,yy+73,14,muted,'700','Inter, Arial',190);
    });
  }
  if (s.kind==='dashboard') {
    portalWindow(portal.dashboard, 590, 138, 620, 430, 'Dashboard', p, [
      { x: 1008, y: 452 },
      { x: 906, y: 364 },
      { x: 793, y: 496 },
      { x: 1106, y: 496 },
    ]);
  }
  if (s.kind==='vendors') {
    portalWindow(portal.vendors, 590, 138, 620, 430, 'Vendor Tracking', p, [
      { x: 1126, y: 274 },
      { x: 950, y: 410 },
      { x: 837, y: 524 },
      { x: 1160, y: 544 },
    ]);
  }
  if (s.kind==='phone') {
    portalWindow(portal.guests, 590, 138, 620, 430, 'Guest List & Invitations', p, [
      { x: 1010, y: 278 },
      { x: 1144, y: 346 },
      { x: 776, y: 418 },
      { x: 974, y: 278 },
    ]);
  }
  if (s.kind==='timeline') {
    portalWindow(portal.timeline, 590, 138, 620, 430, 'Timeline', p, [
      { x: 1124, y: 266 },
      { x: 796, y: 362 },
      { x: 912, y: 450 },
      { x: 1110, y: 520 },
    ]);
  }
  if (s.kind==='docs') {
    portalWindow(portal.documents, 590, 138, 620, 430, 'Document Library', p, [
      { x: 1130, y: 284 },
      { x: 834, y: 348 },
      { x: 990, y: 424 },
      { x: 790, y: 518 },
    ]);
  }
  if (s.kind==='website') {
    portalWindow(portal.website, 590, 138, 620, 430, 'Website Editor', p, [
      { x: 760, y: 320 },
      { x: 895, y: 388 },
      { x: 1124, y: 280 },
      { x: 1090, y: 520 },
    ]);
  }
  ctx.restore();
  drawCaption(s, p);
}

async function waitImages() {
  await Promise.all([logo,couple,floral,...Object.values(portal)].map(async img => {
    if (img.decode) {
      await img.decode();
      return;
    }
    if (img.complete && img.naturalWidth) return;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  }));
}

window.recordAd = async () => {
  await waitImages();
  drawScene(scenes[0], 0);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(voice);
  source.connect(dest);
  source.connect(audioCtx.destination);
  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 6500000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise(resolve => recorder.onstop = resolve);
  recorder.start(1000);
  const start = performance.now();
  await audioCtx.resume();
  await voice.play();
  const audioDuration = Number.isFinite(voice.duration) ? voice.duration * 1000 : 64000;
  const duration = Math.max(68000, audioDuration + 2500);
  function frame(now) {
    const elapsed = Math.min(duration, now - start);
    const index = Math.min(scenes.length - 1, Math.floor(elapsed / (duration / scenes.length)));
    drawScene(scenes[index], (elapsed % (duration / scenes.length)) / (duration / scenes.length));
    if (elapsed < duration) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  await new Promise(r => setTimeout(r, duration + 500));
  recorder.stop();
  await done;
  const blob = new Blob(chunks, { type: 'video/webm' });
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
};
</script>
</body>
</html>`, { waitUntil: "load" });

await page.evaluate(async () => {
  await waitImages();
  drawScene(scenes[0], 0);
});
await page.screenshot({ path: path.join(root, "marketing", "aido-source-frame-check.png") });

const bytes = await page.evaluate(() => window.recordAd());
fs.writeFileSync(output, Buffer.from(bytes));
await browser.close();
console.log(output);
