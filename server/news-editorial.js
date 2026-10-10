import sanitizeHtml from "sanitize-html";
import { createHash } from "node:crypto";
import { cleanArticleHtml, cleanExternalUrl, cleanText } from "./content.js";

export const DINA_SIGNATURE = "Dina - Agente Editora IA";
export function editorialContent(html) {
  const body = sanitizeHtml(cleanArticleHtml(html), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "span", "meter"]),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt", "title", "width", "height"], meter: ["min", "max", "value"], "*": ["class"] },
    exclusiveFilter: frame => (frame.attribs.class ?? "").split(/\s+/).some(name => ["source", "sources", "agent-signature"].includes(name)) || (["p", "div"].includes(frame.tag) && (frame.text.trim() === DINA_SIGNATURE || /^(?:Fuente|Fuentes|Referencias):/i.test(frame.text.trim()))),
  });
  return body + '<p class="agent-signature">' + DINA_SIGNATURE + '</p>';
}
export function articleRevision(post) {
  return createHash("sha256").update(JSON.stringify([post.title, post.content, post.image_url, post.meta_description, post.keywords, Boolean(post.published)])).digest("hex");
}
export function editorialFields(raw) {
  for (const tag of String(raw.content ?? "").match(/<meter\b[^>]*>/gi) ?? []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    const values = [attrs.min, attrs.max, attrs.value];
    if (values.some(v => typeof v !== "string" || !/^-?\d+(?:\.\d+)?$/.test(v) || !Number.isFinite(Number(v))) || Number(attrs.max) <= Number(attrs.min) || Number(attrs.value) < Number(attrs.min) || Number(attrs.value) > Number(attrs.max)) throw Error("El gráfico necesita min, max y value numéricos, con un valor dentro de su escala");
  }
  const title = cleanText(raw.title, 255);
  const content = editorialContent(String(raw.content ?? "").slice(0, 200_000));
  const image = cleanExternalUrl(raw.image_url);
  const meta = cleanText(raw.meta_description, 160);
  if (!title || !String(raw.content ?? "").trim()) throw Error("Título y contenido son obligatorios");
  if ((content.match(/<h2(?:\s|>)/gi) ?? []).length < 2) throw Error("La nota necesita al menos dos subtítulos h2");
  if (!image || new URL(image).protocol !== "https:" || new URL(image).username || new URL(image).password) throw Error("La nota necesita una imagen HTTPS relacionada y verificada");
  if (/^(?:localhost|.*\.localhost|.*\.internal|.*\.local)$/i.test(new URL(image).hostname) || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(new URL(image).hostname)) throw Error("La imagen debe estar en una dirección pública");
  if (!meta) throw Error("La nota necesita una descripción para buscadores");
  return { title, content, image_url: image, meta_description: meta, keywords: cleanText(raw.keywords, 500) || null };
}
