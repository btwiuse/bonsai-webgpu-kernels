// Model access, device checks, and load lifecycle for the browser runtime.
export function setupModelAccess({
  Bonsai27B,
  defaultGgufFile,
  byId,
  getChat,
  setChat,
  onChatReady,
}) {
  const query = new URLSearchParams(location.search);
  const requireToken = window.BONSAI_REQUIRE_HF_TOKEN === true;
  const modelId = "prism-ml/Bonsai-27B-gguf";
  const modelSource = query.get("src") || modelId;
  const tokenKey = "bonsai27b_hf_token_v1";
  const fallbackBytes = 3.8e9;
  const gate = byId("gate");
  const gateInput = byId("gateInput");
  const gateError = byId("gateError");
  const gateContinue = byId("gateContinue");
  const gateField = byId("gateField");
  const veil = byId("veil");

  let loadState = "idle";
  let loadBlocked = false;
  let accessToken = null;
  let reauthAfterGate = false;

  const modelOptions = () => ({
    file: modelSource === modelId ? defaultGgufFile : undefined,
    accessToken: accessToken ?? undefined,
  });

  async function validateToken(token) {
    const trimmed = (token || "").trim();
    if (!trimmed) return { valid: false, error: "A token is required." };
    try {
      const response = await fetch(`https://huggingface.co/api/models/${modelId}`, {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (response.ok) return { valid: true };
      if (response.status === 401) return { valid: false, error: "Invalid token." };
      let body = null;
      try {
        body = await response.json();
      } catch {}
      const errorText = body?.error ? String(body.error) : "";
      if (
        response.status === 404 ||
        errorText.toLowerCase().includes("repository not found")
      ) {
        return {
          valid: false,
          error: "This token can't access the model. Request access on the model page, then try again.",
        };
      }
      if (response.status === 403) {
        return {
          valid: false,
          error: "Access forbidden - the token needs read permission.",
        };
      }
      return {
        valid: false,
        error: errorText || `Validation failed (HTTP ${response.status}).`,
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
      localStorage.setItem(tokenKey, token);
    } catch {}
    gate.classList.add("leave");
    setTimeout(() => {
      gate.hidden = true;
      gate.classList.remove("show", "leave");
    }, 550);
    if (!veil.hidden) {
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
    gateContinue.textContent = "VALIDATING ...";
    const result = await validateToken(token);
    gateContinue.classList.remove("busy");
    gateContinue.innerHTML = "CONTINUE &rarr;";
    if (result.valid === false) {
      showGateError(result.error);
      return;
    }
    grant(token);
  }

  async function init() {
    if (!requireToken) {
      runAvailabilityCheck();
      return;
    }
    let stored = null;
    try {
      stored = localStorage.getItem(tokenKey);
    } catch {}
    if (!stored) {
      showGate();
      return;
    }
    veil.hidden = false;
    const result = await validateToken(stored);
    if (result.valid === false) {
      try {
        localStorage.removeItem(tokenKey);
      } catch {}
      showGate(stored);
      showGateError(`${result.error} Enter a current token to continue.`);
      return;
    }
    grant(stored);
  }

  async function runAvailabilityCheck() {
    if (!navigator.gpu) {
      blockLoad("WebGPU isn't available in this browser. Try a recent Chrome or Edge.");
      return;
    }
    try {
      const response = await Bonsai27B.checkAvailability(modelSource, modelOptions());
      if (response && !response.ok && response.reason && loadState === "idle") {
        blockLoad(response.reason);
      }
    } catch {}
  }

  function blockLoad(reason) {
    loadBlocked = true;
    const cta = byId("loadCta");
    cta.textContent = "UNAVAILABLE ON THIS DEVICE";
    cta.style.opacity = "0.45";
    cta.style.pointerEvents = "none";
    byId("ctaNote").textContent = reason;
    byId("ctaNote").hidden = false;
  }

  function onLoadProgress(event) {
    if (event.status === "init") {
      BonsaiLoader.phase((event.message || "INITIALIZING").toUpperCase());
    } else if (event.status === "tokenizer") {
      BonsaiLoader.phase("PARSING TOKENIZER - 248K VOCAB");
    } else if (event.status === "weights") {
      if (event.kind === "bytes" && Number.isFinite(event.loaded)) {
        BonsaiLoader.phase(null);
        BonsaiLoader.set(
          event.loaded,
          Number.isFinite(event.total) && event.total > 0
            ? event.total
            : fallbackBytes,
        );
      } else if (event.kind === "tensors") {
        if (/warmup/i.test(event.message || "")) {
          BonsaiLoader.phase("COMPILING WEBGPU KERNELS - WARMUP");
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
    byId("loadErrorMsg").textContent = message;
    byId("loadError").hidden = false;
    const authIssue =
      requireToken &&
      /\b40[134]\b|unauthorized|forbidden|invalid token|\btoken\b|repository not found|access (denied|restricted|to model)/i.test(
        message,
      );
    byId("changeTokenBtn").hidden = !authIssue;
  }

  function hideLoadError() {
    document.body.classList.remove("load-failed");
    byId("loadError").hidden = true;
    BonsaiLoader.phase(null);
  }

  async function startLoad() {
    if (loadState === "loading" || loadState === "ready" || loadBlocked) return;
    loadState = "loading";
    hideLoadError();
    BonsaiLoader.set(0, fallbackBytes);
    BonsaiLoader.phase("REQUESTING WEBGPU DEVICE");
    if (document.body.classList.contains("stage-loading")) {
      await new Promise((resolve) => setTimeout(resolve, 1150));
    }
    try {
      const chat = await Bonsai27B.load(modelSource, {
        ...modelOptions(),
        cache: query.has("nocache") ? false : undefined,
        maxLength: Number.parseInt(query.get("ctx") ?? "", 10) || undefined,
        overflow: query.get("overflow") === "sinks" ? "sinks" : undefined,
        onProgress: onLoadProgress,
      });
      setChat(chat);
      loadState = "ready";
      window.__bonsaiChat = chat;
      onChatReady();
      BonsaiLoader.done();
    } catch (error) {
      console.error(error);
      loadState = "failed";
      showLoadError(error);
    }
  }

  gateContinue.addEventListener("click", (event) => {
    event.preventDefault();
    submitGate();
  });
  gateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitGate();
    }
  });
  gateInput.addEventListener("input", clearGateError);
  byId("gateShow").addEventListener("click", () => {
    const hidden = gateInput.type === "password";
    gateInput.type = hidden ? "text" : "password";
    byId("gateShow").textContent = hidden ? "HIDE" : "SHOW";
  });
  byId("loadCta").addEventListener(
    "click",
    (event) => {
      if (loadBlocked) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  byId("retryBtn").addEventListener("click", (event) => {
    event.preventDefault();
    if (loadState === "failed") {
      hideLoadError();
      startLoad();
    }
  });
  byId("changeTokenBtn").addEventListener("click", (event) => {
    event.preventDefault();
    try {
      localStorage.removeItem(tokenKey);
    } catch {}
    reauthAfterGate = true;
    showGate(accessToken ?? "");
  });

  window.BonsaiApp = { startLoad };
  init();
  if (
    document.body.classList.contains("stage-loading") &&
    !query.has("demo") &&
    !query.has("p")
  ) {
    startLoad();
  }

  return {
    get chat() {
      return getChat();
    },
    isReady: () => loadState === "ready",
  };
}
