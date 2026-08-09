import { Bonsai27B, DEFAULT_GGUF_FILE } from "./bonsai-adapter.js";
import { setupModelAccess } from "./model-access.js";
import { renderAnswer } from "./markdown-renderer.js";
import { setupKernelInspector } from "./kernel-inspector.js";

const $ = (id2) => document.getElementById(id2);
let chat = null;
const chatx = $("chatx"),
  cScroll = $("cScroll"),
  cThread = $("cThread");
const cInput = $("cInput"),
  cSend = $("cSend"),
  cStop = $("cStop");
const cStatus = $("cStatus"),
  cStatusText = $("cStatusText"),
  cLive = $("cLive");
const modelAccess = setupModelAccess({
  Bonsai27B,
  defaultGgufFile: DEFAULT_GGUF_FILE,
  byId: $,
  getChat: () => chat,
  setChat: (nextChat) => {
    chat = nextChat;
  },
  onChatReady: prepChatUi,
});
BonsaiLoader.onReady(() => setTimeout(enterChat, 1800));
function enterChat() {
  if (!modelAccess.isReady() || document.body.classList.contains("stage-chat"))
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

setupKernelInspector({ getChat: () => chat, byId: $ });
