import { LAYER_NAMES, LAYER_CONFIG, MAP_W, MAP_H, TILE, settings } from './config.js';
import { updateVolume } from './audio.js';

const SCREENS = ['startScreen', 'settingsScreen', 'pauseScreen', 'deathScreen', 'choiceScreen', 'winScreen'];

export function showScreen(id) {
  SCREENS.forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

export function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

let messageTimer = 0;
export function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.classList.add('show');
  messageTimer = 2;
}
export function tickMessage(dt) {
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) document.getElementById('message').classList.remove('show');
  }
}

export function showDeathScreen(echoCount, attempts) {
  showScreen('deathScreen');
  document.getElementById('deathEchoInfo').textContent = `Эхо #${echoCount} сохранено. Всего попыток: ${attempts}`;
}

export function showChoiceScreen() {
  showScreen('choiceScreen');
  const memories = [
    'Вы видите комнату. Маленький ребёнок плачет в углу. Кто-то кричит. Это... ваш дом. Ваш отец. Снова.',
    'Больничная палата. Белый свет. Монитор пищит. Кто-то держит вас за руку, но вы не можете вспомнить — кто.',
    'Дождь. Фары. Визг тормозов. И потом — тишина. Бесконечная тишина.'
  ];
  document.getElementById('memoryText').textContent = memories[Math.floor(Math.random() * memories.length)];
}

export function showWinScreen(moralChoice, attempts, echoCount, gameTime) {
  showScreen('winScreen');
  let text = '';
  if (moralChoice === 1) text = 'Вы простили. И отпустили. Свет заполняет лабиринт — стены растворяются. Вы открываете глаза. Белый потолок. Мониторы пищат. Вы живы.';
  else if (moralChoice === -1) text = 'Вы не смогли простить. Обиду вы носите с собой — даже здесь, даже сейчас. Лабиринт трескается. Вы просыпаетесь — но тень осталась. Она всегда будет рядом.';
  else text = 'Лабиринт рушится. Вы не помните, что было раньше. Но вы живы. И это главное.';
  document.getElementById('winText').textContent = text;
  document.getElementById('winStats').textContent = `Попыток: ${attempts} | Эхо: ${echoCount} | Время: ${Math.floor(gameTime)}с`;
}

export function updateHUD(g) {
  document.getElementById('healthFill').style.width = g.playerState.health + '%';
  document.getElementById('flashlightFill').style.width = g.playerState.flashlightCharge + '%';
  document.getElementById('layerIndicator').textContent = 'СЛОЙ: ' + LAYER_NAMES[g.currentLayer];
  document.getElementById('layerIndicator').style.borderColor = '#' + LAYER_CONFIG[g.currentLayer].accent.toString(16).padStart(6, '0');
  document.getElementById('echoCount').textContent = 'ЭХО: ' + g.echoes.length;
  document.getElementById('attemptCount').textContent = 'ПОПЫТКА: ' + g.attempts;

  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById('slot' + i);
    slot.textContent = g.playerState.inventory[i] ? g.playerState.inventory[i].type : '';
    slot.className = 'slot' + (g.playerState.inventory[i] ? ' active' : '') + (g.selectedSlot === i ? ' selected' : '');
    slot.title = g.playerState.inventory[i] ? g.playerState.inventory[i].name : `Слот ${i + 1} пуст`;
  }

  const compInd = document.getElementById('companion-indicator');
  if (g.companion && g.companion.visible) {
    compInd.style.display = 'block';
    compInd.textContent = g.companion.scared > 0.5 ? '🔥 Спутник дрожит!' : '🔥 Спутник рядом';
    compInd.style.color = g.companion.scared > 0.5 ? '#ff4444' : '#ffdd44';
  } else {
    compInd.style.display = 'none';
  }

  const nearCore = !g.coreActivated &&
    Math.sqrt((g.playerPos.x - g.corePos.x)**2 + (g.playerPos.z - g.corePos.z)**2) < 2.5;
  document.getElementById('interactHint').classList.toggle('show', nearCore);

  document.getElementById('damageOverlay').style.opacity = Math.max(0, g.damageFlash);
}

export function renderMinimap(g) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const scale = 140 / MAP_W;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, 140, 140);
  const maze = g.mazes[g.currentLayer];
  const hasMap = g.playerState.inventory.some(i => i && i.type === '🗺️');
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (maze[y][x] === 1) {
        const d = Math.abs(x - Math.floor(g.playerPos.x/TILE)) + Math.abs(y - Math.floor(g.playerPos.z/TILE));
        if (hasMap || d < 6) {
          ctx.fillStyle = '#' + LAYER_CONFIG[g.currentLayer].accent.toString(16).padStart(6, '0');
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  const pmx = (g.playerPos.x / TILE) * scale;
  const pmy = (g.playerPos.z / TILE) * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(pmx, pmy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pmx, pmy);
  ctx.lineTo(pmx - Math.sin(g.yaw) * 6, pmy - Math.cos(g.yaw) * 6);
  ctx.stroke();
  if (g.coreActivated) {
    ctx.fillStyle = '#00ff88';
    ctx.beginPath(); ctx.arc((g.exitPos.x / TILE) * scale, (g.exitPos.z / TILE) * scale, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  g.enemies.forEach(e => {
    const ex = e.mesh.position.x, ez = e.mesh.position.z;
    if (Math.sqrt((ex-g.playerPos.x)**2 + (ez-g.playerPos.z)**2) < 12) {
      ctx.fillStyle = '#ff0044';
      ctx.beginPath(); ctx.arc((ex/TILE)*scale, (ez/TILE)*scale, 2, 0, Math.PI * 2); ctx.fill();
    }
  });
}

export function loadSettingsUI() {
  document.getElementById('setSensitivity').value = settings.sensitivity;
  document.getElementById('valSensitivity').textContent = settings.sensitivity;
  document.getElementById('setInvertY').checked = settings.invertY;
  document.getElementById('setQuality').value = settings.quality;
  document.getElementById('setFOV').value = settings.fov;
  document.getElementById('valFOV').textContent = settings.fov;
  document.getElementById('setHeadBob').value = settings.headBob;
  document.getElementById('valHeadBob').textContent = settings.headBob;
  document.getElementById('setVolume').value = settings.volume;
  document.getElementById('valVolume').textContent = settings.volume;
}

export function bindSettingsUI(camera, renderer) {
  const bind = (id, key, valId) => {
    document.getElementById(id).addEventListener('input', e => {
      settings[key] = parseFloat(e.target.value);
      if (valId) document.getElementById(valId).textContent = e.target.value;
      if (key === 'fov') {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }
      if (key === 'volume') updateVolume();
    });
  };
  bind('setSensitivity', 'sensitivity', 'valSensitivity');
  bind('setFOV', 'fov', 'valFOV');
  bind('setHeadBob', 'headBob', 'valHeadBob');
  bind('setVolume', 'volume', 'valVolume');

  document.getElementById('setInvertY').addEventListener('change', e => { settings.invertY = e.target.checked; });
  document.getElementById('setQuality').addEventListener('change', e => {
    settings.quality = e.target.value;
    const pr = settings.quality === 'high' ? Math.min(window.devicePixelRatio, 2) : settings.quality === 'medium' ? Math.min(window.devicePixelRatio, 1.5) : 1;
    renderer.setPixelRatio(pr);
    renderer.shadowMap.enabled = settings.quality !== 'low';
  });
}
