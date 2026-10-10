import { legalArticleHtml, legalPages } from "../shared/legal-content.js";
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function renderLegalPage(template, page, origin) {
  const base = origin.replace(/\/$/, "");
  const url = `${base}${page.path}`;
  const links = legalPages.map(p => `<a href="${p.path}"${p.path === page.path ? ' aria-current="page"' : ""}>${p.label}</a>`).join("");
  const head = `<meta name="description" content="${escape(page.description)}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(page.title)} | BZ Creators"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(url)}"><meta name="twitter:title" content="${escape(page.title)} | BZ Creators"><meta name="twitter:description" content="${escape(page.description)}">`;
  const body = `<div class="lab-page"><header class="lab-shell legal-static-header"><a href="/" aria-label="BZ Creators — inicio"><img src="/bz-logo.png" alt="BZ Creators" width="60" height="60"></a><a href="/blog">Bitácora del laboratorio</a></header><main id="main-content" class="lab-shell legal-main"><nav class="legal-nav" aria-label="Información legal">${links}</nav><article class="legal-document">${legalArticleHtml(page)}</article></main><footer class="lab-footer"><div class="lab-shell"><nav class="legal-nav" aria-label="Páginas legales">${links}</nav><p>© BZ Creators · Laboratorio de producto tecnológico</p></div></footer></div>`;
  return template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(page.title)} | BZ Creators</title>`)
    .replace(/<meta\b[^>]*(?:name=["'](?:description|twitter:title|twitter:description)["']|property=["'](?:og:title|og:description|og:url)["'])[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace("</head>", `${head}</head>`).replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
