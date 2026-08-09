// Browser-facing adapter around the published bitgpu runtime.
//
// Keeping this layer local makes the app's model URL, Hugging Face token handling,
// and UI stream contract explicit while the GPU implementation stays version-pinned on CDN.
import { createEngine } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/index.js";
import { createChat } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/chat.js";
import { fromGguf } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/gguf.js";

export const DEFAULT_MODEL_ID = "prism-ml/Bonsai-27B-gguf";
export const DEFAULT_GGUF_FILE = "Bonsai-27B-Q1_0.gguf";

const DEFAULT_CONTEXT_LENGTH = 4096;

function isHttpUrl(value) {
  return /^https?:/i.test(value);
}

export function resolveGGUFUrl(
  source = DEFAULT_MODEL_ID,
  file = DEFAULT_GGUF_FILE,
  revision = "main",
) {
  if (source.toLowerCase().endsWith(".gguf")) {
    return isHttpUrl(source) ? source : new URL(source, location.href).href;
  }

  return `https://huggingface.co/${source}/resolve/${revision}/${file}`;
}

function modelDirectory(ggufUrl) {
  return ggufUrl.slice(0, ggufUrl.lastIndexOf("/"));
}

function makeAuthenticatedFetch(accessToken, signal) {
  return async (url, init = {}) => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(url, { ...init, headers, signal });
    if (!response.ok) {
      throw new Error(`Request for ${url} failed: HTTP ${response.status}`);
    }
    return response;
  };
}

function createProgressReporter(onProgress) {
  return (progress) => {
    if (progress.phase === "weights" && Number.isFinite(progress.loaded)) {
      onProgress({
        status: "weights",
        kind: "bytes",
        loaded: progress.loaded,
        total: progress.total ?? null,
        message: "Streaming weights",
      });
      return;
    }

    if (progress.phase === "pipelines") {
      onProgress({
        status: "weights",
        kind: "tensors",
        message: "Compiling WebGPU kernels",
      });
    }
  };
}

class BonsaiChat {
  constructor(engine, nativeChat) {
    this.engine = engine;
    this.nativeChat = nativeChat;
    this.contextLength = engine.capabilities.maxSeqLen;
    this.contextFull = false;
    this.lastAssistantContent = null;
    this.chatTemplateArgs = {};
    this.thinkCloseTokenId = nativeChat.tokenizer.tokenToId("</think>") ?? null;

    // The public bitgpu API intentionally does not expose compiled pipeline sources.
    // The UI tolerates an empty list and continues to provide the kernel panel shell.
    this.runtime = { getRenderedShaders: () => [] };
  }

  reset() {
    this.nativeChat.reset();
    this.contextFull = false;
    this.lastAssistantContent = null;
  }

  async *generate(messages, { signal } = {}) {
    const thinkingEnabled = this.chatTemplateArgs.enable_thinking === true;
    const events = [];
    let wake = null;
    let finished = false;
    let failure = null;
    let sentThinkClose = !thinkingEnabled;

    const push = (event) => {
      events.push(event);
      wake?.();
      wake = null;
    };

    const producer = (async () => {
      try {
        const stream = this.nativeChat.stream(messages, {
          signal,
          think: thinkingEnabled,
          onThink: (delta) => {
            if (delta) push({ token: 1, delta });
          },
        });

        let result;
        for (;;) {
          const next = await stream.next();
          if (next.done) {
            result = next.value;
            break;
          }

          if (!sentThinkClose) {
            push({ token: this.thinkCloseTokenId, delta: "" });
            sentThinkClose = true;
          }
          if (next.value) push({ token: 1, delta: next.value });
        }

        if (!sentThinkClose) push({ token: this.thinkCloseTokenId, delta: "" });
        this.lastAssistantContent = result.text;
      } catch (error) {
        if (/maxSeqLen|context/i.test(String(error?.message ?? error))) {
          this.contextFull = true;
        }
        failure = error;
      } finally {
        finished = true;
        wake?.();
        wake = null;
      }
    })();

    while (!finished || events.length > 0) {
      if (events.length > 0) {
        yield events.shift();
      } else {
        await new Promise((resolve) => {
          wake = resolve;
        });
      }
    }

    await producer;
    if (failure) throw failure;
  }
}

export class Bonsai27B {
  static async checkAvailability() {
    if (!navigator.gpu) {
      return {
        ok: false,
        reason:
          "WebGPU isn't available in this browser. Try a recent Chrome or Edge.",
      };
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      return {
        ok: false,
        reason: "No WebGPU adapter is available on this device.",
      };
    }
    return { ok: true };
  }

  static async load(source = DEFAULT_MODEL_ID, options = {}) {
    const onProgress = options.onProgress ?? (() => {});
    const ggufUrl = resolveGGUFUrl(source, options.file, options.revision);
    const request = makeAuthenticatedFetch(options.accessToken, options.signal);

    onProgress({ status: "init", message: "Parsing GGUF header" });
    const gguf = await fromGguf(ggufUrl, {
      fetchRange: async (url, offset, length) => {
        const response = await request(url, {
          headers: { Range: `bytes=${offset}-${offset + length - 1}` },
        });
        return response.arrayBuffer();
      },
    });

    onProgress({ status: "init", message: "Requesting WebGPU device" });
    const engine = await createEngine({
      ...gguf,
      dataUrl: ggufUrl,
      maxSeqLen: options.maxLength ?? DEFAULT_CONTEXT_LENGTH,
      kvCache: "q8",
      onProgress: createProgressReporter(onProgress),
      fetchStream: async (url) => {
        const response = await request(url);
        if (!response.body)
          throw new Error(`Response body for ${url} is unavailable.`);
        return response.body;
      },
    });

    onProgress({ status: "tokenizer", message: "Loading tokenizer" });
    const nativeChat = await createChat(engine, {
      modelUrl: modelDirectory(ggufUrl),
      fetchJson: async (url) => (await request(url)).json(),
    });

    onProgress({ status: "ready", message: "Ready", fraction: 1 });
    return new BonsaiChat(engine, nativeChat);
  }
}

export default Bonsai27B;
