---
title: DDS Website — System Grid Spec & Decisions
type: spec
status: in-development
created: 2026-06-28
updated: 2026-07-03
tags: [dds-website, design-system, grid, spec]
---


# DDS Website — System Grid

> Living spec + decision log for the dorandesign.studio homepage rebuild.
> Working prototype: `grid-system.html` (local, not yet deployed).

> **How this file is used.** This is the single source of truth for the site's design system. The website's Journal entry *The System, Documented* renders the chapters below live (each `## Chapter` becomes a scroll-stop with the illustration named in its `<!--illus:…-->` marker). Sections marked `<!--skip-->` stay here for the record and are not published to the site.

## What this is
<!--illus:graph-->

> **The business is not the design system.** **Doran Design Studio** is a specialist design studio creating **product-communication content for manufacturers** — that is the website's purpose and what its *content* must be about (services, work, the manufacturers we help, how we make product content). The **grid/dot/drag system documented here is just how the site is *built*** — its mechanics and aesthetic, not its subject.
>
> This spec is the **rules of that mechanic**, kept because it's reusable (across future projects) and worth documenting for its own sake. Treat it as the *engine* doc. **The current on-page copy — the homepage caption, the Insight/journal article "The Grid Is the System", the Icons blurbs — is placeholder that describes the engine; it will be replaced with real Doran Design Studio product-communication content.** The engine stays; the content changes.

---

## The mechanic
<!--illus:grid-->

The site is built as **a design system rendering itself**. A Swiss grid of **square modules** (1×1 cells) sits over a **dot field** — the scaffolding. Empty modules show the dots (unbuilt scaffold); content modules sit on the *same* grid, edge-to-edge, snapping to 1×1, 2×1, 1×2, 2×2… So a square illustration designed for a 1×1 lines up perfectly because the dots *are* the measure.

The **grid** and the **graph** are the two visual primitives. It reads as a system mid-assembly — products and assets dropping into their slots during the dev process. Always in development, always being populated.

---

## Colour tokens
<!--illus:tokens-->

| Role | Hex | Token |
|---|---|---|
| Background / dotted scaffold | `#e9e7e3` | `--canvas` |
| Content cell (above dots) | `#f0eeeb` | `--surface` |
| Grid dots + cell hairlines | `#e1dfdb` | `--grid-line` (kept subtle) |
| Header/footer dividers | `#d9d7d3` | `--border-canvas` — ⚠️ open: soften to `#e1dfdb`? |

### Brand colours

`blue #3366FF` · `purple #aa7add` · `magenta #e946c3` · `red #ff4c4c` · `orange #ff9500` · `yellow #ffd119` · `teal #35c4c0` · `green #00bc35`

### Text tiers → renaming to **low / medium / high**

| Priority | Hex | was |
|---|---|---|
| **high** (most important, focal) | `#2B2D33` | primary |
| **medium** | `#5b5d64` | secondary |
| **low** (quietest) | `#6b6b6d` | tertiary — darkened from `#8a8a8b` for ≥4.5:1 contrast on the canvas at 9–10px |

---

## Type & text tiers
<!--illus:type-->

**Chosen: Geist + Geist Mono** (Google Fonts). One superfamily, sans + mono, identical across platforms. Wired through `--font-sans` / `--font-mono`. Rounded dropped. (Recursive trialled and set aside; IBM Plex was the runner-up.)

**Requirement (for the record):** one family, sans **+** mono (mono in the *same family* as the sans), identical across platforms.

**Scale:** mono uppercase tracked → kickers / eyebrow tabs / labels / footer at 9–11px; sans 600 → titles and card headings; body 13–14px at line-height ~1.6–1.75. *(Mirrors entry 001's live Type panel.)*

Current live site uses **Inter** (body) + **SF Pro Display** (headings, system) + **SF Mono** (mono, system) — no rounded, and the mono is Mac-only (not cross-platform).

**Options (matched sans + mono superfamilies):**
1. **Geist + Geist Mono** ← recommended. Neutral grotesque, closest to current Inter, mono is its designed sibling. Most seamless, very current.
2. **IBM Plex Sans + IBM Plex Mono** — warmer, "engineered design-system" character, rock-solid.
3. **Recursive Sans + Mono** — same family, drop the casual/rounded axis.

Wire through one `--font` var so swapping is trivial. Recursive was trialled in the prototype; verdict undecided.

---

## The grid & sizing
<!--illus:grid-->

### Grid system — BUILT

- Page **locked to the viewport, no scroll**. Body flex column: `header (fixed) → stage → …`; the **stage** is a flex row of the **nav rail** (88px side rail on desktop, top bar on narrow) and the **grid column**, and the grid column is itself `grid (whole cells) → footer (buffer)`. *(Earlier this was described as a single body-level `header → grid → footer` column; the header→grid→footer stack is actually the* grid-col*, with the rail as a stage sibling.)*
- **Square cells, full-bleed width.** Cell size clamped to a band; the column count flexes to the screen, the cell size stays roughly constant (adds modules, doesn't enlarge them).
- **Footer is the dynamic buffer** — it flexes to absorb the leftover height so the grid only ever holds *whole* cells (no clipped bottom row).
- **7×7 dot field** per cell.
- Recomputes on resize (debounced).

### Sizing parameters

| Param | Value | Note |
|---|---|---|
| `BASE` | 144px | target module size |
| `MIN_CELL` | 120px | never smaller (keeps card content legible) |
| `MAX_CELL` | 168px | never larger (keeps it reading as a grid) |
| `MIN_FOOTER` | 36px | footer never thinner |
| dots per cell | 7×7 | matches existing DDS system |

*(These are the **effective** values, hardcoded as inline literals in `build()` — target `round(availW/144)`, min-cols `ceil(availW/168)`, max-cols `floor(availW/120)` — and in the `.site-footer` CSS (`min-height:36px`). There are no `BASE`/`MIN_CELL`/`MAX_CELL`/`MIN_FOOTER` named constants in the code; the names above are documentation labels only.)*

Result: phone ≈ 3×n @ ~129px — **no rail subtracted**: on phones the nav is a top bar, so the grid gets the full viewport width (`availW = vw`) and the column math runs on it directly (3 cols on a ~390px phone; 2 cols only on the narrowest ~≤330px phones) · laptop ≈ 10×5 @ 144px · Studio ≈ 21×11 @ 143px. *(Superseded: an earlier "3×n @ 130px", then a v2 "2×n @ 160px with a 52px side rail subtracted first" — both predate the v3 top-bar change; the side rail is gone on phone and costs no column. See* Mobile / touch model ✅ v3 *.)*

### Layout modes — BUILT

Single `LAYOUT_MODE` switch in code:
- **`set`** — hand-authored composition, centred (like the contact form). Author in `setComposition()`. ✅ now holds the real standard view.
- **`dynamic`** — auto-distributed gallery; the hero anchors top-left and cards fill in descending attention (reading gravity), the cold corner stays scaffold. Pool in `POOL`.

---

## Priority, emphasis & distribution
<!--illus:modules-->

### Priority & emphasis

- **Priority = low / medium / high.** Drives text tone *and* placement.
- **Emphasis is a VECTOR**, not just position:
  `emphasis = position (attention field) × visual weight (size + colour saturation + tone)`
  Two modules can reach the same emphasis differently — *central + subtle* or *peripheral + loud*. This is what lets navigation sit off to the side yet stay findable while content holds the centre.

### Distribution algorithm — ✅ BUILT (v1)

**Shipped (v1):** `attentionField(cols,rows)` returns a per-cell weight `0.55·(1−r/maxR) + 0.45·(1−c/maxC)` — reading gravity, 1.00 top-left → 0.00 bottom-right. **Dynamic mode** (`LAYOUT_MODE='dynamic'`) distributes by it: the hero (Lottie 2×2) takes the hottest top-left block, cards fill cells in descending attention up to ~50%, each card's **tier is set by its cell's attention** (`attTier`), and the cold corner stays scaffold.

**Notability is a 3-factor vector (v1.1)** — position alone is a weak predictor. `notabilityOf = 0.4·position + 0.32·isolation + 0.45·saliency`:
- **position** — the attention field above.
- **isolation** (`isolationOf`) — fraction of the bordering ring that's empty; **free space frames a module and boosts it**.
- **saliency** (`saliencyOf`) — visual impact: colour warmth/saturation (`SAL` map, magenta→1) + footprint size + motion (Lottie = 1).

Any axis can make a module pop — proven by an **isolation accent**: a lone **magenta card** (filled, white centred icon) in the *coldest* corner scores ~0.73 notability (2nd only to the hero's ~0.97). **Debug heatmap** now shows *notability*: faint blue position field on empty cells + magenta tint & score on each module (so it predicts what actually grabs the eye, not just position). Toggles — **debug-gated, only with `#debug` in the URL**: **`m`** = set ↔ dynamic, **`h`** = heatmap (also `window.ddsDebug.mode()/.heat()`). Without `#debug` the hotkeys are inert and the footer's `cols × rows · px` readout is hidden (visitors don't get debug telemetry).

*v2 ideas below (richer model — Z/F auto-selection, monotonic reading path, saliency, groups).*

### Distribution algorithm — DESIGN (v2 ideas)

Because the page is **one fixed viewport (no scroll)**, this is **single-screen gaze distribution** — the classic eye-tracking models apply directly.

### Models

- **Z-pattern** — sparse layouts (enter top-left → top-right → diagonal → bottom-right).
- **F-pattern** — dense layouts (top edge, then down the left, diminishing sweeps).
- **Gutenberg** — homogeneous content; reading gravity top-left → bottom-right; top-right & bottom-left are *fallow* (weak).
- **Saliency** overrides position — size, colour, contrast, motion pull first fixation.

### Proposed model: attention field + reading path

1. **Priority is the input** (low/med/high = how early it should be seen).
2. **Build an attention field** per cell = reading gradient (auto Z/F by density) + focal/centre bias + low scores in fallow corners.
3. **Place along the field in priority order** — high-priority into high-attention cells, walking a *monotonic reading path* so reading order = priority order (no backtracking).
4. **Focal anchor** (the Lottie) sits **above centre**, large + motion = guaranteed first fixation.
5. **Fallow corners stay scaffold** — intentional whitespace, on-brand.

### Groupings

Items carry a `group` + placement intent. The field places groups as **units**, then items within. Groups can animate as a unit.
✅ **Implemented in the set view:** `content` → centred cluster (Lottie, caption, tool cards, stats). `nav` (About, Contact) *was* implemented as in-grid cards floating free at the **right edge**, separated from content by scaffold — the living proof of the emphasis-vector idea (peripheral position, still legible) — but **nav has since moved to the rail** (see *Persistent site nav*), so the set view emits no nav cards today. The `group:` field remains on every module (used today mainly to tag the freefloat/float margin cards); the *place-groups-as-units* algorithm is still a v2 idea, not built.

### Decisions locked

- ✅ Base pattern = **auto** (sparse→Z, dense→F)
- ✅ Focal anchor = **above centre**
- ✅ Exploit **salience vs. order** (colour/size can break sequence for emphasis)
- ✅ **Groupings** supported
- ✅ Deterministic (seeded)

---

## Module vocabulary
<!--illus:modules-->

### Module types (component vocabulary)

Drawn from the existing site + the older `DDSWebstie2026/*.md` design docs. Every module snaps to N×M cells.

| Module | Content | Tier (typical) |
|---|---|---|
| **lottie** | the hero animation, fills edge-to-edge | high (focal) |
| **caption** | mono kicker + big title (the Lottie's "chin") | high |
| **tool** | links out — icon/glyph · title · desc · arrow. Pairwise (A·vs·B), Generate Icons | med |
| **stat** | colored icon · light-weight number · mono uppercase label | med / low |
| **card** | icon + title (nav: About, Contact) | low |
| **image** | invisible card — image floats centred over the dot scaffold (no card edge). Reusable for any floating image. **Kept in the vocabulary but *currently unused on any view*** — the brain (its only instance) moved to an `infocard`, the Insight card, see below. | — (accent) |
| **infocard** | 1×1 card that **hover-expands in place** (pushes neighbours) into a drawer: glyph **or image** (`img`) top-left + title/body/link. Info · API · **Insight (brain → blog)**. Whole card can be a `href` button. | accent |
| **qcell** | **¼-cell** chip (4 per cell) on the half-cell sub-grid; generic (icon / value / colour). Draggable, collides with other qcells | accent |
| **floaticon (tool)** | **detached** icon card — a draggable 1×1 `.board-card` (just the icon) that on hover **expands in place to 1×(1+dh), pushing neighbours down** to reveal the drawer (title · desc), then snaps back — see *Draggable board is GLOBAL* below. *(The earlier generation — the drawer's top edge peeking out below the icon like a sheet of paper and sliding down on hover — is retired; hover-expand replaced the peek-slide.)* **Pairwise** links out (external). **Generate Icons** is a **brand-blue card with a white icon** that links **internally to the Icons view** (`goView:'icons'`, not the external subdomain). *(Draggable floaticons are flat at rest and only lift on drag/expand — see* Draggable cards: FLAT at rest*; there is no group shadow.)* | med |

### Card taxonomy (by fill)

1. **Background-colour 1×1** — plain `--canvas` `#e9e7e3`, no dots. The floating icon cards.
2. **Background-colour + drawer** — as above; the drawer is hidden at rest and revealed by **hover-expand** — the card grows downward (1×1 → 1×(1+dh)), pushing neighbours, and the drawer text appears in the grown cells (see the draggable tool buttons, §*Draggable board is GLOBAL*). *(The earlier sheet-of-paper "peeking edge that slides down" is retired.)*
3. **Canvas-colour, various sizes** — `--surface` `#f0eeeb` solid cards (caption, stats, nav, Lottie). N×M.
4. **Internally scrollable** — ✅ `scrolltext` card; long text scrolls within its cells (used by the About view for the ontology copy).
5. **Filled colour (accent)** — brand-colour fill + white centred glyph (`.accent-card`, `infocard-accent`, `icon-float-accent`). Used by Generate Icons and the demo accent chip.
6. **Transparent (dots show through)** — `.infocard-img` at rest is `background: transparent` so the dot scaffold reads through the image's alpha (the Insight/brain card); it only gains a `--surface` fill when expanded.

**Views (SPA):** `home` (standard set) · `about` (scrolltext + graph) · `journal` (the reading view — see *Journal view ✅ v1*) · `icons` (the integrated icon generator — `dds-icon-engine.js`, built in a parallel session) · `contact` (centred card). It's a **one-page app, not scrolling pages** — a dedicated **left nav rail** (88px, *outside* the grid) switches the `view` and content **re-centres in place**; scroll *within* cards when needed. Logo / Home → home. Grid width = viewport − rail. Graph = the original `graph-schema.svg` (self-animating). An in-grid Contact CTA can also `goView:'contact'` on layouts where it might spur contact — it brings the contact card to the centre rather than opening in place.

### Buttons vs tabs (affordance + colour)

Two clearly different shapes **and** colour families so it's obvious what's interactive:
- **Tabs / titles** (eyebrows) — **fabric tags rounded on the *top only*** (square bottom tucks ~2px behind the card, unseen); **cards themselves stay square**. Colour is a swappable token (`--eb-bg/--eb-fg/--eb-border`) drawn from the **existing brand neutrals — no invented colours**. **Default = light raised tag** (`--surface-raised`, lighter than the card) with `--t-med` grey text + hairline border. Alternates kept on-brand: **A** = dark charcoal (`--t-high` + `--surface`), **B** = brand blue (`--color-blue` + white). Not buttons.
- **Buttons** — **fully rounded pills**, **colour-filled** (no neutral/grey text buttons): primary = **brand-blue filled** (Randomize); secondary = **blue text on a light raised fill** (blue `--color-blue` icon on `--surface-overlay` — Save, Download; Download-all `.cb-act-dl` is full blue); **Clear = brand-yellow tint** (`#ffd119`, amber text) — never red. Soft shadow + **hover lift** (`translateY(-1px)` + slight `brightness(0.97)`). *(A press-on-`:active` state is specced but not yet wired.)* Scheme/segmented toggles fill brand blue when on.

Preview icon is centred in its block and sized to **0.92** of the block's short side (min 120); the preview block is kept **≥2 rows** so the icon reads large. The controls panel groups its fields by **concern with hairline separators** — *name · shape · colour · actions* — for legibility.

### Internal alignment — "super Swiss"

Card internals conform to the **7×7 dot grid**: a **1-unit border** = padding of `--dot-unit` (= cell ÷ 8, ~15–18px depending on the live cell size — set per-cell in JS so it scales with the module), and inner elements snap to dot positions. `--dot-unit` is set per-cell in JS so it scales with the module. *(Padding done; element-level dot snapping still to refine.)*

**Horizontal placement:** every view **centres its content cluster** — `ox = floor((cols − contentWidth) / 2)` — so nothing is left-aligned on wide monitors. Home/About/Contact already did this; the **icons view** now matches (it reserves the saved set's *max* 3-col width when centring, so the cluster doesn't shift left/right as the set grows). Home keeps the brain as a deliberate float out in the left margin.

**Vertical placement (`vSpace`):** every view keeps **free scaffold rows top & bottom** — **1 above**, and **1 (small screens) → 2 (full screen) below** — so content never runs to the monitor's bottom edge (you shouldn't have to read to the very bottom). The content area fills the rest; cards fill to their content's aspect / scroll internally rather than leaving big gaps. Applied to home, about, icons. *(home's fixed 4-row cluster is centred within this band.)*

**Depth:** one shadow per *connected group* of solid cards, cast from the group's **true silhouette** — the plate is flood-filled and filled with one opaque cell per solid cell, then a `drop-shadow(0 3px 8px rgba(0,0,0,.11))` follows that footprint, so **empty / cut-out cells cast nothing** (an L-shaped group casts an L-shaped shadow). Touching cards read as one body and never shadow each other. **Z-layering:** scaffold cells `z-index:0` < shadow plate `1` < content `2`. An **expanded** card carries its own `drop-shadow` (`.block.board-card.expanded`) — the elevated state is the card itself, not a peeking edge. Scaffold + plain icon cards stay flat. **Plate fill colour = `--surface` (not `--grid-line`)** — the fill is only there to give the `drop-shadow` an alpha silhouette, its colour is otherwise irrelevant. Colouring it to *match the card* means that when a card **scales/fades during a Populate transition** and momentarily exposes its plate, the footprint is invisible (card-coloured) instead of flashing as a **darker-grey square** — the artifact that made transitions look broken.

**Fill the card, don't pad it with white space** (prefer internal scroll over gaps): illustration/graph cards are sized to their content's **aspect ratio** so they fill edge-to-edge (e.g. the About graph is portrait ~0.6 → a `round(rows×0.6)`-wide × full-height card); text cards use larger type + **internal scroll** rather than leaving big top/bottom gaps. The About view applies both.

**Hover affordance:** only genuinely clickable cards change on hover — `.tool` links, `.clickable` CTAs (goView), and the rail items. Plain content cards (caption, stat, Lottie, scrolltext, graph, contact, brain, floating icons) do **not** change colour.

**Hover:** floating tool icons are large (~66px) and scale **1.18×**. *(The old brain-grows-1.14× rule targeted the `image` float kind, which is currently unused — the brain is now the Insight `infocard` and hover-expands instead of scaling.)*

Established patterns from the docs (not all wired yet): **stat grid** hover = siblings fade to 40% + icon scales 1.1×; **category card** = colored left border that grows on hover + mono tags with "+N more". Minimal colour (icon + accent only), 1px borders, transparent fills, light numbers, mono uppercase labels.

**Content source:** guides come from **Graffold** (the DDS CMS — DITA-style chunks → articles, each with slug/title/desc/Material-icon/brand-color/type like `STRATEGY GUIDE`). See `DDSWebstie2026/graffold-architecture.md`.

---

## Eyebrow tags & labels
<!--illus:buffer-->

A small floating label that does **not** occupy a cell. Mono uppercase, dynamic width, ~2 dot-rows tall, surface + 1px border + faint shadow. Set on an item via `tag` / `tagOn:'hover'` / `tagPos:'above'|'right'|'left'`; rendered as an absolute overlay.

**Z-order: the tag sits *behind* content (z-index 1, between scaffold 0 and content 2)** so it tucks behind the module and **pops out from behind it into an adjacent free cell** — like a tab behind a card. **Placement rule:** a floating object that carries a side-tag must have a **free cell on the pop side** — right when the object is on the **left** half of the screen, left when on the **right** half. Used for the **"SAVED SET"** title (`tagPos:'above'`, static, sits in the buffer row above the panel — freeing the panel's cells for tiles). *(The brain's old "BRAIN" hover-pop tag is **retired** — the brain is now the Insight `infocard`, which reveals via hover-expand instead. The side-tag pattern remains available for other titled modules.)*

> The brain is a **transparent float over a real scaffold cell** (not a dotted block), so dots show through behind it and the tag layers cleanly as `dots(0) < tag(1) < brain(2)`.

Title eyebrows are slightly **rounded (3px)** and **tuck ~2px behind the card's top edge** so they read as a fabric tag popping up from behind the card (z-index 1 < card 2), not floating above it — only a couple of px hidden, so the text sits clear of the edge. *(An earlier ~7px tuck cut into the label; 2px is the shipped value.)*

**`above` auto-falls-back to the side:** if the row above a module is occupied, the tag becomes a **vertical tab** (`writing-mode: vertical-rl`) on a free side (left preferred, then right), anchored **near the top** of the module rather than centred. **Scope note:** the occupancy check reads the *non-draggable* render pass's `occ` map, so on the all-draggable icons board it effectively fires only when the module sits **in the top row** (`r === 0`) — draggable neighbours parked above a tag aren't detected. Used for the icons view's section titles — **Preview / Example usage / Saved Set** sit horizontally above (the Controls toolbar carries no tag; it's the untitled satellite pill — see below). The vertical-tab fallback remains available for any future titled module with no room above.

**Top tabs TUCK AWAY on adjacency (draggable boards):** when another card ends up **flush above** a tagged module (drop, drawer-expand shove, or a restored layout), the tab **animates down behind its own card** (the eb-handle 0.26s transform spring — it visibly slides in behind the top edge, z: tab 1 < card 3) and **pops back out** when the space above opens again. `syncEyebrowTucks()` runs after every layout commit (build · drop-reflow · hover-expand) and tests the tab's actual poke-strip rectangle against every card, so **cards can butt directly together with no poking sliver** — the buffer rule's "accessories can share the gap" holds even at zero gap. *(Also fixed here: `.eb-handle` re-enables `pointer-events` — the base `.eyebrow` is `pointer-events:none`, which had silently disabled grab-by-the-title-tab.)*

---

## Spacing: buffer & adjacency
<!--illus:buffer-->

A **spacing convention** for how cards/groups relate on the grid (a design principle; it does *not* force a code change — the collision resolver already keeps cards from overlapping):
- **Default breathing room:** a card or a connected group of cards should carry a **~1-cell buffer of free scaffold around it**, so modules read as distinct objects floating on the dot field rather than a solid slab. (This is why `vSpace` keeps free rows top & bottom, and why the icons cluster carries a left gutter `ox`.)
- **Buffers may be *shared* / overlap:** the buffer is a *minimum breathing zone*, not an exclusion zone. Two cards' 1-cell buffers can occupy the **same** free cell — because the sub-cell **accessories** that live in the buffer (floating satellite palettes, eyebrow tabs) **never extend past the halfway line** of that shared cell. So a satellite hanging off card A's right and a tab peeking from card B's left can share the column between them without colliding. Budget the buffer as *shared*, not *per-card additive*.
- **Deliberate adjacency is allowed:** cards **may butt directly against each other** with no buffer when they're meant to read as one unit — e.g. **Preview + In-situ ("Example usage")** stacked edge-to-edge so it reads as part of the Preview column. Adjacency is a compositional choice; the 1-cell buffer is the *default*, not a hard constraint.
- **Practical result:** when placing/reflowing, prefer leaving a 1-cell gap around a group, but don't reserve a full ring of exclusive cells — let neighbours' buffers overlap in the gap, and collapse the buffer to zero where two cards form an intentional pair.

---

## The draggable board
<!--illus:modules-->

### Icons board — layout model: **draggable + collision/reflow** (chosen)

Decided model (over free-canvas and pure auto-populate): the **react-grid-layout / dashboard** pattern. Cards are draggable **and never overlap** — `resolveLayout()` keeps the moving card where you drop it and **pushes every colliding card DOWN** to clear (cascading, reading order), so a drop **shoves neighbours** and the board self-tidies. It runs both in the composition (so stored/resized layouts render clean; non-overlapping defaults pass through untouched) and live on drop (neighbours animate into place, no rebuild). Positions persist per card in `viewLayout` (the per-view store alias — see *Per-view persistence* below).
**Gravity + recovery:** `resolveLayout` packs cards **UP from a floor row** (= the top buffer `oy`) to the first free slot, so gaps close and cards **never drift/stick to the bottom**. Bad/stale stored layouts self-correct on load. **Grab affordance:** the **whole card is a drag handle** (`cursor: grab`, pointerdown starts the drag) — *except* on an actual control (input/button/tile/segment/dot/grip/toggle), which still work normally. A subtle **"Reset layout"** pill (bottom-left) appears once the board's been customised and restores the centred default.
**Still to do for the full model:** live shove *during* drag (currently resolves on drop), horizontal re-column when a stack can't fit vertically, and responsive breakpoint re-pack. The **"Example usage" minimize** should also become a documented, animated, reusable `minimizable` card token (collapse to a 1×1 icon+label and back) — deferred to build on this model.

### Draggable board is GLOBAL — the home page drags too

The same machinery now powers the **home view** (desktop, `cols ≥ 7`): the **hero Lottie**, the **caption**, **both stat cards**, **both tool buttons**, the **brain/Insight infocard** (a freefloat margin card, see *Insight card*), and the **four quarter-cell demo chips** are draggable `.board-card` cards that collide/reflow exactly like the icons board. *(The Lottie and the brain are* separate *cards — the Lottie is a plain `kind:'lottie'` tile, the brain a `freefloat` infocard.)* A few small generalizations made the icons-only system view-aware:
- **Per-view persistence.** `viewLayout` / `persistLayout` are no longer hard-wired to one key — a tiny `LAYOUT_KEYS` registry maps `home → 'dds-home-layout'`, `icons → 'dds-icons-layout'`, and `build()` repoints the `viewLayout` alias + `CUR_LAYOUT_KEY` at the current view **before** the composition reads it. So dragging one board never disturbs the other; each remembers its own arrangement. *(The alias was named `iconLayout` before the drag board went view-global; renamed with the board-wide `icons* → board*/view*` pass. `ICON_STORE_KEY` — the saved icon set — keeps its name: it genuinely is icons-only.)*
- **Per-view floor.** `boardFloor` (né `iconsFloor`) is "the current board's floor" — `setComposition` sets it to the home `oy` just as `iconsComposition` does, so gravity packs against the right row on whichever board is mounted (only one view is ever in the DOM).
- **Tool buttons = draggable 1×1 cards that hover-EXPAND (no reserved space).** Each floating tool button is a **draggable 1×1 `.board-card` card** (just the icon). On hover it **expands downward to 1×(1+dh) and pushes its neighbours out of the way** — the drawer is revealed in the grown cell(s), not a permanently reserved slot. Collapsed footprint lives in `baseCells` (1×1); the grown footprint is registered in the generalized **`EXPAND` map** (tool = 1×2, info/api = 2×2) that `reflowInfoExpand` reads. So at rest the buttons pack tightly (a stat can sit directly below one), and unhiding shoves whatever's in the way. Dragging collapses the card to 1×1 first (via `infoExpanded` check) so it moves as a single cell; the card lifts (`drop-shadow`) while dragging/expanded and is flat at rest. `baseCells` is kept current on every drop so hover-expand always reflows from the *live* layout, not the build-time one.
- **Two reflow modes: compact vs push-only.** `resolveLayout(rects, movingId, …)` now branches on whether a card is moving. **No mover (initial pack / Reset)** → gravity-**compacts** up from the floor (closes gaps, self-corrects stale/resized layouts). **A mover present (live drop)** → each other card **starts at its resting row and slides DOWN only if the mover/cascade actually overlaps it**. *(Hover-expand (`reflowInfoExpand`) uses the same push-only semantics but via its own inline pass, not `resolveLayout`.)* This killed two bugs: a drop no longer **yanks a distant card across the board** to fill a gap (it only shoves what's under it), and the **free-float brain moves out of the way when a drawer opens into it** instead of being pinned-and-overlapped. Free-float is still pinned in the *drag* reflow only (so it isn't sucked to the top); **quarter-cells** stay on their own sub-grid.
- **One shared expand timer.** Hover-expand uses a single module-level collapse timer (not one per card), so sliding the cursor **from one drawer to the next** cancels the first card's pending collapse — the target drawer stays open instead of flickering shut ~0.1s later.
- **Click vs. drag.** The tool icons are links (Pairwise → external, Generate Icons → `goView`), so the whole card is the drag handle *and* the link. A module-level **`dragMoved`** flag (reset in `startCardDrag`, set once the pointer moves > 4px in `pointermove`) gates the click: a click that **didn't move navigates**; a **drag suppresses it** (`e.preventDefault()` / skip `transitionTo`). No text-selection or accidental navigation while dragging.
- **Fixed obstacles (`fixed:true`).** `resolveLayout` gained a `fixed:true` flag: pinned rects the resolver **packs around but never moves**. Fixed obstacles are **inline `fixed:true` rects declared by each composition** (the parked brain, the quarter-cells during a full-card drag) — there is no separate obstacle array. *(An earlier `boardFixed` side-array was speced for this; it ended up write-never dead state — nothing ever pushed into it — and was deleted in the rename/dead-code pass.)* A general capability for any "keep this clear" region.
- **Free-float (`freefloat`).** The **brain PNG** is a draggable margin float, but it must *not* get sucked to the top when another card is dragged (gravity would pack it up its empty margin column). It's tagged `data-freefloat`; in the drop-reflow it's treated as **fixed unless it is itself the card being dragged** — so it holds its spot while others move, and moves + persists only when you grab it directly. Once parked in a custom spot it also becomes a `fixed` obstacle on rebuild so content re-packs around it.
- **Gotcha — draggable cards need `.block`.** Positioning is keyed on `.block.board-card` (position:absolute + top/left:0). The draggable render branch adds `.board-card` but relies on `renderContent` to set `.block`. Every kind sets `el.className = 'block …'` **except lottie**, which only appended its host — so the draggable Lottie card rendered *without* `.block`, wasn't absolutely positioned, fell into flow at `offsetTop ≈ 700px` and vanished off-screen. Fix: `renderContent`'s lottie branch sets `el.className = 'block lottie'`. Any new draggable kind must set `.block` in `renderContent`.
- **Ghost + reset generalised.** The snap-preview `#dragGhost` and the **"Reset layout"** pill are created for **any** view that produced `.board-card` cards (gated on `grid.querySelector('.board-card')`, not `view==='icons'`); reset clears the *current* view's store. Satellites (pill/controls) stay strictly icons-only — home never calls `positionSats` for anchors it lacks (the existing self-guards no-op). Home dragging is **desktop-only** (`cols ≥ 7`); the narrow stack is unchanged, matching the icons board.

### Quarter-cell cards (¼-cell, sub-grid) — GLOBAL primitive

A **`qcell`** module is **¼ of a cell** (`w=h=0.5`) — **four fit in one cell** in a 2×2 sub-grid (each `(cell−1)/2` px, 1px gaps, so 4 tile a cell exactly). It's a **generic chip**: icon, value, or a plain colour block (accent = filled colour tile with a white glyph). Quarter-cells are **draggable and collide on the half-cell sub-grid**:
- **Fractional collision.** `resolveLayout` gained a **`step`** param (default 1; **0.5** for quarter-cells). Positions/sizes are plain cell units that can be `.5` — the transform (`c·gcw`) and size (`w·cell + (w−1)`) formulas already work for fractions (`w=0.5 → (cell−1)/2`). `clampInt` is a pure clamp, so no rounding to fix.
- **Snap by card kind.** `startCardDrag` sets `cDrag.step = footprintW < 1 ? 0.5 : 1`; the pointer handlers snap `Math.round(d/gcw/step)·step`. So quarter-cells snap to half-cells, full cards to whole cells.
- **Two granularities, one board.** When you drag a **quarter-cell**, the other quarter-cells reflow among themselves (`step 0.5`) and **full cards are `fixed` obstacles**; when you drag a **full card** (`step 1`), quarter-cells are the obstacles. They never overlap, and full cards stay on the whole-cell grid. The **initial composition pack** also lists the quarter-cells as `fixed` obstacles so a stored full-card layout never packs onto them. Quarter-cells are **pinned during a neighbour's hover-expand** — *unlike* free-floats, which get pushed out of the drawer's way — so an opening drawer may temporarily cover them; they reappear when it collapses.
- Demo: four chips (bolt/favorite/star/bubble, one accent) fill a free cell on the home board; each persists its fractional position in the per-view store. Content is a placeholder — the primitive can carry icons, mini-stats, thumbnails, swatches, etc.

### Two consistent satellite palettes + responsive stack

Both floating palettes are now the **same component** (`positionSat`/`SATS` config) so they behave identically: the **action pill** is a satellite of the **saved** card, the **controls toolbar** is a satellite of the **preview** card. Each floats a uniform **`GRP_GAP` = 14px** from its card, **snaps vertical (left/right) or horizontal (above/below)** by drop side (`pillSideFor`/`sideTowards`), **follows its card** when it moves, and — being recomputed every build — is **robust to resize** (no stale grid position). (A mid-build transform-transition can stall in some renderers, so `positionSat` commits the transform with the transition briefly disabled.)
- **Shapes selector: no nested container** — just the three `2/3/4.png` buttons, tightly grouped (4px), tinted `<img>` (grey off / white on the blue selected pill), matching the pill's container-less button language. (The old grey track pill was the "different-shape thing" and is gone.)
- **Spacing/radius are tokenised & uniform**: palette wall **7px**, item gap **8px**, shapes inner gap **4px**; scheme squircle **12px**, colour dots **9px**, saved-tile `×` **5px**. Both palettes share the same shadow.
- **Save → `add` (plus)** in the preview footer ("Add to set" — it's adding, not saving a file).
- **Narrow / portrait (`cols<7`)**: a plain **vertical stack** — preview (+footer) · a **compact centred controls toolbar** (`.ctrl-inline`, never a giant pill, grip hidden) · saved grid (dense ¼-size tiles, 4 per cell). **No floating satellites** at this size (they'd overlap); the pill is desktop-only — the inline toolbar **absorbs the set actions** (download-all + clear join it as round `.cb-act` buttons) and **wraps onto a second line** when the cell is tight (see *Mobile / touch model ✅ v2*). This fixes the badly-broken narrow layout.

### Icons board — split modules (footer · hideable in-situ · toolbar)

The icons cluster is broken into independent draggable pieces:
- **Preview card** carries a **footer strip**: the **name input** + a **Randomize** button (brand-blue, **`autorenew` circular-arrows** — *not* the shuffle glyph). The icon canvas lives in a flex `.ip-stage` above it (so `mountIcon` sizes to the stage, not the footer).
- **In-situ** is its own **hideable card** (drag group `situ`): a toggle (`close_fullscreen` ⇄ `open_in_full`) **collapses it to 1×1** (shows a mini icon) and back; state persists (`viewLayout.situHidden`). **Sizing:** the mockup (list + app/folder cards + size-scale) needs **2 rows** or `overflow:hidden` clips it, so the card claims 2 rows from the space **below the preview** (incl. bottom breathing), not the tighter content budget; if the viewport is too short for 2 rows it **auto-minimizes** rather than rendering the mockup cut off. *(Fixed a bug where a 1-row card clipped the mockup — the bottom cards bled off the edge.)*
- **Preview footer** carries **all four actions**: name input + **Randomize** (`autorenew`) + **Save** + **Download** (like the study's footer). The name field is styled as a **clear bordered input** (not plain text) so it reads as editable.
- Both the **action pill** and the **controls toolbar** are **compact** (natural size — just their contents), NOT edge-span stretched, so there's no dead space; the grip is a small handle, not a filling spacer.
- The **in-situ** module is renamed **"Example usage"** (clearer for users than the Latin term).
- The toolbar **snaps horizontal ↔ vertical like the action pill**: the drop picks a dock **side** (persisted as `viewLayout.controlsSide`, same mechanism as the pill's `pillSide`), and `positionSat` derives the orientation from it — docked **left/right → the toolbar stands up vertically**. To fit vertically, the controls are **icon-only** (no wide text): **Shapes** are the `2/3/4.png` renders as tinted `<img>` (dark grey unselected, white on the blue selected pill — robust, no CSS-mask dependency); **Scheme** is a **live example icon** — the current design rendered in the current scheme, click cycles + re-renders it (replacing the wide "Mono/Colorful" text); **Colour** stays two swatch dots. The **minimize/expand toggle** on the Example-usage card is now **tiny** (matches the saved-tile `×`).
- **Controls** is stripped to a **minimal pill-toolbar** — the same shape/size language as the action pill (short ~58px, `border-radius: 999px`, `--surface-raised`, **no title tab, no labels**): `[shapes seg] · [drag grip, flex-fills the middle] · [Scheme] · [colour dots]`. It's **grabbed by its centre grip** (no tab). **Scheme is click-to-cycle** — a single pill showing the current scheme (Mono → Pop → Neutral → Colorful), not four always-visible pills. **Colour** is two compact swatch dots (icon fill · background/checker) that open the wheel pop-out. Reads like a **minimal design tool**, not a form.

### Controls panel — compressed (compact form) — superseded by the pill-toolbar

The compact settings *form* (ported from the `icon-controls-panel.html` study — masked-icon shape segments, Mono/Pop/Neutral/Colorful scheme pills, `dot + label + value` colour chips with a `None` state) is a **retired generation**: the live Controls is the **minimal pill-toolbar** documented in the two sections above (tinted-`<img>` shape buttons, a single click-to-cycle live-example Scheme icon, two bare colour dots — no labels, no values). What **survives** from this generation is the **colour pop-out picker** the dots open:
- **Per-shape recolour** lives inside the **Icon colour pop-out**: a top **"Recolour" strip** — `All` (base colour / palette seed, `colors=null`) plus one swatch per shape showing its current colour. Pick a target, then the wheel/swatches recolour just that shape (`iconState.colors[i]`). Restores the old per-shape editor into the compact picker (verified: recolouring one shape leaves the others untouched; saved into the set via `snapshotState`).
- **The pop-out itself**: a **hue/sat wheel + lightness slider**, then **brand swatches pinned** (`IG_MONO` for icon · `IG_BG` incl. a transparent/checker option for background) and a **Saved** row with **`+`** to store the current colour. It flips **above** the trigger if there's no room below. The Icon dot is the single base colour that seeds every scheme's palette.

*(Kept for the record: compressing the form removed two full swatch rows + the per-shape row; the pill-toolbar then removed the form.)*

### Icons view = a draggable board (anchor-aware pill)

The Preview / Example-usage / Saved modules are **draggable** — the **whole card is the drag handle** (actual controls — inputs, buttons, tiles — are excluded and stay interactive; originally only the eyebrow tab dragged) — drop it on the dot-grid; it **snaps to the nearest cell**, a dashed **ghost** previews the target, and positions **persist** (`localStorage: dds-icons-layout`, re-applied + clamped on every build/resize). Dragged cards render **absolutely** (float above the scaffold) with a `filter: drop-shadow` so the shadow follows the cut-corner silhouette *and* moves with the card — no plate needed. Reposition-on-drop is done by transform only (no full rebuild → no icon-engine re-mount → smooth).

The saved-set **action pill** (download · **drag-handle** · trash) is **anchor-aware**: it re-homes into free space beside its card (reading-order preference **right › below › left › above**, dodging the other modules), and **orients to the docked edge — vertical when left/right, horizontal when above/below**. Drag it by its centre grip; **where you drop it picks the side** (drop-proximity via `sideTowards`). It's **compact** — natural size, vertically centred on its card's edge, the grip a small handle *(an earlier edge-span variant stretched along the card's full side; see the satellite-palettes section)*. When its card moves, the pill **follows**. Ported from the `floating-pill-placement.html` study — but unlike the study's free placement, **card-vs-card overlap IS prevented**: `resolveLayout` packs/pushes on every drop (see *Icons board — layout model* above); the ghost shows where it'll land.

### Draggable cards: FLAT at rest, lift on drag

Draggable `.board-card` cards carry **no drop-shadow at rest** (`filter:none`) — so dense/adjacent cards (tools, stats, quarter-cells) **never cast shadows on each other**; they read as flat tiles on the dot scaffold (the surface-filled cards distinguished by their `--surface` fill vs the canvas; the tool/icon cards are transparent (`.icon-float-card`) or brand-filled (`.icon-float-accent`) instead). A card gets a **`drop-shadow` only while `.dragging`** (lifts as you move it) or **`.expanded`** (the info/API/tool drawer reads as elevated). *(Earlier every card had a resting per-card drop-shadow; on the denser home board those shadows fell on neighbours — the reported "cards casting shadows on each other".)* The grouped shadow-*plate* system still applies to non-draggable grid-placed cards.

**Hover-expand is suppressed mid-drag.** A card's hover-expand (`reflowInfoExpand`) is guarded by `if (cDrag) return`, and `startCardDrag` **collapses any currently-expanded card** before it reads footprints — so dragging a card *past* or *below* an expandable one (e.g. the blue Generate-Icons tool) can't leave that card stuck in its 1×2 expanded footprint, "jumping up and preserving its hidden space". Everything reflows against **resting (collapsed) footprints**.

---

## The icon generator
<!--illus:modules-->

### Saved set — content-sized, grid-aligned, scroll-on-overflow

The Saved Set panel **grows with its contents** instead of always being full width: **1 saved icon = 1 cell**, the block grows roughly square from a **2-cell minimum** and is **never wider than 3 columns** — past that it grows **down** to the vertical budget (`vSpace` rows) then **scrolls internally** (`.icon-saved` is the `overflow-y:auto` scroller). **A save scrolls the panel to the new tile** (`scrollSavedEnd` — the tile appends at the *bottom* of the scroll, so on a full/scrolling panel the add would otherwise land below the fold and read as "nothing happened, click again"; it re-scrolls after the debounced resize-rebuild too, which resets `scrollTop`). Leftover area becomes **free scaffold**, not an empty panel. A **partially-filled last row cuts the empty corner out** (`clip-path` L-shape) — those cells stay un-occupied so the **dot scaffold shows through** and the group's shadow follows the real silhouette (no shadow under empty cells). **Actions are solid round icon buttons** on the anchor-aware **satellite action pill** (download · grip · clear — see *Two consistent satellite palettes* / *anchor-aware pill*): **download** (full blue, white icon) + **trash/delete** (full yellow, dark icon, with confirm). The pill floats just off the panel's edge (reading-order preference right › below › left › above) and is **vertically centred on the card** (not top-aligned), so it never overlaps content and stays clickable.

### Info / API cards (icons view)

Off to the right of the cluster, as **draggable icon cards** (`.board-card`, 1×1, no content peek — closed = a clean colour block): **Info** = blue card with white `i`, **API** = neutral card with `code`. They are **real participants in the collision layout** (added to the composition `rects` with their own anchors, packed by `resolveLayout`), so on hover each **expands in place into a 2×2 drawer and pushes its neighbours out of the way** — exactly like the home Generate-Icons drawer, *not* an overlay/modal floating over the grid. `reflowInfoExpand(id)` re-runs the gravity resolver with the hovered card grown to its `EXPAND` footprint (2×2), keeping it pinned (as the `movingId`) while every other card reflows around it; leaving snaps everyone back to the `baseCells` snapshot taken each build (no repack drift). The card's `transform`/`width`/`height`/`background` all transition (`.block.board-card.infocard`, ~0.26s) so the growth animates and neighbours slide. Inside the expanded drawer: the **glyph floats top-left** in a rounded square (blue for Info, neutral surface-overlay for API) and the **text wraps around & below it** (title · paras · mailto link · mono footer); overflow scrolls. Info = the tool explanation (soft-body/p5.js + cognitive-differentiation rationale + auto-colour-match + "Built by Doran Design Studio · 2026"); API = the access blurb + `hugh@dorandesignstudio.com` (mailto). *(Earlier iteration was an absolute `.info-panel` overlay that scaled from the corner — replaced because it read as a modal floating over the page; the user wanted it to push the layout, not cover it.)*

### Icon-generator action buttons

Randomize / Save / Download are **solid round icon buttons** (no labels): **Randomize** = brand-blue fill, white **`autorenew`** (circular-arrows, not shuffle); **Save** = **`add`** ("Add to set" — it's adding, not saving a file), **Download** = `download` on a light raised fill with a blue icon. *(The custom `::after`-reads-`aria-label` hover tooltips shipped with the old `.ig-btn`/`.sa-btn` form-panel generation and were dropped with it — the live buttons (`.ip-fb` preview footer, `.dp-btn` pill, `.cb-act` inline toolbar) carry `title` + `aria-label` and rely on the native tooltip.)*

**Saved-set download/trash pull-tab — superseded.** *(A raised pull-tab hanging below the panel — top edge tucked ~3px behind, `border-radius: 0 0 15px 15px`, `.saved-actions-up` flip-up fallback — was speced but never shipped; the shipped actions are the anchor-aware satellite pill above.)*

**No-overflow grid sizing.** Cell size is `(availW − (cols−1)) / cols`, i.e. the available width **minus the `cols−1` one-pixel hairline gaps**, so `cols·cell + gaps == availW` exactly. (Previously `availW/cols` ignored the gaps, making the grid ~`cols−1`px wider than its area — the rightmost column and the actions tab were pushed off-screen at some widths. *This* was the real "I lose the button when I scale down".)

**Insight card (the brain = the blog button).** The old "BRAIN" pop-out tag is **retired** (it predated the card model). The brain is now an **`infocard`** — the *Insight* module, a **button for the studio journal/blog**. Collapsed it's a 1×1 card with the brain image centred; on **hover it expands in place to 2×2** (brain floats top-left, **"Insight"** heading + a short blurb + a **"Read the journal →"** link), pushing neighbours like the info/API cards. **Clicking the whole card opens the blog** (`href`, new tab) — suppressed after a drag via `dragMoved`. It's still a **`freefloat`** margin card: *defaults* to whichever margin has room (left if `leftRoom ≥ 2`, else right) so it never drops out as the window narrows, holds its spot during other cards' reflow, and is draggable + persists. The infocard renderer gained an **image variant** (`it.img` → `.infocard-media` instead of a material glyph): centred when collapsed, floated top-left (no coloured square) when expanded. **Image infocards are transparent when collapsed** (`.block.infocard-img { background: transparent }`) — no opaque surface tile — so the **dot scaffold shows through the PNG's alpha** (the brain sits *on* the grid, like the old float). The card gets a `--surface` background only when **expanded** (the drawer needs a readable panel). The brain PNG is 500×500 with transparent corners, so at `fit:'cover'` (square-in-square) it fills the cell with the folds and the **corners reveal the dots**.

- **Click a saved tile → it shows in the in-situ panel** (`insituOverride`), with a blue selection ring, *until the next edit* (any control change clears the override and reverts in-situ to the working icon). The main preview always stays on the working icon.
- **Performance & the save bug (real root cause):** rendered tiles are cached by id (`tileCache`). The "nothing, then two on the second click" symptom was a **paint freeze**: a save added the tile fine, but `renderSavedList` then **rasterised the new thumbnail via `DDSIcon.toDataURL` synchronously** — a ~150–170ms *blocking* physics settle that froze the paint, so the tile didn't show until a later paint (the second click). Fix: **append the tile card immediately** (it paints instantly, 0 ms block), then render each uncached thumbnail **after paint** (`setTimeout`, one per tick, guarded by `img.isConnected`). The panel-resize **`build()` is debounced ~350ms off the click**. **That build re-mounts was the *remaining* half of the bug** — the deferred-thumbnail fix alone did NOT solve it: the debounced build called `mountIcon`, which **`destroy()`+`create()`d the whole DDSIcon physics engine every build** (another ~150ms blocking settle), so the first save still froze the paint and looked dead → click-again-get-two. **Real fix — persistent engine:** the preview `<canvas>` is now a **persistent element reused across builds** (like the hero Lottie host), and `mountIcon` **only re-creates the engine on view entry or a real preview resize** — on a save-resize rebuild the same canvas returns at the same size, so it keeps its running engine + pixels and just refreshes the in-situ mockup (verified headless: `DDSIcon.create` fires **once** on entry and stays at 1 across N saves; tiles render one-per-click). *(Also: the in-situ mockup memo `insituKey` is reset when its elements are recreated, so a resize rebuild repaints the fresh — otherwise blank — mockup icons.)* Saved-item ids use a **monotonic counter** (`sv{n}-{rand}`) so they're unique regardless of name/seed. **Render reliability — the "1 shows · 2 nothing · 3 gives two (even if I rename)" report (ROOT CAUSE, headless-traced):** the incremental `renderSavedList` mutated the DOM correctly but **some browsers did not repaint the *existing* saved panel**, so a save only *visibly* landed on the clicks that also **changed the panel size** and thus fired a `build()` (a full `grid.replaceChildren`, which always repaints). Panel size **oscillates** by count — `savedPanelSize` goes `2×2→2×1` (0→1), stays (1→2), `2×1→2×2` (2→3), stays (3→4)… — so a build fired on *odd* saves and not *even* ones: the classic every-other-click. **Fix: every save re-renders via a full `build()`** (`refreshSaved` just calls `build()` on the icons view) — reliable repaint, and cheap now that the icon engine persists across builds (no destroy/create settle). The old incremental-render + debounced-resize-build path is retired. *(The persisted data was always correct — only the on-screen paint lagged, which is why a refresh "found" the missing ones.)* **Dev caching gotcha:** the prototype now sends `Cache-Control: no-store` meta — without it the browser was serving a stale cached HTML, masking fixes (hard-refresh ⌘⇧R if in doubt).
- The icons view carries a **left gutter** (`ox`) so the cluster isn't jammed against the nav rail.

### In-situ panel

Shows the working/clicked icon **in context** — a sidebar list row (selected "Project Apollo"), an app tile, a dark folder card, and the size scale (16/24/32). *(A button-specimen redesign was tried and reverted — kept the original contextual mockup.)*

---

## The journal pattern
<!--illus:gallery-->

The journal is a **technical-documentation reading pattern**, not a blog: the media panel is **pinned for the chunk being read** instead of scrolling away inline — the pattern DDS builds into product documentation, demonstrated on the studio's own site. Reached in-app (Insight card `goView:'journal'`, nav rail item).
- **Two modes: `gallery` (landing) and `read`** — a small `journalMode` state machine, on **both desktop and phone**. Entering the journal from any other view always lands on the gallery; opening a cover (`openJournalEntry`) switches to read; **re-tapping the Journal nav item while reading returns to the gallery** (cheap "up" without routing). Back affordances in read mode: desktop = the `journalindex` header becomes a `← Journal` button; phone = a `← Journal` button at the top of the article (`.jr-back`).
- **Gallery = cover cards (`journalcover`).** Each entry renders as a cover card: the entry's **first chunk that carries media** as the cover (falling back to a `graph` render if none does) (same `MEDIA_RENDER` kinds, incl. live renderers — the cover is generated from the entry's own content, never a separate asset) over a **meta strip** (kicker · date, then the title) with a top border. First card carries the 'Journal' eyebrow. Click/Enter opens the entry. Desktop: **2-wide × 2-tall covers** with 1-col gaps, row centred; phone: **full-width covers stacked** (h=2 each).
- **Articles are CHUNKS** — the same shape as the studio's databases and Graffold's chunk tables (`entry → chunks[] → media refs`), so entries import 1:1 later. `JOURNAL_ENTRIES[]` = `{slug, date, kicker, title, dek, chunks[{heading, body: markdown[] (paragraph array, joined on blank lines), media?}]}`, rendered via `mdToHtml`.
- **Read layout (desktop, left → right):** `journalindex` entry-list card (1–2 cols; header = `← Journal` back button; selection = raised card + full-strength title, unselected entries recede — no blue bar) · the article column (4–5 cols, internal scroll) · the `journalmedia` **pinned panel** (2–3 cols).
- **Read layout (phone, top → bottom):** article full-width (`← Journal` back button in the header) over the `journalmedia` panel **pinned as the bottom row** — the pinned-media pattern rotated 90°, same chunk-swap behaviour. The media row is dropped when only 2 rows fit (text wins). The spine goes **horizontal** (see below). No `journalindex` card — the gallery is the index.
- **The chunk spine is a TAG with METABALL dots:** attached to the article's **left edge** like the title eyebrows (right edge tucks ~3px behind the card, z below content), **~a quarter-cell wide** (`Math.round(cell/4)` ≈ 2 dot-units), one **small blue dot per chunk** centred in it. The **indicator is a bigger blue blob** in the same goo-filtered `<g>` (`#goo`: feGaussianBlur + alpha-contrast feColorMatrix), so it **melts through the dots metaball-style** as it travels (0.45s spring on `translateY`, `JR_DOT_GAP` = 21px steps). Click a dot = smooth-jump. **A one-chunk article shows no spine.** On phone the same spine builder runs **horizontal** (`.jr-toc-h`): a tab centred on the pinned media panel's **top edge** (bottom tucks ~3px behind the panel), dots run left→right, blob travels on `translateX` — `syncTocDots` picks the axis from the class. *(On a short phone where the pinned media row is dropped — only 2 rows fit — there is no media panel to anchor the horizontal tab, so the phone spine is omitted too.)* *(Reference: the halftone/metaball print in `MetaBallBlend/`.)* **Implementation notes (learned the hard way):** the goo layer must be a **native inline `<svg>`** — `filter: url()` on HTML elements leaves stale half-rendered trails in Safari mid-transition; and the filter needs an **explicit oversized region** (`x="-150%" width="400%"…`) — the default −10%..120% region clips the blur on a ~14px-wide column and the contrast turns clipped dots into half-shapes. The scroll-spy requires `.scrolltext { position: relative }` so chunk `offsetTop` is measured against the article (not the page grid) — without it the spy only ever fired the bottom clamp.
- **Chunk-pinned media:** each chunk may carry `media`; the panel holds it for the whole chunk and **swaps with an animated transition** (0.19s pop-out → replace → pop-in) when the reader scrolls into the next chunk (active = chunk under ~35% viewport height, rAF-throttled, **bottom-of-scroll clamps to the last chunk**). A chunk **without** media keeps the previous panel. Media kinds: `graph` · `image` · `gallery` (bento) · and **LIVE renderers** (`tokens` · `type` · `grid` · `modules` · `buffer`) that draw from the real CSS custom properties — the illustrations can't go stale. Panel-level grid resizing per chunk (bigger/smaller footprints via the expand machinery) is the designed next step. *(The v3 phone fallback — inline entry chips, no panel — is superseded by the v4 phone read layout: pinned bottom panel + horizontal spine.)*
- **Entry 001 = "The System, Documented" — the LIVE STYLE GUIDE, rendered from THIS FILE.** The site **fetches this very markdown** at load (`loadSpec` → `parseSpecChunks`) and renders each published **`## Chapter`** as a chunk with the illustration named in its **`<!--illus:KIND-->`** marker; **`<!--skip-->`** sections (Open decisions/TODO · Technical notes) stay in the vault and never publish. So the spec and the on-site guide are **one source that cannot drift** — editing the vault file re-renders the journal. The hardcoded chunks remain as an **offline fallback** if the fetch fails. *(The first draft, "The Grid Is the System", drifted into marketing voice — rewritten; the journal's job here is documentation, kept live. ~14 chapters, editorial-restructured from the old flat decision-log.)* Entry 002 = "How this journal works" (the pinned-media pattern, demoing `gallery`).
- **This entry proves the Graffold pattern on itself:** content = a versioned markdown file, resolved at load and rendered by the module system — locally against a file today, an S3 ref tomorrow. The vault file is the source; `content/dds-system-spec.md` (the path the site fetches) is a **symlink** to it for local dev; the deploy step copies it in as a real file.
- Next: per-chapter media as **asset refs**; the remaining `<!--illus-->` kinds (`attention · eyebrow · board · icongen · editing · motion`) as bespoke live renderers; panel-footprint animation.

---

## Editing & the content model
<!--illus:graph-->

### Content model — CMS-ready (tokens · objects · layout)

The site is built to become **data-driven**. Today the compositions are code, but **every screen is already assembled from plain objects**, so a backend/CMS can drive theme, content, and layout without touching the renderer. Three editable layers:

**1. Tokens (theme).** The design tokens (see *Colour tokens* + *Type system*) are CSS custom properties — brand colours, `--surface`/`--canvas`/text tiers, type scale, spacing, radius, grid metrics. A CMS "theme" is just a `token → value` map injected as `:root` vars; editing a token re-skins the whole site. **Nothing is hard-coded per component** (colours in module objects already reference `var(--color-*)`).

**2. Module objects (content + kind).** Every card is a composition **item object**. Shared shape:
- `id` / `drag` — stable identifier (also the layout key).
- `kind` — component type from the *Module types* vocabulary: `lottie · caption · stat · tool/floaticon · infocard · qcell · image · iconpreview · iconsaved · graph · scrolltext · journalcover · journalindex · journalmedia · contact`.
- **content** — kind-specific fields. e.g. `stat {icon, color, value, label}` · `infocard {icon|img, info → {title, paras[], link}}` · `tool {title, desc, href|goView, img|variant}` · `qcell {icon|value, color, accent}`.
- **layout** — `{c, r, w, h}` in cell units (fractions allowed for `qcell`): the *default* position, overridden by the saved layout.
- **behaviour** flags — `accent`, `freefloat`, `dh` (expand depth), `goView`/`href`.
The renderer (`renderContent` + the build item-loop) already consumes these objects, so a CMS payload is **the same array, as JSON**. Content currently lives in `CARD_INFO` (né `ICON_INFO`) / `TOOLS` maps — those are the seed of the content collection.

**3. Layout (arrangement).** The draggable board persists positions **per view** in `localStorage['dds-<view>-layout']` (`LAYOUT_KEYS`). That store **IS the layout document** a CMS reads/writes — reorder, resize, and drag positions are data. Dragging in the browser is already **WYSIWYG layout editing**; it just needs to save to the backend instead of `localStorage`.

**How the CMS edits the site**
- **Theme** → edit token values.
- **Composition** → add / remove / reorder module objects per view (`home` · `about` · `journal` · `icons` · `contact`, + new views).
- **Content** → edit a module's content fields (text · icon · colour · link).
- **Layout** → the persisted per-view layout doc (drag = editing).

**Relationship to Graffold.** *Graffold* (`DDSWebstie2026/graffold-architecture.md`) is the **content CMS for the journal/guides** — DITA-style *chunks* → *articles* (`slug, title, description, Material icon, brand color, type, estimatedTime, product tags`), served read-only via API. It shares the **same content vocabulary** as our module objects (`icon`, `color`, `title`, `type`, `link`), so a guide maps straight onto a `stat`/`infocard`/`tool` module with no translation. The new **Insight card (brain) is the entry point** — it links into Graffold's journal; a future *Guides* view would render Graffold articles as grid modules directly. **Two stores, one object vocabulary:** Graffold = content source; the module/token/layout model here = presentation layer.

**Current → target.** Now: per-view composition functions (`setComposition` · `aboutComposition` · `journalComposition` · `iconsComposition` · `contactComposition`), content in `CARD_INFO`/`TOOLS`/`JOURNAL_ENTRIES`, layout in `localStorage`. Target: a **JSON document per view** — `{ theme, modules[], layout }` — served by the backend; the renderer stays as-is. The migration is mechanical because the shapes already match. *(This is the "specified tokens/objects" the CMS needs — documented here so every new module keeps to the schema.)*

### Editing model — in-place, no separate admin ✅ v2 (hardened, pre-Graffold)

Editing happens **directly on the page**, not in a separate CMS UI. An **Edit toggle** (bottom-right pill) flips the site into edit mode; every editable card shows a blue **pencil**; clicking opens the **editor dialog** (proper `role="dialog"` + `aria-modal`, focus lands in the first field, **Tab is trapped**, **Escape closes**). Save persists to the per-view **content store** (`localStorage['dds-<view>-content']`), applied over the content each build. This is the **local Graffold stand-in** — the same edit → patch-object → save loop, pointed at localStorage until the backend is wired.
- **The JOURNAL is editable in place** — the flagship case: a pencil on the **entry head** (kicker · title · dek) and one **per section** (heading + the full **markdown body** in a textarea). Saves are keyed `head:<slug>` / `chunk:<slug>:<i>` in the journal view's content store (the old `sec:<slug>:<i>` key is still read as a legacy fallback for pre-rename saves) — content identity is the entry slug, independent of layout. `entryHTML` renders built-in entry **patched by overrides**. The chunk pencil edits only the heading and markdown body — a chunk's `media` (the pinned-panel image/gallery/graph or live-renderer kind) is **NOT yet exposed in the editor** and can only be changed in code.
- **Save is VERBATIM, Revert is explicit.** Clearing a field now sticks (empty string is a real edit); the dialog's **Revert** button removes all overrides for that module (back to built-in content). No more silent snap-back to defaults.
- **Everything edited is escaped at render** (`esc()` on every user-editable string interpolated into innerHTML; markdown bodies are safe via `mdInline`'s escaping; `safeColor()` whitelists colour fields to `var(--*)`/hex before they touch a `style=`). This is the future CMS payload path — hardened before Graffold serves it.
- **`href` is never a no-op**: an edited `href` **wins over a built-in `goView`** on tools, floaticons and infocards — set one and the card goes there.
- **Infocard body text is editable** (`infoTitle` + markdown `infoBody` override the `CARD_INFO` entry), not just its image.
- **Asset-ref seam**: image fields accept a plain path/URL *or* the Graffold ref shape **`bucket:key@version`** — `resolveAsset()` resolves refs against `ASSET_BASE` (empty = local passthrough today; point it at the bucket and every ref goes there). `fit:'contain'` now has real CSS (explicit fill-and-letterbox flag).

**Locked module schema (v2)** — `MODULE_SCHEMA` in code is the single source of truth; it drives the editor *and* documents the editable content fields per kind. Field types: `text · markdown · icon` (material name) `· image` (path/URL or `bucket:key@version` ref) `· color` (token or hex, whitelisted).

| kind | editable fields |
|---|---|
| `lottie` | — (animation, no content fields) |
| `caption` | kicker · title |
| `stat` | icon · value · label · color |
| `tool` / `floaticon` | title · desc · href |
| `infocard` | img · icon · infoTitle · infoBody (markdown) · href |
| journal entry | *own pencils:* head (kicker · title · dek) + per-section (heading · body markdown), keyed `head:<slug>` / `chunk:<slug>:<i>` (legacy `sec:<slug>:<i>` still read). *media not yet editable* |
| `qcell` | icon · value · color |
| `image` | img *(kind kept in the vocabulary but currently unused on any view — the brain became the Insight infocard)* |

Layout (`{c,r,w,h}`) and behaviour flags (`accent · freefloat · dh · goView · fit`) are separate axes, not content. **Adding a new module kind = add a `MODULE_SCHEMA` entry** and it's instantly editable. *(Image fields currently take a URL/path or file→dataURL; step 3 swaps that for a Graffold/S3 asset ref `{bucketKey, version}`.)*

**`fit` style.** Image-bearing modules take a `fit` flag — `cover` = **zoomed, cropped-to-container** (fills the cell, clips overflow), `contain` = **fit within, centred** (the image's own background shows around it). Reusable on any `image`/`infocard`. **Implementation note:** only `cover` has explicit CSS today — `contain` is documented vocabulary with no rule, so an image without `cover` falls back to its kind's *default* sub-100% contain (≈82% for infocard media, ≈72% for the image float), not a true fit-within-100%. The **Insight/brain card uses `fit:'cover'`** — the chosen look: the brain fills the frame so its (opaque) background crops away cleanly. A **transparent-background** brain asset is still preferred for `cover` in general (any non-filling image would otherwise reveal its baked background at the crop), and is the future swap; the crop setting stays the same.

### Asset & text pipeline — Graffold-backed, versioned

Content is **referenced, not inlined**:
- **Images/assets** live in an **S3 bucket managed by Graffold** (run locally). A module's `img` becomes an **asset reference** — so iterations are tracked (asset versioning); the page resolves the current (or pinned) version. *(Shipped seam: the string form `bucket:key@version`, resolved by `resolveAsset()` against `ASSET_BASE`. The `{ bucketKey, version }` object is the future/target shape.)* Swapping a photo = pointing the ref at a new version.
- **Text** is **markdown**, authored as files on the same bucket and **updated/pushed via the Graffold methodology/system** locally. A text module's content becomes a **markdown reference** — `{ bucketKey, version }` — rendered to HTML at load. (So content fields hold refs + versions; publishing = bumping the ref.)
- Same versioned, chunk-based discipline as Graffold's guides — the site's modules and Graffold's chunks share the pipeline.

### This site = Graffold's marketing front-end

The homepage/system **is the pitch**: it markets Graffold and demonstrates **how Doran Design Studio uses it**. So the **knowledge graph** — or snippets of it (the ontology graph already built for the About view) — becomes a **first-class module/view** here over time: a `graph` module wired to Graffold's chunk ↔ article ↔ product relationships, not just a static SVG. The site eating its own dog food (design system rendering itself, content served by Graffold) *is* the marketing.

**Build order (proposed):** (1) formalise content fields as **asset/markdown refs** (schema only — renderer resolves `{bucketKey, version}`); (2) an **Edit toggle + per-module edit affordance**, persisting to `localStorage` first as a Graffold stand-in; (3) swap the store for the **Graffold/S3 API** (assets + markdown, versioned); (4) embed the **live graph** module.

---

## Motion, interaction & the mobile model
<!--illus:graph-->

### Animation — ✅ Populate (chosen via slider test)

**Trigger:** selecting a category (e.g. *Assets*) transitions the card set out and a new set in.

**Chosen: Populate** — exit dissolves to scaffold dots, enter drops & settles from just above. Deliberately subtle: it fires on every nav click, so it shouldn't read as a feature. (Flip was tried and set aside as too much of a moment.)

**Locked:** ✅ staggered along the **reading order** (exit = reverse, enter = forward), **~280ms per card, ~160ms stagger spread → ~0.9s per full view swap** (exit then enter; `POP_DUR=280`, `POP_WINDOW=160`), `prefers-reduced-motion` → **instant swap** (view rebuilds with no transition — a plain crossfade was the earlier intent; instant is what shipped, see the checklist below).

**Key reframe — the scaffold is permanent, content is transient.** Cards are *overlaid on top of* the always-present dot scaffold. So "recede into scaffold" is literal: fade a card and the dots are already underneath — no hole, no flying object. This is why **flip is rejected** (a flip implies the card is hinged/fixed in its slot with the grid as its back — the opposite of swappable content).

**Standard UI spring:** all card / tab / pill transforms use one token — `0.26s cubic-bezier(.2,.9,.25,1.05)`. *(The journal metaball blob is the one exception at `0.45s` — the only slower spring.)*

**Primitive options being tested** (`grid-anim-test.html`, multi-position slider):
1. **Populate** ← recommended. Exit dissolves to scaffold dots; enter drops & settles from just above. Calm, truest to the concept.
2. **Drop** — exit visibly falls out; enter drops in. More literal/physical, busier per click.
3. **Fade** — plain staggered crossfade.
4. **Flip** — `rotateX`; included only to confirm it reads as "fixed." Likely out.
5. **Choreo** — fade → fall → slide-stack. Expressive but ~1.5–2.5s; reserve for first-load / reset only.

*Persistent-module FLIP glide was a design intent and is **not implemented** — the shipped Populate transition pops every module out and in. The hero Lottie survives the rebuild intact (its live SVG host is moved between builds to skip re-parsing the ~830KB animation) but still animates with the pop-out/pop-in, and the old in-grid nav group no longer exists (nav moved to the rail).*

### Mobile / touch model ✅ v3 (post-audit + phone review + top bar)

**This is a COMPUTER-FIRST website; the phone serves a more limited function.** The phone build is a lean companion, not a feature-parity port: no dragging, no editing, no hover-expand cards — the desktop is where the system performs. Phone rules (tablet explicitly out of scope):
- **TOP NAV BAR on narrow — all views.** On phones the rail leaves the side entirely and becomes a **48px horizontal bar across the top** (`body.narrow .stage { flex-direction: column }`; items lay out in a centred row, **icon-only — labels hidden (`.nav-label { display:none }`), glyph bumped to 24px**; bottom border instead of right border). Every horizontal pixel goes to the grid: `availW = vw` (no `RAIL_W` subtraction) and the vertical budget pays for it instead (`usable = vh − header − NAV_BAR_H(49)`). Net effect: **3 columns on a 390px phone instead of 2**. Still decided from viewport width *before* the column math (`vw − 88 < 846` → narrow), and `body.narrow` is toggled at the same early point so the CSS and the column math always agree. *(Supersedes the v2 "slim icon-only 52px side rail" — even icon-only, a side rail cost a whole column on phone widths.)*
- **Narrow branches are HEIGHT-AWARE** — content compresses to the rows available instead of silently dropping off the bottom (the old bounds-filter ate the home CTAs on 4-row iPhones and blanked landscape). Priority when rows run out: **CTAs > caption > hero size > hero**. Home stacks lottie (2×2→2×1→none) · caption · **tools as PURE ICON MARKS side-by-side** — no text, no arrow, just the mark (same language as the desktop float icons); **Generate Icons keeps its brand-blue card with a white mark**. *(An icon-over-title "app tile" variant was tried first — even that was too much chrome for a ~157px cell.)* Icons keeps the controls bar over the saved panel when only one row remains; about gives short screens the text and skips the graph. The `rows−=1` breathing-room rule is **desktop-only** (on a phone it stole a whole ~157px row into the footer).
- **The footer stays quiet.** Just the small centred mark; the grid's quantization leftover reads as scaffold, not as a content region. *(A "harness the footer with stats/Insight" variant was tried and rejected — cramped, duplicated the nav, and the stats were placeholder anyway.)* The `cols × rows · px` readout is debug telemetry — visible only with `#debug` in the URL.
- **Icons view on phone = the full generator, compact.** Saved set renders **dense: ¼-size tiles, 4 per grid cell** (2×2 sub-tiles; names read-only at that size, × always visible and proportionate). The inline toolbar **absorbs the set actions** — download-all + clear join shapes/scheme/colours as round `.cb-act` buttons (no floating pill on phone) — and the toolbar **wraps onto a second line** when the cell is tight.
- **Journal on phone = gallery → full-width reader + pinned BOTTOM media.** The gallery covers stack full-width (`w = cols`, 2 rows each). Reading: the article takes the full width with a `← Journal` back button in its header; the **pinned media panel docks as the BOTTOM row** (`journalmedia`, 1 row, hidden if only 2 rows fit) — same chunk-pinned swap behaviour as desktop, rotated under the text; the **metaball spine goes HORIZONTAL** (`.jr-toc-h`), centred on the media panel's top edge like a tab (bottom tucked 3px behind the panel), blob travels on `translateX`. No `journalindex` card on phone — the gallery *is* the index.
- **Touch interaction:** under `(hover: none)` the first **tap on an expandable card OPENS its drawer**, the second navigates; tapping outside collapses. Hover-revealed micro-controls (tile delete, in-situ minimize, download-all) are **always visible and ≥24px**; `reveal`-style tool cards show their labels. `touch-action: none` on draggable cards / the colour wheel, `pan-y` on internal scrollables; drawers and lists are **excluded from the drag handle** (they scroll).
- **Pointer safety:** one drag at a time; `pointerId`-guarded move/up (a second finger can't hijack or commit); `pointercancel`/mid-drag-rebuild **abort cleanly** via `abortDrag()` (nothing persisted); a **zero-movement tap persists nothing** (responsive defaults stay live); an **invalid drop onto a fixed obstacle** (quarter-cells, parked brain) reverts instead of overlapping.
- **Movement correctness:** hover-expand clamps its **row** as well as its column (bottom-row drawers shift up, not off-grid); the gravity pass **scans for a free slot instead of stacking** when a tall-window layout restores on a short window; eyebrow tags compute offsets against their **build-time cell** (`data-bc/br`) so they never drift; `startCardDrag` clears the shared expand timer (no mid-drag snap-back).
- **Perf:** resize takes a **light path** when view/cols/rows/cell are unchanged (iOS URL-bar jitter no longer rebuilds); the hero Lottie lives in a **persistent host** moved between builds (no 830KB re-parse), pauses on hidden tabs and views without it, and **respects `prefers-reduced-motion`** (meaningful still frame); in-situ renders are debounced + memoised (colour-wheel drags no longer run blocking physics per event).
- **A11y:** global `:focus-visible`; expandable cards are **focusable** (focus = hover-expand; Enter/Space activates; role button); nav gets `aria-current` + per-view `document.title`; material-icon ligatures are `aria-hidden`; `--t-low` darkened to `#6b6b6d` (≥4.5:1 at 9–10px); clickable infocards show `cursor:pointer`. Debug hotkeys (`m`/`h`) gated behind `#debug`.

---

## Open decisions / TODO
<!--skip-->

- [x] **Font:** ✅ Geist + Geist Mono
- [x] **Animation primitive:** ✅ Populate — **wired into the real prototype**. `transitionTo(view)` runs on every rail / logo / in-grid-CTA switch: content + shadow plates recede (pop-out, reverse reading order), the view rebuilds while the scaffold stays put, then new content drops & settles (pop-in, reading order). ~0.9s; rapid clicks **queue** (land on the last); resize stays instant; `prefers-reduced-motion` → instant. (`grid-anim-test.html` kept as the primitive sandbox.)
- [x] **Standard SET view:** ✅ built in `grid-system.html` — Lottie + caption + Pairwise + Generate Icons tool cards + stats, on Geist + low/med/high *(the original in-grid About/Contact cards moved to the nav rail)*
- [ ] Header/footer divider colour — soften to `#e1dfdb` or keep `#d9d7d3`?
- [ ] Icon set — Material Symbols Rounded (confirm, given font may drop rounded)
- [x] **About view** — ✅ scrollable ontology card + animated `graph-schema.svg` beside it. Opened by clicking **About**; the **logo returns home**.
- [x] **Scrollable text module** — ✅ `scrolltext` card (overflow-y scroll, styled scrollbar)
- [x] **Persistent site nav** — ✅ dedicated **left nav rail** (Home / About / Journal / Icons / Contact), nav removed from the grid. SPA: rail item → swap `view`, content centres. Logo + Home → home; Contact → centred contact card. *(More nav items — Work / Services / Guides — can be added; **five views live so far: home · about · journal · icons · contact**.)*
- [x] **Built (v1):** attention field + debug heatmap + emphasis-by-attention in `dynamic` mode (`m`/`h` toggles).
- [x] **Stats + graph as modules** — ✅ `stat` and `graph` kinds are live (home stats; About/journal graph).
- [x] **Blank journal media on entry-open** — ✅ fixed (`renderJournalMedia` now called post-mount in build's journal block, `isConnected`-guarded).
- [ ] **Deploy / launch:** `grid-system.html` still local — replace the old `index.html` and ship to Railway (`main` deploys); domain + redirects.
- [ ] **Hash / URL routing:** views are in-memory only (`location.hash` drives just `#debug`); add per-view hash routes + back-button support.
- [ ] **Case-study journal entries** (1–3 real engagements) — *needs Hugh*.
- [ ] **Founder / standards / pricing** copy + decisions — *needs Hugh*.
- [ ] Element-level **"super Swiss"** dot-snapping (1-unit padding done; per-element snapping pending).
- [ ] **Distribution v2:** Z/F auto-selection, monotonic reading path, saliency-driven placement, group-as-unit placement.

---

## Technical notes
<!--skip-->

- **Prototype:** `grid-system.html` (repo root) — local only, not deployed — shipping it means it **REPLACES** the current `index.html` (still the old 30KB homepage) as the Railway entrypoint; that swap + deploy is the open Launch item in the TODO.
- **Animation tester:** `grid-anim-test.html` — multi-position slider to compare transition primitives. Uses Geist; scaffold-dots are a permanent layer with content cards overlaid on top.
- **Lottie:** `HeroLottie5.js` = the animation JSON wrapped as `window.HERO_LOTTIE` so it works over `file://` (no fetch). Lottie reads `animationData`, falls back to `path`.
- **Shared tokens:** `styles.css` (`--canvas`, `--surface`, brand colours, etc.).
- **Live site:** `index.html` → GitHub `hughdoran1/dorandesignstudio` → **Railway** → dorandesign.studio. The **`main`** branch deploys. (Homepage experiments earlier were reverted on both `main` and `dev`.)
- **Dev server:** `python3 -m http.server 8000`.

---
