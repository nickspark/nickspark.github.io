const canvas = document.getElementById('pickleball-court');
const ctx = canvas.getContext('2d');
const frame = canvas.parentElement;
const status = document.getElementById('game-status');
const reset = document.getElementById('reset-rally');
const paddleImage = new Image();
paddleImage.src = 'assets/pickleball-paddle.webp';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const gravity = 0.38;
let width = 0;
let height = 0;
let lastTime = 0;
let phase = 'ready';
let pointerActive = false;
let pointer = { x: 0, y: 0 };
let ball = { x: 0.5, y: 0.16, z: 0 };
let velocity = { x: 0, y: 0, z: 0 };
let bounceCount = 0;
let hitCooldown = 0;
let flash = 0;
let spin = 0;

// View across the long side of the court, as in the reference photograph.
// x follows the 44 ft length; y follows the 20 ft width.
function project(x, y) {
  const span = 0.9 - y * 0.16;
  return {
    x: width * (0.5 + (x - 0.5) * span),
    y: height * (0.78 - y * 0.52),
  };
}

function unproject(px, py) {
  const y = (0.78 - py / height) / 0.52;
  return { x: 0.5 + (px / width - 0.5) / (0.9 - y * 0.16), y };
}

function resize() {
  const bounds = frame.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  draw();
  if (document.documentElement.classList.contains('embedded-game')) {
    window.parent.postMessage({ type: 'pickleball-height', height: document.body.scrollHeight }, '*');
  }
}

function movePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const world = unproject(pointer.x, pointer.y);
  // The ball can rise above the far sideline, so the paddle follows the
  // pointer anywhere inside the canvas. Serving still requires a court click.
  pointerActive = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
  canvas.style.cursor = pointerActive ? 'none' : 'default';
  return world;
}

function ballScreen() {
  const ground = project(ball.x, ball.y);
  return { x: ground.x, y: ground.y - ball.z * height * 0.7 };
}

function launch(from, targetX, targetY, flightTime) {
  ball = { ...from };
  velocity = {
    x: (targetX - from.x) / flightTime,
    y: (targetY - from.y) / flightTime,
    z: (0.5 * gravity * flightTime * flightTime - from.z) / flightTime,
  };
  phase = 'flight';
  bounceCount = 0;
  hitCooldown = 0.35;
  status.textContent = 'Click the ball to return';
}

function serve(point) {
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
  const fromLeft = point.x < 0.5;
  launch(
    { x: clamp(point.x, 0.08, 0.92), y: clamp(point.y, 0.1, 0.9), z: 0.06 },
    fromLeft ? random(0.72, 0.85) : random(0.15, 0.28),
    random(0.25, 0.75),
    2.45,
  );
}

function tryPaddleHit() {
  if (!pointerActive || phase !== 'flight' || hitCooldown > 0) return;
  const screen = ballScreen();
  const radius = clamp(width * 0.034, 24, 38);
  if (Math.hypot(screen.x - pointer.x, screen.y - pointer.y) > radius) return;

  const goingRight = velocity.x > 0;
  const targetX = goingRight ? random(0.14, 0.25) : random(0.75, 0.86);
  launch({ ...ball, z: Math.max(ball.z, 0.04) }, targetX, clamp(ball.y + random(-0.2, 0.2), 0.18, 0.82), 2.45);
  flash = 0.22;
}

function resetRally() {
  phase = 'ready';
  ball = { x: 0.2, y: 0.48, z: 0 };
  velocity = { x: 0, y: 0, z: 0 };
  bounceCount = 0;
  status.textContent = 'Click the court to serve · click the ball to return';
}

canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerleave', () => {
  pointerActive = false;
  canvas.style.cursor = 'default';
});
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const point = movePointer(event);
  if (phase === 'ready' || phase === 'ended') serve(point);
  else tryPaddleHit();
});
canvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (phase === 'ready' || phase === 'ended') serve({ x: 0.2, y: 0.48 });
});
reset.addEventListener('click', resetRally);

function update(dt) {
  flash = Math.max(0, flash - dt);
  hitCooldown = Math.max(0, hitCooldown - dt);
  if (phase === 'flight') {
    spin += dt * 1.8;
    ball.x += velocity.x * dt;
    ball.y += velocity.y * dt;
    ball.z += velocity.z * dt;
    velocity.z -= gravity * dt;

    if (ball.z <= 0 && velocity.z < 0) {
      ball.z = 0;
      bounceCount += 1;
      velocity.z = 0.12;
    }
    if (bounceCount > 0 && (ball.x < 0 || ball.x > 1 || ball.y < 0 || ball.y > 1)) endRally();
  }
}

function endRally() {
  phase = 'ended';
  status.textContent = 'Click for another ball';
}

function polygon(points, fill, stroke, thickness = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = thickness; ctx.stroke(); }
}

function line(a, b, color, thickness = 1) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
}

function drawCourt() {
  ctx.fillStyle = '#f7f8f5';
  ctx.fillRect(0, 0, width, height);
  polygon([project(-0.025, -0.06), project(1.025, -0.06), project(1.025, 1.06), project(-0.025, 1.06)], '#eef3ef');
  polygon([project(0, 0), project(1, 0), project(1, 1), project(0, 1)], '#e2ece5', '#698b7d', 1.8);
  polygon([project(0.341, 0), project(0.659, 0), project(0.659, 1), project(0.341, 1)], '#edf1e8');
  const color = '#fff';
  line(project(0.341, 0), project(0.341, 1), color, 2);
  line(project(0.659, 0), project(0.659, 1), color, 2);
  line(project(0, 0.5), project(0.341, 0.5), color, 2);
  line(project(0.659, 0.5), project(1, 0.5), color, 2);

  // The net spans the short dimension at the middle of the court.
  const lift = clamp(height * 0.065, 20, 35);
  const a = project(0.5, 0);
  const b = project(0.5, 1);
  polygon([a, b, { x: b.x, y: b.y - lift }, { x: a.x, y: a.y - lift }], 'rgba(75,108,95,.065)');
  for (let i = 0; i <= 16; i += 1) {
    const p = project(0.5, i / 16);
    line(p, { x: p.x, y: p.y - lift }, 'rgba(66,101,86,.28)');
  }
  line({ x: a.x, y: a.y - lift }, { x: b.x, y: b.y - lift }, '#547566', 2);
  line(a, { x: a.x, y: a.y - lift - 3 }, '#547566', 2.5);
  line(b, { x: b.x, y: b.y - lift - 3 }, '#547566', 2.5);
}

function drawPaddle() {
  if (!pointerActive || !paddleImage.complete || !paddleImage.naturalWidth) return;
  const size = clamp(width * 0.033, 22, 33);
  const paddleWidth = size * 1.35;
  const paddleHeight = size * 3;
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.rotate(-0.28);
  if (flash) {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(221, 173, 69, .16)';
    ctx.fill();
  }
  ctx.drawImage(paddleImage, 225, 18, 350, 770,
    -paddleWidth / 2, -paddleHeight * 0.31, paddleWidth, paddleHeight);
  ctx.restore();
}

function drawBall() {
  if (phase === 'ready' || phase === 'ended') return;
  const p = ballScreen();
  const ground = project(ball.x, ball.y);
  const radius = clamp(width * 0.011, 6.5, 11);
  ctx.beginPath(); ctx.ellipse(ground.x + 2, ground.y + 3, radius, radius * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70,88,57,.16)'; ctx.fill();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(spin);
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#e9d34d'; ctx.fill();
  ctx.strokeStyle = '#a69a3c'; ctx.lineWidth = 1; ctx.stroke();
  // Dark apertures distinguish the hollow plastic pickleball.
  const holes = [[0, 0, 0.19], [-0.48, -0.31, 0.16], [0.36, -0.5, 0.15], [0.51, 0.27, 0.16], [-0.26, 0.55, 0.15]];
  holes.forEach(([x,y,r]) => {
    ctx.beginPath(); ctx.ellipse(x * radius, y * radius, r * radius, r * radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8e8b39'; ctx.fill();
  });
  ctx.restore();
}

function draw() { drawCourt(); drawBall(); drawPaddle(); }
function tick(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.035) : 0;
  lastTime = now;
  update(dt); draw();
  requestAnimationFrame(tick);
}
new ResizeObserver(resize).observe(frame);
resetRally(); resize(); requestAnimationFrame(tick);
