# Buildless Assets — Architecture

This directory ships the **buildless** variant of the landing page: a single
`buildless.html` plus a flat folder of small, hand-readable modules — no
bundler, no transpiler, no source maps to chase.

The split is structured so each file tells **one story** in ~30 seconds. Large
concerns (two Three.js scenes, a chat surface, a kernel inspector, a worker for
the model) live as a set of focused modules rather than a single 1,000+ line
monolith.

---

## Boot order

`buildless.html` is the single entry. Script and link tags must load in this
exact order — each later script assumes the earlier ones have already attached
their globals.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. config.js                       (plain script, runs synchronously)    │
│    → reads URL params, sets App / __BONSAI_HOLD_LANDING / etc.           │
│                                                                          │
│ 2. three.min.js                    (CDN, plain script)                    │
│    → defines global `THREE`                                            │
│                                                                          │
│ 3. loader.js                       (plain script, runs synchronously)    │
│    → exposes window.{SEED, FREEZE, REDUCED, AZ_FIX, START_STAGE,         │
│                     QS, state, byId, simulate, stepProgress,             │
│                     updateDom, SPEED, App, BonsaiLoader}                  │
│                                                                          │
│ 4. scene-background.js             (ES module)                           │
│    → paints the always-on sceneBG canvas                                 │
│                                                                          │
│ 5. scene-prism-index.js            (ES module)                           │
│    → on landing stage: instantiates PrismScene                          │
│    → always: assigns App.bootLanding so model-access can fire it         │
│                                                                          │
│ 6. scene-garden-index.js           (ES module)                           │
│    → always: constructs GardenScene (wired into App.startGarden)        │
│    → on loading stage: flips body class and starts the grow animation   │
│                                                                          │
│ 7. app.js                          (ES module)                           │
│    → boots chat events, kernel inspector, model access, mode toggles    │
└──────────────────────────────────────────────────────────────────────────┘
```

Style sheets (`landing.css`, `access-gate.css`, `chat-shell.css`,
`chat-header.css`, `chat-thread.css`, `chat-message.css`, `chat-markdown.css`,
`chat-composer.css`, `kernel-inspector.css`, `app.css`) load in parallel with
the scripts; order between CSS files does not matter, but they must precede any
module that touches relevant DOM nodes.

---

## Module dependency graph

Three.js scene modules are organized around **classes that compose mixins by
topic** (`Object.assign(prototype, MethodMixins)`), with single-purpose helper
modules feeding pure-math primitives up the chain.

### Prism scene

```
scene-prism-utils.js          ─── pure numeric helpers (clamp, hermite, SPD)
        ▲
        │
scene-prism-constants.js      ─── scene-wide counts and geometry numbers
        ▲
        │
scene-prism-optics.js         ─── Cauchy dispersion + spectral color
        ▲
        │                          ┌──────────────────────────────┐
scene-prism-textures.js       ──┐  │ scene-prism-trace.js         │
scene-prism-shaders.js        ──┼──│   2D ray-trace primitives    │
scene-prism-geometry.js       ──┘  └──────────────────────────────┘
        ▲                              ▲            ▲
        │                              │            │
        │              ┌───────────────┘            │
        │              │                            │
scene-prism-trace-methods.js   ── trace / castRay / column writers
scene-prism-update.js          ── per-column updates + optics
scene-prism-pulse.js           ── pulse palette helper
        ▲
        │
scene-prism-init.js            ── constructor + 14 init*() methods
scene-prism-frame.js           ── drag / resize / animate
        ▲
        │
scene-prism-class.js           ── composes PrismScene + bootPrismScene
        ▲
        │
scene-prism-index.js           ── entry: wires App.bootLanding, decides
                                   whether to boot immediately
```

### Garden scene

```
scene-garden-utils.js          ─── TAU / Vector3 / clamp / lerp / Mulberry32
        ▲
        │
scene-garden-assets.js         ─── canvas textures, palette, shared mat
        ▲
        │
scene-garden-blossom.js        ─── blossom cloud packing (one tpl)
scene-garden-tree.js           ─── TreeBuilder algorithm
        ▲
        │
scene-garden-init.js           ─── renderer / lights / props / tree / petals
scene-garden-update.js         ─── per-frame updates + animate
        ▲
        │
scene-garden-class.js          ─── composes GardenScene
        ▲
        │
scene-garden-index.js          ─── entry: constructs scene, wires startGarden
```

### Background

`scene-background.js` is self-contained — the always-on glow + word layer. No
mixins; one file because the whole behaviour is one canvas.

---

## Naming conventions

| Kind           | Pattern                | Example                     |
| -------------- | ---------------------- | --------------------------- |
| Three.js scene | `scene-<role>-*.js`    | `scene-prism-init.js`       |
| Top-level mod. | `<role>.js`            | `app.js`, `loader.js`       |
| Worker         | `<role>.js`            | `model-worker.js`           |
| Stylesheet     | `<role>-<part>.css`    | `chat-message.css`          |
| Class export   | `<Role>`               | `PrismScene`, `GardenScene` |
| Method group   | `<Role><Topic>Methods` | `PrismInitMethods`          |
| Boot helper    | `boot<Scene>`          | `bootPrismScene`            |
| Module entry   | `*-index.js`           | `scene-prism-index.js`      |

The `scene-` prefix is uniform across `background`, `prism`, and `garden` so a
single grep (`scene-*`) lists every Three.js concern.

---

## The "50-line rule" — spirit, not letter

Each file should tell one story, readable end-to-end in ~30 seconds. A handful
of files legitimately exceed because they hold _one_ cohesive artefact that
cannot be cleanly cut without inventing fake seams:

| File                           | Lines | Reason it stays whole                              |
| ------------------------------ | ----- | -------------------------------------------------- |
| `scene-prism-shaders.js`       | ~122  | GLSL strings must be contiguous to read            |
| `scene-prism-init.js`          | ~393  | 14 publicly-named `init*` methods, IDE-foldable    |
| `scene-garden-tree.js`         | ~457  | TreeBuilder is a single recursive algorithm        |
| `app.js`                       | ~419  | Top-level app controller; one user-visible surface |
| `scene-prism-trace-methods.js` | ~280  | The `trace()` family is one computation graph      |
| `scene-garden-init.js`         | ~289  | Same init-cluster rationale as the prism scene     |
| `scene-prism-geometry.js`      | ~180  | One geometry/material factory                      |
| `scene-prism-update.js`        | ~218  | Per-frame update cluster                           |
| `scene-garden-update.js`       | ~261  | Per-frame update cluster                           |
| `scene-background.js`          | ~242  | One canvas, two passes                             |

Everything else is under 200 lines and most under 100.

When adding new code: prefer a new file over padding an existing one. If the new
code is "another method on an existing class", put it in the right `*-init.js` /
`*-update.js` / `*-frame.js` mixin rather than inflating the class file.

---

## Globals contract

Only `loader.js` writes to `window`. Scene modules are readers. The full surface
that ES modules may read off `window`:

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

`__BONSAI_HOLD_LANDING` is set by `config.js` and read by
`scene-prism-index.js`; nothing else should touch it.

---

## CSS layout

Chat CSS is split by **region**, not by feature, so a new class can be added
next to its peers:

| File                | Region                                                    |
| ------------------- | --------------------------------------------------------- |
| `chat-shell.css`    | `#chatx` overlay shell + scroll track + `.kx` shared rule |
| `chat-header.css`   | top bar (`.c-head*`, `.c-status*`, `.c-btn*`)             |
| `chat-thread.css`   | scroll column + welcome card (`.c-thread`, `.c-welcome*`) |
| `chat-message.css`  | per-message row (`.c-msg*`, `.u-bubble`, caret, meta)     |
| `chat-markdown.css` | assistant body (`.t-*` thinking block + `.a-body` md)     |
| `chat-composer.css` | input row (`.c-field`, send/stop, bulb, tip)              |

Keyframe definitions live in the file that **owns** the animated selector
(`cPulse` in `chat-header.css`, `cRise` in `chat-message.css` because every
message uses it, `tShimmer` and `aBlink` next to their respective selectors).
