# Buildless Source Map

`buildless.html` uses native browser modules. No bundler or local dependency
installation is required.

## Layout

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
└── ui/           global / landing / access-gate stylesheets
```

| Path                             | Responsibility                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/core/config.js`             | Runtime access-gate configuration                                                                                     |
| `src/core/loader.js`             | Landing-stage state and model loading progress UI                                                                     |
| `src/core/app.js`                | Chat session state and UI orchestration                                                                               |
| `src/scenes/background.js`       | Ambient Three.js backdrop                                                                                             |
| `src/scenes/prism/*.js`          | Landing prism Three.js scene and handoff cleanup (14 modules)                                                         |
| `src/scenes/garden/*.js`         | Post-load garden Three.js scene (8 modules)                                                                           |
| `src/chat/events.js`             | Typed UI events over bitgpu's chat stream                                                                             |
| `src/chat/markdown.js`           | Incremental Markdown and KaTeX answer rendering                                                                       |
| `src/model/access.js`            | Access gate, WebGPU availability checks, and model load lifecycle                                                     |
| `src/model/catalog.js`           | Model weights, tokenizer, and generation metadata                                                                     |
| `src/model/fetch.js`             | Authenticated GGUF requests and optional Cache Storage integration                                                    |
| `src/model/worker.js`            | Module Worker hosting the bitgpu runtime                                                                              |
| `src/model/bonsai-client.js`     | Main-thread facade for the Worker                                                                                     |
| `src/model/adapter.js`           | Model URL resolution, Hugging Face access-token requests, loading progress, and the UI-facing streaming chat contract |
| `src/model/kernel/sources.js`    | WGSL kernel-source catalogue                                                                                          |
| `src/model/kernel/inspector.js`  | Kernel-source dialog and search UI                                                                                    |
| `src/ui/landing.css`             | Landing composition and transition styles                                                                             |
| `src/ui/access-gate.css`         | Hugging Face access-gate styles                                                                                       |
| `src/ui/app.css`                 | Shared overrides and final responsive rules                                                                           |
| `src/chat/*.css`                 | Chat layout, messages, composer, and Markdown styles (one file per region)                                            |
| `src/model/kernel/inspector.css` | Kernel-source dialog styles                                                                                           |

## Structure and conventions

Every function in these modules stays under 50 lines, with one responsibility
per function. Larger stateful pieces are organized as small classes:

- `ModelAccess` in `model/access.js` owns the access gate, token validation, and
  the load lifecycle; `setupModelAccess()` wires events and boots the page.
- `KernelInspector` in `model/kernel/inspector.js` owns the kernel-source
  dialog; the WGSL highlighter and its keyword/type tables live at module scope.
- `TreeBuilder` in `scenes/garden/tree.js` grows the seeded bonsai tree; each
  build step (roots, moss, branches, canopy, pad scheduling) is one method.
- `GardenScene` in `scenes/garden/class.js` owns the post-load bonsai animation
  (growth, petals, wind, and camera); `BackgroundScene` in `scenes/background.js`
  and `PrismScene` in `scenes/prism/class.js` own their respective scenes.

The chat turn in `core/app.js` is driven by a small state object: `createTurnState()`
builds the message, `consumeTurnEvent()` applies stream events, and
`finishTurn()` finalizes meta, history, and context-full handling. Scene classes
are composed from per-topic method mixins via `Object.assign(prototype, …)` so
each topic lives in its own focused file.

The GPU implementation is loaded as pinned browser ESM from jsDelivr:

- `bitgpu@0.19.1/dist/index.js`: WebGPU inference engine
- `bitgpu@0.19.1/dist/gguf.js`: GGUF parser and Bonsai-27B model manifest
  adapter
- `bitgpu@0.19.1/dist/chat.js`: tokenizer, Jinja chat template, and streaming
  chat layer

For its default model, the page also reads bitgpu's pinned, GPU-validated
`models/bonsai-27b-gguf/manifest.json` and auxiliary lookup table from jsDelivr.
The 3.8 GB GGUF still streams directly from Hugging Face. A custom `?src=` GGUF
continues to use bitgpu's browser-side GGUF parser.

The answer renderer also loads pinned browser ESM from esm.sh: `marked@17`,
`katex@0.16`, and `dompurify@3.2.6`. DOMPurify sanitizes generated Markdown
before it is inserted into the page.

`Bonsai-27B` requests bitgpu's `q8` KV cache and `f16` activation path. The
runtime falls back safely when `shader-f16` is unavailable. Its pinned Qwen3.5
hybrid backbone does not support bitgpu's `overflow: "sinks"` policy, so this
page retains strict context-window errors rather than exposing an invalid
fixed-memory option.

For the default Bonsai-27B model, each turn uses bitgpu's upstream recommended
sampling settings: `temperature: 0.5`, `topP: 0.85`, and `topK: 20`. Custom
`?src=` GGUF URLs retain bitgpu's own defaults unless their caller supplies turn
options.

Thinking is opt-in per turn (the composer bulb). Two query parameters add
optional bounds without changing default behavior:

- `?thinkBudget=N` forces bitgpu to close `</think>` after N reasoning tokens.
- `?thinkEarlyStop` enables bitgpu's logit-confidence early stop for thinking
  (`?thinkEarlyStop=off` explicitly disables it).

Both are candidate-filter features in bitgpu@0.19.1 and work on the pinned
Qwen3.5 hybrid backbone. They are deliberately not part of the default page: the
original page never bounded reasoning, so default turns stay equivalent.

Evaluated and not integrated: `chat.save/restore` snapshots are full KV-cache
serializations (heavy for a 4096-token q8 cache on a 27B hybrid), and delta
snapshots (`prewarm` + `save({ delta: true })`) are explicitly rejected by the
engine for the qwen3_5 hybrid backbone; `prewarm` alone only serves that
checkpointing pattern; `countTokens` has no original-page UI equivalent that
would not change existing behavior. `promptLookup` is left disabled because the
hybrid backbone rejects it and the page never forwards it.

Add `?runtime=worker` to host bitgpu in a module Worker, following bitgpu's
worker example. This is opt-in because Worker WebGPU availability differs by
browser; the default keeps the broadly compatible main-thread runtime.

The Kernels panel reads static WGSL files lazily from the same pinned `bitgpu`
source tag on jsDelivr. Public `bitgpu` does not expose browser-specific
compiled-pipeline variants, so the displayed code is the pinned source catalogue
rather than a serialization of live pipelines.

The source for the pinned runtime is available at
<https://github.com/stfurkan/bitgpu/tree/v0.19.1/src>. The prior self-contained
bundle is preserved in commit `b7eac7e` and is no longer loaded by the page.
