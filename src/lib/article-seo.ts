import type { Post } from "./api";

export function setArticleSeo(post: Post): () => void {
  const canonical = new URL("/blog/" + encodeURIComponent(post.slug), location.origin).href;
  const description = post.meta_description || post.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const image = post.image_url ? new URL(post.image_url, location.origin).href : undefined;
  document.title = post.title + " | BZ Creators";
  const meta = (key: string, value: string, property = false) => {
    const attr = property ? "property" : "name";
    let element = document.head.querySelector<HTMLMetaElement>('meta[' + attr + '="' + key + '"]');
    if (!element) { element = document.createElement("meta"); element.setAttribute(attr, key); document.head.append(element); }
    element.content = value; element.dataset.bzArticle = "true";
  };
  meta("description", description); meta("author", post.author_name || "BZ Creators"); meta("keywords", post.keywords || "");
  meta("og:type", "article", true); meta("og:title", post.title, true); meta("og:description", description, true);
  meta("og:url", canonical, true); meta("og:site_name", "BZ Creators", true);
  meta("article:published_time", new Date(post.created_at).toISOString(), true);
  meta("article:modified_time", new Date(post.updated_at || post.created_at).toISOString(), true);
  meta("twitter:card", image ? "summary_large_image" : "summary");
  meta("twitter:title", post.title); meta("twitter:description", description);
  if (image) { meta("og:image", image, true); meta("og:image:alt", post.title, true); meta("twitter:image", image); }
  else document.head.querySelectorAll('meta[property="og:image"],meta[property="og:image:alt"],meta[name="twitter:image"]').forEach(el => el.remove());
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.append(link); }
  link.href = canonical; link.dataset.bzArticle = "true";
  let script = document.head.querySelector<HTMLScriptElement>("#bz-article-jsonld");
  if (!script) { script = document.createElement("script"); script.id = "bz-article-jsonld"; script.type = "application/ld+json"; document.head.append(script); }
  script.dataset.bzArticle = "true";
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description, mainEntityOfPage: canonical, url: canonical,
    ...(image ? { image: [image] } : {}), datePublished: new Date(post.created_at).toISOString(), dateModified: new Date(post.updated_at || post.created_at).toISOString(),
    author: { "@type": "Organization", name: post.author_name || "BZ Creators" }, publisher: { "@type": "Organization", name: "BZ Creators", url: location.origin }, inLanguage: "es-AR" });
  return () => { document.head.querySelectorAll('[data-bz-article="true"]').forEach(el => el.remove()); document.title = "BZ Creators"; };
}
