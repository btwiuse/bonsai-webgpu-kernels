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
export function renderAnswer(el2, raw, withCaret) {
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
