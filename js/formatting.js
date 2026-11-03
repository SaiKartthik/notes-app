const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeHttpUrl(value) {
  try {
    const rawUrl = String(value).trim().replace(/&amp;/g, "&");
    const url = new URL(rawUrl);
    return SAFE_URL_PROTOCOLS.has(url.protocol) && !url.username && !url.password ? rawUrl : null;
  } catch {
    return null;
  }
}

function safeLink(label, url) {
  const safeUrl = normalizeHttpUrl(url);
  return safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
}

function renderInline(text) {
  const tokens = [];
  const stash = (html) => {
    const token = `\uE000${tokens.length}\uE001`;
    tokens.push(html);
    return token;
  };

  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label, url) => stash(safeLink(label, url)));
  output = output.replace(/https?:\/\/[^\s<>"']+/g, (url) => stash(safeLink(url, url)));
  output = output.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  output = output.replace(/\*(.*?)\*/g, "<i>$1</i>");
  return output.replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)]);
}

export function renderLinks(text = "") {
  return renderInline(text);
}

export function renderMarkdown(text = "") {
  const tokens = [];
  const stash = (html) => {
    const token = `\uE100${tokens.length}\uE101`;
    tokens.push(html);
    return token;
  };

  const source = String(text).replace(/```([\s\S]*?)```/g, (_, code) => stash(`<pre><code>${escapeHtml(code)}</code></pre>`));
  const output = source.split("\n").map((line) => {
    if (line.startsWith("### ")) return `<h3>${renderInline(line.slice(4))}</h3>`;
    if (line.startsWith("## ")) return `<h2>${renderInline(line.slice(3))}</h2>`;
    if (line.startsWith("# ")) return `<h1>${renderInline(line.slice(2))}</h1>`;
    return renderInline(line);
  }).join("<br>");
  return output.replace(/\uE100(\d+)\uE101/g, (_, index) => tokens[Number(index)]);
}
