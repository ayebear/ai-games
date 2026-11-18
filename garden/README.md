# Bloom & Doom

A 3D couch co-op garden-defense game for 1–4 players, built with Three.js.
Grow plants by day, defend the Heart Bloom by night, and try to survive 100 days.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

## Run

```bash
npm install
npm run dev      # then open the printed URL (Chrome/Edge/Firefox)
npm run build    # production build in dist/
npm run balance  # print the plant economy and the market unlock/price curve
npm run prod     # build + serve on 0.0.0.0:4173 for LAN play (prints the LAN links)
PORT=8080 npm run prod   # use a different port
```

## Controls

| | Gamepad | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Join / pause / leave | Start / tap Start / hold Start | Enter / tap / hold | Right Shift / tap / hold |
| Move | Left stick, D-pad | WASD | Arrows |
| Interact / buy at a stall | A | Space | . |
| Use tool / sell at a stall | X or RT (hold for hose, can, sprayer) | J | , |
| Drop / throw | B / Y | K / L | / / ; |
| Drop equipped tool | hold B | hold K | hold / |
| Switch tool | LB / RB | Q / E | M / ' |
| Pause | Back | Esc | Esc |

Press a button on each controller once after the page loads so the browser can see it.

## Code map

| File | Purpose |
|---|---|
| `src/config.js` | All tuning data: plant economy formula, plants, tools, gadgets, supplies, upgrades, shops, enemies |
| `src/game.js` | Game flow: day/night, joining/leaving, projectiles, camera, lights |
| `src/players.js` | Gnome movement, context actions, tools, carrying |
| `src/enemies.js` | Enemy AI and the wave Director |
| `src/plants.js` | Plant growth model (water/sun/soil) and the Heart Bloom |
| `src/placeables.js` | Garden gadgets (sprinkler, zapper, lamp, …) |
| `src/world.js` | Grid, plots, weeds, ground pickups |
| `src/market.js` | The walk-in market: shops with menu boards, one stall per item (buy with A, sell back with X), NEW tags, Quick Sell kiosk |
| `src/icons.js` | Item icons rendered from the 3D models at startup (used on boards, cards and the HUD) |
| `src/hud.js` | HUD, stall cards, attack alarms, title and results screens |
| `src/models.js`, `src/scene.js` | Procedural low-poly models and scene setup |
| `src/input.js`, `src/audio.js`, `src/fx.js` | Gamepad/keyboard input, synthesized SFX, particles |

`window.G` (game state) and `window.game` are exposed in the console for debugging.
For example, `G.money = 999` or `G.time = 149` (skip to dusk).
