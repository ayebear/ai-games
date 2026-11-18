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
  day while it's watered. If its water runs out completely it **loses 2 HP a second** until you
  water it. Small pests only do half damage to it; deer, raccoons and the Moon Stag
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
harvest → sell for profit → buy a **Shovel** (you each need one) → expand. The first four steps
are a **Getting started checklist** at the bottom center of the screen. Each item ticks off as
soon as it's done (in any order), the next unchecked one is highlighted, and the list goes away
once all four are checked. A Daisy triples your
money; by Day 3 you'll want higher-tier seeds, which pay far more per plot.

---

## 4. Growing

Each plant has three needs plus a health bar:

| Need | Source | Effect |
|---|---|---|
| **Water** | Dew, Watering Can, Hose, Sprinkler, rain | **Sweet spot 30–90 %.** Too dry: growth stops and the plant wilts. Too wet (soggy): growth slows and slugs come. |

**Water status icons** (same on plant badges, over the Heart Bloom and in the top bar):

| State | Plant | Heart Bloom | Icon |
|---|---|---|---|
| **Soggy** | over 90 %: grows at about half speed | can't be overwatered | 🌊 purple |
| **Healthy** | 30–90 % | 15 % and up | none |
| **Low** | 10–30 %: grows at half speed | under 15 %: stops healing | 💧 orange |
| **No water** | under 10 %: stops growing, dies in 90 s from full HP | empty: loses 2 HP/s | 💧 crossed out, red, bobbing |
| **Sunlight** | The sun (strongest at noon), Sun Lamps, Sun Jars | Growth speed. Sun-lovers (Sunflower) need much more of it. |
| **Soil** | Tilled plots start as Dirt. Improve them with Soil Bags or compost | Dirt ×0.6 → Loam ×1.0 → Rich ×1.4 → Magic ×1.9 growth. Every harvest uses up one soil level. |

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

There are no shop menus. The north strip of the garden is a **market shaped like one big
flower**. The 💰 Quick Sell kiosk is its center, and each of the five shops is a **petal** fanning
out from it. Every item **hovers just above the floor** over a soft spot of its shop's color, spinning
slowly, with a **price tag** above it showing its icon and price (`🍓 $6`). Nothing blocks: gnomes
walk freely between the items, and **the item you stand at (or face) is the one you're
browsing**; it gets a ring-and-**$** target marker. A card then shows what it does, what A and X do,
and a few quick facts (for seeds: what it sells for, whether it regrows, how fast it grows).

**Starter items sit at the base of each petal, next to the kiosk, and later, better ones toward
its tip** (sorted by the day they arrive, then by price). The layout is computed from the item
list in `config.js`, so it can't drift. There are **no upgrades**: progress comes from buying
better items.

```
                gear      care
              g g g      c c        p                     ← north (fence)
          g g g g      c        p p                         petals fan out from the kiosk;
      seeds   g g g            p p     gadgets              2 items across, base → tip
    s s s s     g             p      g g g
      s s s s  s     [K]        g g g g g
                   Quick Sell
```

| Petal | Shop | Sells (base → tip) |
|---|---|---|
| West | 🌱 **Seeds** | Daisy, Strawberry, Carrot, Marigold, Sunflower, Tomato, Flytrap, Corn, Rose, Watermelon, Giant Pumpkin |
| North-west | 🧰 **Garden Gear** | Shovel, Watering Can, Satchel, Backpack, Steel Shovel, Golden Can, Garden Hose, Soap Hose, Wheelbarrow |
| North | 🧪 **Plant Care** | Soil Bag, Fertilizer, Sun Jar, Heart Mulch |
| North-east | 🎯 **Pest Control** | Fly Swatter, Soap Sprayer, Slingshot, Spud Gun, Hot Spud Gun, Seed Blaster |
| East | ⛲ **Gadgets** | Fence, Beer Trap, Rain Barrel, Compost Bin, Scarecrow, Sun Lamp, Sprinkler, Ladybug House, Bug Zapper, Beehive, Sell Stand |

Each petal has a colored, petal-shaped patch on the floor and one **floating sign** with the shop's
name near its tip.

- **A buys** one. **X sells that item back** right there: a seed stall also buys that plant's
  produce, gadget and plant-care stalls buy back their goods (half price), tool and bag stalls buy
  back yours.
- **Better versions trade in.** A better tool (Steel Shovel, Golden Can, Soap Hose, Hot Spud Gun)
  or a bigger bag replaces the one you have, and you get **half its price back**. The card shows
  the trade-in. You can't buy a worse version of something you already have.
- **Price tags:** icon and price. Yellow price = you can afford it, orange = not yet.
  **🔥 ×2** = today's Hot Item.
- **Everything is on display from Day 1.** Items that haven't arrived yet are shown **faded out
  (20 % opacity)** with their tag, and can't be bought: the card says which day they arrive.
- **★ NEW:** anything that unlocked after Day 1 gets a **★ NEW** badge on its price tag, and the
  shop's sign counts them (`★2`), until a gnome walks up and looks at it.
- **💰 Quick Sell kiosk** in the middle of the market buys *anything*, so you never have to go
  inside just to dump weeds and junk. It also holds the coin jar raccoons are after.
- **Sell Stand** gadget: your own quick-sell spot anywhere in the garden.
- **At dusk the market closes**: shop signs say CLOSED, the price tags dim, and nothing is sold until dawn (the Quick
  Sell kiosk stays open).

### Visual language

- **Target markers** (on the ground, in your color) show what A / X will act on: a **square** for
  a whole cell (tilling, planting, soil, placing a gadget, a fence), a **ring** for round things
  (plants, weeds, gadgets, pickups, sized to the thing), and for a shop item a **ring around the
  item's base with a $ badge**, colored by what you can do there: **green = A buys it**, **gold
  (+$) = X sells yours back**, **grey = neither right now** (closed, can't afford, not arrived).
  The Buy / Sell lines on the item's card use the same green and gold.

- **Icons** for tools, gadgets and supplies are rendered from the item's own 3D model with a white
  sticker outline, so the icon on the board, the card, your HUD and the item in the world all
  match. Plants use their emoji.
- **Anything you can pick up** (dew, junk, coins, seeds, produce, supplies, gadget kits) sits on a
  soft **white ring** (gold for coins). No ring = scenery.
- **Weeds** are dandelions: dark jagged leaves with a bright yellow puff. Grass is short, sparse and
  the same color as the ground.
- A carried **gadget kit** shows a mini version of the gadget; a **seed packet** shows its plant.

## 4c. Collision (hitboxes)

Gnomes bump into things by their **real shape**, not by the 2 m grid cell they sit on:

| Thing | Hitbox |
|---|---|
| 🌸 Heart Bloom | round, **0.9 m** radius (its stem and leaves), growing with the Heart. Its 2.3 m "reach" is only for watering and pests biting it |
| Pond | round, the water's edge |
| Spigot | round, 0.35 m |
| Fence | a thin wall, 2 m × 0.36 m |
| Rain Barrel / Sun Lamp / Scarecrow / Ladybug House / Bug Zapper | round, 0.3–0.6 m (the pole or barrel) |
| Compost Bin / Beehive / Sell Stand | boxes the size of the model |
| Market items | none: walk between them |
| Quick Sell kiosk, forest | grid cells |

Round things push a gnome out sideways instead of stopping it, so you **slide around** the Heart,
the pond and poles instead of snagging. Pests still treat a blocking gadget as filling its whole
cell (that's what makes fences work against deer).

## 4d. Camera

The shared camera frames every gnome **and anything that needs a gnome's attention**, zooming out
as far as needed:

- anything you own that is **under attack** (plants, the Heart Bloom, gadgets, the coin jar): ⚔️/⚠️ marker
- plants that are **being hurt by neglect**: no water, mites (🐛), or nearly dead (💔)
- the **Heart Bloom** when its water is low or empty

Low or soggy plants show their icon but don't pull the camera: they only grow slower, and with a
big garden there's almost always one, which would keep the camera zoomed all the way out.

---

## 5. Tools (bought per player)

Each gnome holds **one tool of each kind**. A better version works like its base tool but
stronger, and buying it trades in the base tool for half price. Dropped tools can be shared:
picking up a tool you already have a version of swaps them.

**Garden Gear** shop (tools):

| Tool | Day | Cost | Uses |
|---|---|---|---|
| ✋ Hands | — | free | Pull weeds, carry, harvest, weak punch |
| Shovel | 1 | $10 | **Till** grass into plots · **dig out** weeds · **bonk** pests · the only tool that hits **moles underground** |
| Watering Can | 1 | $12 | Fill at the pond or a Rain Barrel · hold to water · splash flies |
| Steel Shovel | 4 | $45 | A Shovel that hits ×2 harder and swings faster |
| Golden Can | 4 | $50 | A Watering Can that holds double and pours faster |
| Garden Hose | 4 | $90 | Endless water from the spigot (tethered, limited reach) · **blasts pests back** · careful, it can **overwater** |
| Soap Hose | 6 | $160 | A Garden Hose whose spray also kills mites and burns slugs |

**Pest Control** shop:

| Tool | Day | Cost | Uses |
|---|---|---|---|
| Fly Swatter | 1 | $6 | One-hit flies and moths · scatters crows · knocks mites off plants |
| Soap Sprayer | 2 | $25 | **Kills mites** · burns slugs · refills with water |
| Slingshot | 3 | $30 | Quick pebble shots; great for flies and crows at range |
| Spud Gun | 3 | $60 | Long-range potatoes: the **deer stopper** |
| Hot Spud Gun | 5 | $150 | A Spud Gun with flaming spuds that hit harder and **pierce** |
| Seed Blaster | 6 | $350 | Hold to spray seeds. **Overheats** after about 3 s, so fire in bursts. The heat meter is in your panel |

## 6. Gadgets (shared, placed on the grid)

| Gadget | Day | Cost | What it does | Catch / combo |
|---|---|---|---|---|
| Fence | 1 | $4 | Blocks deer, raccoons (and you) | Slugs slip under; deer chew through |
| 🍺 Beer Trap | 1 | $6 | Lures and drowns slugs (4 uses) | Put it near your sprinklers |
| Rain Barrel | 2 | $20 | A refill station closer than the pond | — |
| Compost Bin | 2 | $25 | 4 weeds become 1 free Soil Bag | Turns weeding into better soil |
| Scarecrow | 3 | $30 | Crows won't land within 8 m | — |
| Sun Lamp | 3 | $40 | Sunlight at night, so plants **grow at night** · **deer avoid light** | **Attracts moths**, which attack it |
| Sprinkler | 4 | $50 | Waters everything nearby every few seconds | Wet soil **lures slugs**; can make plants soggy |
| 🐞 Ladybug House | 4 | $60 | Ladybugs eat mites nearby | — |
| Bug Zapper | 5 | $90 | Zaps flies and moths | Pairs with lamps to farm moth bounties |
| 🐝 Beehive | 6 | $150 | Nearby plants get +25 % size and value; bees sting flies | — |
| Sell Stand | 7 | $250 | A quick-sell spot in your garden | Pricey, but saves trips |

## 7. Plant Care (consumables)

- **Soil Bag** (Day 1, $6): raise one plot's soil a level.
- **Fertilizer** (Day 2, $10): instant growth spurt.
- **Sun Jar** (Day 3, $20): use it on a plant for a big growth burst, or **throw it** to make a flash
  that **stuns every pest nearby and scares deer**. In daylight, a thrown jar boosts every plant it
  splashes.
- **Heart Mulch** (Day 5, $40): carry it to the Heart Bloom to heal it 150 HP.

## 8. The Bag (inventory) & Selling

- You carry **one stack of one item type**. Its size is limited by your bag's **capacity in weight**:
  most items weigh 1, **Soil Bags and gadget kits weigh 2**, and **Giant Pumpkins and Watermelons weigh 3**.
- Every player panel shows a **load meter** (`12/16`, turning orange then a flashing red **FULL**).
- **Heavy loads slow you down**, up to −30 % speed when the bag is full. That's the trade-off
  between one big haul to the counter and several quick trips.
- **Anything you can pick up sells at the counter.** Weeds and dew sell for $1, junk for $3, and
  produce for its size-based value (×2 if it's the Hot Item). Seeds, kits and supplies sell back
  for **half price**, so you can undo a bad purchase or cash out spare gear.
- Bags (Garden Gear shop, **per gnome**, worn, a bigger bag trades in the old one): pockets hold 5 ·
  👜 **Satchel** 10 ($15, Day 1) · 🎒 **Backpack** 16 ($40, Day 3) · 🛒 **Wheelbarrow** 25 ($200,
  Day 7), and a full wheelbarrow **never slows you down**.

## 9. Progression

There are no upgrades. You get stronger by buying **better items**, which unlock over the first
nine days and always sit to the right of what they improve on.

### Unlock schedule

New things arrive just before the threats they answer (flies on Day 2, crows and mites on Day 3,
moles on Day 4; slugs on Night 1, moths on Night 2, deer on Night 3, raccoons on Night 4):

| Day | New at the market |
|---|---|
| 1 | Daisy, Strawberry, Shovel, Watering Can, Satchel, Fly Swatter, Fence, Beer Trap, Soil Bag |
| 2 | Carrot, Marigold, Soap Sprayer, Fertilizer, Rain Barrel, Compost Bin |
| 3 | Tomato, Sunflower, Slingshot, Spud Gun, Sun Jar, Scarecrow, Sun Lamp, Backpack |
| 4 | Flytrap, Garden Hose, Steel Shovel, Golden Can, Sprinkler, Ladybug House |
| 5 | Corn, Hot Spud Gun, Bug Zapper, Heart Mulch |
| 6 | Rose, Soap Hose, Seed Blaster, Beehive |
| 7 | Watermelon, Wheelbarrow, Sell Stand |
| 9 | Giant Pumpkin |

---

## 10. Enemies

Each enemy has a counter, a "weird trick", and drops coins when defeated.

### Day pests (from Day 2)
| Pest | Behavior | Counters |
|---|---|---|
| 🪰 **Fly** | Swarms a plant and nibbles | Swatter, Flytrap, Zapper, Marigold, hose |
| 🐦‍⬛ **Crow** | Lands on blooming plants and **steals size** | Walk near to scare it off, Scarecrow, Swatter, Spud Gun |
| 🔴 **Mites** | Infest a plant, **multiply and spread** to neighbors | Soap Sprayer, Soap Hose, Ladybugs, Marigold, Swatter (slowly) |
| 🐀 **Mole** | Tunnels underground, pops up under plants | Whack it with a **Shovel**: whack-a-mole! |

### Night creatures
| Creature | Behavior | Counters |
|---|---|---|
| 🐌 **Slug** | Slow, tough, **attracted to wet soil** | Shovel, Soap, Beer Trap |
| 🦋 **Moth** | Drawn to **lamps** and attacks them | Swatter, Zapper, Flytrap |
| 🦌 **Deer** | Big, hungry, eats fast. **Afraid of light**, blocked by fences (but chews through) | Spud Gun, Fence, Sun Lamp, Sun Jar flash |
| 🦝 **Raccoon** | Ignores plants and goes for your **coin jar** at the Quick Sell counter! Hit it and it drops what it stole | Anything; fence off the counter |
| 🌙 **Moon Stag** (boss, every 10th night) | Huge, heads straight for the Heart Bloom, smashes fences, charges and bowls over gnomes, calls deer | Everything you've got |

**Difficulty curve:** night waves are budget-based (budget grows with day number and player
count). Enemy health grows about 7 % per day. New enemy types arrive on a schedule: Night 1 slugs,
N2 moths, N3 deer, N4 raccoons, N10/20/30… Moon Stag.

---

## 11. Weather & Daily Variety

One weather per day, picked at dawn (Days 1–2 are always clear). It **fades in over about 12 s**,
and every effect (sky, light, particles and gameplay) is blended by how far it has faded in, so
nothing switches abruptly.

| Weather | How often | Effect | Look |
|---|---|---|---|
| 🌤️ Clear | 55 % | normal | — |
| 🌧️ Rain | 16 % | waters plants and soil, half sun, no dew | grey sky, rain streaks |
| 🔥 Heatwave | 11 % | water dries up about twice as fast | warm sky |
| 🌫️ Fog | 10 % | soft sun (×0.7), **double dew** | pale sky, fog closes in around the view |
| ❄️ Snow | 8 % | cold: growth ×0.6 but water barely dries up (×0.3), less sun, no dew | white sky, drifting snowflakes |

- **Hot Item:** one crop sells for ×2 that day.

### Day/night wheel & sky

- The top bar has a **day/night wheel**: the top half of a dial with a day arc (☀️) and a night
  arc (🌙), sized to their real lengths, turning under a fixed pointer. Today's weather icon sits
  in the hub at the bottom.
- The top bar is built once with **fixed-width fields** (numbers use tabular digits), so nothing in
  it moves or resizes as values change.
- The sky, sun, moon, ambient light and stars are **continuous** through dawn and dusk. The sun and
  moon each fade out at the horizon, so the switch between them (and the shadow direction) is never
  visible. Shadows are snapped to shadow-map texels so they don't shimmer when the camera moves.

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
