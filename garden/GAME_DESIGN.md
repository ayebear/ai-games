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
| Interact (pick up, plant, harvest, quick sell, **buy at a stall**) | **A** | Space | . (period) |
| Use tool · **sell back at a stall** | **X** (hold for streams) | J | , (comma) |
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
 collect dew · pull weeds · sell · browse market · plant · water · harvest   market closes
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

- **Weeds** (yellow dandelions) are everywhere. Hold Interact to pull one. Weeds sell for $1 at the Quick Sell kiosk, or
  can be fed to a Compost Bin later.
- **Old junk** (boots, cans) is lying around and sells for $3.
- A few **lost coins** sparkle in the grass.
- **Dew drops** appear every morning. Carry them to a plant (or the Heart Bloom) to water it.
  This is how you water before you own a can. Dew evaporates by midday, so collect it early.
- There are **four old garden plots** near the Heart Bloom that are already dug, so you can plant
  before you own a shovel.

Your first minute goes: pull weeds → sell → buy Daisy seeds ($3) → plant → water with dew →
harvest → sell for profit → buy a **Shovel** (you each need one) → expand. A Daisy triples your
money; by Day 3 you'll want higher-tier seeds, which pay far more per plot.

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

Plants come in five **tiers** of difficulty (how slow, thirsty, sun-hungry or fragile they are).
**Crops** are grown for money; **helpers** also do a job in the garden.

| Plant | Day | Tier | Seed | Sells | Special |
|---|---|---|---|---|---|
| 🌼 Daisy | 1 | 1 | $3 | $9 | Cheap and quick. The starter crop |
| 🍓 Strawberry | 1 | 1 | $6 | $8 / harvest | **Regrows** after every harvest |
| 🥕 Carrot | 2 | 2 | $8 | $32 | Sturdy, reliable money |
| 🏵️ Marigold *(helper)* | 2 | 2 | $10 | $32 | **Aura:** repels flies and kills mites nearby |
| 🍅 Tomato | 3 | 3 | $20 | $63 / harvest | **Regrows**; tomatoes can be **thrown** at pests |
| 🌻 Sunflower *(helper)* | 3 | 3 | $18 | $79 | Sun-hungry; harvest also drops a free **Sun Jar** |
| 🪴 Flytrap *(helper)* | 4 | 3 | $25 | $110 | **Eats** flies and moths that come close |
| 🌽 Corn | 5 | 4 | $35 | $259 | Tall and sun-hungry |
| 🌹 Rose *(helper)* | 6 | 4 | $45 | $266 | **Thorns** hurt anything that chews on it |
| 🍉 Watermelon | 7 | 5 | $60 | $600 | Thirsty; swells up to ×2.6 |
| 🎃 Giant Pumpkin | 9 | 5 | $90 | $900 | Slow, thirsty; grows **enormous** (×3.5) |

### The economy

The sell price is computed, not hand-picked (`plantValue` in `config.js`):

- **Sale value = seed cost × tier multiplier.** The multiplier grows exponentially with
  difficulty: **T1 ×3 · T2 ×4.05 · T3 ×5.5 · T4 ×7.4 · T5 ×10.** Since harder seeds also cost
  more, profit climbs steeply: easy plants are safe but small, hard plants are where money is.
- **Helpers** earn ×0.8 of that, because they also protect the garden.
- **Regrowing plants** (Strawberry, Tomato) go back to the Growing stage after a harvest and pay
  70% of a single crop's profit each time. That works out to about the same money per day as
  replanting, minus the trips to the market.
- On top of that: **size** (care after blooming keeps growing it, ×1 up to the plant's max),
  **soil** (+12% per level), **Beehive** (+25%) and the **Hot Item** (×2 that day).

Profit per plot per day on Dirt with good watering (run `npm run balance` for the full table):
Daisy ~$12 · Strawberry ~$19 · Carrot ~$31 · Tomato/Flytrap ~$100 · Corn ~$210 · Watermelon ~$290 ·
Pumpkin ~$330 (a ×3.5 Giant Pumpkin sells for $3,150).

---

## 4b. The Market (walk-in store)

There are no shop menus. The north strip of the garden is a **market** of eight shops. Each shop
is a row of stalls under one **menu board**: a colored header with the shop's name, and one panel
per item showing its icon, price and name. Every item has its own stall with the real item on the
table. Walk up to a stall and a card shows what it does, what A and X do, and a few quick facts
(for seeds: what it sells for, whether it regrows, how fast it grows).

The market has three rows, all facing the garden, each reached from its south side:

| Row | Shop | Sells |
|---|---|---|
| Back · *Grow* | 🌱 **Crop Seeds** | Daisy, Strawberry, Carrot, Tomato, Corn, Watermelon, Giant Pumpkin |
| | 🏵️ **Helper Seeds** | Marigold, Sunflower, Flytrap, Rose |
| | 🧪 **Plant Care** | Soil Bag, Fertilizer, Sun Jar, Heart Mulch |
| | ⛲ **Farm Gadgets** | Rain Barrel, Compost Bin, Sprinkler, Sun Lamp, Beehive, Sell Stand |
| Middle · *Gear* | 🧰 **Garden Tools** | Shovel, Watering Can, Garden Hose + their upgrades (Sharp Shovels, Golden Can, Soap Mixer) |
| | 🎒 **Outfitter** | Bag (Big Pockets → Backpack → Wheelbarrow), Running Shoes, Strong Back, Bright Lanterns |
| Front · *Defend* | 🎯 **Pest Control** | Fly Swatter, Soap Sprayer, Slingshot, Spud Gun, Seed Blaster + Hot Potatoes |
| | 🛡️ **Defenses** | Fence, Beer Trap, Scarecrow, Ladybug House, Bug Zapper |

- **A buys** one. **X sells that item back** right there: a seed stall also buys that plant's
  produce, gadget and plant-care stalls buy back their goods (half price), tool stalls buy back
  your tool.
- **Price panels:** yellow price = you can afford it, orange = not yet. **Day N** = arrives on that
  day (the table stays empty until then). **✔** = upgrade owned. **🔥 ×2** = today's Hot Item.
- **★ NEW:** anything that unlocked after Day 1 gets a floating **★ NEW** tag over its stall, and
  the shop header counts them (`★ 2 NEW`), until a gnome walks up and looks at it.
- **Upgrade paths** share one stall: the Bag stall sells Big Pockets, then Backpack, then
  Wheelbarrow.
- A board **fades out** while a gnome stands in the aisle behind it, so you never lose sight of
  your gnome.
- **💰 Quick Sell kiosk** in the middle of the market buys *anything*, so you never have to go
  inside just to dump weeds and junk. It also holds the coin jar raccoons are after.
- **Sell Stand** gadget: your own quick-sell spot anywhere in the garden.
- **At dusk the market closes**: shop headers say CLOSED and nothing is sold until dawn (the Quick
  Sell kiosk stays open).

### Visual language

- **Icons** for tools, gadgets and supplies are rendered from the item's own 3D model with a white
  sticker outline, so the icon on the board, the card, your HUD and the item in the world all
  match. Plants use their emoji.
- **Anything you can pick up** (dew, junk, coins, seeds, produce, supplies, gadget kits) sits on a
  soft **white ring** (gold for coins). No ring = scenery.
- **Weeds** are dandelions: dark jagged leaves with a bright yellow puff. Grass is short, sparse and
  the same color as the ground.
- A carried **gadget kit** shows a mini version of the gadget; a **seed packet** shows its plant.

## 4c. Camera

The shared camera frames every gnome **and anything you own that is under attack** (plants, the Heart
Bloom, gadgets, the coin jar), zooming out as far as needed. Attacked things get a ⚔️/⚠️ marker.

---

## 5. Tools (bought per player)

**Garden Tools** shop:

| Tool | Day | Cost | Uses |
|---|---|---|---|
| ✋ Hands | — | free | Pull weeds, carry, harvest, weak punch |
| Shovel | 1 | $10 | **Till** grass into plots · **dig out** weeds · **bonk** pests · the only tool that hits **moles underground** |
| Watering Can | 1 | $12 | Fill at the pond or a Rain Barrel · hold to water · splash flies |
| Garden Hose | 4 | $90 | Endless water from the spigot (tethered, limited reach) · **blasts pests back** · with Soap Mixer it also kills mites and slugs · careful, it can **overwater** |

**Pest Control** shop:

| Tool | Day | Cost | Uses |
|---|---|---|---|
| Fly Swatter | 1 | $6 | One-hit flies and moths · scatters crows · knocks mites off plants |
| Soap Sprayer | 2 | $25 | **Kills mites** · burns slugs · refills with water |
| Slingshot | 3 | $30 | Quick pebble shots; great for flies and crows at range |
| Spud Gun | 3 | $60 | Long-range potatoes: the **deer stopper** |
| Seed Blaster | 6 | $350 | Hold to spray seeds. **Overheats** after about 3 s, so fire in bursts. The heat meter is in your panel |

## 6. Gadgets (shared, placed on the grid)

| Gadget | Shop | Day | Cost | What it does | Catch / combo |
|---|---|---|---|---|---|
| Fence | Defenses | 1 | $4 | Blocks deer, raccoons (and you) | Slugs slip under; deer chew through |
| 🍺 Beer Trap | Defenses | 1 | $6 | Lures and drowns slugs (4 uses) | Put it near your sprinklers |
| Rain Barrel | Farm | 2 | $20 | A refill station closer than the pond | — |
| Compost Bin | Farm | 2 | $25 | 4 weeds become 1 free Soil Bag | Turns weeding into soil upgrades |
| Scarecrow | Defenses | 3 | $30 | Crows won't land within 8 m | — |
| Sun Lamp | Farm | 3 | $40 | Sunlight at night, so plants **grow at night** · **deer avoid light** | **Attracts moths**, which attack it |
| Sprinkler | Farm | 4 | $50 | Waters everything nearby every few seconds | Wet soil **lures slugs**; can make plants soggy |
| 🐞 Ladybug House | Defenses | 4 | $60 | Ladybugs eat mites nearby | — |
| Bug Zapper | Defenses | 5 | $90 | Zaps flies and moths | Pairs with lamps to farm moth bounties |
| 🐝 Beehive | Farm | 6 | $150 | Nearby plants get +25 % size and value; bees sting flies | — |
| Sell Stand | Farm | 7 | $250 | A quick-sell spot in your garden | Pricey, but saves trips |

## 7. Plant Care (consumables)

- **Soil Bag** (Day 1, $6): upgrade one plot's soil a level.
- **Fertilizer** (Day 2, $10): instant growth spurt.
- **Sun Jar** (Day 3, $20): use it on a plant for a big growth burst, or **throw it** to make a flash
  that **stuns every pest nearby and scares deer**. In daylight, a thrown jar boosts every plant it
  splashes.
- **Heart Mulch** (Day 5, $150, one-time): Heart Bloom +150 max HP and faster healing.

## 8. The Bag (inventory) & Selling

- You carry **one stack of one item type**. Its size is limited by your bag's **capacity in weight**:
  most items weigh 1, **Soil Bags and gadget kits weigh 2**, and **Giant Pumpkins and Watermelons weigh 3**.
- Every player panel shows a **load meter** (`12/16`, turning orange then a flashing red **FULL**).
- **Heavy loads slow you down**, up to −30 % speed when the bag is full. That's the trade-off
  between one big haul to the counter and several quick trips.
- **Anything you can pick up sells at the counter.** Weeds and dew sell for $1, junk for $3, and
  produce for its size-based value (×2 if it's the Hot Item). Seeds, kits and supplies sell back
  for **half price**, so you can undo a bad purchase or cash out spare gear.
- Bag upgrades (one Outfitter stall, shared): 👖 **Big Pockets** 10 ($20, Day 1) → 🎒 **Backpack** 16
  ($80, Day 3) → **Wheelbarrow** 25 ($300, Day 7). 💪 **Strong Back** removes the slowdown.

## 9. Upgrades (shared, one-time)

| Upgrade | Shop | Day | Cost | Effect |
|---|---|---|---|---|
| 👖🎒 Bag path | Outfitter | 1 / 3 / 7 | $20 / $80 / $300 | Bag 5 → 10 → 16 → 25 |
| 👟 Running Shoes | Outfitter | 2 | $40 | All gnomes +25 % speed |
| 💪 Strong Back | Outfitter | 3 | $60 | No slowdown from a heavy bag |
| 🏮 Bright Lanterns | Outfitter | 5 | $120 | Wider lantern light; lanterns scare deer |
| Sharp Shovels | Garden Tools | 4 | $60 | ×2 shovel damage, faster swing |
| Golden Can | Garden Tools | 4 | $70 | Cans hold double and pour faster |
| 🧼 Soap Mixer | Garden Tools | 6 | $120 | Hose spray kills mites and burns slugs |
| Hot Potatoes | Pest Control | 8 | $250 | Spud Gun hits harder and pierces |
| 🌸 Heart Mulch | Plant Care | 5 | $150 | Heart Bloom +150 max HP, faster healing |

### Unlock schedule

New things arrive just before the threats they answer (flies on Day 2, crows and mites on Day 3,
moles on Day 4; slugs on Night 1, moths on Night 2, deer on Night 3, raccoons on Night 4):

| Day | New at the market |
|---|---|
| 1 | Daisy, Strawberry, Shovel, Watering Can, Fly Swatter, Fence, Beer Trap, Soil Bag, Big Pockets |
| 2 | Carrot, Marigold, Soap Sprayer, Fertilizer, Rain Barrel, Compost Bin, Running Shoes |
| 3 | Tomato, Sunflower, Slingshot, Spud Gun, Sun Jar, Scarecrow, Sun Lamp, Backpack, Strong Back |
| 4 | Flytrap, Garden Hose, Sprinkler, Ladybug House, Sharp Shovels, Golden Can |
| 5 | Corn, Bug Zapper, Bright Lanterns, Heart Mulch |
| 6 | Rose, Seed Blaster, Beehive, Soap Mixer |
| 7 | Watermelon, Sell Stand, Wheelbarrow |
| 8 | Hot Potatoes |
| 9 | Giant Pumpkin |

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
| 🦝 **Raccoon** | Ignores plants and goes for your **coin jar** at the Quick Sell counter! Hit it and it drops what it stole | Anything; fence off the counter |
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
