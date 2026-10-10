import sanitizeHtml from "sanitize-html";

export const cleanText = (value, maxLength) => String(value ?? "").trim().slice(0, maxLength);

export const slugify = (value) =>
  cleanText(value, 255)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 240);

export const cleanArticleHtml = (value) => sanitizeHtml(String(value ?? ""), {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "span", "meter"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"], meter: ["min", "max", "value"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
});

export const parsePublished = (value) => value === true || value === "true" || value === "1" || value === 1;

export const cleanExternalUrl = (value, { required = false } = {}) => {
  const candidate = cleanText(value, 2048);
  if (!candidate && !required) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
};
