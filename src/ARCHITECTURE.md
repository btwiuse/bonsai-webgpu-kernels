# Architecture

This directory ships the **buildless** variant of the landing page: a
single `buildless.html` plus a flat folder of small, hand-readable
modules — no bundler, no transpiler, no source maps to chase.

The split is structured so each file tells **one story** in ~30 seconds.
Large concerns (two Three.js scenes, a chat surface, a kernel
inspector, a worker for the model) live as a set of focused modules
rather than a single 1,000+ line monolith.

---

## Directory layout

```
src/
├── core/         framework-level: config, loader, app controller
├── scenes/       Three.js scenes
│   ├── background.js
│   ├── prism/    14 focused modules — utils → constants → optics → ...
│   └── garden/    8 focused modules — utils → assets → ...
├── chat/         chat surface — events, markdown renderer, region CSS
├── model/        model access + WebGPU kernel
│   └── kernel/   kernel sources + kernel inspector (UI + JS)
├── ui/           global / landing / access-gate stylesheets
├── deno.json     fmt + lint tasks
├── ARCHITECTURE.md
└── README.md
```

File names drop the redundant prefix that the directory already
provides — `scenes/prism/utils.js`, not `scenes/prism/scene-prism-utils.js`.

---

## Boot order

`buildless.html` is the single entry. Script and link tags must load in
this exact order — each later script assumes the earlier ones have
already attached their globals.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. src/core/config.js              (plain script, runs synchronously)    │
│    → reads URL params, sets App / __BONSAI_HOLD_LANDING / etc.           │
│                                                                          │
│ 2. three.min.js                    (CDN, plain script)                    │
│    → defines global `THREE`                                            │
│                                                                          │
│ 3. src/core/loader.js              (plain script, runs synchronously)    │
│    → exposes window.{SEED, FREEZE, REDUCED, AZ_FIX, START_STAGE,         │
│                     QS, state, byId, simulate, stepProgress,             │
│                     updateDom, SPEED, App, BonsaiLoader}                  │
│                                                                          │
│ 4. src/scenes/background.js        (ES module)                           │
│    → paints the always-on sceneBG canvas                                 │
│                                                                          │
│ 5. src/scenes/prism/index.js       (ES module)                           │
│    → on landing stage: instantiates PrismScene                          │
│    → always: assigns App.bootLanding so model-access can fire it         │
│                                                                          │
│ 6. src/scenes/garden/index.js      (ES module)                           │
│    → always: constructs GardenScene (wired into App.startGarden)        │
│    → on loading stage: flips body class and starts the grow animation   │
│                                                                          │
│ 7. src/core/app.js                 (ES module)                           │
│    → boots chat events, kernel inspector, model access, mode toggles    │
└──────────────────────────────────────────────────────────────────────────┘
```

Style sheets (`src/ui/landing.css`, `src/ui/access-gate.css`,
`src/chat/*.css`, `src/model/kernel/inspector.css`, `src/ui/app.css`)
load in parallel with the scripts; order between CSS files does not
matter, but they must precede any module that touches relevant DOM
nodes.

---

## Module dependency graph

Three.js scene modules are organized around **classes that compose
mixins by topic** (`Object.assign(prototype, MethodMixins)`), with
single-purpose helper modules feeding pure-math primitives up the
chain.

### Prism scene — `src/scenes/prism/`

```
utils.js                    ─── pure numeric helpers (clamp, hermite, SPD)
        ▲
        │
constants.js                ─── scene-wide counts and geometry numbers
        ▲
        │
optics.js                   ─── Cauchy dispersion + spectral color
        ▲
        │                          ┌──────────────────────────────┐
textures.js                 ──┐  │ trace.js                     │
shaders.js                  ──┼──│   2D ray-trace primitives    │
geometry.js                 ──┘  └──────────────────────────────┘
        ▲                              ▲            ▲
        │                              │            │
        │              ┌───────────────┘            │
        │              │                            │
trace-methods.js        ── trace / castRay / column writers
update.js                ── per-column updates + optics
pulse.js                 ── pulse palette helper
        ▲
        │
init.js                   ── constructor + 14 init*() methods
frame.js                  ── drag / resize / animate
        ▲
        │
class.js                  ── composes PrismScene + bootPrismScene
        ▲
        │
index.js                  ── entry: wires App.bootLanding, decides
                              whether to boot immediately
```

### Garden scene — `src/scenes/garden/`

```
utils.js                   ─── TAU / Vector3 / clamp / lerp / Mulberry32
        ▲
        │
assets.js                  ─── canvas textures, palette, shared mat
        ▲
        │
blossom.js                 ─── blossom cloud packing (one tpl)
tree.js                    ─── TreeBuilder algorithm
        ▲
        │
init.js                    ─── renderer / lights / props / tree / petals
update.js                  ─── per-frame updates + animate
        ▲
        │
class.js                   ─── composes GardenScene
        ▲
        │
index.js                   ─── entry: constructs scene, wires startGarden
```

### Background

`src/scenes/background.js` is self-contained — the always-on glow + word
layer. No mixins; one file because the whole behaviour is one canvas.

---

## Naming conventions

| Kind           | Pattern                | Example                            |
| -------------- | ---------------------- | ---------------------------------- |
| Three.js scene | `scenes/<name>/*.js`   | `scenes/prism/init.js`             |
| Top-level mod. | `<dir>/<role>.js`      | `core/loader.js`, `chat/events.js` |
| Worker         | `model/<role>.js`      | `model/worker.js`                  |
| Stylesheet     | `<dir>/<part>.css`     | `chat/message.css`                 |
| Class export   | `<Role>`               | `PrismScene`, `GardenScene`        |
| Method group   | `<Role><Topic>Methods` | `PrismInitMethods`                 |
| Boot helper    | `boot<Scene>`          | `bootPrismScene`                   |
| Module entry   | `index.js`             | `scenes/prism/index.js`            |

The directory already says `scenes/` and `prism/`, so the file name
stays short — `scenes/prism/utils.js`, not
`scenes/prism/scene-prism-utils.js`.

---

## The "50-line rule" — spirit, not letter

Each file should tell one story, readable end-to-end in ~30 seconds.
A handful of files legitimately exceed because they hold _one_ cohesive
artefact that cannot be cleanly cut without inventing fake seams:

| File                            | Lines | Reason it stays whole                              |
| ------------------------------- | ----- | -------------------------------------------------- |
| `scenes/prism/shaders.js`       | ~122  | GLSL strings must be contiguous to read            |
| `scenes/prism/init.js`          | ~393  | 14 publicly-named `init*` methods, IDE-foldable    |
| `scenes/garden/tree.js`         | ~457  | TreeBuilder is a single recursive algorithm        |
| `core/app.js`                   | ~419  | Top-level app controller; one user-visible surface |
| `scenes/prism/trace-methods.js` | ~280  | The `trace()` family is one computation graph      |
| `scenes/garden/init.js`         | ~289  | Same init-cluster rationale as the prism scene     |
| `scenes/prism/geometry.js`      | ~180  | One geometry/material factory                      |
| `scenes/prism/update.js`        | ~218  | Per-frame update cluster                           |
| `scenes/garden/update.js`       | ~261  | Per-frame update cluster                           |
| `scenes/background.js`          | ~242  | One canvas, two passes                             |

Everything else is under 200 lines and most under 100.

When adding new code: prefer a new file over padding an existing one.
If the new code is "another method on an existing class", put it in
the right `init.js` / `update.js` / `frame.js` mixin rather than
inflating the class file.

---

## Globals contract

Only `src/core/loader.js` writes to `window`. Scene modules are
readers. The full surface that ES modules may read off `window`:

| Name                                                     | Set by         | Meaning                                       |
| -------------------------------------------------------- | -------------- | --------------------------------------------- |
| `THREE`                                                  | `three.min.js` | The library                                   |
| `App`                                                    | `loader.js`    | `{ bootLanding, startGarden, flatMode, ... }` |
| `BonsaiLoader`                                           | `loader.js`    | Loading stage façade                          |
| `SEED`                                                   | `loader.js`    | RNG seed (from URL or default)                |
| `FREEZE`                                                 | `loader.js`    | `null` or timestamp — pause animation         |
| `REDUCED`                                                | `loader.js`    | `true` if the user wants reduced motion       |
| `AZ_FIX`                                                 | `loader.js`    | Pin to azimuth 0 (deterministic first frame)  |
| `START_STAGE`                                            | `loader.js`    | `"landing"` or `"loading"`                    |
| `QS`                                                     | `loader.js`    | Parsed URLSearchParams                        |
| `state`                                                  | `loader.js`    | `{ reduced, ... }` runtime flags              |
| `byId`, `simulate`, `stepProgress`, `updateDom`, `SPEED` | `loader.js`    | helpers used by the loading stage             |

`__BONSAI_HOLD_LANDING` is set by `src/core/config.js` and read by
`src/scenes/prism/index.js`; nothing else should touch it.

---

## CSS layout

Chat CSS is split by **region**, not by feature, so a new class can be
added next to its peers:

| File                    | Region                                           |
| ----------------------- | ------------------------------------------------ |
| `src/chat/shell.css`    | overlay shell + scroll track + `.kx` shared rule |
| `src/chat/header.css`   | top bar (header, status, buttons)                |
| `src/chat/thread.css`   | scroll column + welcome card                     |
| `src/chat/message.css`  | per-message row (msg, bubble, caret, meta)       |
| `src/chat/markdown.css` | assistant body (thinking block + markdown)       |
| `src/chat/composer.css` | input row (field, send/stop, bulb, tip)          |

Keyframe definitions live in the file that **owns** the animated
selector (`cPulse` in `chat/header.css`, `cRise` in `chat/message.css`
because every message uses it, `tShimmer` and `aBlink` next to their
respective selectors).

Other stylesheets:

| File                             | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `src/ui/landing.css`             | Landing page chrome (canvas overlays)  |
| `src/ui/access-gate.css`         | Token gate dialog                      |
| `src/ui/app.css`                 | Global resets / typography / utilities |
| `src/model/kernel/inspector.css` | Kernel inspector overlay               |

---

## Tasks

`src/deno.json` pins the formatter:

```
deno task fmt         # format everything in src/
deno task fmt-check   # dry-run, exit 1 if anything's off
deno task lint        # deno lint (advisory; hints, not a gate)
```
