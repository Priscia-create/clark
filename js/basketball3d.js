/**
 * 3D Basketball Canvas Module (Three.js)
 * Clean 3D basketball enclosed within an interactive transparent 3D cube.
 * Rotates smoothly, bounces on click, and comes to a complete rest after bouncing.
 */

import * as THREE from 'three';

let audioCtx = null;
function playBounceSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.15);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {}
}

function generateBasketballTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Vibrant basketball orange
  const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  baseGrad.addColorStop(0, '#f56326');
  baseGrad.addColorStop(0.5, '#d64617');
  baseGrad.addColorStop(1, '#a6320e');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Micro leather dimple noise
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 24;
    data[i] = Math.min(255, Math.max(0, data[i] + grain));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain * 0.7));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain * 0.4));
  }
  ctx.putImageData(imgData, 0, 0);

  // Black seam lines
  ctx.save();
  ctx.strokeStyle = '#121316';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';

  // Equator
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Meridians
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.25, 0);
  ctx.lineTo(canvas.width * 0.25, canvas.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.75, 0);
  ctx.lineTo(canvas.width * 0.75, canvas.height);
  ctx.stroke();

  // Curved ribs
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.18, canvas.height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, canvas.height * 0.5, canvas.width * 0.18, canvas.height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(canvas.width, canvas.height * 0.5, canvas.width * 0.18, canvas.height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class Basketball3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ball = null;
    this.cubeMesh = null;
    this.cubeEdges = null;
    this.shadowMesh = null;
    this.animId = null;

    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.autoRotateSpeed = 0.012;
    this.cubeRotateSpeed = 0.007;

    this.isBouncing = false;
    this.bounceVelocity = 0;
    this.bounceY = 0;
    this.bounceCount = 0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 340;
    const height = this.container.clientHeight || 300;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0.3, 4.4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 1. Basketball Sphere
    const ballGeometry = new THREE.SphereGeometry(1.05, 48, 48);
    const texture = generateBasketballTexture();
    const ballMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.52,
      metalness: 0.05
    });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.scene.add(this.ball);

    // 2. 3D Transparent Cube-shaped Box around the ball
    const boxSize = 2.8;
    const cubeGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.65,
      ior: 1.15,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
    this.cubeMesh.rotation.set(0.12, 0.28, 0);
    this.scene.add(this.cubeMesh);

    // Transparent glass cube edge lines (transparent white, NOT blue)
    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28
    });
    this.cubeEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.cubeEdges.rotation.set(0.12, 0.28, 0);
    this.scene.add(this.cubeEdges);

    // Ground shadow beneath ball
    const shadowGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -1.25;
    this.scene.add(this.shadowMesh);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(4, 5, 4);
    this.scene.add(dirLight);

    const rimWhite = new THREE.DirectionalLight(0xffffff, 0.85);
    rimWhite.position.set(-3, 2, -2);
    this.scene.add(rimWhite);

    const rimRed = new THREE.DirectionalLight(0xff003c, 1.1);
    rimRed.position.set(3, -2, -1);
    this.scene.add(rimRed);

    this.setupEvents();
    this.animate();
  }

  setupEvents() {
    const el = this.renderer.domElement;

    const onDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = {
        x: e.clientX || (e.touches && e.touches[0].clientX),
        y: e.clientY || (e.touches && e.touches[0].clientY)
      };
      this.startBounce();
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      const deltaX = clientX - this.previousMousePosition.x;
      const deltaY = clientY - this.previousMousePosition.y;

      this.ball.rotation.y += deltaX * 0.015;
      this.ball.rotation.x += deltaY * 0.015;

      // Cube moves in the opposite direction
      if (this.cubeMesh && this.cubeEdges) {
        this.cubeMesh.rotation.y -= deltaX * 0.009;
        this.cubeMesh.rotation.x -= deltaY * 0.009;
        this.cubeEdges.rotation.copy(this.cubeMesh.rotation);
      }

      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onUp = () => {
      this.isDragging = false;
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    el.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    window.addEventListener('resize', () => this.resize());
  }

  startBounce() {
    if (this.isBouncing) return;
    this.isBouncing = true;
    this.bounceVelocity = 0.15;
    this.bounceCount = 0;
    playBounceSound();
  }

  resize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());
    if (!this.ball) return;

    // Ball and cube move in opposite directions
    if (!this.isDragging) {
      this.ball.rotation.y += this.autoRotateSpeed;
      if (this.cubeMesh && this.cubeEdges) {
        this.cubeMesh.rotation.y -= this.cubeRotateSpeed;
        this.cubeMesh.rotation.x -= this.cubeRotateSpeed * 0.35;
        this.cubeEdges.rotation.copy(this.cubeMesh.rotation);
      }
    }

    // Bounce physics with clean stop
    if (this.isBouncing) {
      this.bounceY += this.bounceVelocity;
      this.bounceVelocity -= 0.011; // Gravity

      if (this.bounceY <= 0) {
        this.bounceY = 0;
        this.bounceVelocity = -this.bounceVelocity * 0.58; // Damping
        this.bounceCount++;

        // Stop bouncing after 3-4 natural bounces and stay at rest
        if (Math.abs(this.bounceVelocity) > 0.035 && this.bounceCount < 4) {
          playBounceSound();
        } else {
          this.isBouncing = false;
          this.bounceVelocity = 0;
          this.bounceY = 0;
        }
      }

      this.ball.position.y = this.bounceY;
      if (this.shadowMesh) {
        const s = Math.max(0.6, 1 - this.bounceY * 0.35);
        this.shadowMesh.scale.set(s, s, 1);
        this.shadowMesh.material.opacity = Math.max(0.1, 0.38 - this.bounceY * 0.2);
      }
    } else {
      this.ball.position.y = 0;
      if (this.shadowMesh) {
        this.shadowMesh.scale.set(1, 1, 1);
        this.shadowMesh.material.opacity = 0.38;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}
