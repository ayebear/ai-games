import { G } from './state.js';
import { createScene } from './scene.js';
import { Input } from './input.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { initAudio } from './audio.js';
import { buildIcons } from './icons.js';

const env = createScene(document.getElementById('game'));
G.scene = env.scene;
G.camera = env.camera;
G.renderer = env.renderer;
buildIcons(); // before anything draws an item icon
G.input = new Input();
G.input.onGesture = initAudio;
G.fx = new FX(env.scene, env.camera, document.getElementById('labels'));
G.hud = new HUD();
const game = new Game(env);
window.G = G; // handy for debugging in the console
window.game = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.input.poll(dt);
  game.update(dt);
  G.hud.update();
  env.renderer.render(env.scene, env.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
