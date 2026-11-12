import { settings } from './config.js';

export const controls = {
  yaw: 0,
  pitch: 0,
  pointerLocked: false,
  pointerLockSupported: true,
  dragging: false
};

export const keys = {};

let domElement = null;
let getState = () => 'start';
let onFallback = null;
let lastMouseX = null;
let lastMouseY = null;

// Pause screens can consume the keyup event. Clear movement and drag state
// explicitly so resuming never inherits a stuck key or stale mouse delta.
export function clearInputState() {
  Object.keys(keys).forEach(code => { keys[code] = false; });
  controls.dragging = false;
  lastMouseX = null;
  lastMouseY = null;
  if (domElement) domElement.classList.remove('camera-dragging');
}

function applyLook(dx, dy) {
  const sens = settings.sensitivity * 0.0016;
  controls.yaw -= dx * sens;
  const yDelta = dy * sens * (settings.invertY ? -1 : 1);
  controls.pitch -= yDelta;
  controls.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, controls.pitch));
  if (controls.yaw > Math.PI) controls.yaw -= Math.PI * 2;
  if (controls.yaw < -Math.PI) controls.yaw += Math.PI * 2;
}

function enableFallbackMode() {
  controls.pointerLockSupported = false;
  document.getElementById('lookModeHint').classList.add('show');
  if (onFallback) onFallback();
}

export function requestLock() {
  if (!controls.pointerLockSupported || !domElement) return;
  controls.pointerLocked = document.pointerLockElement === domElement;
  if (controls.pointerLocked) return;
  try {
    const result = domElement.requestPointerLock();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => {
        console.warn('Pointer lock отклонён:', err);
        enableFallbackMode();
      });
    }
  } catch (e) {
    console.warn('Pointer lock недоступен:', e);
    enableFallbackMode();
  }
}

export function releaseLock() {
  controls.pointerLocked = false;
  if (document.pointerLockElement === domElement) document.exitPointerLock();
}

export function initControls(element, stateGetter, fallbackCallback) {
  domElement = element;
  getState = stateGetter;
  onFallback = fallbackCallback || (() => {});
  controls.pointerLockSupported = typeof element.requestPointerLock === 'function' && typeof document.exitPointerLock === 'function';
  if (!controls.pointerLockSupported) enableFallbackMode();
  element.style.cursor = 'none';

  window.addEventListener('keydown', e => { keys[e.code] = true; });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  document.addEventListener('pointerlockerror', () => {
    console.warn('pointerlockerror — fallback-режим');
    enableFallbackMode();
  });

  document.addEventListener('pointerlockchange', () => {
    controls.pointerLocked = (document.pointerLockElement === domElement);
    if (!controls.pointerLocked) {
      lastMouseX = null;
      lastMouseY = null;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (getState() !== 'playing') return;
    const actuallyLocked = document.pointerLockElement === domElement;
    if (controls.pointerLocked !== actuallyLocked) controls.pointerLocked = actuallyLocked;
    let dx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    let dy = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
    if (!actuallyLocked) {
      if (lastMouseX !== null && lastMouseY !== null) {
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
      } else {
        dx = 0;
        dy = 0;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    applyLook(dx, dy);
  });

  domElement.addEventListener('mousedown', (e) => {
    if (getState() !== 'playing') return;
    if (!controls.pointerLockSupported && e.button === 0) {
      controls.dragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      domElement.classList.add('camera-dragging');
    } else if (controls.pointerLockSupported && !controls.pointerLocked && e.button === 0) {
      requestLock();
    }
  });

  window.addEventListener('mouseup', () => {
    controls.dragging = false;
    domElement.classList.remove('camera-dragging');
  });

  window.addEventListener('blur', clearInputState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInputState();
  });

  domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}
