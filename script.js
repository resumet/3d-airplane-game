const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");
const fuelEl = document.getElementById("fuel");
const shieldEl = document.getElementById("shield");
const overlay = document.getElementById("overlay");
const levelNotice = document.getElementById("levelNotice");
const startButton = document.getElementById("startButton");

const keys = new Set();
const touchControls = new Map();
const storageKey = "sky-sprint-3d-best";
const world = {
  xLimit: 14,
  yLimit: 8,
  enemyStartZ: -92,
  playerZ: 8
};

const enemyTypes = [
  { type: "scout", color: 0xff5757, trim: 0xffd166, radius: 1.2, speed: 22, wave: 1.8, score: 45 },
  { type: "fighter", color: 0xff8f3d, trim: 0xfff0a6, radius: 1.5, speed: 18, wave: 3.0, score: 60 },
  { type: "bomber", color: 0x9aa7b2, trim: 0xff5d5d, radius: 2.3, speed: 13, wave: 0.8, score: 90 },
  { type: "interceptor", color: 0xb75cff, trim: 0x63d7ff, radius: 1.35, speed: 24, wave: 2.0, score: 75 },
  { type: "drone", color: 0x5df58f, trim: 0x103524, radius: 1.1, speed: 16, wave: 4.0, score: 70 }
];
const levelConfigs = [
  { level: 1, minScore: 0, spawnInterval: 1.12, enemySpeedMultiplier: 1, tunnelSpeedBonus: 0, fuelDrain: 3.5, itemMin: 4.5, itemMax: 7, enemyWeights: { scout: 48, fighter: 42, bomber: 0, interceptor: 0, drone: 10 } },
  { level: 2, minScore: 500, spawnInterval: 1.03, enemySpeedMultiplier: 1.06, tunnelSpeedBonus: 2, fuelDrain: 3.6, itemMin: 4.6, itemMax: 7.1, enemyWeights: { scout: 42, fighter: 42, bomber: 4, interceptor: 0, drone: 12 } },
  { level: 3, minScore: 1000, spawnInterval: 0.92, enemySpeedMultiplier: 1.12, tunnelSpeedBonus: 4, fuelDrain: 3.72, itemMin: 4.8, itemMax: 7.3, enemyWeights: { scout: 33, fighter: 39, bomber: 6, interceptor: 0, drone: 22 } },
  { level: 4, minScore: 1700, spawnInterval: 0.82, enemySpeedMultiplier: 1.19, tunnelSpeedBonus: 7, fuelDrain: 3.88, itemMin: 5, itemMax: 7.5, enemyWeights: { scout: 28, fighter: 34, bomber: 7, interceptor: 14, drone: 17 } },
  { level: 5, minScore: 2500, spawnInterval: 0.72, enemySpeedMultiplier: 1.27, tunnelSpeedBonus: 10, fuelDrain: 4.05, itemMin: 5.1, itemMax: 7.8, enemyWeights: { scout: 22, fighter: 31, bomber: 17, interceptor: 15, drone: 15 } },
  { level: 6, minScore: 3500, spawnInterval: 0.63, enemySpeedMultiplier: 1.35, tunnelSpeedBonus: 13, fuelDrain: 4.22, itemMin: 5.3, itemMax: 8, enemyWeights: { scout: 18, fighter: 29, bomber: 18, interceptor: 18, drone: 17 } },
  { level: 7, minScore: 4800, spawnInterval: 0.54, enemySpeedMultiplier: 1.44, tunnelSpeedBonus: 16, fuelDrain: 4.42, itemMin: 5.5, itemMax: 8.2, enemyWeights: { scout: 14, fighter: 27, bomber: 18, interceptor: 23, drone: 18 } },
  { level: 8, minScore: 6300, spawnInterval: 0.47, enemySpeedMultiplier: 1.54, tunnelSpeedBonus: 20, fuelDrain: 4.62, itemMin: 5.8, itemMax: 8.8, enemyWeights: { scout: 12, fighter: 24, bomber: 20, interceptor: 24, drone: 20 } },
  { level: 9, minScore: 8000, spawnInterval: 0.41, enemySpeedMultiplier: 1.66, tunnelSpeedBonus: 24, fuelDrain: 4.82, itemMin: 5.8, itemMax: 8.9, enemyWeights: { scout: 10, fighter: 24, bomber: 20, interceptor: 26, drone: 20 } },
  { level: 10, minScore: 10000, spawnInterval: 0.38, enemySpeedMultiplier: 1.78, tunnelSpeedBonus: 28, fuelDrain: 5, itemMin: 5.8, itemMax: 8.8, enemyWeights: { scout: 12, fighter: 22, bomber: 22, interceptor: 22, drone: 22 } }
];

let renderer;
let scene;
let camera;
let player;
let shieldMesh;
let best = Number(localStorage.getItem(storageKey) || 0);
let animationId = 0;
let lastTime = 0;
let spawnClock = 0;
let itemClock = 0;
let game;

bestEl.textContent = best;

function createGame() {
  return {
    running: false,
    score: 0,
    level: 1,
    levelConfig: levelConfigs[0],
    levelNoticeTimer: 0,
    fuel: 100,
    shield: 0,
    speedBonus: 0,
    bullets: [],
    enemies: [],
    items: [],
    particles: [],
    tunnel: []
  };
}

function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071521);
  scene.fog = new THREE.Fog(0x071521, 22, 118);

  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 180);
  camera.position.set(0, 5.2, 22);
  camera.lookAt(0, 0, -22);

  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x142536, 2.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(7, 10, 8);
  sun.castShadow = true;
  scene.add(sun);

  scene.add(makeRunway());
  player = makePlayer();
  player.position.set(-4.8, 0, world.playerZ);
  scene.add(player);

  shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x63d7ff, transparent: true, opacity: 0.16, wireframe: true })
  );
  shieldMesh.visible = false;
  player.add(shieldMesh);

  makeTunnel();
  resize();
}

function makePlayer() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.72, 3.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.36, metalness: 0.2 })
  );
  body.rotation.z = -Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.12, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x26c6ff, roughness: 0.42, metalness: 0.18 })
  );
  wing.rotation.z = 0.04;
  group.add(wing);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.5 })
  );
  tail.position.x = -1.5;
  tail.position.y = 0.35;
  group.add(tail);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0x07131f, roughness: 0.15, metalness: 0.5 })
  );
  cockpit.scale.set(1.35, 0.55, 0.82);
  cockpit.position.set(0.58, 0.26, 0);
  group.add(cockpit);
  group.rotation.y = Math.PI / 2;

  return group;
}

function makeEnemy(template) {
  const group = new THREE.Group();
  group.userData = {
    ...template,
    age: Math.random() * 3,
    boom: template.trim,
    hitRadius: template.radius
  };

  if (template.type === "bomber") {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshStandardMaterial({ color: template.color, roughness: 0.48, metalness: 0.16 })
    );
    body.scale.set(1.9, 0.72, 0.88);
    group.add(body);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.16, 1.25),
      new THREE.MeshStandardMaterial({ color: template.trim, roughness: 0.42 })
    );
    group.add(wing);
  } else if (template.type === "drone") {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 18, 12),
      new THREE.MeshStandardMaterial({ color: template.color, roughness: 0.35, metalness: 0.18 })
    );
    group.add(core);
    const armMat = new THREE.MeshStandardMaterial({ color: template.trim, roughness: 0.45 });
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.76 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.08), armMat);
      arm.position.set(x * 0.55, 0, z * 0.55);
      arm.rotation.y = z * x * 0.76;
      group.add(arm);
      const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 8, 20), rotorMat);
      rotor.position.set(x * 1.18, 0, z * 1.18);
      rotor.rotation.x = Math.PI / 2;
      group.add(rotor);
    }
  } else {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.58, 3.2, 20),
      new THREE.MeshStandardMaterial({ color: template.color, roughness: 0.38, metalness: 0.18 })
    );
    body.rotation.z = Math.PI / 2;
    group.add(body);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(template.type === "scout" ? 2.5 : 3.1, 0.11, 0.9),
      new THREE.MeshStandardMaterial({ color: template.trim, roughness: 0.48 })
    );
    group.add(wing);

    if (template.type === "interceptor") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.035, 8, 34),
        new THREE.MeshBasicMaterial({ color: template.trim })
      );
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
    }
  }

  group.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });

  return group;
}

function makeRunway() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0d3144, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 160), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -9.4;
  floor.position.z = -38;
  floor.receiveShadow = true;
  group.add(floor);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0x36d1ff, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 22; i += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.2), lineMat);
    line.position.set(i % 2 === 0 ? -9.5 : 9.5, -9.25, 14 - i * 6);
    group.add(line);
  }

  return group;
}

function makeTunnel() {
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a8ab8, transparent: true, opacity: 0.26 });
  for (let i = 0; i < 18; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15.8, 0.025, 8, 80), ringMat);
    ring.position.z = 9 - i * 7;
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    game.tunnel.push(ring);
  }
}

function startGame() {
  clearObjects();
  game = createGame();
  makeTunnel();
  game.running = true;
  spawnClock = 0;
  itemClock = 2.4;
  lastTime = performance.now();
  player.position.set(-4.8, 0, world.playerZ);
  player.rotation.set(0, Math.PI / 2, 0);
  overlay.classList.add("hidden");
  levelNotice.classList.remove("show");
  levelNotice.textContent = "LEVEL 1";
  startButton.textContent = "다시 시작";
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function clearObjects() {
  if (!game) {
    return;
  }

  [...game.bullets, ...game.enemies, ...game.items, ...game.particles, ...game.tunnel].forEach((object) => {
    scene.remove(object);
  });
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render();
  if (game.running) {
    animationId = requestAnimationFrame(loop);
  }
}

function update(dt) {
  const left = keys.has("ArrowLeft") || keys.has("KeyA") || touchControls.has("left");
  const right = keys.has("ArrowRight") || keys.has("KeyD") || touchControls.has("right");
  const up = keys.has("ArrowUp") || keys.has("KeyW") || touchControls.has("up");
  const down = keys.has("ArrowDown") || keys.has("KeyS") || touchControls.has("down");
  const fire = keys.has("Space") || touchControls.has("fire");

  game.score += dt * (28 + game.speedBonus);
  updateLevel();
  game.fuel -= dt * game.levelConfig.fuelDrain;
  game.speedBonus += dt * 0.9;
  game.levelNoticeTimer = Math.max(0, game.levelNoticeTimer - dt);
  levelNotice.classList.toggle("show", game.levelNoticeTimer > 0);

  player.position.x += (right - left) * 12 * dt;
  player.position.y += (up - down) * 9 * dt;
  player.position.x = clamp(player.position.x, -world.xLimit, world.xLimit);
  player.position.y = clamp(player.position.y, -world.yLimit, world.yLimit);
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, (left - right) * 0.45, 0.14);
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, (down - up) * 0.18, 0.12);
  player.rotation.y = Math.PI / 2;
  shieldMesh.visible = game.shield > 0;
  shieldMesh.rotation.y += dt * 1.8;

  if (fire && (!player.userData.cooldown || player.userData.cooldown <= 0)) {
    shoot();
    player.userData.cooldown = 0.16;
  }
  player.userData.cooldown = Math.max(0, (player.userData.cooldown || 0) - dt);

  spawnClock -= dt;
  itemClock -= dt;
  if (spawnClock <= 0) {
    spawnEnemy();
    spawnClock = getSpawnInterval();
  }
  if (itemClock <= 0) {
    spawnItem();
    itemClock = randomBetween(game.levelConfig.itemMin, game.levelConfig.itemMax);
  }

  updateTunnel(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateItems(dt);
  updateParticles(dt);
  checkCollisions();
  updateHud();

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.18, 0.05);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 5.2 + player.position.y * 0.12, 0.05);
  camera.lookAt(player.position.x * 0.24, player.position.y * 0.1, -24);

  if (game.fuel <= 0) {
    burst(player.position, 0xffb347, 28);
    endGame();
  }
}

function updateTunnel(dt) {
  for (const ring of game.tunnel) {
    ring.position.z += (26 + game.speedBonus + game.levelConfig.tunnelSpeedBonus) * dt;
    ring.rotation.z += dt * 0.12;
    if (ring.position.z > 16) {
      ring.position.z -= 126;
    }
  }
}

function shoot() {
  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe66d })
  );
  bullet.position.copy(player.position);
  bullet.position.z -= 1.8;
  bullet.userData = { speed: 74, radius: 0.32 };
  scene.add(bullet);
  game.bullets.push(bullet);
}

function spawnEnemy() {
  const template = chooseEnemyType(game.levelConfig.enemyWeights);
  const enemy = makeEnemy(template);
  enemy.position.set(
    (Math.random() * 2 - 1) * world.xLimit,
    (Math.random() * 2 - 1) * world.yLimit,
    world.enemyStartZ - Math.random() * 12
  );
  enemy.userData.speed *= game.levelConfig.enemySpeedMultiplier;
  enemy.userData.wave *= 1 + Math.max(0, game.level - 1) * 0.035;
  enemy.rotation.y = Math.PI / 2;
  scene.add(enemy);
  game.enemies.push(enemy);
}

function spawnItem() {
  const type = Math.random() > 0.38 ? "fuel" : "shield";
  const item = new THREE.Group();
  const color = type === "fuel" ? 0x5df58f : 0x63d7ff;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.92, 0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.36, emissive: color, emissiveIntensity: 0.22 })
  );
  item.add(gem);
  item.position.set(
    (Math.random() * 2 - 1) * (world.xLimit - 1),
    (Math.random() * 2 - 1) * (world.yLimit - 1),
    world.enemyStartZ
  );
  item.userData = { type, radius: 1.05, speed: 16 };
  scene.add(item);
  game.items.push(item);
}

function updateBullets(dt) {
  for (const bullet of game.bullets) {
    bullet.position.z -= bullet.userData.speed * dt;
  }
  removeDead(game.bullets, (bullet) => bullet.position.z < -110);
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    const data = enemy.userData;
    data.age += dt;
    enemy.position.z += (data.speed + game.speedBonus * 0.45) * dt;
    enemy.position.x += Math.sin(data.age * 2.5 + data.speed) * data.wave * dt;
    enemy.rotation.z = Math.sin(data.age * 3) * 0.18;

    if (data.type === "interceptor") {
      const levelBoost = 1 + Math.max(0, game.level - 1) * 0.045;
      enemy.position.x += Math.sign(player.position.x - enemy.position.x) * 4.6 * levelBoost * dt;
      enemy.position.y += Math.sign(player.position.y - enemy.position.y) * 3.6 * levelBoost * dt;
    }

    if (data.type === "drone") {
      enemy.rotation.y += dt * 3.5;
      enemy.position.y += Math.sin(data.age * 5.4) * (3.8 + game.level * 0.14) * dt;
    }
  }
  removeDead(game.enemies, (enemy) => enemy.position.z > 18);
}

function updateItems(dt) {
  for (const item of game.items) {
    item.position.z += item.userData.speed * dt;
    item.rotation.x += dt * 1.8;
    item.rotation.y += dt * 2.4;
  }
  removeDead(game.items, (item) => item.position.z > 18);
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.userData.life -= dt;
    particle.material.opacity = Math.max(0, particle.userData.life);
  }
  removeDead(game.particles, (particle) => particle.userData.life <= 0);
}

function checkCollisions() {
  for (const enemy of game.enemies) {
    for (const bullet of game.bullets) {
      if (enemy.position.distanceTo(bullet.position) < enemy.userData.hitRadius + bullet.userData.radius) {
        enemy.userData.dead = true;
        bullet.userData.dead = true;
        game.score += enemy.userData.score;
        burst(enemy.position, enemy.userData.boom, 18);
      }
    }

    if (!enemy.userData.dead && enemy.position.distanceTo(player.position) < enemy.userData.hitRadius + 1.15) {
      enemy.userData.dead = true;
      burst(enemy.position, 0xff7b54, 22);
      if (game.shield > 0) {
        game.shield -= 1;
      } else {
        game.fuel -= 30;
      }
    }
  }

  for (const item of game.items) {
    if (item.position.distanceTo(player.position) < item.userData.radius + 1.2) {
      item.userData.dead = true;
      if (item.userData.type === "fuel") {
        game.fuel = Math.min(100, game.fuel + 30);
      } else {
        game.shield = Math.min(3, game.shield + 1);
      }
      burst(item.position, item.userData.type === "fuel" ? 0x5df58f : 0x63d7ff, 14);
    }
  }

  removeDead(game.enemies, (enemy) => enemy.userData.dead);
  removeDead(game.bullets, (bullet) => bullet.userData.dead);
  removeDead(game.items, (item) => item.userData.dead);
}

function burst(position, color, count) {
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.random() * 0.15, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    particle.position.copy(position);
    particle.userData = {
      life: 0.45 + Math.random() * 0.45,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 18
      )
    };
    scene.add(particle);
    game.particles.push(particle);
  }
}

function removeDead(list, predicate) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) {
      scene.remove(list[i]);
      list.splice(i, 1);
    }
  }
}

function endGame() {
  game.running = false;
  best = Math.max(best, Math.floor(game.score));
  localStorage.setItem(storageKey, String(best));
  bestEl.textContent = best;
  overlay.querySelector("h1").textContent = "기록 " + Math.floor(game.score);
  overlay.querySelector("p").textContent = Math.floor(game.score) >= best ? "NEW BEST" : "SKY SPRINT 3D";
  overlay.classList.remove("hidden");
}

function render() {
  renderer.render(scene, camera);
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  render();
}

function updateHud() {
  scoreEl.textContent = Math.floor(game.score);
  levelEl.textContent = game.level > 10 ? "MAX+" + (game.level - 10) : game.level;
  fuelEl.textContent = Math.max(0, Math.floor(game.fuel));
  shieldEl.textContent = game.shield;
}

function updateLevel() {
  const nextLevel = getLevelForScore(game.score);
  if (nextLevel === game.level) {
    game.levelConfig = getLevelConfig(nextLevel);
    return;
  }

  game.level = nextLevel;
  game.levelConfig = getLevelConfig(nextLevel);
  levelNotice.textContent = game.level > 10 ? "LEVEL MAX+" + (game.level - 10) : "LEVEL " + game.level;
  game.levelNoticeTimer = 1.4;
}

function getLevelForScore(score) {
  if (score >= 12500) {
    return 10 + Math.floor((score - 12500) / 1500) + 1;
  }

  let level = 1;
  for (const config of levelConfigs) {
    if (score >= config.minScore) {
      level = config.level;
    }
  }
  return level;
}

function getLevelConfig(level) {
  if (level <= 10) {
    return levelConfigs[level - 1];
  }

  const extra = level - 10;
  const base = levelConfigs[levelConfigs.length - 1];
  return {
    ...base,
    level,
    spawnInterval: Math.max(0.28, base.spawnInterval - extra * 0.018),
    enemySpeedMultiplier: Math.min(2.45, base.enemySpeedMultiplier + extra * 0.08),
    tunnelSpeedBonus: base.tunnelSpeedBonus + extra * 3,
    fuelDrain: Math.min(5.8, base.fuelDrain + extra * 0.08),
    itemMin: Math.min(6.5, base.itemMin + extra * 0.08),
    itemMax: Math.min(9, base.itemMax + extra * 0.08)
  };
}

function getSpawnInterval() {
  const pressure = Math.min(0.08, game.score / 90000);
  return Math.max(0.28, game.levelConfig.spawnInterval - pressure);
}

function chooseEnemyType(weights) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (const template of enemyTypes) {
    roll -= weights[template.type] || 0;
    if (roll <= 0) {
      return template;
    }
  }

  return enemyTypes[0];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Enter" && !game.running) {
    startGame();
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.querySelectorAll("[data-control]").forEach((button) => {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    touchControls.set(control, true);
    button.classList.add("active");
  };
  const release = (event) => {
    event.preventDefault();
    button.releasePointerCapture?.(event.pointerId);
    touchControls.delete(control);
    button.classList.remove("active");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

window.addEventListener("blur", () => {
  touchControls.clear();
  document.querySelectorAll("[data-control].active").forEach((button) => {
    button.classList.remove("active");
  });
});

startButton.addEventListener("click", startGame);
window.addEventListener("resize", resize);

game = createGame();
init3D();
updateHud();
render();
