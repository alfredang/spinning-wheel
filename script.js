/* ================================================================
   Spinning Wheel — Pure JS (Canvas)
   ================================================================ */

// ── Color Palette (12 distinct, vibrant colors) ──
const COLORS = [
  '#7c3aed', '#f472b6', '#fb923c', '#34d399',
  '#60a5fa', '#f43f5e', '#a78bfa', '#fbbf24',
  '#2dd4bf', '#e879f9', '#38bdf8', '#4ade80'
];

// ── DOM References ──
const canvas      = document.getElementById('wheel');
const ctx         = canvas.getContext('2d');
const textarea    = document.getElementById('entries');
const counterEl   = document.getElementById('counter');
const validationEl= document.getElementById('validation');
const spinBtn     = document.getElementById('spinBtn');
const shuffleBtn  = document.getElementById('shuffleBtn');
const resetBtn    = document.getElementById('resetBtn');
const resultEl    = document.getElementById('result');
const confettiCvs = document.getElementById('confetti-canvas');
const confettiCtx = confettiCvs.getContext('2d');

const DEFAULT_ENTRIES = 'Pizza Night\nMovie Marathon\nBoard Games\nKaraoke\nRoad Trip';
const CX = canvas.width / 2;
const CY = canvas.height / 2;
const RADIUS = CX - 16;

let currentAngle = 0;   // cumulative rotation in radians
let spinning = false;
let audioCtx = null;

// ── Helpers ──
function getEntries() {
  return textarea.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function updateCounter() {
  const count = getEntries().length;
  counterEl.textContent = `${count} / 12`;
  const valid = count >= 3 && count <= 12;
  counterEl.classList.toggle('invalid', !valid);
  if (count < 3) {
    validationEl.textContent = 'Add at least 3 entries to spin.';
  } else if (count > 12) {
    validationEl.textContent = 'Maximum 12 entries allowed.';
  } else {
    validationEl.textContent = '';
  }
  spinBtn.disabled = !valid || spinning;
}

// ── Draw Wheel ──
function drawWheel(entries, rotation) {
  const n = entries.length;
  if (n === 0) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  const sliceAngle = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(rotation);

  for (let i = 0; i < n; i++) {
    const startA = i * sliceAngle;
    const endA = startA + sliceAngle;

    // Segment
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, RADIUS, startA, endA);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();

    // Thin border between slices
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.rotate(startA + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;

    // Auto-size font
    let fontSize = n <= 6 ? 26 : n <= 9 ? 22 : 18;
    const maxLabelWidth = RADIUS * 0.62;
    ctx.font = `700 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    let text = entries[i];
    // Truncate if too wide
    while (ctx.measureText(text).width > maxLabelWidth && text.length > 1) {
      text = text.slice(0, -1);
    }
    if (text !== entries[i]) text += '…';

    ctx.fillText(text, RADIUS - 24, fontSize / 3);
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1b3a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.restore();
}

// ── Spin Animation ──
function spin() {
  const entries = getEntries();
  if (entries.length < 3 || entries.length > 12 || spinning) return;

  spinning = true;
  spinBtn.disabled = true;
  shuffleBtn.disabled = true;
  resetBtn.disabled = true;
  resultEl.classList.remove('visible');
  resultEl.textContent = '';

  // Random target: 5-9 full rotations + random offset
  const extraRotations = (5 + Math.random() * 4) * Math.PI * 2;
  const targetAngle = currentAngle + extraRotations;

  const startAngle = currentAngle;
  const totalDelta = targetAngle - startAngle;
  const duration = 4500; // ms
  const startTime = performance.now();

  // Track last segment index for tick sound
  let lastSegIdx = -1;

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Cubic ease-out
    const eased = 1 - Math.pow(1 - t, 3);
    currentAngle = startAngle + totalDelta * eased;

    drawWheel(entries, currentAngle);

    // Tick sound when crossing segment boundary
    const n = entries.length;
    const sliceAngle = (Math.PI * 2) / n;
    // The pointer is at the top (–π/2). Which segment is under it?
    const normalised = ((Math.PI * 1.5 - currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const segIdx = Math.floor(normalised / sliceAngle) % n;
    if (segIdx !== lastSegIdx) {
      lastSegIdx = segIdx;
      playTick(t); // quieter as it slows
    }

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Determine winner
      const winnerIdx = segIdx;
      showWinner(entries[winnerIdx]);
      spinning = false;
      updateCounter();
      shuffleBtn.disabled = false;
      resetBtn.disabled = false;
    }
  }

  requestAnimationFrame(animate);
}

// ── Winner Display + Celebration ──
function showWinner(name) {
  resultEl.textContent = `🎉 ${name} 🎉`;
  // Force reflow then add class for transition
  void resultEl.offsetWidth;
  resultEl.classList.add('visible');
  playWinSound();
  launchConfetti();
}

// ── Confetti ──
function launchConfetti() {
  confettiCvs.width = window.innerWidth;
  confettiCvs.height = window.innerHeight;

  const particles = [];
  const PARTICLE_COUNT = 120;
  const confettiColors = ['#a78bfa','#f472b6','#fb923c','#34d399','#60a5fa','#fbbf24','#e879f9','#f43f5e'];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: confettiCvs.width / 2 + (Math.random() - 0.5) * 200,
      y: confettiCvs.height / 2 - 100,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.25 + Math.random() * 0.1,
      opacity: 1
    });
  }

  let frame = 0;
  const maxFrames = 180;

  function render() {
    confettiCtx.clearRect(0, 0, confettiCvs.width, confettiCvs.height);
    frame++;

    for (const p of particles) {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (frame > maxFrames - 40) p.opacity -= 0.025;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.globalAlpha = Math.max(0, p.opacity);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
    }

    if (frame < maxFrames) requestAnimationFrame(render);
    else confettiCtx.clearRect(0, 0, confettiCvs.width, confettiCvs.height);
  }

  requestAnimationFrame(render);
}

// ── Sound Effects (Web Audio, self-contained) ──
function ensureAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
}

function playTick(progress) {
  ensureAudioCtx();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600 + Math.random() * 200;
    gain.gain.value = 0.08 * (1 - progress * 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch(e) {}
}

function playWinSound() {
  ensureAudioCtx();
  if (!audioCtx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.12);
      osc.stop(audioCtx.currentTime + i * 0.12 + 0.45);
    });
  } catch(e) {}
}

// ── Shuffle ──
function shuffleEntries() {
  const entries = getEntries();
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  textarea.value = entries.join('\n');
  updateCounter();
  drawWheel(entries, currentAngle);
}

// ── Reset ──
function resetAll() {
  textarea.value = DEFAULT_ENTRIES;
  currentAngle = 0;
  resultEl.classList.remove('visible');
  resultEl.textContent = '';
  updateCounter();
  drawWheel(getEntries(), currentAngle);
}

// ── Event Listeners ──
textarea.addEventListener('input', () => {
  updateCounter();
  drawWheel(getEntries(), currentAngle);
});

spinBtn.addEventListener('click', spin);
shuffleBtn.addEventListener('click', shuffleEntries);
resetBtn.addEventListener('click', resetAll);

// ── Init ──
updateCounter();
drawWheel(getEntries(), currentAngle);
