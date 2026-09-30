import { settings } from './config.js';

let audioCtx = null;
let masterGain = null;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = settings.volume / 100;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

export function updateVolume() {
  if (masterGain) masterGain.gain.value = settings.volume / 100;
}

function playTone(freq, duration, type = 'sine', vol = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const SFX = {
  step:      () => playTone(80 + Math.random()*40, 0.05, 'triangle', 0.04),
  pickup:    () => { playTone(800, 0.15, 'sine', 0.1); setTimeout(()=>playTone(1200, 0.2, 'sine', 0.08), 80); },
  hurt:      () => playTone(100, 0.3, 'sawtooth', 0.12),
  layer:     () => { playTone(200, 0.1, 'square', 0.05); playTone(400, 0.15, 'sine', 0.05); },
  death:     () => { playTone(200, 0.5, 'sawtooth', 0.1); setTimeout(()=>playTone(100, 0.8, 'sawtooth', 0.08), 200); },
  heartbeat: (i) => { playTone(40, 0.15, 'sine', 0.05*i); setTimeout(()=>playTone(50, 0.1, 'sine', 0.04*i), 150); },
  stone:     () => { playTone(300, 0.05, 'triangle', 0.06); setTimeout(()=>playTone(150, 0.3, 'triangle', 0.04), 100); },
  echo:      () => playTone(200, 0.3, 'triangle', 0.05)
};