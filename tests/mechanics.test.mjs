import { strict as assert } from 'node:assert';
import { echoFrameAt, findUsableDoor, findDoorPlacement, doorBlocks } from '../js/mechanics.mjs';
import { generateMaze, hasLineOfSight } from '../js/maze.js';

const frames = [{ time: 0, x: 0 }, { time: 1, x: 1 }, { time: 2, x: 2 }];
assert.equal(echoFrameAt(frames, 1.5).x, 1);
assert.equal(echoFrameAt(frames, 20).x, 2);
assert.equal(findUsableDoor([{ x: 8, z: 0, unlocked: false }], 0, 0), undefined);
assert.equal(findUsableDoor([{ x: 2, z: 0, unlocked: false }], 0, 0).x, 2);
assert.equal(findUsableDoor([{ x: 2, z: 0, unlocked: true }], 0, 0), undefined);
const door = findDoorPlacement([[1, 1, 1], [1, 0, 0], [1, 1, 1]], 4);
assert.deepEqual(door, { x: 8, z: 6, rotation: Math.PI / 2 });
assert.equal(doorBlocks({ ...door, width: 2, depth: 0.3 }, 8, 6, 0.5), true);
assert.equal(doorBlocks({ ...door, width: 2, depth: 0.3 }, 4, 6, 0.5), false);

for (let i = 0; i < 100; i++) {
  const maze = generateMaze();
  const queue = [[1, 1]], seen = new Set(['1,1']);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [x, y] = queue[cursor];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (maze[ny]?.[nx] === 0 && !seen.has(key)) { seen.add(key); queue.push([nx, ny]); }
    }
  }
  for (let y = 1; y < maze.length - 1; y++) for (let x = 1; x < maze[y].length - 1; x++)
    if (maze[y][x] === 0) assert.ok(seen.has(`${x},${y}`), `isolated cell at ${x},${y}`);
}

const openMaze = Array.from({ length: 5 }, () => Array(5).fill(0));
openMaze[2][2] = 1;
assert.equal(hasLineOfSight(0.5, 2.5, 4.5, 2.5, openMaze, 1), false);
assert.equal(hasLineOfSight(0.5, 0.5, 4.5, 0.5, openMaze, 1), true);
console.log('mechanics tests passed');
