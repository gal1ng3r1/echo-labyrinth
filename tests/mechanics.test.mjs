import { strict as assert } from 'node:assert';
import { echoFrameAt, findUsableDoor } from '../js/mechanics.mjs';

const frames = [{ time: 0, x: 0 }, { time: 1, x: 1 }, { time: 2, x: 2 }];
assert.equal(echoFrameAt(frames, 1.5).x, 1);
assert.equal(echoFrameAt(frames, 20).x, 2);
assert.equal(findUsableDoor([{ x: 8, z: 0, unlocked: false }], 0, 0), undefined);
assert.equal(findUsableDoor([{ x: 2, z: 0, unlocked: false }], 0, 0).x, 2);
assert.equal(findUsableDoor([{ x: 2, z: 0, unlocked: true }], 0, 0), undefined);
console.log('mechanics tests passed');
