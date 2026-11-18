# BLOOM & DOOM — Game Design

*A 3D couch co-op garden-defense game for 1–4 gardeners.*

You and up to three friends are garden gnomes who inherit an overgrown, abandoned garden.
At its center grows the **Heart Bloom**, an ancient giant flower that keeps the garden alive.
By day you clear weeds, plant seeds, water, feed and harvest. By night the forest wakes up and
hungry creatures come for your plants. Survive as many nights as you can. The goal is **Day 100**.

---

## 1. Pillars

1. **From nothing to a fortress-garden.** You start with bare hands, a few weeds and no money.
   Every coin you earn comes from the garden itself.
2. **Every tool has more than one job.** Nothing in the shop does only one thing. Tools,
   plants and gadgets combine with each other.
3. **Day = farm, Night = defend.** Daytime is busy and only a little dangerous. Night is the
   round: a wave of enemies you get ready for while the sun is up.
4. **Couch chaos, cooperative brain.** One shared screen, one shared wallet, separate tools.
   Players naturally split into roles (waterer, hunter, farmer), but nobody is locked into one.
5. **Proper care makes bigger plants.** Sun, soil and *proper* watering (not too little, not too
   much) decide how big a plant grows, and bigger plants sell for more.

---

## 2. Players & Controls

| Action | Gamepad | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Join | **Start** | Enter | Right Shift |
| Pause | **Tap Start** (or Back) | Tap Enter / Esc | Tap Right Shift |
| Leave | **Hold Start** (1 s) | Hold Enter | Hold Right Shift |
| Move | Left stick / D-pad | WASD | Arrows |
| Aim (optional) | Right stick | — | — |
| Interact (pick up, plant, harvest, sell, shop) | **A** | Space | . (period) |
| Use tool | **X** (hold for streams) | J | , (comma) |
| Drop carried stack | **B** | K | / |
| Drop equipped tool (share it) | **Hold B** (hands empty) | Hold K | Hold / |
| Throw one carried item | **Y** | L | ; |
| Switch tool | **LB / RB** | Q / E | M / ' |

- Players can join or leave **at any time**, including mid-game. Your slot remembers your tools,
  so you can rejoin without losing them.
- If everyone leaves, the game pauses until someone presses Start.
- Each gnome has a color (Red, Blue, Yellow, Green) and carries a lantern at night.

---

## 3. The Core Loop

```
 DAY  ──────────────────────────────────────────────────────────►  DUSK
 collect dew · pull weeds · sell · shop · plant · water · harvest   shop closes
 light pests: flies, crows, mites, moles                            prep defenses
                                                                       │
 DAWN ◄────────────────────────────────────────────────────────── NIGHT (the round)
 night creatures flee · day +1 · new weather · new hot item         slugs, moths, deer,
 dew spawns · weeds sprout · pick up coins dropped by pests          raccoons, bosses
```

- **One full day is about 4 minutes**: 150 s of day and 80 s of night.
- **Every night you survive is one round cleared.** Nights get harder as the days go on.
- **You lose** when the **Heart Bloom** is eaten down to 0 HP. It has 400 HP and heals during the
  day while it's watered. Small pests only do half damage to it; deer, raccoons and the Moon Stag
  are the real threat. Flies only go for it once no other plants are left.
- **You win** when you reach the dawn of **Day 100**. After that you can keep going in endless mode.

### How a game starts (the zero-money opening)

You start with **$0, bare hands, and an overgrown garden**:

- **Weeds** are everywhere. Hold Interact to pull one. Weeds sell for $1 at the shop counter, or
  can be fed to a Compost Bin later.
- **Old junk** (boots, cans) is lying around and sells for $3.
- A few **lost coins** sparkle in the grass.
- **Dew drops** appear every morning. Carry them to a plant (or the Heart Bloom) to water it.
  This is how you water before you own a can. Dew evaporates by midday, so collect it early.
- There are **four old garden plots** near the Heart Bloom that are already dug, so you can plant
  before you own a shovel.

Your first minute goes: pull weeds → sell → buy Daisy seeds ($3) → plant → water with dew →
harvest → sell for profit → buy a **Shovel** (you each need one) → expand.

---

## 4. Growing

Each plant has three needs plus a health bar:

| Need | Source | Effect |
|---|---|---|
| **Water** | Dew, Watering Can, Hose, Sprinkler, rain | **Sweet spot 30–90 %.** Too dry: growth stops and the plant wilts. Too wet (soggy): growth slows and slugs come. |
| **Sunlight** | The sun (strongest at noon), Sun Lamps, Sun Jars | Growth speed. Sun-lovers (Sunflower) need much more of it. |
| **Soil** | Tilled plots start as Dirt. Upgrade with Soil Bags or compost | Dirt ×0.6 → Loam ×1.0 → Rich ×1.4 → Magic ×1.9 growth. Every harvest uses up one soil level. |

**Growth stages:** Seed → Sprout → Growing → Bud → **Bloom** (ready to harvest).
A bloomed plant you keep caring for **keeps getting bigger** (size ×1.0 up to its max), and
sale value scales with size. The game tracks the **biggest plant ever grown**. Giant Pumpkins can
reach ×4.5.

### Plants (seeds unlock as the days go on)

| Plant | Seed | Grow | Base value | Special |
|---|---|---|---|---|
| 🌼 Daisy | $3 | fast | $9 | Hardy starter crop |
| 🏵️ Marigold | $6 | fast | $13 | **Aura:** repels flies and kills mites nearby |
| 🍅 Tomato | $10 | medium | $7 | **Fruits again** after harvest; tomatoes can be **thrown** at pests |
| 🌻 Sunflower | $14 | slow | $30 | Sun-hungry; harvest also drops a free **Sun Jar** |
| 🪴 Flytrap | $18 | medium | $12 | **Eats** flies and moths that come close (a living turret) |
| 🌹 Rose | $24 | slow | $45 | **Thorns** hurt anything that chews on it |
| 🎃 Giant Pumpkin | $40 | very slow | $80 | Thirsty; grows **enormous** (×4.5) |

**Market:** each morning one crop is the **Hot Item** and sells for ×2.

---

## 5. Tools & Weapons (bought per player; separate Tools and Weapons tabs in the shop)

| Tool | Cost | Uses |
|---|---|---|
| ✋ Hands | free | Pull weeds, carry, harvest, weak punch |
| ⛏️ Shovel | $10 | **Till** grass into plots · **dig out** weeds instantly · **bonk** pests · the only tool that hits **moles underground** |
| 🚿 Watering Can | $14 | Fill at the pond or a Rain Barrel · hold to water · splash flies |
| 🏓 Fly Swatter *(weapon)* | $8 | One-hit flies and moths · scatters crows · knocks mites off plants |
| 🪃 Slingshot *(weapon)* | $20 | Quick pebble shots (3 dmg); great for flies and crows at range |
| 🧴 Soap Sprayer | $16 | **Kills mites** · burns slugs · refills with water |
| 🥔 Spud Gun *(weapon)* | $45 | Long-range potatoes: the **deer stopper** |
| 🔫 Machine Gun *(weapon, Day 5)* | $200 | Hold to spray seed-bullets. **Overheats** after about 3 s, so fire in bursts. The heat meter is in your panel |
| 🌊 Garden Hose | $60 | Endless water from the spigot (tethered, limited reach) · **blasts pests back** · with Soap Mixer it also kills mites and slugs · careful, it can **overwater** |

## 6. Garden Gadgets (shared, placed on the grid)

| Gadget | Cost | What it does | Catch / combo |
|---|---|---|---|
| 🧱 Fence | $5 | Blocks deer, raccoons (and you) | Slugs slip under; deer chew through |
| 👒 Scarecrow | $25 | Crows won't land within 8 m | — |
| 💡 Sun Lamp | $30 | Sunlight at night, so plants **grow at night** · **deer avoid light** | **Attracts moths**, which attack it |
| ⛲ Sprinkler | $35 | Waters everything nearby every few seconds | Wet soil **lures slugs**; can make plants soggy |
| 🍺 Beer Trap | $8 | Lures and drowns slugs (4 uses) | Put it near your sprinklers |
| 🛢️ Rain Barrel | $18 | A refill station closer than the pond | — |
| ♻️ Compost Bin | $20 | 4 weeds become 1 free Soil Bag | Turns weeding into soil upgrades |
| ⚡ Bug Zapper | $50 | Zaps flies and moths | Pairs with lamps to farm moth bounties |
| 🐞 Ladybug House | $40 | Ladybugs eat mites nearby | — |
| 🐝 Beehive | $60 | Nearby plants get +25 % size and value; bees sting flies | — |

## 7. Supplies

- 🟫 **Soil Bag ($7):** upgrade one plot's soil a level.
- 🧪 **Fertilizer ($10):** instant growth spurt.
- ☀️ **Sun Jar ($15):** use it on a plant for a big growth burst, or **throw it** to make a flash
  that **stuns every pest nearby and scares deer**. In daylight, a thrown jar boosts every plant it
  splashes.

## 8. The Bag (inventory) & Selling

- You carry **one stack of one item type**. Its size is limited by your bag's **capacity in weight**:
  most items weigh 1, **Soil Bags and gadget kits weigh 2**, and **Giant Pumpkins weigh 3**.
- Every player panel shows a **load meter** (`12/16`, turning orange then a flashing red **FULL**).
- **Heavy loads slow you down**, up to −30 % speed when the bag is full. That's the trade-off
  between one big haul to the counter and several quick trips.
- **Anything you can pick up sells at the counter.** Weeds and dew sell for $1, junk for $3, and
  produce for its size-based value (×2 if it's the Hot Item). Seeds, kits and supplies sell back
  for **half price**, so you can undo a bad purchase or cash out spare gear.
- Bag upgrade path (shared): 👖 **Big Pockets** 10 → 🎒 **Backpack** 16 (needs Pockets, Day 3) →
  🛒 **Wheelbarrow** 25 (needs Backpack, Day 6). 💪 **Strong Back** removes the slowdown.

## 9. Upgrades (shared, one-time)

👖🎒🛒 Bag upgrades (see above) · 💪 Strong Back · 👟 Running Shoes (+25 % speed) · 🏆 Golden Can (double capacity and
faster pour) · 🗡️ Sharp Shovels (×2 damage, faster tilling) · 🧼 Soap Mixer (soapy hose) ·
🏮 Bright Lanterns (your lanterns scare deer) · ❤️ Heart Mulch (+150 Heart HP, faster healing) ·
🔥 Hot Potatoes (spud gun pierces and hits harder)

---

## 10. Enemies

Each enemy has a counter, a "weird trick", and drops coins when defeated.

### Day pests (from Day 2)
| Pest | Behavior | Counters |
|---|---|---|
| 🪰 **Fly** | Swarms a plant and nibbles | Swatter, Flytrap, Zapper, Marigold, hose |
| 🐦‍⬛ **Crow** | Lands on blooming plants and **steals size** | Walk near to scare it off, Scarecrow, Swatter, Spud Gun |
| 🔴 **Mites** | Infest a plant, **multiply and spread** to neighbors | Soap Sprayer, Soapy Hose, Ladybugs, Marigold, Swatter (slowly) |
| 🐀 **Mole** | Tunnels underground, pops up under plants | Whack it with a **Shovel**: whack-a-mole! |

### Night creatures
| Creature | Behavior | Counters |
|---|---|---|
| 🐌 **Slug** | Slow, tough, **attracted to wet soil** | Shovel, Soap, Beer Trap |
| 🦋 **Moth** | Drawn to **lamps** and attacks them | Swatter, Zapper, Flytrap |
| 🦌 **Deer** | Big, hungry, eats fast. **Afraid of light**, blocked by fences (but chews through) | Spud Gun, Fence, Sun Lamp, Sun Jar flash, Bright Lanterns |
| 🦝 **Raccoon** | Ignores plants and goes for your **coin jar** at the shop! Hit it and it drops what it stole | Anything; fence off the counter |
| 🌙 **Moon Stag** (boss, every 10th night) | Huge, heads straight for the Heart Bloom, smashes fences, charges and bowls over gnomes, calls deer | Everything you've got |

**Difficulty curve:** night waves are budget-based (budget grows with day number and player
count). Enemy health grows about 7 % per day. New enemy types arrive on a schedule: Night 1 slugs,
N2 moths, N3 deer, N4 raccoons, N10/20/30… Moon Stag.

---

## 11. Weather & Daily Variety

- **Clear:** normal.
- **Rain:** waters everything slowly, half sunlight, no dew.
- **Heatwave:** water evaporates twice as fast, full sun.
- **Hot Item:** one crop sells for ×2 that day.

---

## 12. End-of-Run Stats

When the Heart Bloom falls (or you reach Day 100), you get a results screen:

- Days survived, nights cleared, money earned and spent
- Plants harvested (by type), plants lost, **biggest plant grown**
- Pests defeated by type, mites cleared, weeds pulled
- Per-player stats, a **shopping receipt** (every item they bought, how many, and what they spent; also on the pause screen) and a **title** for each gnome, for example *The Exterminator*,
  *Green Thumb*, *Water Bearer*, *Weed Whacker*, *Big Spender* or *Merchant*.

---

## 13. Future ideas (parked)

- **Tiny Mode:** you're ant-sized; crumbs and dew drops are huge.
- County Fair every 7 days: judges score your biggest plant for a jackpot.
- Seed breeding and cross-pollination (Beehive + two flowers = hybrid seed).
- Greenhouse building, seasons, more bosses (Gopher King, Locust Swarm).
- Online leaderboards for days survived.
