import { game, initGameScene, updateGame, startGame, retryGame, makeChoice, pauseGame, resumeGame, quitToMenu, restartAll, handleGameKey } from './game.js';
import { initControls } from './player.js';
import { showScreen, loadSettingsUI, bindSettingsUI } from './ui.js';
import { LAYER_CONFIG, settings } from './config.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(LAYER_CONFIG[0].fogColor);
scene.fog = new THREE.FogExp2(LAYER_CONFIG[0].fogColor, LAYER_CONFIG[0].fogDensity);
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 150);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'gameCanvas';
document.body.appendChild(renderer.domElement);

initGameScene(scene, camera);
initControls(renderer.domElement, () => game.state, () => {});
loadSettingsUI();
bindSettingsUI(camera, renderer);

const byId = id => document.getElementById(id);
byId('startBtn').addEventListener('click', startGame);
byId('settingsBtn').addEventListener('click', () => showScreen('settingsScreen'));
byId('backBtn').addEventListener('click', () => showScreen(game.state === 'pause' ? 'pauseScreen' : 'startScreen'));
byId('resumeBtn').addEventListener('click', resumeGame);
byId('pauseSettingsBtn').addEventListener('click', () => showScreen('settingsScreen'));
byId('quitBtn').addEventListener('click', () => { quitToMenu(); showScreen('startScreen'); });
byId('retryBtn').addEventListener('click', retryGame);
byId('restartBtn').addEventListener('click', restartAll);
byId('forgiveBtn').addEventListener('click', () => makeChoice(1));
byId('resentBtn').addEventListener('click', () => makeChoice(-1));

window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !event.repeat) {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'pause') resumeGame();
    return;
  }
  if (!event.repeat) handleGameKey(event.code);
});

function resize() {
  camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateGame(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
