import { settings } from './config.js';

export const controls = {
  yaw: 0,
  pitch: 0,
  pointerLocked: false,
  pointerLockSupported: true
};

export const keys = {};

let domElement = null;
let getState = () => 'start';
let onFallback = null;

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
    const dx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    const dy = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
    if (controls.pointerLocked || !controls.pointerLockSupported) {
      applyLook(dx, dy);
    }
  });

  domElement.addEventListener('mousedown', (e) => {
    if (getState() !== 'playing') return;
    if (controls.pointerLockSupported && !controls.pointerLocked && e.button === 0) {
      requestLock();
    }
  });

  document.getElementById('lockOverlay').addEventListener('click', () => {
    if (getState() === 'playing') requestLock();
  });

  domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}