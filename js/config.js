export const TILE = 4;
export const WALL_H = 4;
export const MAP_W = 21;
export const MAP_H = 21;

export const PLAYER_RADIUS = 0.5;
export const EYE_HEIGHT = 1.6;
export const PLAYER_SPEED = 5.5;
export const RUN_MULT = 1.7;
export const LIGHT_DIST = 20;

export const LAYER_NAMES = ['РЕАЛЬНОСТЬ', 'ПАМЯТЬ', 'КОШМАР'];
export const LAYER_CONFIG = {
  0: { wallColor: 0x2a2a3a, floorColor: 0x111118, fogColor: 0x0a0a15, fogDensity: 0.08, ambient: 0x223344, accent: 0x4444aa },
  1: { wallColor: 0x4a3520, floorColor: 0x1a1408, fogColor: 0x1a1008, fogDensity: 0.06, ambient: 0x443322, accent: 0xaa8844 },
  2: { wallColor: 0x3a0a1a, floorColor: 0x0a0008, fogColor: 0x100008, fogDensity: 0.1, ambient: 0x441122, accent: 0xaa0044 }
};

export const settings = {
  sensitivity: 5,
  invertY: false,
  quality: 'medium',
  fov: 75,
  headBob: 50,
  volume: 70
};