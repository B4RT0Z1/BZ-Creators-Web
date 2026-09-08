import { describe, expect, it } from "vitest";
import { cleanArticleHtml, cleanExternalUrl, parsePublished, slugify } from "../../server/content.js";

describe("contenido del servidor", () => {
  it("genera slugs estables para títulos en español", () => {
    expect(slugify("  Guía de IA para creación  ")).toBe("guia-de-ia-para-creacion");
  });

  it("elimina scripts y protocolos peligrosos del HTML", () => {
    const result = cleanArticleHtml('<h2>Seguro</h2><script>alert(1)</script><a href="javascript:alert(1)">Enlace</a>');
    expect(result).toContain("<h2>Seguro</h2>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("javascript:");
  });

  it("interpreta el estado publicado sin aceptar valores arbitrarios", () => {
    expect(parsePublished("true")).toBe(true);
    expect(parsePublished("1")).toBe(true);
    expect(parsePublished("yes")).toBe(false);
  });

  it("acepta solo enlaces web externos con HTTP o HTTPS", () => {
    expect(cleanExternalUrl("https://github.com/bz/example")).toBe("https://github.com/bz/example");
    expect(cleanExternalUrl("javascript:alert(1)")).toBeNull();
    expect(cleanExternalUrl("not-a-url")).toBeNull();
  });
});
