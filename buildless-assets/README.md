# Buildless Source Map

`buildless.html` uses native browser modules. No bundler or local dependency
installation is required.

| File | Responsibility |
| --- | --- |
| `landing.js` | Landing prism animation and model loading progress UI |
| `app.js` | Access gate, chat UI, Markdown/KaTeX rendering, and kernel dialog |
| `bonsai-adapter.js` | Model URL resolution, Hugging Face access-token requests, loading progress, and the UI-facing streaming chat contract |
| `landing.css`, `app.css` | Landing and chat styles |
| `config.js` | Runtime access-gate configuration |

The GPU implementation is loaded as pinned browser ESM from jsDelivr:

- `bitgpu@0.19.1/dist/index.js`: WebGPU inference engine
- `bitgpu@0.19.1/dist/gguf.js`: GGUF parser and Bonsai-27B model manifest adapter
- `bitgpu@0.19.1/dist/chat.js`: tokenizer, Jinja chat template, and streaming chat layer

The Kernels panel reads the static WGSL source catalogue from the same pinned
`bitgpu` distribution after the model loads. Public `bitgpu` does not expose
browser-specific compiled-pipeline variants.

The source for the pinned runtime is available at
<https://github.com/stfurkan/bitgpu/tree/v0.19.1/src>. The prior self-contained
bundle is preserved in commit `b7eac7e` and is no longer loaded by the page.
