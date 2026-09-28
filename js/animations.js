/**
 * Ambient Animations & Visual Effects
 * Spider-Web particle network, audio visualizer, and moving 3D Sakura Petals.
 * Strictly NO emojis.
 */

// ---- Spider-Web Particle Lattice ----
export function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let nodes = [];
  let animId = null;
  let mouse = { x: null, y: null, radius: 180 };

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createNode() {
    const roll = Math.random();
    const color = roll > 0.4 ? 'rgba(255, 0, 60,' : (roll > 0.08 ? 'rgba(0, 240, 255,' : 'rgba(255, 42, 133,');

    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.9,
      vy: (Math.random() - 0.5) * 0.9,
      size: Math.random() * 2 + 1,
      colorPrefix: color,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03
    };
  }

  function init() {
    resize();
    nodes = [];
    const count = Math.min(85, Math.floor((canvas.width * canvas.height) / 18000));
    for (let i = 0; i < count; i++) {
      nodes.push(createNode());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      p.pulse += p.pulseSpeed;
      const alpha = 0.4 + Math.sin(p.pulse) * 0.3;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `${p.colorPrefix} ${alpha})`;
      ctx.fill();

      // Mouse connection
      if (mouse.x !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (1 - dist / mouse.radius) * 0.04;
          p.x += dx * force;
          p.y += dy * force;

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${(1 - dist / mouse.radius) * 0.35})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Web connections
      for (let j = i + 1; j < nodes.length; j++) {
        const p2 = nodes[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const maxDist = 130;
        if (dist < maxDist) {
          const strandAlpha = (1 - dist / maxDist) * 0.26;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `${p.colorPrefix} ${strandAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    init();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  init();
  draw();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

// ---- Audio Pulse Visualizer ----
export function initAudioVisualizer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const barCount = 24;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'gothic-sound-bar';
    bar.style.setProperty('--delay', `${(i * 0.05).toFixed(2)}s`);
    container.appendChild(bar);
  }
}

export function setVisualizerPlaying(containerId, isPlaying) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.classList.toggle('playing', isPlaying);
}

// ---- 3D Moving Sakura Flowers in PrisciaVerse Music Room ----
let sakuraInterval = null;

export function startMusicSakuras(containerId = 'sakura-ambient-container') {
  stopMusicSakuras();
  const container = document.getElementById(containerId);
  if (!container) return;

  let flowerCount = 0;

  function dropSakuraFlower() {
    flowerCount++;
    const flower = document.createElement('div');
    flower.className = 'gothic-sakura-flower';

    const startX = Math.random() * 96;
    const size = Math.random() * 22 + 24; // 24px - 46px full blossoms
    const duration = Math.random() * 7 + 8; // 8s - 15s fall duration
    const driftX = (Math.random() - 0.5) * 160;
    const initialRot = Math.random() * 360;
    const spinSpeed = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 400 + 200);

    flower.style.left = `${startX}%`;
    flower.style.width = `${size}px`;
    flower.style.height = `${size}px`;
    flower.style.setProperty('--drift-x', `${driftX}px`);
    flower.style.setProperty('--duration', `${duration}s`);
    flower.style.setProperty('--spin-rot', `${initialRot + spinSpeed}deg`);
    flower.style.setProperty('--init-rot', `${initialRot}deg`);

    // SVG 5-petal cherry blossom flower with pistil/stamens
    const gradId = `sakura-grad-${flowerCount}-${Date.now()}`;
    flower.innerHTML = `
      <svg viewBox="0 0 100 100" class="sakura-flower-svg">
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fff0f5" stop-opacity="0.95" />
            <stop offset="50%" stop-color="#ffb3d1" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#ff2a85" stop-opacity="0.95" />
          </linearGradient>
          <radialGradient id="center-${gradId}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffe066" />
            <stop offset="65%" stop-color="#ff0055" />
            <stop offset="100%" stop-color="#550022" />
          </radialGradient>
        </defs>
        
        <!-- 5 Petals (spaced 72 deg apart with notched tips) -->
        <g transform="translate(50, 50)">
          <!-- Petal 1 (0 deg) -->
          <path d="M 0 0 C -14 -20 -20 -38 0 -48 C 20 -38 14 -20 0 0 Z" fill="url(#${gradId})" />
          <!-- Petal 2 (72 deg) -->
          <path d="M 0 0 C -14 -20 -20 -38 0 -48 C 20 -38 14 -20 0 0 Z" transform="rotate(72)" fill="url(#${gradId})" />
          <!-- Petal 3 (144 deg) -->
          <path d="M 0 0 C -14 -20 -20 -38 0 -48 C 20 -38 14 -20 0 0 Z" transform="rotate(144)" fill="url(#${gradId})" />
          <!-- Petal 4 (216 deg) -->
          <path d="M 0 0 C -14 -20 -20 -38 0 -48 C 20 -38 14 -20 0 0 Z" transform="rotate(216)" fill="url(#${gradId})" />
          <!-- Petal 5 (288 deg) -->
          <path d="M 0 0 C -14 -20 -20 -38 0 -48 C 20 -38 14 -20 0 0 Z" transform="rotate(288)" fill="url(#${gradId})" />
          
          <!-- Center floral disc & stamens -->
          <circle cx="0" cy="0" r="7" fill="url(#center-${gradId})" />
          <!-- Delicate radial stamen dots -->
          <circle cx="-5" cy="-6" r="1.5" fill="#ffe066" />
          <circle cx="5" cy="-6" r="1.5" fill="#ffe066" />
          <circle cx="7" cy="3" r="1.5" fill="#ffe066" />
          <circle cx="0" cy="8" r="1.5" fill="#ffe066" />
          <circle cx="-7" cy="3" r="1.5" fill="#ffe066" />
        </g>
      </svg>
    `;

    container.appendChild(flower);
    setTimeout(() => {
      flower.remove();
    }, duration * 1000 + 500);
  }

  // Initial burst of Sakura blossoms
  for (let i = 0; i < 7; i++) {
    setTimeout(dropSakuraFlower, i * 350);
  }

  sakuraInterval = setInterval(dropSakuraFlower, 1100);
}

export function stopMusicSakuras() {
  if (sakuraInterval) {
    clearInterval(sakuraInterval);
    sakuraInterval = null;
  }
}

