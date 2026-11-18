# Jet Raft 🛶💦

Local co-op (1–4 players) rafting down curvy magical sky rivers.

```
npm install
npm run dev        # open the printed URL (Chrome/Edge recommended for gamepads)
```

## Controls (gamepad, standard mapping)
| Input | Action |
|---|---|
| START | join / leave |
| Left stick | walk (camera-relative) |
| Right stick | aim (otherwise you face where you walk) |
| RT | blast the rear jet: pushes the raft forward, or you if you're in the air or water |
| LT | suck water through the front pump. Stand at the raft edge facing the water, or catch a friend's spray to chain it |
| A | jump (launch the level on the title screen) |
| Back/Select | pause |
| D-pad / stick ←→ | choose level on the title screen |

Keyboard player: WASD walk, IJKL aim, E blast, Q suck, Space jump, Enter join/leave, ←/→ level, Esc pause.

## Rules
- Each tank holds 10 s of full blast. Refill from the river or from other players' water streams.
- Water droplets are simulated individually. A jet can shove other players off the raft.
- If the raft falls off the edge, you restart from the last checkpoint. If a player falls, they respawn by dropping back onto the raft.
- Levels are generated from the level number, so a level is identical every time you replay it. Later levels are longer and faster, with fewer guard rails and more bends, rocks, narrow spots and waterfall drops.

Debug URL params: `?level=N`, `?autojoin=4&bot&play` (bots that play by themselves).
