import {
  TILE, MAP_W, MAP_H, PLAYER_RADIUS, EYE_HEIGHT,
  PLAYER_SPEED, RUN_MULT, LIGHT_DIST, LAYER_CONFIG, settings
} from './config.js';
import { initAudio, SFX } from './audio.js';
import {
  generateMaze, createLayerVariants, findOpenPositions, generatePatrolPoints,
  buildMazeMeshes, setLayerVisible, canMove, isWall, dist2D, hasLineOfSight
} from './maze.js';
import {
  clearGameObjects, createExit, createCore, createCrystal, createEnemy,
  createButton, createDoor, createItem, createCompanion, createEchoMesh,
  createEchoStation, createMemoryFragment
} from './world.js';
import { controls, keys, requestLock, releaseLock, clearInputState } from './player.js';
import { echoFrameAt, findUsableDoor, findDoorPlacement, doorBlocks, rebaseEchoFrames, emitNoise } from './mechanics.mjs';
import {
  showMessage, tickMessage, showDeathScreen, showChoiceScreen,
  showWinScreen, updateHUD, renderMinimap, hideOverlay, showScreen
} from './ui.js';

export const game = {
  state: 'start',
  currentLayer: 0,
  attempts: 1,
  moralChoice: 0,
  selectedSlot: 0,
  gameTime: 0,
  playerPos: new THREE.Vector3(TILE * 1.5, EYE_HEIGHT, TILE * 1.5),
  playerState: null,
  mazes: [],
  wallMeshes: [],
  floorMeshes: [],
  enemies: [], crystals: [], buttons: [], doors: [], items: [], echoStations: [], memories: [],
  echoes: [], currentEchoRecording: [], particles: [], stones: [],
  exitPos: { x: 0, z: 0 },
  corePos: { x: 0, z: 0 },
  coreActivated: false, memoryCount: 0, echoPulse: 0,
  exitMesh: null, coreMesh: null, companion: null,
  headBobPhase: 0, stepTimer: 0, heartbeatTimer: 0,
  switchFlash: 0, damageFlash: 0,
  get yaw() { return controls.yaw; },
  get pitch() { return controls.pitch; }
};

let scene = null, camera = null;
let ambientLight = null, spotLight = null, playerLight = null;
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const flashlightDirection = new THREE.Vector3();
let particleGeometry = null;

export function initGameScene(_scene, _camera) {
  scene = _scene;
  camera = _camera;
}

function setupLighting() {
  if (!ambientLight) {
    ambientLight = new THREE.AmbientLight(0x334b66, 0.3);
    scene.add(ambientLight);
    spotLight = new THREE.SpotLight(0xfff4d0, 12, LIGHT_DIST * 2, Math.PI / 4, 0.5, 1);
    spotLight.shadow.mapSize.set(512, 512);
    scene.add(spotLight);
    scene.add(spotLight.target);
    playerLight = new THREE.PointLight(0x88aaff, 0.6, 5);
    scene.add(playerLight);
  }
}

function spawnParticles3D(x, z, color, count) {
  if (!particleGeometry) particleGeometry = new THREE.SphereGeometry(0.08, 4, 4);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    const mesh = new THREE.Mesh(particleGeometry, mat);
    mesh.position.set(x, EYE_HEIGHT * 0.7, z);
    scene.add(mesh);
    game.particles.push({ mesh, mat, vx: (Math.random()-0.5)*4, vy: Math.random()*4+1, vz: (Math.random()-0.5)*4, life: 0.8 + Math.random()*0.5 });
  }
}

function clearMazeMeshes() {
  [...game.wallMeshes, ...game.floorMeshes].forEach(m => {
    scene.remove(m);
    m.geometry?.dispose();
    m.material?.dispose();
  });
  game.wallMeshes = [];
  game.floorMeshes = [];
}

function canMovePlayer(x, z) {
  if (!canMove(x, z, PLAYER_RADIUS, game.currentLayer, game.mazes)) return false;
  return !game.doors.some(door => door.mesh.visible && !door.open && doorBlocks(door, x, z, PLAYER_RADIUS));
}

function updateDoorStates() {
  const buttonsPressed = game.buttons.filter(button => button.pressed).length;
  game.doors.forEach(door => {
    door.open = door.unlocked || buttonsPressed >= door.requiredButtons;
    door.mesh.visible = !door.open;
  });
}

export function initGame() {
  clearGameObjects(scene);
  game.stones.forEach(s => { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mat.dispose(); });
  game.particles.forEach(p => { scene.remove(p.mesh); p.mat.dispose(); });
  clearMazeMeshes();

  game.enemies = []; game.crystals = []; game.buttons = []; game.doors = []; game.items = []; game.echoStations = []; game.memories = [];
  game.echoes = []; game.particles = []; game.stones = []; game.currentEchoRecording = [];
  game.attemptTime = 0;
  game.uiTimer = 0;
  game.mapTimer = 0;
  game.lastEchoSample = -Infinity;
  game.visited = Array.from({ length: 3 }, () => Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false)));

  const baseMaze = generateMaze();
  game.mazes = createLayerVariants(baseMaze);
  game.currentLayer = 0;
  game.memoryCount = 0;
  game.echoPulse = 0;
  const built = buildMazeMeshes(scene, game.mazes, 0);
  game.wallMeshes = built.wallMeshes;
  game.floorMeshes = built.floorMeshes;
  setLayerVisible(scene, game.wallMeshes, game.floorMeshes, 0, ambientLight);

  const positions = findOpenPositions(game.mazes[0]);

  game.playerPos.set(TILE * 1.5, EYE_HEIGHT, TILE * 1.5);
  controls.yaw = 0;
  controls.pitch = 0;
  game.playerState = {
    health: 100, maxHealth: 100,
    flashlightOn: true, flashlightCharge: 100,
    inventory: [null, null, null],
    invincible: 0, moving: false, running: false
  };
  game.selectedSlot = 0;

  let farthest = positions[0], maxDist = 0;
  positions.forEach(p => {
    const d = Math.abs(p.x - 1) + Math.abs(p.y - 1);
    if (d > maxDist) { maxDist = d; farthest = p; }
  });
  game.exitPos = { x: farthest.x * TILE + TILE/2, z: farthest.y * TILE + TILE/2 };
  game.exitMesh = createExit(scene, game.exitPos);

  const midPositions = positions.filter(p => Math.abs(p.x - MAP_W/2) + Math.abs(p.y - MAP_H/2) < 5);
  const coreP = midPositions[Math.floor(Math.random() * midPositions.length)] || positions[Math.floor(positions.length/2)];
  game.corePos = { x: coreP.x * TILE + TILE/2, z: coreP.y * TILE + TILE/2 };
  game.coreActivated = false;
  game.coreMesh = createCore(scene, game.corePos);

  positions.slice(0, 12).forEach(p => {
    game.crystals.push(createCrystal(scene, { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 }));
  });

  positions.slice(12, 16).forEach(p => {
    const pos = { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 };
    const patrol = generatePatrolPoints(p.x, p.y, game.mazes);
    game.enemies.push(createEnemy(scene, pos, patrol));
  });

  positions.slice(16, 19).forEach((p, i) => {
    game.buttons.push(createButton(scene, { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 }, i));
  });
  const doorPlacement = findDoorPlacement(game.mazes[0], TILE, 8);
  if (doorPlacement) game.doors.push(createDoor(scene, doorPlacement));

  const itemTypes = ['🔑', '🗺️', '🪞', '🧭', '⚡'];
  const itemNames = ['Ключ', 'Карта', 'Зеркало эха', 'Компас', 'Ловушка'];
  const itemColors = [0xffdd44, 0x88ff88, 0xccccff, 0xff88ff, 0xff8844];
  positions.slice(20, 25).forEach((p, i) => {
    game.items.push(createItem(scene, { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 }, itemTypes[i], itemNames[i], itemColors[i]));
  });
  positions.slice(25, 27).forEach(p => {
    game.echoStations.push(createEchoStation(scene, { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 }));
  });
  positions.slice(27, 30).forEach((p, i) => {
    game.memories.push(createMemoryFragment(scene, { x: p.x * TILE + TILE/2, z: p.y * TILE + TILE/2 }, i));
  });

  game.companion = createCompanion(scene);
  game.companion.x = game.playerPos.x;
  game.companion.z = game.playerPos.z;

  setupLighting();
}

export function switchLayer(layer) {
  if (!canMove(game.playerPos.x, game.playerPos.z, PLAYER_RADIUS, layer, game.mazes)) {
    showMessage('Здесь переход невозможен: в другом слое стена');
    return;
  }
  game.currentLayer = layer;
  setLayerVisible(scene, game.wallMeshes, game.floorMeshes, layer, ambientLight);
  game.switchFlash = 0.5;
  SFX.layer();
}

function handleInteraction() {
  const p = game.playerPos;
  if (!game.coreActivated && dist2D(p.x, p.z, game.corePos.x, game.corePos.z) < 2.5) {
    game.coreActivated = true;
    game.state = 'choice';
    releaseLock();
    showChoiceScreen(game.memoryCount, game.memories.length || 3);
    game.coreMesh.mat.emissive.setHex(0xffffff);
    game.coreMesh.mat.emissiveIntensity = 3;
    return;
  }
  const station = game.echoStations.find(s => !s.used && dist2D(p.x, p.z, s.mesh.position.x, s.mesh.position.z) < 2.5);
  if (station) {
    if (game.currentEchoRecording.length < 10) {
      showMessage('Сначала пройдите немного, чтобы записать эхо');
      return;
    }
    const frames = rebaseEchoFrames(game.currentEchoRecording);
    const mesh = createEchoMesh(scene);
    game.echoes.push({ frames, frameIndex: 0, startTime: game.attemptTime, x: frames[0].x, z: frames[0].z, yaw: frames[0].yaw, layer: frames[0].layer, mesh });
    game.currentEchoRecording = [];
    game.lastEchoSample = -Infinity;
    station.used = true;
    station.mat.emissiveIntensity = 0.25;
    station.light.intensity = 0.15;
    showMessage('Эхо сохранено в точке памяти');
    return;
  }
  const inv = game.playerState.inventory;
  const i = game.selectedSlot;
  if (inv[i]) {
      const item = inv[i];
      if (item.type === '🧭') {
        const target = game.coreActivated ? game.exitPos : game.corePos;
        showMessage(`Компас: ${Math.round(dist2D(p.x, p.z, target.x, target.z))}м до ${game.coreActivated ? 'выхода' : 'ядра'}`);
      } else if (item.type === '🪞') {
        game.echoPulse = 5;
        inv[i] = null;
        showMessage('Зеркало эха раскрывает угрозы поблизости');
        spawnParticles3D(p.x, p.z, 0xff44dd, 10);
      } else if (item.type === '⚡') {
        game.enemies.forEach(e => {
          if (dist2D(p.x, p.z, e.mesh.position.x, e.mesh.position.z) < 10) { e.stunTime = 4; e.chasing = false; }
        });
        inv[i] = null;
        showMessage('Ловушка активирована!');
        spawnParticles3D(p.x, p.z, 0xff8844, 15);
      } else if (item.type === '🔑') {
        const door = findUsableDoor(game.doors.map(d => ({ x: d.mesh.position.x, z: d.mesh.position.z, unlocked: d.unlocked, door: d })), p.x, p.z);
        if (!door) { showMessage('Рядом нет закрытой двери'); return; }
        door.door.unlocked = true;
        inv[i] = null;
        showMessage('Дверь открыта!');
      } else if (item.type === '🗺️') {
        showMessage('Карта показывает весь текущий слой');
      }
  }
}

function throwStone() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat);
  mesh.position.set(game.playerPos.x, EYE_HEIGHT * 0.8, game.playerPos.z);
  scene.add(mesh);
  const dir = new THREE.Vector3(-Math.sin(controls.yaw), 0.3, -Math.cos(controls.yaw)).normalize();
  game.stones.push({ mesh, mat, vx: dir.x * 12, vz: dir.z * 12, vy: dir.y * 12, life: 1.5 });
  emitNoise(game.enemies, game.playerPos.x, game.playerPos.z, 8, 2);
  SFX.stone();
}

export function handleGameKey(code) {
  if (game.state !== 'playing') return;
  if (code === 'KeyF') game.playerState.flashlightOn = !game.playerState.flashlightOn;
  if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') selectInventorySlot(Number(code.slice(-1)) - 1);
  if (code === 'KeyZ' && game.currentLayer !== 0) switchLayer(0);
  if (code === 'KeyX' && game.currentLayer !== 1) switchLayer(1);
  if (code === 'KeyC' && game.currentLayer !== 2) switchLayer(2);
  if (code === 'KeyE') handleInteraction();
  if (code === 'Space') throwStone();
  if (code === 'KeyQ') switchLayer((game.currentLayer + 1) % 3);
  if (code === 'KeyG') {
    const item = game.playerState.inventory[game.selectedSlot];
    if (item) {
      const dropped = createItem(scene, { x: game.playerPos.x, z: game.playerPos.z }, item.type, item.name, 0xffdd44);
      dropped.pickupDelay = 2;
      dropped.transient = true;
      game.items.push(dropped);
      game.playerState.inventory[game.selectedSlot] = null;
      showMessage(`Выброшено: ${item.name}`);
    }
  }
}

export function selectInventorySlot(index) {
  if (!game.playerState || index < 0 || index > 2) return;
  game.selectedSlot = index;
  const item = game.playerState.inventory[index];
  showMessage(item ? `Выбрано: ${item.name} ${item.type}` : `Слот ${index + 1} пуст`);
  updateHUD(game);
}

export function updateGame(dt) {
  tickMessage(dt);
  if (game.state !== 'playing') return;

  game.gameTime += dt;
  game.attemptTime += dt;
  if (game.echoPulse > 0) game.echoPulse = Math.max(0, game.echoPulse - dt);
  const p = game.playerPos;
  const yaw = controls.yaw;

  moveForward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  moveRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
  let moveX = 0, moveZ = 0;
  if (keys['KeyW'] || keys['ArrowUp']) { moveX += moveForward.x; moveZ += moveForward.z; }
  if (keys['KeyS'] || keys['ArrowDown']) { moveX -= moveForward.x; moveZ -= moveForward.z; }
  if (keys['KeyA'] || keys['ArrowLeft']) { moveX -= moveRight.x; moveZ -= moveRight.z; }
  if (keys['KeyD'] || keys['ArrowRight']) { moveX += moveRight.x; moveZ += moveRight.z; }
  const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
  if (len > 0) { moveX /= len; moveZ /= len; }
  const moving = len > 0;
  const running = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = PLAYER_SPEED * (running ? RUN_MULT : 1) * dt;
  game.playerState.moving = moving;
  game.playerState.running = running;
  updateDoorStates();

  if (moving) {
    const newX = p.x + moveX * speed;
    const newZ = p.z + moveZ * speed;
    if (canMovePlayer(newX, p.z)) p.x = newX;
    if (canMovePlayer(p.x, newZ)) p.z = newZ;
    game.headBobPhase += dt * (running ? 12 : 8);
    game.stepTimer += dt;
    if (game.stepTimer > (running ? 0.25 : 0.4)) {
      game.stepTimer = 0;
      SFX.step();
      emitNoise(game.enemies, p.x, p.z, running ? 11 : 5, running ? 1.5 : 0.8);
    }
  }

  const bobAmount = 0.08 * (settings.headBob / 50);
  const bobY = moving ? Math.sin(game.headBobPhase) * bobAmount : 0;
  const bobX = moving ? Math.cos(game.headBobPhase * 0.5) * bobAmount * 0.5 : 0;
  camera.position.set(p.x + bobX, EYE_HEIGHT + bobY, p.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = controls.yaw;
  camera.rotation.x = controls.pitch;
  camera.rotation.z = 0;

  const ps = game.playerState;
  if (ps.flashlightOn && ps.flashlightCharge > 0) {
    ps.flashlightCharge -= dt * 4;
    if (ps.flashlightCharge <= 0) { ps.flashlightCharge = 0; ps.flashlightOn = false; }
  }
  if (ps.flashlightOn && ps.flashlightCharge > 0) {
    spotLight.visible = true;
    let radius = LIGHT_DIST * (0.5 + 0.5 * ps.flashlightCharge / 100);
    const flicker = ps.flashlightCharge < 25 ? (Math.random() * 2 - 1) : 0;
    spotLight.distance = radius * 2 + flicker;
    spotLight.intensity = 12 * (0.5 + 0.5 * ps.flashlightCharge / 100);
    spotLight.position.copy(camera.position);
    flashlightDirection.set(0, 0, -1).applyEuler(camera.rotation);
    spotLight.target.position.copy(camera.position).addScaledVector(flashlightDirection, 10);
  } else {
    spotLight.visible = false;
  }
  playerLight.position.copy(camera.position);
  playerLight.intensity = 0.6;

  if (game.attemptTime - game.lastEchoSample >= 0.1) {
    game.currentEchoRecording.push({ time: game.attemptTime, x: p.x, z: p.z, yaw: controls.yaw, layer: game.currentLayer });
    game.lastEchoSample = game.attemptTime;
  }
  if (ps.invincible > 0) ps.invincible -= dt;

  game.echoes.forEach(echo => {
    if (echo.frames.length) {
      const f = echoFrameAt(echo.frames, Math.max(0, game.attemptTime - (echo.startTime || 0)));
      echo.x = f.x; echo.z = f.z; echo.yaw = f.yaw; echo.layer = f.layer;
    }
    if (echo.mesh) {
      echo.mesh.position.set(echo.x, 0, echo.z);
      echo.mesh.rotation.y = echo.yaw;
      echo.mesh.visible = (echo.layer === game.currentLayer);
    }
  });

  game.enemies.forEach(enemy => {
    enemy.pulse += dt * 3;
    const ex = enemy.mesh.position.x, ez = enemy.mesh.position.z;
    const d = dist2D(ex, ez, p.x, p.z);
    const visible = hasLineOfSight(ex, ez, p.x, p.z, game.mazes[game.currentLayer]);
    const canSee = d < 15 && game.currentLayer === 0 && visible;
    const towardEnemyX = ex - p.x, towardEnemyZ = ez - p.z;
    const facing = d > 0 && ((-Math.sin(controls.yaw) * towardEnemyX - Math.cos(controls.yaw) * towardEnemyZ) / d) > Math.cos(Math.PI / 5);
    const inLight = ps.flashlightOn && ps.flashlightCharge > 0 && d < LIGHT_DIST * 0.6 && visible && facing;
    const revealed = game.echoPulse > 0 && d < 18;
    let distracted = false;
    game.echoes.forEach(echo => {
      if (echo.layer === game.currentLayer && dist2D(ex, ez, echo.x, echo.z) < 4) distracted = true;
    });
    if (enemy.noiseTime > 0) enemy.noiseTime -= dt;
    if (enemy.stunTime > 0) enemy.stunTime -= dt;
    if (enemy.stunTime > 0) {
      enemy.chasing = false;
    } else if (enemy.noiseTime > 0 && game.currentLayer !== 1) {
      enemy.chasing = false;
      const angle = Math.atan2(enemy.noiseX - ex, enemy.noiseZ - ez);
      if (dist2D(ex, ez, enemy.noiseX, enemy.noiseZ) > 1) {
        const nx = ex + Math.sin(angle) * 3 * dt, nz = ez + Math.cos(angle) * 3 * dt;
        if (canMove(nx, ez, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.x = nx;
        if (canMove(enemy.mesh.position.x, nz, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.z = nz;
      }
    } else if ((canSee || inLight) && !distracted && game.currentLayer !== 1) {
      enemy.chasing = true;
      const angle = Math.atan2(p.x - ex, p.z - ez);
      const newX = ex + Math.sin(angle) * 4.2 * dt;
      const newZ = ez + Math.cos(angle) * 4.2 * dt;
      if (canMove(newX, ez, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.x = newX;
      if (canMove(enemy.mesh.position.x, newZ, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.z = newZ;
      enemy.mesh.rotation.y = angle;
    } else {
      enemy.chasing = false;
      const target = enemy.patrolPoints[enemy.patrolIndex];
      if (target) {
        const angle = Math.atan2(target.x - ex, target.z - ez);
        if (dist2D(ex, ez, target.x, target.z) < 1) {
          enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPoints.length;
        } else {
          const newX = ex + Math.sin(angle) * 2.2 * dt;
          const newZ = ez + Math.cos(angle) * 2.2 * dt;
          if (canMove(newX, ez, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.x = newX;
          if (canMove(enemy.mesh.position.x, newZ, 0.7, game.currentLayer, game.mazes)) enemy.mesh.position.z = newZ;
          enemy.mesh.rotation.y = angle;
        }
      }
    }
    enemy.body.scale.setScalar(1 + Math.sin(enemy.pulse) * 0.1);
    enemy.eyeMat.emissiveIntensity = revealed ? 5 : (enemy.chasing ? 3 : 1.5);
    enemy.haloMat.emissiveIntensity = revealed ? 3 : 1.2;
    enemy.light.visible = enemy.chasing && d < 10;
    enemy.light.intensity = 0.8;

    if (d < PLAYER_RADIUS + 0.7 && ps.invincible <= 0 && !(enemy.stunTime > 0)) {
      ps.health -= 15;
      ps.invincible = 1.0;
      game.damageFlash = 1;
      SFX.hurt();
      const angle = Math.atan2(p.x - ex, p.z - ez);
      const kx = p.x + Math.sin(angle) * 1.5;
      const kz = p.z + Math.cos(angle) * 1.5;
      if (canMove(kx, kz, PLAYER_RADIUS, game.currentLayer, game.mazes)) { p.x = kx; p.z = kz; }
    }
    if (d < 12) {
      game.heartbeatTimer += dt;
      const intensity = 1 - d / 12;
      if (game.heartbeatTimer > (1.5 - intensity)) { game.heartbeatTimer = 0; SFX.heartbeat(intensity); }
    }
  });

  game.crystals.forEach(crystal => {
    if (crystal.collected) return;
    crystal.pulse += dt * 2;
    crystal.obj.rotation.y += dt * 2;
    crystal.obj.position.y = 1 + Math.sin(crystal.pulse) * 0.2;
    if (dist2D(p.x, p.z, crystal.mesh.position.x, crystal.mesh.position.z) < 1.5) {
      crystal.collected = true;
      crystal.mesh.visible = false;
      ps.flashlightCharge = Math.min(100, ps.flashlightCharge + 20);
      SFX.pickup();
      showMessage('+20 🔦');
      spawnParticles3D(crystal.mesh.position.x, crystal.mesh.position.z, 0x00ffff, 12);
    }
  });

  game.echoStations.forEach(station => {
    station.pulse += dt * 2;
    station.ring.rotation.z += dt;
    station.ring.scale.setScalar(1 + Math.sin(station.pulse) * 0.08);
  });

  game.memories.forEach(memory => {
    if (memory.collected) return;
    memory.pulse += dt * 2;
    memory.obj.rotation.y += dt * 1.4;
    memory.obj.position.y = 1.1 + Math.sin(memory.pulse) * 0.18;
    if (dist2D(p.x, p.z, memory.mesh.position.x, memory.mesh.position.z) < 1.5) {
      memory.collected = true;
      memory.mesh.visible = false;
      game.memoryCount++;
      SFX.pickup();
      showMessage(`Фрагмент памяти найден: ${game.memoryCount}/${game.memories.length}`);
      spawnParticles3D(memory.mesh.position.x, memory.mesh.position.z, 0xff44aa, 12);
    }
  });

  game.buttons.forEach(btn => {
    btn.pressed = false;
    const bx = btn.mesh.position.x, bz = btn.mesh.position.z;
    if (dist2D(p.x, p.z, bx, bz) < 1.5 && game.currentLayer === 0) btn.pressed = true;
    game.echoes.forEach(echo => {
      if (echo.layer === 0 && dist2D(bx, bz, echo.x, echo.z) < 1.5) btn.pressed = true;
    });
    btn.obj.position.y = btn.pressed ? 0.05 : 0.15;
    btn.mat.color.setHex(btn.pressed ? 0x00ff88 : 0xffaa00);
    btn.mat.emissive.setHex(btn.pressed ? 0x00ff88 : 0xffaa00);
  });
  updateDoorStates();
  game.items.forEach(item => {
    if (item.collected) return;
    if (item.pickupDelay > 0) { item.pickupDelay -= dt; return; }
    item.obj.rotation.y += dt * 1.5;
    item.obj.position.y = 1 + Math.sin(game.gameTime * 2) * 0.15;
    if (dist2D(p.x, p.z, item.mesh.position.x, item.mesh.position.z) < 1.5) {
      const emptySlot = ps.inventory.indexOf(null);
      if (emptySlot !== -1) {
        item.collected = true;
        item.mesh.visible = false;
        ps.inventory[emptySlot] = { type: item.type, name: item.name };
        SFX.pickup();
        showMessage(`Подобрано: ${item.name} ${item.type}`);
        spawnParticles3D(item.mesh.position.x, item.mesh.position.z, 0xffdd44, 10);
      } else showMessage('Инвентарь полон!');
    }
  });

  game.coreMesh.obj.rotation.y += dt * 1.5;
  game.coreMesh.obj.rotation.x += dt * 0.7;
  game.coreMesh.obj.position.y = 1.5 + Math.sin(game.gameTime * 2) * 0.2;
  game.coreMesh.light.intensity = 1 + Math.sin(game.gameTime * 2) * 0.3;
  if (game.coreActivated) game.coreMesh.group.visible = false;

  game.exitMesh.ring.rotation.z += dt * 2;
  if (game.coreActivated) {
    game.exitMesh.mat.color.setHex(0x00ff88);
    game.exitMesh.mat.emissive.setHex(0x00ff88);
    game.exitMesh.mat.emissiveIntensity = 1.5;
    game.exitMesh.light.color.setHex(0x00ff88);
    game.exitMesh.light.intensity = 1.5;
    game.exitMesh.sealMat.color.setHex(0x063b32);
    game.exitMesh.sealMat.emissive.setHex(0x00aa77);
    game.exitMesh.sealMat.emissiveIntensity = 1.4;
    game.exitMesh.glyph.rotation.z -= dt * 3;
    if (dist2D(p.x, p.z, game.exitPos.x, game.exitPos.z) < 2) {
      game.state = 'win';
      releaseLock();
      showWinScreen(game.moralChoice, game.attempts, game.echoes.length, game.gameTime);
    }
  } else {
    game.exitMesh.mat.color.setHex(0x444444);
    game.exitMesh.mat.emissive.setHex(0x444444);
    game.exitMesh.mat.emissiveIntensity = 0.3;
    game.exitMesh.light.color.setHex(0x444444);
    game.exitMesh.light.intensity = 0.3;
    game.exitMesh.sealMat.color.setHex(0x08080d);
    game.exitMesh.sealMat.emissive.setHex(0x111111);
    game.exitMesh.sealMat.emissiveIntensity = 0.25;
  }

  const comp = game.companion;
  comp.angle += dt * 2.5;
  comp.x = p.x + Math.cos(comp.angle) * 1.2;
  comp.z = p.z + Math.sin(comp.angle) * 1.2;
  comp.visible = game.currentLayer !== 2;
  comp.mesh.visible = comp.visible;
  comp.mesh.position.set(comp.x, EYE_HEIGHT * 0.7 + Math.sin(game.gameTime * 4) * 0.15, comp.z);
  comp.scared = 0;
  game.enemies.forEach(e => {
    const d = dist2D(e.mesh.position.x, e.mesh.position.z, comp.x, comp.z);
    if (d < 5) comp.scared = Math.max(comp.scared, 1 - d/5);
  });
  comp.mat.emissiveIntensity = 2 - comp.scared;
  comp.light.intensity = 0.6 - comp.scared * 0.4;

  game.stones = game.stones.filter(s => {
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.z += s.vz * dt;
    s.mesh.position.y += s.vy * dt;
    s.vy -= 10 * dt;
    s.life -= dt;
    if (isWall(s.mesh.position.x, s.mesh.position.z, game.currentLayer, game.mazes) || s.life <= 0 || s.mesh.position.y < 0) {
      SFX.echo();
      game.enemies.forEach(enemy => {
        if (dist2D(enemy.mesh.position.x, enemy.mesh.position.z, s.mesh.position.x, s.mesh.position.z) < 18) {
          enemy.noiseX = s.mesh.position.x; enemy.noiseZ = s.mesh.position.z; enemy.noiseTime = 4;
        }
      });
      spawnParticles3D(s.mesh.position.x, s.mesh.position.z, 0x888888, 6);
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mat.dispose();
      return false;
    }
    return true;
  });
  game.particles = game.particles.filter(pt => {
    pt.mesh.position.x += pt.vx * dt;
    pt.mesh.position.y += pt.vy * dt;
    pt.mesh.position.z += pt.vz * dt;
    pt.vy -= 6 * dt;
    pt.life -= dt;
    pt.mat.opacity = Math.max(0, pt.life);
    if (pt.life <= 0) { scene.remove(pt.mesh); pt.mat.dispose(); return false; }
    return true;
  });

  if (game.damageFlash > 0) game.damageFlash -= dt * 2;
  if (game.switchFlash > 0) {
    game.switchFlash -= dt;
    if (game.switchFlash <= 0) {
      const cfg = LAYER_CONFIG[game.currentLayer];
      scene.background.setHex(cfg.fogColor);
      scene.fog.color.setHex(cfg.fogColor);
    } else {
      const cfg = LAYER_CONFIG[game.currentLayer];
      scene.background.setHex(cfg.accent);
      scene.fog.color.setHex(cfg.accent);
    }
  }

  if (ps.health <= 0) {
    game.state = 'dead';
    releaseLock();
    SFX.death();
    if (game.currentEchoRecording.length > 10) {
      const mesh = createEchoMesh(scene);
      game.echoes.push({
        frames: rebaseEchoFrames(game.currentEchoRecording), frameIndex: 0, startTime: 0,
        x: game.currentEchoRecording[0].x, z: game.currentEchoRecording[0].z,
        yaw: game.currentEchoRecording[0].yaw, layer: game.currentEchoRecording[0].layer,
        mesh
      });
    }
    game.currentEchoRecording = [];
    showDeathScreen(game.echoes.length, game.attempts);
  }

  game.uiTimer += dt;
  game.mapTimer += dt;
  if (game.uiTimer >= 0.1) { game.uiTimer = 0; updateHUD(game); }
  if (game.mapTimer >= 0.15) { game.mapTimer = 0; renderMinimap(game); }
}

export function startGame() {
  initAudio();
  game.attempts = 1;
  game.moralChoice = 0;
  game.gameTime = 0;
  clearInputState();
  initGame();
  game.state = 'playing';
  hideOverlay();
  requestLock();
}

export function retryGame() {
  game.attempts++;
  clearInputState();
  game.playerPos.set(TILE * 1.5, EYE_HEIGHT, TILE * 1.5);
  controls.yaw = 0; controls.pitch = 0;
  game.playerState.maxHealth = 100;
  game.playerState.health = 100;
  game.playerState.flashlightCharge = 100;
  game.playerState.flashlightOn = true;
  game.playerState.invincible = 2;
  game.currentLayer = 0;
  game.coreActivated = false;
  game.memoryCount = 0;
  game.echoPulse = 0;
  game.moralChoice = 0;
  game.switchFlash = 0;
  game.damageFlash = 0;
  game.heartbeatTimer = 0;
  if (game.coreMesh) game.coreMesh.group.visible = true;
  setLayerVisible(scene, game.wallMeshes, game.floorMeshes, 0, ambientLight);
  game.currentEchoRecording = [];
  game.attemptTime = 0;
  game.lastEchoSample = -Infinity;
  game.crystals.forEach(c => { c.collected = false; c.mesh.visible = true; });
  game.buttons.forEach(b => b.pressed = false);
  game.enemies.forEach(e => {
    e.noiseTime = 0; e.stunTime = 0; e.chasing = false; e.patrolIndex = 0;
    e.mesh.position.set(e.patrolPoints[0].x, 0, e.patrolPoints[0].z);
    e.mesh.rotation.y = 0;
  });
  game.doors.forEach(d => { d.open = false; d.unlocked = false; d.mesh.visible = true; });
  game.items.filter(i => i.transient).forEach(i => scene.remove(i.mesh));
  game.items = game.items.filter(i => !i.transient);
  game.items.forEach(i => { i.collected = false; i.mesh.visible = true; });
  game.echoStations.forEach(s => { s.used = false; s.mesh.visible = true; s.mat.emissiveIntensity = 1.5; s.light.intensity = 0.8; });
  game.memories.forEach(m => { m.collected = false; m.mesh.visible = true; });
  game.playerState.inventory = [null, null, null];
  game.selectedSlot = 0;
  game.state = 'playing';
  hideOverlay();
  requestLock();
}

export function makeChoice(choice) {
  game.moralChoice = choice;
  if (choice === 1) {
    for (let y = 1; y < MAP_H-1; y++)
      for (let x = 1; x < MAP_W-1; x++)
        if (game.mazes[0][y][x] === 1 && Math.random() < 0.15) {
          game.mazes[0][y][x] = 0; game.mazes[1][y][x] = 0; game.mazes[2][y][x] = 0;
        }
    clearMazeMeshes();
    const built = buildMazeMeshes(scene, game.mazes, game.currentLayer);
    game.wallMeshes = built.wallMeshes;
    game.floorMeshes = built.floorMeshes;
    setLayerVisible(scene, game.wallMeshes, game.floorMeshes, game.currentLayer, ambientLight);
    showMessage('Лабиринт светлеет...');
  } else {
    game.playerState.maxHealth = 150;
    game.playerState.health = 150;
    showMessage('Тьма даёт силу...');
  }
  game.state = 'playing';
  hideOverlay();
  requestLock();
}

export function pauseGame() {
  if (game.state !== 'playing') return;
  clearInputState();
  game.state = 'pause';
  releaseLock();
  showScreen('pauseScreen');
}

export function resumeGame() {
  clearInputState();
  game.state = 'playing';
  hideOverlay();
  requestLock();
}

export function quitToMenu() {
  clearInputState();
  game.state = 'start';
  releaseLock();
}

export function restartAll() {
  game.attempts = 1;
  game.moralChoice = 0;
  game.gameTime = 0;
  initGame();
  game.state = 'playing';
  hideOverlay();
  requestLock();
}
