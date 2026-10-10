import { describe, expect, it } from "vitest";
import { editorialFields } from "../../server/news-editorial.js";
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

  it("preserves editorial charts and captions while rejecting malformed scales and executable attributes", () => {
    const content='<h2>Datos</h2><h2>Lectura</h2><aside class="news-takeaway"><strong>Idea clave</strong></aside><figure class="news-chart"><figcaption>Prueba de escala</figcaption><meter min="0" max="100" value="60" onclick="alert(1)">60%</meter></figure>';
    const note={title:"Prueba",content,image_url:"https://images.example.com/news.png",meta_description:"Resumen"};
    const result=editorialFields(note).content;
    expect(result).toContain('class="news-chart"');expect(result).toContain('<meter min="0" max="100" value="60">60%</meter>');
    expect(result).toContain('<figcaption>');expect(result).not.toContain('onclick');
    expect(()=>editorialFields({...note,content:content.replace('value="60"','value="160"')})).toThrow("escala");
    expect(()=>editorialFields({...note,content:content.replace('max="100"','max="dato"')})).toThrow("numéricos");
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
