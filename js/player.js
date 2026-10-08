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
let lastMouseX = 0;
let lastMouseY = 0;

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
  document.getElementById('lockOverlay').classList.remove('show');
  document.getElementById('lookModeHint').classList.add('show');
  if (onFallback) onFallback();
}

export function requestLock() {
  if (!controls.pointerLockSupported || !domElement) return;
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
  if (controls.pointerLocked) document.exitPointerLock();
}

export function initControls(element, stateGetter, fallbackCallback) {
  domElement = element;
  getState = stateGetter;
  onFallback = fallbackCallback || (() => {});
  controls.pointerLockSupported = typeof element.requestPointerLock === 'function' && typeof document.exitPointerLock === 'function';
  if (!controls.pointerLockSupported) enableFallbackMode();

  window.addEventListener('keydown', e => { keys[e.code] = true; });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  document.addEventListener('pointerlockerror', () => {
    console.warn('pointerlockerror — fallback-режим');
    enableFallbackMode();
  });

  document.addEventListener('pointerlockchange', () => {
    controls.pointerLocked = (document.pointerLockElement === domElement);
    if (getState() === 'playing' && !controls.pointerLocked && controls.pointerLockSupported) {
      document.getElementById('lockOverlay').classList.add('show');
    } else {
      document.getElementById('lockOverlay').classList.remove('show');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (getState() !== 'playing') return;
    let dx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    let dy = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
    if (!controls.pointerLocked && !controls.pointerLockSupported) {
      if (!controls.dragging) return;
      dx = e.clientX - lastMouseX;
      dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    if (controls.pointerLocked || (!controls.pointerLockSupported && controls.dragging)) {
      applyLook(dx, dy);
    }
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

  document.getElementById('lockOverlay').addEventListener('click', () => {
    if (getState() === 'playing') requestLock();
  });

  domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}
