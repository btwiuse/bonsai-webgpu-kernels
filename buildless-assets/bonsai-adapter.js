// Browser-facing adapter around the published bitgpu runtime.
//
// Keeping this layer local makes the app's model URL, Hugging Face token handling,
// and UI stream contract explicit while the GPU implementation stays version-pinned on CDN.
import { createEngine } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/index.js";
import { createChat } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/chat.js";
import { fromGguf } from "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/gguf.js";
import {
  BONSAI_27B,
  resolveGgufUrl,
  tokenizerDirectory,
} from "./model-catalog.js";
import { createModelFetch } from "./model-fetch.js";
import { streamChatEvents } from "./chat-events.js";

export const DEFAULT_MODEL_ID = BONSAI_27B.id;
export const DEFAULT_GGUF_FILE = BONSAI_27B.ggufFile;
export { resolveGgufUrl as resolveGGUFUrl } from "./model-catalog.js";

const DEFAULT_CONTEXT_LENGTH = 4096;
const BITGPU_ENGINE_URL =
  "https://cdn.jsdelivr.net/npm/bitgpu@0.19.1/dist/index.js";

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

async function loadKernelSources() {
  try {
    const source = await (await fetch(BITGPU_ENGINE_URL)).text();
    const declaration = "const SHADERS = ";
    const start = source.indexOf(declaration);
    if (start < 0) return [];

    const objectStart = source.indexOf("{", start + declaration.length);
    let depth = 0;
    let quote = null;
    let escaped = false;
    let objectEnd = -1;

    // The pinned distribution holds the WGSL catalogue in one JavaScript object.
    // Scan string literals so braces in shader source do not end the object early.
    for (let index = objectStart; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}" && --depth === 0) {
        objectEnd = index;
        break;
      }
    }
    if (objectEnd < 0) return [];

    const shaderObject = Function(
      `"use strict"; ${source.slice(start, objectEnd + 1)}; return SHADERS;`,
    )();
    return Object.entries(shaderObject).map(([name, shaderSource]) => ({
      name,
      source: shaderSource,
    }));
  } catch {
    return [];
  }
}

class BonsaiChat {
  constructor(engine, nativeChat, kernelSources) {
    this.engine = engine;
    this.nativeChat = nativeChat;
    this.contextLength = engine.capabilities.maxSeqLen;
    this.contextFull = false;
    this.lastAssistantContent = null;

    // bitgpu keeps the source catalogue private, so expose the pinned distribution's WGSL
    // source table through the UI's existing kernel inspector contract.
    this.runtime = { getRenderedShaders: () => kernelSources };
  }

  reset() {
    this.nativeChat.reset();
    this.contextFull = false;
    this.lastAssistantContent = null;
  }

  async *streamTurn(messages, options = {}) {
    try {
      for await (const event of streamChatEvents(
        this.nativeChat,
        messages,
        options,
      )) {
        if (event.type === "complete") {
          this.lastAssistantContent = event.result.text;
        }
        yield event;
      }
    } catch (error) {
      if (/maxSeqLen|context/i.test(String(error?.message ?? error))) {
        this.contextFull = true;
      }
      throw error;
    }
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
    const ggufUrl = resolveGgufUrl(source, options.file);
    const request = createModelFetch({
      accessToken: options.accessToken,
      cache: options.cache,
      signal: options.signal,
    });

    onProgress({ status: "init", message: "Parsing GGUF header" });
    const gguf = await fromGguf(ggufUrl, {
      fetchRange: request.fetchRange,
    });

    onProgress({ status: "init", message: "Requesting WebGPU device" });
    const engine = await createEngine({
      ...gguf,
      dataUrl: ggufUrl,
      maxSeqLen: options.maxLength ?? DEFAULT_CONTEXT_LENGTH,
      kvCache: "q8",
      onProgress: createProgressReporter(onProgress),
      fetchStream: request.fetchStream,
    });

    onProgress({ status: "tokenizer", message: "Loading tokenizer" });
    const nativeChat = await createChat(engine, {
      modelUrl: tokenizerDirectory(source, ggufUrl),
      fetchJson: request.fetchJson,
    });

    const kernelSources = await loadKernelSources();
    onProgress({ status: "ready", message: "Ready", fraction: 1 });
    return new BonsaiChat(engine, nativeChat, kernelSources);
  }
}

export default Bonsai27B;
