export function echoFrameAt(frames, time) {
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (frames[mid].time <= time) low = mid;
    else high = mid - 1;
  }
  return frames[low];
}

export function findUsableDoor(doors, x, z) {
  return doors.find(door => !door.unlocked && Math.hypot(door.x - x, door.z - z) < 5);
}

export function findDoorPlacement(maze, tileSize = 4, minDistance = 0) {
  for (let y = 1; y < maze.length - 1; y++) {
    for (let x = 1; x < maze[y].length - 1; x++) {
      if (maze[y][x] === 0 && maze[y][x + 1] === 0 && x - 1 + y - 1 >= minDistance) {
        return { x: (x + 1) * tileSize, z: (y + 0.5) * tileSize, rotation: Math.PI / 2 };
      }
    }
  }
  for (let y = 1; y < maze.length - 2; y++) {
    for (let x = 1; x < maze[y].length - 1; x++) {
      if (maze[y][x] === 0 && maze[y + 1][x] === 0 && x - 1 + y - 1 >= minDistance) {
        return { x: (x + 0.5) * tileSize, z: (y + 1) * tileSize, rotation: 0 };
      }
    }
  }
  if (minDistance > 0) return findDoorPlacement(maze, tileSize, 0);
  return undefined;
}

export function doorBlocks(door, x, z, radius = 0.5) {
  const dx = x - door.x, dz = z - door.z;
  const c = Math.cos(door.rotation || 0), s = Math.sin(door.rotation || 0);
  const localX = c * dx - s * dz;
  const localZ = s * dx + c * dz;
  return Math.abs(localX) <= door.width / 2 + radius && Math.abs(localZ) <= door.depth / 2 + radius;
}
