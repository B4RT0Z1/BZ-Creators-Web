import { cleanArticleHtml } from "./content.js";
export const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function articleData(post, base) {
  const origin = base.replace(/\/$/, "");
  const url = origin + "/blog/" + encodeURIComponent(post.slug);
  const image = post.image_url ? new URL(post.image_url, origin).href : undefined;
  return { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.meta_description || post.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0,160), datePublished: new Date(post.created_at).toISOString(), dateModified: new Date(post.updated_at || post.created_at).toISOString(), mainEntityOfPage: url, url, inLanguage: "es-AR", ...(image ? { image: [image] } : {}), author: { "@type": "Organization", name: post.author_name || "BZ Creators" }, publisher: { "@type": "Organization", name: "BZ Creators", url: origin } };
}
export function renderArticlePage(template, post, base) {
  const data = articleData(post, base);
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(post.title) + " | BZ Creators</title>");
  html = html.replace(/<meta\b[^>]*(?:name=["'](?:description|author|keywords)["']|property=["'](?:og:[^"']+|article:[^"']+)["']|name=["']twitter:[^"']+["'])[^>]*>/gi, "");
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "");
  const meta = (property, value) => '<meta property="' + property + '" content="' + escapeHtml(value) + '">';
  const head = '<meta name="description" content="' + escapeHtml(data.description) + '"><meta name="author" content="' + escapeHtml(data.author.name) + '"><link rel="canonical" href="' + escapeHtml(data.url) + '">' + meta("og:type", "article") + meta("og:title", post.title) + meta("og:description", data.description) + meta("og:url", data.url) + meta("og:site_name", "BZ Creators") + meta("article:published_time", data.datePublished) + meta("article:modified_time", data.dateModified) + (data.image ? meta("og:image", data.image[0]) + meta("og:image:alt", post.title) : "") + '<meta name="twitter:card" content="' + (data.image ? "summary_large_image" : "summary") + '">' + '<meta name="twitter:title" content="' + escapeHtml(post.title) + '"><meta name="twitter:description" content="' + escapeHtml(data.description) + '">' + (data.image ? '<meta name="twitter:image" content="' + escapeHtml(data.image[0]) + '">' : "") + '<script type="application/ld+json" id="bz-article-jsonld">' + JSON.stringify(data).replace(/</g, "\\u003c") + '</script>';
  const body = '<main id="main-content" class="lab-page article-main"><article class="bz-article"><a class="article-back" href="/blog">← Bitácora del laboratorio</a><p class="article-kicker">BZ CREATORS / BITÁCORA</p><h1>' + escapeHtml(post.title) + '</h1><p class="article-description">' + escapeHtml(data.description) + '</p>' + (data.image ? '<figure class="article-cover has-image"><img src="' + escapeHtml(data.image[0]) + '" alt="' + escapeHtml(post.title) + '"></figure>' : "") + '<div class="bz-article-content">' + cleanArticleHtml(post.content) + '</div></article></main>';
  return html.replace("</head>", head + "</head>").replace('<div id="root"></div>', '<div id="root">' + body + '</div>');
}
