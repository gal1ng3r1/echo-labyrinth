import { TILE, WALL_H, MAP_W, MAP_H, LAYER_CONFIG, settings } from './config.js';

export function generateMaze() {
  const grid = Array.from({length: MAP_H}, () => Array(MAP_W).fill(1));
  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = [[0,-2],[0,2],[-2,0],[2,0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < MAP_W-1 && ny > 0 && ny < MAP_H-1 && grid[ny][nx] === 1) {
        grid[y + dy/2][x + dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1, 1);
  for (let i = 0; i < 20; i++) {
    const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
    grid[y][x] = 0;
  }
  return grid;
}

export function createLayerVariants(base) {
  const reality = base.map(r => [...r]);
  const memory = reality.map(r => [...r]);
  for (let y = 1; y < MAP_H-1; y++) {
    for (let x = 1; x < MAP_W-1; x++) {
      if (memory[y][x] === 1 && Math.random() < 0.35) {
        let wn = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (memory[y+dy]?.[x+dx] === 1) wn++;
        if (wn > 3) memory[y][x] = 0;
      }
    }
  }
  const nightmare = reality.map(r => [...r]);
  for (let y = 1; y < MAP_H-1; y++)
    for (let x = 1; x < MAP_W-1; x++)
      if (nightmare[y][x] === 1 && Math.random() < 0.25) nightmare[y][x] = 0;
  return [reality, memory, nightmare];
}

export function findOpenPositions(maze) {
  const positions = [];
  for (let y = 1; y < MAP_H-1; y++)
    for (let x = 1; x < MAP_W-1; x++)
      if (maze[y][x] === 0 && !(x === 1 && y === 1)) positions.push({x, y});
  return positions.sort(() => Math.random() - 0.5);
}

export function generatePatrolPoints(startX, startY, mazes) {
  const points = [{ x: startX * TILE + TILE/2, z: startY * TILE + TILE/2 }];
  let cx = startX, cy = startY;
  for (let i = 0; i < 3; i++) {
    const dirs = [[0,-2],[0,2],[-2,0],[2,0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && nx < MAP_W-1 && ny > 0 && ny < MAP_H-1 && mazes[0][ny][nx] === 0) {
        points.push({ x: nx * TILE + TILE/2, z: ny * TILE + TILE/2 });
        cx = nx; cy = ny; break;
      }
    }
  }
  return points;
}

export function buildMazeMeshes(scene, mazes, currentLayer) {
  const wallMeshes = [], floorMeshes = [];
  for (let layer = 0; layer < 3; layer++) {
    const cfg = LAYER_CONFIG[layer], maze = mazes[layer];

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_W * TILE, MAP_H * TILE),
      new THREE.MeshStandardMaterial({ color: cfg.floorColor, roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(MAP_W * TILE / 2, 0, MAP_H * TILE / 2);
    floor.receiveShadow = settings.quality !== 'low';
    floor.visible = (layer === currentLayer);
    scene.add(floor);
    floorMeshes.push(floor);

    let count = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (maze[y][x] === 1) count++;

    const wallGeom = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    const wallMat = new THREE.MeshStandardMaterial({
      color: cfg.wallColor, roughness: 0.85, metalness: 0.15,
      emissive: layer === 2 ? 0x220011 : 0x000000,
      emissiveIntensity: layer === 2 ? 0.3 : 0
    });
    const instanced = new THREE.InstancedMesh(wallGeom, wallMat, count);
    instanced.castShadow = settings.quality !== 'low';
    instanced.receiveShadow = settings.quality !== 'low';
    const matrix = new THREE.Matrix4();
    let idx = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (maze[y][x] === 1) {
          matrix.setPosition(x * TILE + TILE/2, WALL_H/2, y * TILE + TILE/2);
          instanced.setMatrixAt(idx++, matrix);
        }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.visible = (layer === currentLayer);
    scene.add(instanced);
    wallMeshes.push(instanced);
  }
  return { wallMeshes, floorMeshes };
}

export function setLayerVisible(scene, wallMeshes, floorMeshes, layer, ambientLight) {
  for (let i = 0; i < 3; i++) {
    wallMeshes[i].visible = (i === layer);
    floorMeshes[i].visible = (i === layer);
  }
  const cfg = LAYER_CONFIG[layer];
  scene.fog.color.setHex(cfg.fogColor);
  scene.fog.density = cfg.fogDensity;
  scene.background.setHex(cfg.fogColor);
  if (ambientLight) ambientLight.color.setHex(cfg.ambient);
}

export function isWall(px, pz, layer, mazes) {
  const tx = Math.floor(px / TILE), tz = Math.floor(pz / TILE);
  if (tx < 0 || tx >= MAP_W || tz < 0 || tz >= MAP_H) return true;
  return mazes[layer][tz][tx] === 1;
}

export function canMove(x, z, radius, layer, mazes) {
  const r = radius || 0.5;
  return !isWall(x - r, z - r, layer, mazes) && !isWall(x + r, z - r, layer, mazes) &&
         !isWall(x - r, z + r, layer, mazes) && !isWall(x + r, z + r, layer, mazes);
}

export function dist2D(ax, az, bx, bz) {
  return Math.sqrt((ax-bx)**2 + (az-bz)**2);
}