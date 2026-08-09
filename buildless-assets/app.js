import { Bonsai27B, DEFAULT_GGUF_FILE } from "./bonsai-adapter.js";

const $ = (id2) => document.getElementById(id2);
const QSA = new URLSearchParams(location.search);
const REQUIRE_HF_TOKEN = window.BONSAI_REQUIRE_HF_TOKEN === true;
const MODEL_ID = "prism-ml/Bonsai-27B-gguf";
const MODEL_SRC = QSA.get("src") || MODEL_ID;
const TOKEN_KEY = "bonsai27b_hf_token_v1";
const TOTAL_BYTES_FALLBACK = 38e8;
let chat = null;
let loadState = "idle";
let loadBlocked = false;
let accessToken = null;
let messages = [];
let isGenerating = false;
let contextExhausted = false;
let abortController = null;
let reauthAfterGate = false;
const SEED_EXAMPLES = [
  {
    label: "LOGIC PUZZLE",
    prompt:
      "You have three boxes labeled Apples, Oranges, and Mixed. Every label is wrong.\n\nYou may take one fruit from one box without looking inside. How can you correctly relabel all three boxes?",
  },
  {
    label: "GENERATE CODE",
    prompt:
      "Write a python function that takes a list of numbers and returns the sum of the even numbers.",
  },
  { label: "WRITE A HAIKU", prompt: "Write a haiku about a bonsai tree." },
];
const gate = $("gate"),
  gateInput = $("gateInput"),
  gateError = $("gateError");
const gateContinue = $("gateContinue"),
  gateField = $("gateField"),
  veil = $("veil");
async function validateToken(token) {
  const trimmed = (token || "").trim();
  if (!trimmed) return { valid: false, error: "A token is required." };
  try {
    const res = await fetch(`https://huggingface.co/api/models/${MODEL_ID}`, {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: "Invalid token." };
    let body = null;
    try {
      body = await res.json();
    } catch {}
    const errText = body?.error ? String(body.error) : "";
    if (
      res.status === 404 ||
      errText.toLowerCase().includes("repository not found")
    ) {
      return {
        valid: false,
        error:
          "This token can't access the model. Request access on the model page, then try again.",
      };
    }
    if (res.status === 403)
      return {
        valid: false,
        error: "Access forbidden — the token needs read permission.",
      };
    return {
      valid: false,
      error: errText || `Validation failed (HTTP ${res.status}).`,
    };
  } catch {
    return {
      valid: null,
      error: "Couldn't reach huggingface.co to verify the token.",
    };
  }
}
function showGate(prefill = "") {
  veil.hidden = true;
  gate.hidden = false;
  gate.classList.remove("leave");
  if (prefill) gateInput.value = prefill;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      gate.classList.add("show");
      gateInput.focus();
    }),
  );
}
function showGateError(message) {
  gateError.textContent = message;
  gateError.hidden = false;
  gateField.classList.add("error");
}
function clearGateError() {
  gateError.hidden = true;
  gateField.classList.remove("error");
}
function grant(token) {
  accessToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  gate.classList.add("leave");
  setTimeout(() => {
    gate.hidden = true;
    gate.classList.remove("show", "leave");
  }, 550);
  if (veil.hidden === false) {
    veil.classList.add("leave");
    setTimeout(() => {
      veil.hidden = true;
      veil.classList.remove("leave");
    }, 850);
  }
  window.App?.bootLanding?.();
  runAvailabilityCheck();
  if (reauthAfterGate) {
    reauthAfterGate = false;
    hideLoadError();
    startLoad();
  }
}
async function submitGate() {
  if (gateContinue.classList.contains("busy")) return;
  const token = gateInput.value.trim();
  if (!token) {
    showGateError("A token is required.");
    return;
  }
  clearGateError();
  gateContinue.classList.add("busy");
  gateContinue.textContent = "VALIDATING …";
  const result = await validateToken(token);
  gateContinue.classList.remove("busy");
  gateContinue.innerHTML = "CONTINUE &rarr;";
  if (result.valid === false) {
    showGateError(result.error);
    return;
  }
  grant(token);
}
gateContinue.addEventListener("click", (e2) => {
  e2.preventDefault();
  submitGate();
});
gateInput.addEventListener("keydown", (e2) => {
  if (e2.key === "Enter") {
    e2.preventDefault();
    submitGate();
  }
});
gateInput.addEventListener("input", clearGateError);
$("gateShow").addEventListener("click", () => {
  const hidden = gateInput.type === "password";
  gateInput.type = hidden ? "text" : "password";
  $("gateShow").textContent = hidden ? "HIDE" : "SHOW";
});
async function initAccess() {
  if (!REQUIRE_HF_TOKEN) {
    runAvailabilityCheck();
    return;
  }
  let stored = null;
  try {
    stored = localStorage.getItem(TOKEN_KEY);
  } catch {}
  if (!stored) {
    showGate();
    return;
  }
  veil.hidden = false;
  const result = await validateToken(stored);
  if (result.valid === false) {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    showGate(stored);
    showGateError(result.error + " Enter a current token to continue.");
    return;
  }
  grant(stored);
}
async function runAvailabilityCheck() {
  if (!navigator.gpu) {
    blockLoad(
      "WebGPU isn't available in this browser. Try a recent Chrome or Edge.",
    );
    return;
  }
  try {
    const res = await Bonsai27B.checkAvailability(MODEL_SRC, {
      file: MODEL_SRC === MODEL_ID ? DEFAULT_GGUF_FILE : void 0,
      accessToken: accessToken ?? void 0,
    });
    if (res && !res.ok && res.reason && loadState === "idle")
      blockLoad(res.reason);
  } catch {}
}
function blockLoad(reason) {
  loadBlocked = true;
  const cta = $("loadCta");
  cta.textContent = "UNAVAILABLE ON THIS DEVICE";
  cta.style.opacity = "0.45";
  cta.style.pointerEvents = "none";
  $("ctaNote").textContent = reason;
  $("ctaNote").hidden = false;
}
$("loadCta").addEventListener(
  "click",
  (e2) => {
    if (loadBlocked) {
      e2.preventDefault();
      e2.stopImmediatePropagation();
    }
  },
  true,
);
window.BonsaiApp = { startLoad, enterChat };
async function startLoad() {
  if (loadState === "loading" || loadState === "ready" || loadBlocked) return;
  loadState = "loading";
  hideLoadError();
  BonsaiLoader.set(0, TOTAL_BYTES_FALLBACK);
  BonsaiLoader.phase("REQUESTING WEBGPU DEVICE");
  if (document.body.classList.contains("stage-loading")) {
    await new Promise((resolve) => setTimeout(resolve, 1150));
  }
  try {
    chat = await Bonsai27B.load(MODEL_SRC, {
      file: MODEL_SRC === MODEL_ID ? DEFAULT_GGUF_FILE : void 0,
      accessToken: accessToken ?? void 0,
      cache: QSA.has("nocache") ? false : void 0,
      maxLength: Number.parseInt(QSA.get("ctx") ?? "", 10) || void 0,
      onProgress: onLoadProgress,
    });
    loadState = "ready";
    window.__bonsaiChat = chat;
    prepChatUi();
    BonsaiLoader.done();
  } catch (error) {
    console.error(error);
    loadState = "failed";
    showLoadError(error);
  }
}
function onLoadProgress(event) {
  if (event.status === "init") {
    BonsaiLoader.phase((event.message || "INITIALIZING").toUpperCase());
  } else if (event.status === "tokenizer") {
    BonsaiLoader.phase("PARSING TOKENIZER — 248K VOCAB");
  } else if (event.status === "weights") {
    if (event.kind === "bytes" && Number.isFinite(event.loaded)) {
      BonsaiLoader.phase(null);
      BonsaiLoader.set(
        event.loaded,
        Number.isFinite(event.total) && event.total > 0
          ? event.total
          : TOTAL_BYTES_FALLBACK,
      );
    } else if (event.kind === "tensors") {
      if (/warmup/i.test(event.message || "")) {
        BonsaiLoader.phase("COMPILING WEBGPU KERNELS · WARMUP");
      } else if (Number.isFinite(event.total) && event.total > 0) {
        BonsaiLoader.info({ tensors: event.loaded, tensorsTotal: event.total });
      }
    }
  }
}
function showLoadError(error) {
  const message = String(error?.message ?? error);
  document.body.classList.add("load-failed");
  BonsaiLoader.phase("LOAD FAILED");
  $("loadErrorMsg").textContent = message;
  $("loadError").hidden = false;
  const authish =
    REQUIRE_HF_TOKEN &&
    /\b40[134]\b|unauthorized|forbidden|invalid token|\btoken\b|repository not found|access (denied|restricted|to model)/i.test(
      message,
    );
  $("changeTokenBtn").hidden = !authish;
}
function hideLoadError() {
  document.body.classList.remove("load-failed");
  $("loadError").hidden = true;
  BonsaiLoader.phase(null);
}
$("retryBtn").addEventListener("click", (e2) => {
  e2.preventDefault();
  if (loadState === "failed") {
    hideLoadError();
    startLoad();
  }
});
$("changeTokenBtn").addEventListener("click", (e2) => {
  e2.preventDefault();
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  reauthAfterGate = true;
  showGate(accessToken ?? "");
});
if (
  document.body.classList.contains("stage-loading") &&
  !QSA.has("demo") &&
  !QSA.has("p")
)
  startLoad();
const chatx = $("chatx"),
  cScroll = $("cScroll"),
  cThread = $("cThread");
const cInput = $("cInput"),
  cSend = $("cSend"),
  cStop = $("cStop");
const cStatus = $("cStatus"),
  cStatusText = $("cStatusText"),
  cLive = $("cLive");
BonsaiLoader.onReady(() => setTimeout(enterChat, 1800));
function enterChat() {
  if (loadState !== "ready" || document.body.classList.contains("stage-chat"))
    return;
  document.body.classList.add("stage-chat");
  chatx.classList.add("show");
  setStatus("", "READY");
  setTimeout(() => cInput.focus(), 450);
}
function prepChatUi() {
  cInput.disabled = false;
  $("clearBtn").disabled = false;
  $("thinkToggle").disabled = false;
  renderSeeds();
  refreshSend();
}
function setStatus(mode, text) {
  cStatus.className = "c-status" + (mode ? " " + mode : "");
  if (text !== void 0) cStatusText.textContent = text;
}
function renderSeeds() {
  const wrap = $("cSeeds");
  if (!wrap) return;
  wrap.replaceChildren(
    ...SEED_EXAMPLES.map((seed) => {
      const b = document.createElement("button");
      b.className = "c-seed";
      b.type = "button";
      b.dataset.prompt = seed.prompt;
      b.textContent = seed.label;
      return b;
    }),
  );
}
document.addEventListener("click", (e2) => {
  const seed = e2.target.closest(".c-seed");
  if (!seed || seed.disabled || !chat || isGenerating) return;
  cInput.value = seed.dataset.prompt || "";
  send();
});
cSend.addEventListener("click", send);
cStop.addEventListener("click", () => abortController?.abort());
$("clearBtn").addEventListener("click", clearChat);
cInput.addEventListener("input", () => {
  autoGrow();
  refreshSend();
});
cInput.addEventListener("keydown", (e2) => {
  if (e2.key === "Enter" && !e2.shiftKey) {
    e2.preventDefault();
    if (!cSend.disabled) send();
  }
});
function refreshSend() {
  cSend.disabled =
    isGenerating || contextExhausted || !chat || cInput.value.trim() === "";
}
function autoGrow() {
  cInput.style.height = "auto";
  cInput.style.height = `${Math.min(cInput.scrollHeight, 180)}px`;
}
function scrollDown(force = false) {
  const nearBottom =
    cScroll.scrollHeight - cScroll.scrollTop - cScroll.clientHeight < 90;
  if (force || nearBottom) cScroll.scrollTop = cScroll.scrollHeight;
}
function setGenerating(on2) {
  isGenerating = on2;
  cInput.disabled = on2;
  $("clearBtn").disabled = on2;
  $("thinkToggle").disabled = on2;
  cSend.style.display = on2 ? "none" : "";
  cStop.style.display = on2 ? "grid" : "none";
  document.querySelectorAll(".c-seed").forEach((s) => {
    s.disabled = on2;
  });
  setStatus(
    on2 ? "busy" : "",
    on2 ? (thinkingEnabled ? "REASONING …" : "WRITING …") : "READY",
  );
  refreshSend();
}
let thinkingEnabled = false;
const thinkToggle = $("thinkToggle");
thinkToggle.addEventListener("click", () => {
  thinkingEnabled = !thinkingEnabled;
  thinkToggle.classList.toggle("on", thinkingEnabled);
  thinkToggle.setAttribute("aria-pressed", String(thinkingEnabled));
  $("thinkTip").textContent = `THINKING ${thinkingEnabled ? "ON" : "OFF"}`;
});
const welcomeTemplate = $("cWelcome").cloneNode(true);
function removeWelcome() {
  $("cWelcome")?.remove();
}
function clearChat() {
  if (isGenerating) return;
  messages = [];
  chat?.reset();
  contextExhausted = false;
  cInput.disabled = false;
  cInput.placeholder = "Ask anything…";
  setStatus("", "READY");
  cThread.replaceChildren(welcomeTemplate.cloneNode(true));
  renderSeeds();
  cInput.focus();
}
function appendUser(text) {
  const msg = document.createElement("div");
  msg.className = "c-msg user";
  const role = document.createElement("div");
  role.className = "c-role";
  role.textContent = "YOU";
  const bubble = document.createElement("div");
  bubble.className = "u-bubble";
  bubble.textContent = text;
  msg.append(role, bubble);
  cThread.appendChild(msg);
  scrollDown(true);
}
function appendAssistant(withThinking) {
  const msg = document.createElement("div");
  msg.className = "c-msg bot";
  msg.innerHTML = `
    <div class="c-role">BONSAI</div>
    ${
      withThinking
        ? `
    <div class="t-block live open">
      <button class="t-head" type="button">
        <span class="t-chev">&#9654;</span>
        <span class="t-label t-shimmer">THINKING</span>
      </button>
      <div class="t-body"></div>
    </div>`
        : ""
    }
    <div class="a-body"></div>`;
  const tBlock = msg.querySelector(".t-block");
  tBlock?.querySelector(".t-head").addEventListener("click", () => {
    if (tBlock.classList.contains("live")) return;
    const open = tBlock.classList.toggle("open");
    if (open) tBlock.querySelector(".t-body").scrollTop = 0;
  });
  cThread.appendChild(msg);
  scrollDown(true);
  return msg;
}
async function send() {
  const text = cInput.value.trim();
  if (!text || !chat || isGenerating || contextExhausted) return;
  removeWelcome();
  cInput.value = "";
  autoGrow();
  appendUser(text);
  messages.push({ role: "user", content: text });
  const thinkTurn = thinkingEnabled && chat.thinkCloseTokenId != null;
  chat.chatTemplateArgs = {
    enable_thinking: thinkingEnabled,
    preserve_thinking: true,
  };
  const msg = appendAssistant(thinkTurn);
  const tBlock = msg.querySelector(".t-block");
  const tBody = msg.querySelector(".t-body");
  const tLabel = msg.querySelector(".t-label");
  const aBody = msg.querySelector(".a-body");
  setGenerating(true);
  abortController = new AbortController();
  const closeId = chat.thinkCloseTokenId;
  let phase = thinkTurn ? "think" : "answer";
  let thinking = "",
    answer = "",
    closed = false;
  let startedAt = performance.now(),
    firstTokenAt = 0,
    thinkEndedAt = 0,
    tokens = 0;
  const finishThinking = () => {
    closed = true;
    thinkEndedAt = performance.now();
    tBlock.classList.remove("live", "open");
    const seconds = (
      (thinkEndedAt - (firstTokenAt || startedAt)) /
      1e3
    ).toFixed(1);
    tLabel.classList.remove("t-shimmer");
    tLabel.textContent = `THOUGHT FOR ${seconds}S`;
    if (!thinking.trim()) tBlock.remove();
    setStatus("busy", "WRITING …");
  };
  try {
    for await (const tok of chat.generate(messages, {
      signal: abortController.signal,
    })) {
      const now = performance.now();
      if (!firstTokenAt) firstTokenAt = now;
      if (tok.token !== null) tokens++;
      if (phase === "think") {
        if (tok.token === closeId) {
          phase = "answer";
          finishThinking();
        } else {
          thinking += tok.delta;
          scheduleStream(() => {
            tBody.textContent = thinking;
            tBody.scrollTop = tBody.scrollHeight;
          });
        }
      } else {
        answer += answer === "" ? tok.delta.replace(/^\s+/, "") : tok.delta;
        scheduleStream(() => renderAnswer(aBody, answer, true));
      }
      updateLiveStat({ startedAt, firstTokenAt, now, tokens });
    }
  } catch (error) {
    console.error(error);
    if (!answer) {
      aBody.innerHTML = "";
      const err = document.createElement("div");
      err.className = "a-error";
      err.textContent = `Generation stopped: ${String(error?.message ?? error)}`;
      aBody.appendChild(err);
    }
    setStatus("error", "ERROR · SEE CONSOLE");
  } finally {
    if (phase === "think" && !closed) {
      tBlock.classList.remove("live");
      tLabel.classList.remove("t-shimmer");
      tLabel.textContent = "THINKING (INTERRUPTED)";
    }
    cancelStream();
    if (tBody?.isConnected) {
      tBody.textContent = thinking;
      tBody.scrollTop = tBody.scrollHeight;
    }
    if (answer || !aBody.firstChild) renderAnswer(aBody, answer, false);
    appendMeta(msg, {
      startedAt,
      firstTokenAt,
      thinkEndedAt,
      endedAt: performance.now(),
      tokens,
    });
    scrollDown();
    const content = chat.lastAssistantContent;
    if (content !== null) messages.push({ role: "assistant", content });
    setGenerating(false);
    cLive.textContent = "";
    abortController = null;
    if (chat.contextFull) lockContextFull(msg);
    else cInput.focus();
  }
}
function lockContextFull(msg) {
  contextExhausted = true;
  const note = document.createElement("div");
  note.className = "a-ctxfull";
  note.textContent = `CONTEXT WINDOW FULL · ${chat.contextLength} TOKENS — PRESS CLEAR TO START FRESH`;
  msg.appendChild(note);
  cInput.disabled = true;
  cInput.placeholder = "Context window full — press CLEAR to start fresh";
  refreshSend();
  setStatus("error", "CONTEXT FULL");
  scrollDown();
}
function appendMeta(
  msg,
  { startedAt, firstTokenAt, thinkEndedAt, endedAt, tokens },
) {
  if (tokens <= 0) return;
  const parts = [`${tokens} TOK`];
  if (thinkEndedAt)
    parts.push(
      `THOUGHT ${((thinkEndedAt - (firstTokenAt || startedAt)) / 1e3).toFixed(1)}S`,
    );
  if (firstTokenAt)
    parts.push(`TTFT ${(firstTokenAt - startedAt).toFixed(0)} MS`);
  if (tokens > 5 && firstTokenAt) {
    parts.push(
      `${((tokens - 1) / Math.max((endedAt - firstTokenAt) / 1e3, 1e-9)).toFixed(1)} TOK/S`,
    );
  }
  const meta = document.createElement("div");
  meta.className = "c-msg-meta";
  meta.textContent = parts.join("  ·  ");
  msg.appendChild(meta);
}
const LIVE_STAT_MS = 150;
let lastLiveStatAt = 0;
function updateLiveStat({ startedAt, firstTokenAt, now, tokens }) {
  if (tokens <= 1) {
    cLive.textContent = `TTFT ${(firstTokenAt - startedAt).toFixed(0)} MS`;
    lastLiveStatAt = now;
    return;
  }
  if (now - lastLiveStatAt < LIVE_STAT_MS) return;
  lastLiveStatAt = now;
  cLive.textContent = `${((tokens - 1) / Math.max((now - firstTokenAt) / 1e3, 1e-9)).toFixed(0)} TOK/S`;
}
const STREAM_RENDER_MS = 33;
let streamPaint = null,
  renderQueued = false,
  lastRenderAt = 0;
function scheduleStream(paint) {
  streamPaint = paint;
  if (renderQueued) return;
  renderQueued = true;
  const tick = () => {
    if (!streamPaint) {
      renderQueued = false;
      return;
    }
    if (performance.now() - lastRenderAt < STREAM_RENDER_MS) {
      requestAnimationFrame(tick);
      return;
    }
    renderQueued = false;
    lastRenderAt = performance.now();
    const paintNow = streamPaint;
    streamPaint = null;
    paintNow();
    scrollDown();
  };
  requestAnimationFrame(tick);
}
function cancelStream() {
  streamPaint = null;
}
let marked = null;
let katexLib = null;
const katexCache = new Map();
let katexFragments = null;
import("https://esm.sh/marked@17")
  .then((m) => {
    marked = m.marked;
    marked.use({ gfm: true, breaks: true });
    return import("https://esm.sh/katex@0.16")
      .then((k) => {
        katexLib = k.default ?? k;
        marked.use(makeKatexExtension());
        ensureKatexCss();
      })
      .catch(() => {});
  })
  .catch(() => {
    marked = null;
  });
function ensureKatexCss() {
  if (document.querySelector("link[data-katex]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css";
  link.dataset.katex = "1";
  document.head.appendChild(link);
}
function makeKatexExtension() {
  const inline = {
    name: "katexInline",
    level: "inline",
    start(src) {
      return src.match(/\\\(/)?.index;
    },
    tokenizer(src) {
      const m = /^\\\(([\s\S]+?)\\\)/.exec(src);
      if (m) return { type: "katexInline", raw: m[0], text: m[1] };
    },
    renderer(token) {
      return stashKatex(token.text, false);
    },
  };
  const block = {
    name: "katexBlock",
    level: "inline",
    start(src) {
      return src.match(/\\\[/)?.index;
    },
    tokenizer(src) {
      const m = /^\\\[([\s\S]+?)\\\]/.exec(src);
      if (m) return { type: "katexBlock", raw: m[0], text: m[1] };
    },
    renderer(token) {
      return stashKatex(token.text, true);
    },
  };
  const dollarBlock = {
    name: "katexDollarBlock",
    level: "inline",
    start(src) {
      return src.match(/\$\$/)?.index;
    },
    tokenizer(src) {
      const m = /^\$\$([\s\S]+?)\$\$/.exec(src);
      if (m) return { type: "katexDollarBlock", raw: m[0], text: m[1] };
    },
    renderer(token) {
      return stashKatex(token.text, true);
    },
  };
  const dollarInline = {
    name: "katexDollarInline",
    level: "inline",
    start(src) {
      return src.match(/\$/)?.index;
    },
    tokenizer(src) {
      const m = /^\$(?!\s|\$)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
      if (m) return { type: "katexDollarInline", raw: m[0], text: m[1] };
    },
    renderer(token) {
      return stashKatex(token.text, false);
    },
  };
  return { extensions: [dollarBlock, block, inline, dollarInline] };
}
function renderKatex(text, display) {
  const key = (display ? "d:" : "i:") + text;
  let html = katexCache.get(key);
  if (html === void 0) {
    try {
      html = katexLib.renderToString(text.trim(), {
        throwOnError: false,
        displayMode: display,
      });
    } catch {
      html = escapeHtml(text);
    }
    katexCache.set(key, html);
  }
  return html;
}
function stashKatex(text, display) {
  const html = renderKatex(text, display);
  if (!katexFragments) return html;
  return `<\!--katex:${katexFragments.push(html) - 1}-->`;
}
function trimIncompleteMath(text) {
  let cut = -1;
  for (const [open, close] of [
    ["\\[", "\\]"],
    ["\\(", "\\)"],
  ]) {
    const lastOpen = text.lastIndexOf(open);
    if (lastOpen !== -1 && text.indexOf(close, lastOpen + open.length) === -1) {
      if (cut === -1 || lastOpen < cut) cut = lastOpen;
    }
  }
  const dd2 = text.split("$$").length - 1;
  if (dd2 % 2 === 1) {
    const lastOpen = text.lastIndexOf("$$");
    if (cut === -1 || lastOpen < cut) cut = lastOpen;
  }
  const tail = cut === -1 ? text : text.slice(0, cut);
  const m = /\$(?![\s\d$])[^$\n]*$/.exec(tail);
  if (m && tail.split("$").length % 2 === 0) {
    if (cut === -1 || m.index < cut) cut = m.index;
  }
  return cut === -1 ? text : text.slice(0, cut);
}
function renderAnswer(el2, raw, withCaret) {
  const text =
    withCaret && katexLib ? trimIncompleteMath(raw || "") : raw || "";
  if (marked) {
    try {
      katexFragments = [];
      let html = sanitizeHtml(marked.parse(text));
      if (katexFragments.length) {
        html = html.replace(
          /<\!--katex:(\d+)-->/g,
          (_, i) => katexFragments[+i] ?? "",
        );
      }
      el2.innerHTML = html;
      if (withCaret) appendCaret(el2);
      return;
    } catch {
    } finally {
      katexFragments = null;
    }
  }
  const safe = escapeHtml(text);
  const paragraphs = safe
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  el2.innerHTML = paragraphs
    .map((p) => `<p>${formatInline(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  if (withCaret) appendCaret(el2);
}
function appendCaret(el2) {
  const caret = document.createElement("span");
  caret.className = "a-caret";
  const DESCEND = /^(P|UL|OL|LI|BLOCKQUOTE|H[1-6]|PRE|CODE|EM|STRONG)$/;
  let host = el2;
  for (;;) {
    let tail = host.lastChild;
    while (tail && tail.nodeType === Node.TEXT_NODE && !tail.textContent.trim())
      tail = tail.previousSibling;
    if (
      !tail ||
      tail.nodeType !== Node.ELEMENT_NODE ||
      !DESCEND.test(tail.tagName)
    )
      break;
    host = tail;
  }
  host.appendChild(caret);
}
function sanitizeHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content
    .querySelectorAll("script,style,iframe,object,embed,link,meta,form")
    .forEach((el2) => el2.remove());
  tpl.content.querySelectorAll("*").forEach((el2) => {
    for (const attr of [...el2.attributes]) {
      const name = attr.name.toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "src") &&
          /^\s*(javascript|data):/i.test(attr.value))
      ) {
        el2.removeAttribute(attr.name);
      }
    }
  });
  return tpl.innerHTML;
}
function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}
const kernelsOverlay = $("kernelsOverlay");
let kernels = [];
let kxCopySource = "";
$("kernelsBtn").addEventListener("click", openKernels);
kernelsOverlay.addEventListener("click", (e2) => {
  if (e2.target.closest("[data-close]")) closeKernels();
});
$("kxList").addEventListener("scroll", updateListFade, { passive: true });
$("kxCopy").addEventListener("click", copyKernel);
document.addEventListener("keydown", (e2) => {
  if (e2.key === "Escape" && !kernelsOverlay.hidden) closeKernels();
});
function openKernels() {
  kernels = (chat ? (chat.runtime.getRenderedShaders?.() ?? []) : []).filter(
    (k) => !/\btranscode\b|\.transcode\./i.test(k.name),
  );
  const list = $("kxList");
  list.replaceChildren();
  $("kxSub").textContent = kernels.length
    ? `${kernels.length} WGSL COMPUTE SHADERS · COMPILED FOR YOUR GPU`
    : "LOAD THE MODEL TO INSPECT ITS COMPILED KERNELS";
  kernels.forEach((k, i) => {
    const item = document.createElement("button");
    item.className = "kx-item";
    item.type = "button";
    item.textContent = k.name;
    item.addEventListener("click", () => selectKernel(i));
    list.appendChild(item);
  });
  $("kxSource").hidden = true;
  $("kxIntro").hidden = false;
  kxCopySource = "";
  kernelsOverlay.hidden = false;
  document.body.classList.add("kx-locked");
  list.scrollTop = 0;
  requestAnimationFrame(updateListFade);
}
function updateListFade() {
  const list = $("kxList");
  const atEnd =
    list.scrollHeight <= list.clientHeight + 4 ||
    list.scrollTop >= list.scrollHeight - list.clientHeight - 4;
  list.parentElement.classList.toggle("at-end", atEnd);
}
function selectKernel(i) {
  const k = kernels[i];
  if (!k) return;
  $("kxIntro").hidden = true;
  $("kxSource").hidden = false;
  [...$("kxList").children].forEach((el2, j) =>
    el2.classList.toggle("active", j === i),
  );
  $("kxName").textContent = k.name;
  $("kxLines").textContent = `${k.source.split("\n").length} LINES`;
  $("kxCode").innerHTML = highlightWgsl(k.source);
  $("kxCode").parentElement.scrollTop = 0;
  kxCopySource = k.source;
}
function closeKernels() {
  kernelsOverlay.hidden = true;
  document.body.classList.remove("kx-locked");
}
async function copyKernel() {
  if (!kxCopySource) return;
  try {
    await navigator.clipboard.writeText(kxCopySource);
    $("kxCopy").textContent = "COPIED";
    setTimeout(() => {
      $("kxCopy").textContent = "COPY";
    }, 1200);
  } catch {}
}
const WGSL_KEYWORDS = new Set([
  "fn",
  "let",
  "var",
  "const",
  "const_assert",
  "struct",
  "if",
  "else",
  "for",
  "loop",
  "return",
  "break",
  "continue",
  "switch",
  "case",
  "default",
  "while",
  "override",
  "enable",
  "requires",
  "discard",
  "alias",
  "true",
  "false",
  "workgroup",
  "storage",
  "uniform",
  "function",
  "private",
  "read",
  "write",
  "read_write",
  "bitcast",
]);
const WGSL_TYPES = new Set([
  "u32",
  "i32",
  "f32",
  "f16",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "mat2x2",
  "mat3x3",
  "mat4x4",
  "mat2x3",
  "mat3x2",
  "mat2x4",
  "mat4x2",
  "mat3x4",
  "mat4x3",
  "array",
  "atomic",
  "ptr",
  "sampler",
]);
const WGSL_TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)|(\d[\w.]*)|(\s+)|([\s\S])/g;
function highlightWgsl(src) {
  let out = "";
  WGSL_TOKEN.lastIndex = 0;
  let m;
  while ((m = WGSL_TOKEN.exec(src))) {
    const [tok, comment, attr, ident, num, ws2] = m;
    if (comment) out += `<span class="k-cm">${escapeHtml(comment)}</span>`;
    else if (attr) out += `<span class="k-at">${escapeHtml(attr)}</span>`;
    else if (ident) {
      const cls = WGSL_KEYWORDS.has(ident)
        ? "k-kw"
        : WGSL_TYPES.has(ident)
          ? "k-ty"
          : null;
      out += cls ? `<span class="${cls}">${ident}</span>` : escapeHtml(ident);
    } else if (num) out += `<span class="k-nu">${escapeHtml(num)}</span>`;
    else if (ws2) out += ws2;
    else out += escapeHtml(tok);
  }
  return out;
}
const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
initAccess();
