export function setupKernelInspector({ getChat, byId }) {
  const $ = byId;
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
    const chat = getChat();
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
}
