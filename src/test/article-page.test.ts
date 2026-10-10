import { describe, expect, it } from "vitest";
import { renderArticlePage } from "../../server/article-page.js";
describe("public article HTML", () => {
  it("renders the article and its metadata before JavaScript, without allowing script injection", () => {
    const post = { title: 'Noticia <importante>', slug: 'noticia', content: '<h2>Qué pasó</h2><p>Texto.</p><p class="agent-signature">Dina - Agente Editora IA</p>', author_name: 'Dina - Agente Editora IA', meta_description: '</script><script>alert(1)</script>', image_url: 'https://images.example.com/news.jpg', created_at: '2026-10-09T12:00:00Z', updated_at: '2026-10-09T14:00:00Z' };
    const html = renderArticlePage('<html><head><title>Inicio</title><meta name="description" content="Inicio"><meta property="og:type" content="website"></head><body><div id="root"></div></body></html>', post, 'https://bzcreators.com.ar');
    expect(html).toContain('<h2>Qué pasó</h2>');
    expect(html).toContain('rel="canonical" href="https://bzcreators.com.ar/blog/noticia"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).not.toContain('<script>alert(1)</script>');
    const data = JSON.parse(html.match(/id="bz-article-jsonld">(.*?)<\/script>/)![1]);
    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBe(post.title);
    expect(data.author.name).toBe('Dina - Agente Editora IA');
    expect(data.image).toEqual([post.image_url]);
    expect(html.match(/name="description"/g)).toHaveLength(1);
  });
});
