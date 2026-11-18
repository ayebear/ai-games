import * as THREE from 'three';
import { DAY_LEN, NIGHT_LEN, GOAL_DAYS, PLANTS, TOOLS, PLACEABLES, SUPPLIES, UPGRADES, ENEMIES, HALF, PLAYER_NAMES, MAX_PLAYERS } from './config.js';
import { G, newStats, activePlayers, rand, pick, clamp, dist2 } from './state.js';
import { World, spawnPickup, updatePickups } from './world.js';
import { Heart } from './plants.js';
import { Player } from './players.js';
import { Director, flashAt } from './enemies.js';
import { updateSky } from './scene.js';
import { sfx } from './audio.js';
import { closeShop } from './shop.js';

const EMPTY = { mx: 0, mz: 0, ax: 0, az: 0, held: {}, pressed: {}, nav: {} };

export class Game {
  constructor(env) {
    this.env = env;
    G.director = new Director();
    this.camT = new THREE.Vector3(0, 0, 0);
    this.camDist = 34;
    this.endT = 0;
    this.weedT = 10;
    this.orbit = 0;
    this.newWorld();
  }

  // ───────────── Setup ─────────────
  newWorld() {
    const sc = G.scene;
    for (const p of G.plants) sc.remove(p.root);
    for (const e of G.enemies) sc.remove(e.model.group);
    for (const p of G.pickups) sc.remove(p.mesh);
    for (const p of G.placeables) sc.remove(p.model.group);
    for (const p of G.projectiles) sc.remove(p.mesh);
    if (G.heart) sc.remove(G.heart.model.group);
    if (G.world) for (const c of G.world.cells) { if (c.plot) sc.remove(c.plot); if (c.weed) sc.remove(c.weed.mesh); }
    G.fx?.clear();

    G.world = new World(sc);
    G.plants = []; G.enemies = []; G.pickups = []; G.placeables = []; G.projectiles = []; G.flashes = [];
    G.heart = new Heart();
    G.money = 0; G.day = 1; G.time = 0; G.phase = 'day';
    G.upgrades = new Set(); G.stats = newStats();
    G.weather = 'clear'; G.hotItem = 'daisy'; G.boss = null; G.endless = false;
    G.director.reset();
    const w = G.world;
    // The old, overgrown garden
    for (const [i, j] of [[11, 18], [12, 18], [17, 18], [18, 18]]) { const c = w.cell(i, j); w.till(c, 1); w.addWeed(c); }
    const inPlay = (c) => c.type === 'grass' && !c.weed && Math.abs(c.x) < 24 && Math.abs(c.z) < 24 && Math.hypot(c.x, c.z) > 4 && !(c.z < -14 && Math.abs(c.x) < 9);
    for (let k = 0; k < 26; k++) { const c = w.randomCell(inPlay); if (c) w.addWeed(c); }
    for (const c of w.cells) if (c.weed) { c.weed.grow = 1; c.weed.mesh.scale.setScalar(1); }
    for (let k = 0; k < 6; k++) { const c = w.randomCell(inPlay); if (c) spawnPickup('junk', 1, c.x + rand(-0.5, 0.5), c.z + rand(-0.5, 0.5), 0, false); }
    for (let k = 0; k < 6; k++) { const c = w.randomCell(inPlay); if (c) spawnPickup('coin', 1, c.x, c.z, 1, false); }
    this.spawnDew();
    for (const p of G.slots) if (p) p.resetForNewGame();
  }

  spawnDew() {
    const n = 8 + 3 * Math.max(1, activePlayers().length);
    for (let k = 0; k < n; k++) {
      const c = G.world.randomCell((c) => (c.type === 'grass' || c.type === 'plot') && Math.hypot(c.x, c.z) < 21 && Math.hypot(c.x, c.z) > 3.5 && !c.placeable);
      if (c) spawnPickup('dew', 1, c.x + rand(-0.6, 0.6), c.z + rand(-0.6, 0.6), 0, false);
    }
  }

  startGame() {
    G.state = 'playing';
    G.hud.hideScreen();
    sfx('dawn');
    G.fx.toast('☀️ Day 1', 'Pull weeds 🌿 &amp; grab junk 🥾 → sell at the shop counter → buy seeds 🌱. Water with morning dew 💧!');
  }

  // ───────────── Join / leave ─────────────
  handleJoin(dt) {
    if (G.state === 'gameover' || G.state === 'victory') return;
    for (const [dev, inp] of G.input.devices) {
      const p = G.slots.find((s) => s && s.active && s.device === dev);
      if (p) {
        if (inp.held.start && !p.joinLock) p.leaveT += dt;
        else {
          // a short tap of START toggles pause; holding it (1s) leaves
          if (!inp.held.start && p.leaveT > 0 && p.leaveT < 0.45 && (G.state === 'playing' || G.state === 'paused')) this.pauseTap = true;
          p.leaveT = 0;
        }
        if (!inp.held.start) p.joinLock = false;
        if (p.leaveT >= 1) {
          p.leaveT = 0;
          p.leave();
          sfx('leave');
          G.fx.toast(`👋 ${PLAYER_NAMES[p.idx]} gnome left`, 'Press START to rejoin — tools are kept.');
        }
        continue;
      }
      if (!inp.pressed.start) continue;
      let idx = G.slots.findIndex((s) => s && !s.active && s.device === dev);
      if (idx < 0) idx = G.slots.findIndex((s) => !s);
      if (idx < 0) idx = G.slots.findIndex((s) => s && !s.active);
      if (idx < 0 || idx >= MAX_PLAYERS) continue;
      let np = G.slots[idx];
      if (np) np.rejoin(dev); else np = G.slots[idx] = new Player(idx, dev);
      np.joinLock = true;
      sfx('join');
      if (G.state !== 'title') G.fx.toast(`🧙 ${PLAYER_NAMES[np.idx]} gnome joined!`);
      if (G.state === 'paused' && activePlayers().length === 1) { G.state = 'playing'; G.hud.hideScreen(); }
    }
  }

  // ───────────── Main update ─────────────
  update(dt) {
    const inp = G.input;
    this.handleJoin(dt);
    const anyBack = [...inp.devices.values()].some((d) => d.pressed.back) || this.pauseTap;
    this.pauseTap = false;
    switch (G.state) {
      case 'title':
        G.hud.showTitle();
        if (activePlayers().some((p) => inp.get(p.device)?.pressed.a)) this.startGame();
        for (const p of activePlayers()) p.animate(dt, 0);
        break;
      case 'playing':
        if (activePlayers().length === 0 || anyBack) { G.state = 'paused'; break; }
        this.tick(dt);
        break;
      case 'paused':
        if (anyBack && activePlayers().length) { G.state = 'playing'; G.hud.hideScreen(); }
        else G.hud.showPause();
        break;
      case 'gameover':
      case 'victory': {
        this.endT += dt;
        if (this.endT > 2.5) {
          const pressed = (b) => [...inp.devices.values()].some((d) => d.pressed[b]);
          if (G.state === 'victory' && pressed('y')) { G.endless = true; G.state = 'playing'; G.hud.hideScreen(); break; }
          if (pressed('a')) { this.newWorld(); if (activePlayers().length) this.startGame(); else { G.state = 'title'; } }
        }
        for (const e of G.enemies) e.update(dt);
        break;
      }
    }
    // sky & lights always
    const p = G.phase === 'day' ? G.time / DAY_LEN : G.time / NIGHT_LEN;
    G.night = updateSky(this.env, { phase: G.phase, p, weather: G.weather, focus: this.camT });
    this.updateCamera(dt);
    this.updateLights(dt);
    this.updateAmbient(dt);
    G.fx.update(dt);
  }

  tick(dt) {
    G.time += dt;
    if (G.phase === 'day' && G.time >= DAY_LEN) this.dusk();
    else if (G.phase === 'night' && G.time >= NIGHT_LEN) this.dawn();
    if (G.state !== 'playing') return;
    const p = G.phase === 'day' ? G.time / DAY_LEN : 0;
    G.sun = G.phase === 'day' ? clamp(Math.sin(p * Math.PI) * 1.5, 0, 1) * (G.weather === 'rain' ? 0.5 : 1) : 0;

    G.director.update(dt);
    for (const pl of activePlayers()) pl.update(dt, G.input.get(pl.device) || EMPTY);
    G.world.update(dt);
    for (const pl of G.plants) if (!pl.dead) pl.update(dt);
    G.plants = G.plants.filter((pl) => !pl.dead);
    G.heart.update(dt);
    for (const pl of G.placeables) if (!pl.dead) pl.update(dt);
    G.placeables = G.placeables.filter((pl) => !pl.dead);
    for (const e of G.enemies) if (!e.dead) e.update(dt);
    G.enemies = G.enemies.filter((e) => !e.dead);
    updatePickups(dt);
    this.updateProjectiles(dt);
    for (const f of G.flashes) f.t -= dt;
    G.flashes = G.flashes.filter((f) => f.t > 0);

    // weeds keep creeping in
    this.weedT -= dt;
    if (this.weedT <= 0) {
      this.weedT = Math.max(5, 14 - G.day * 0.4);
      const c = G.world.randomCell((c) => (c.type === 'grass' || c.type === 'plot') && !c.weed && !c.placeable && Math.abs(c.x) < 25 && Math.abs(c.z) < 25 && Math.hypot(c.x, c.z) > 3.5);
      if (c) G.world.addWeed(c);
    }

    if (G.heart.hp <= 0 || G.heart.dead) this.gameOver();
  }

  dusk() {
    G.phase = 'night';
    G.time = 0;
    sfx('dusk');
    for (const p of activePlayers()) closeShop(p);
    for (const e of G.enemies) if (!e.def.night) e.startFlee();
    const counts = G.director.onDusk();
    const list = Object.entries(counts).map(([k, n]) => `${ENEMIES[k].icon}×${n}`).join(' ');
    G.fx.toast(`🌙 Night ${G.day}`, `The shop is closed. Defend the garden!${list ? ' Incoming: ' + list : ''}`, 'night');
  }

  dawn() {
    G.stats.nights++;
    G.day++;
    G.phase = 'day';
    G.time = 0;
    for (const e of G.enemies) e.startFlee();
    if (G.day > GOAL_DAYS && !G.endless) { this.victory(); return; }
    // weather & market
    const r = Math.random();
    G.weather = G.day < 3 ? 'clear' : r < 0.2 ? 'rain' : r < 0.35 ? 'heat' : 'clear';
    G.hotItem = pick(Object.keys(PLANTS).filter((k) => PLANTS[k].unlock <= G.day));
    if (G.weather !== 'rain') this.spawnDew();
    for (let k = 0; k < 3; k++) {
      const c = G.world.randomCell((c) => c.type === 'grass' && !c.weed && !c.placeable && Math.abs(c.x) < 25 && Math.abs(c.z) < 25 && Math.hypot(c.x, c.z) > 3.5);
      if (c) G.world.addWeed(c);
    }
    if (Math.random() < 0.35) {
      const c = G.world.randomCell((c) => c.type === 'grass' && Math.abs(c.x) < 24 && Math.abs(c.z) < 24 && Math.hypot(c.x, c.z) > 4);
      if (c) spawnPickup('junk', 1, c.x, c.z, 0, false);
    }
    G.director.onDawn();
    sfx('dawn');
    const wtxt = { clear: 'Clear skies', rain: '🌧️ Rain: plants drink, half sun, no dew', heat: '🔥 Heatwave: water evaporates 2× faster' }[G.weather];
    const fresh = [PLANTS, TOOLS, PLACEABLES, SUPPLIES, UPGRADES].flatMap((o) => Object.values(o).filter((d) => d.unlock === G.day).map((d) => d.icon + ' ' + d.name));
    G.fx.toast(`☀️ Day ${G.day} — Night ${G.day - 1} survived!`, `${wtxt} · Hot item: ${PLANTS[G.hotItem].icon} ${PLANTS[G.hotItem].name} sells ×2${fresh.length ? '<br>New in shop: ' + fresh.join(', ') : ''}`);
    if (G.day % 10 === 0) setTimeout(() => G.fx.toast('⚠️ Tonight is a full moon…', 'Something big is coming. Prepare!', 'danger'), 2500);
  }

  gameOver() {
    G.state = 'gameover';
    this.endT = 0;
    for (const p of activePlayers()) closeShop(p);
    G.fx.burst({ x: 0, y: 3.5, z: 0 }, 0xff6fa8, 60, { speed: 6, life: 1.5, grav: 3 });
    sfx('gameover');
    G.hud.showEnd(false);
  }
  victory() {
    G.state = 'victory';
    this.endT = 0;
    sfx('win');
    G.hud.showEnd(true);
  }

  // ───────────── Projectiles ─────────────
  updateProjectiles(dt) {
    for (const pr of G.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      if (pr.kind === 'spud') {
        pr.pos.addScaledVector(pr.vel, dt);
        pr.mesh.position.copy(pr.pos);
        pr.mesh.rotation.x += dt * 20;
        for (const e of G.enemies) {
          if (e.dead || pr.hits.has(e) || !e.canBeHitBy('gun')) continue;
          if (e.airborne && Math.abs(e.y - pr.pos.y) > 1.6) continue;
          if (dist2(e.pos, pr.pos) < e.def.radius + 0.4) {
            const l = pr.vel.length();
            e.hit(pr.dmg, pr.owner, (pr.vel.x / l) * 6, (pr.vel.z / l) * 6);
            pr.hits.add(e);
            if (!pr.pierce) { pr.dead = true; break; }
          }
        }
        const c = G.world.cellAt(pr.pos.x, pr.pos.z);
        if (!c || c.type === 'solid' || pr.life <= 0) pr.dead = true;
        if (pr.dead) G.fx.burst(pr.pos, pr.color ?? 0xc49a5a, 6, { speed: 3 });
      } else {
        pr.vel.y -= 20 * dt;
        pr.pos.addScaledVector(pr.vel, dt);
        pr.mesh.position.copy(pr.pos);
        pr.mesh.rotation.x += dt * 8;
        const c = G.world.cellAt(pr.pos.x, pr.pos.z);
        if (!c || c.type === 'solid' || c.type === 'forest') { pr.vel.x *= -0.4; pr.vel.z *= -0.4; pr.pos.addScaledVector(pr.vel, dt * 2); }
        let hitE = null;
        if (pr.item === 'produce:tomato' || pr.item === 'sunjar') {
          hitE = G.enemies.find((e) => !e.dead && dist2(e.pos, pr.pos) < e.def.radius + 0.4 && Math.abs(e.y + 0.6 - pr.pos.y) < 1.3);
        }
        if (hitE || pr.pos.y <= 0.05) { this.land(pr); pr.dead = true; }
      }
      if (pr.dead) G.scene.remove(pr.mesh);
    }
    if (G.projectiles.some((p) => p.dead)) G.projectiles = G.projectiles.filter((p) => !p.dead);
  }

  land(pr) {
    const { x, z } = pr.pos;
    if (pr.item === 'sunjar') { flashAt(x, z); return; }
    if (pr.item === 'produce:tomato') {
      G.fx.burst({ x, y: 0.6, z }, 0xe8302a, 16, { speed: 4 });
      sfx('splash');
      for (const e of G.enemies) if (!e.dead && dist2(e.pos, { x, z }) < 1.8 && e.canBeHitBy('throw')) e.hit(3, pr.owner, (e.pos.x - x) * 3, (e.pos.z - z) * 3);
      G.fx.text({ x, z }, 'SPLAT!', '#ff5252', 16);
      return;
    }
    if (pr.item === 'dew') {
      const target = G.plants.find((p) => !p.dead && dist2(p.pos, { x, z }) < 1.3) || (Math.hypot(x, z) < G.heart.radius + 1 ? G.heart : null);
      G.fx.burst({ x, y: 0.4, z }, 0x4fc3f7, 10, { speed: 2.5 });
      sfx('splash');
      if (target) { target.addWater(0.3); pr.owner.stats.water += 0.3; return; }
    }
    spawnPickup(pr.item, 1, x, z, pr.value, false);
  }

  // ───────────── Camera, lights, ambience ─────────────
  updateCamera(dt) {
    const cam = G.camera;
    const ps = activePlayers();
    if ((G.state === 'title') || ps.length === 0) {
      this.orbit += dt * 0.08;
      const target = new THREE.Vector3(Math.sin(this.orbit) * 36, 24, Math.cos(this.orbit) * 36);
      cam.position.lerp(target, Math.min(1, dt * 2));
      cam.lookAt(0, 2, 0);
      this.camT.set(0, 0, 0);
      return;
    }
    let cx = 0, cz = 0;
    for (const p of ps) { cx += p.pos.x; cz += p.pos.z; }
    cx /= ps.length; cz /= ps.length;
    let spread = 0;
    for (const p of ps) spread = Math.max(spread, Math.hypot(p.pos.x - cx, (p.pos.z - cz) * 1.5));
    if (G.state === 'gameover') { cx = 0; cz = 0; spread = 6; }
    const k = Math.min(1, dt * 3);
    this.camT.x += (clamp(cx, -16, 16) - this.camT.x) * k;
    this.camT.z += (clamp(cz, -14, 15) - this.camT.z) * k;
    const want = clamp(15 + spread * 1.25, 17, 50);
    this.camDist += (want - this.camDist) * Math.min(1, dt * 2);
    const d = this.camDist;
    cam.position.set(this.camT.x, d * 0.92, this.camT.z + d * 0.7);
    cam.lookAt(this.camT.x, 0, this.camT.z - 1.5);
  }

  updateLights() {
    const { lampLights, playerLights, heartLight } = this.env;
    const nk = G.night;
    const lamps = G.placeables.filter((p) => p.type === 'lamp' && !p.dead).sort((a, b) => dist2(a.pos, this.camT) - dist2(b.pos, this.camT));
    lampLights.forEach((l, i) => {
      const lp = lamps[i];
      if (lp) { l.position.set(lp.pos.x, 2.4, lp.pos.z); l.intensity = 2 + nk * 28; }
      else { l.intensity = 0; l.position.y = -50; }
    });
    const bright = G.upgrades.has('lanterns');
    playerLights.forEach((l, i) => {
      const p = G.slots[i];
      if (p && p.active && nk > 0.05) {
        l.position.set(p.pos.x, 1.6, p.pos.z);
        l.intensity = nk * (bright ? 30 : 16);
        l.distance = bright ? 14 : 9;
      } else { l.intensity = 0; l.position.y = -50; }
    });
    heartLight.intensity = nk * 18;
  }

  updateAmbient(dt) {
    const { rain, fireflies } = this.env;
    rain.visible = G.weather === 'rain' && G.state !== 'title';
    if (rain.visible) {
      const pos = rain.geometry.attributes.position.array;
      rain.userData.drops.forEach((d, i) => {
        d.y -= dt * 28;
        if (d.y < 0) { d.y = 25 + Math.random() * 5; d.x = this.camT.x + (Math.random() - 0.5) * 70; d.z = this.camT.z + (Math.random() - 0.5) * 60; }
        pos.set([d.x, d.y, d.z, d.x + 0.1, d.y + 0.8, d.z], i * 6);
      });
      rain.geometry.attributes.position.needsUpdate = true;
    }
    const nk = G.night;
    fireflies.material.opacity = nk * 0.9;
    if (nk > 0) {
      const pos = fireflies.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      fireflies.userData.seeds.forEach((s, i) => {
        pos[i * 3] = s.x + Math.sin(t * 0.3 + s.p) * 3;
        pos[i * 3 + 1] = 1 + Math.sin(t * 0.7 + s.p * 2) * 0.6;
        pos[i * 3 + 2] = s.z + Math.cos(t * 0.25 + s.p) * 3;
      });
      fireflies.geometry.attributes.position.needsUpdate = true;
    }
  }
}
