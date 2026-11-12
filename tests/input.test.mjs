import { strict as assert } from 'node:assert';
import { clearInputState, controls, keys } from '../js/player.js';

keys.KeyW = true;
keys.ShiftLeft = true;
controls.dragging = true;
clearInputState();
assert.equal(keys.KeyW, false);
assert.equal(keys.ShiftLeft, false);
assert.equal(controls.dragging, false);
console.log('input reset tests passed');
