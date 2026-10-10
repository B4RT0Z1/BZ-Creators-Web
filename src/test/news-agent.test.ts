import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createNewsAgentRouter } from "../../server/news-agent.js";

const WRITE = "w".repeat(40);
const PUBLISH = "p".repeat(40);

type Post = { id: string; title: string; slug: string; content: string; published: boolean; image_url?: string | null; meta_description?: string | null; keywords?: string | null; created_at: string };

function fakePool() {
  const posts: Post[] = [];
  const drafts: Array<{ post_id: string; source_url: string }> = [];
  const pool = {
    async query() { return [posts.map((p) => ({ ...p, source_url: drafts.find((d) => d.post_id === p.id)?.source_url ?? null }))]; },
    async execute(sql: string, params: unknown[]) {
      if (sql.startsWith("SELECT post_id FROM agent_drafts")) return [drafts.filter((d) => d.source_url === params[0])];
      if (sql.includes("INSERT INTO posts")) {
        if (posts.some((p) => p.slug === params[2])) throw Object.assign(new Error("dup"), { errno: 1062 });
        posts.push({ id: params[0] as string, title: params[1] as string, slug: params[2] as string, content: params[3] as string, published: false, image_url: params[4] as string, meta_description: params[6] as string, keywords: params[7] as string, created_at: "now" });
        return [{}];
      }
      if (sql.startsWith("INSERT INTO agent_drafts")) { drafts.push({ post_id: params[0] as string, source_url: params[1] as string }); return [{}]; }
      if (sql.startsWith("UPDATE posts p JOIN")) { const post = posts.find(p => p.id === params[5])!; Object.assign(post, { title: params[0], content: params[1], image_url: params[2], meta_description: params[3], keywords: params[4] }); return [{ affectedRows: 1 }]; }
      if (sql.startsWith("DELETE p FROM")) { const index = posts.findIndex(p => p.id === params[0]); posts.splice(index,1); drafts.splice(drafts.findIndex(d => d.post_id === params[0]),1); return [{ affectedRows: 1 }]; }
      if (sql.includes("JOIN agent_drafts")) return [posts.filter((p) => p.id === params[0] && drafts.some((d) => d.post_id === p.id)).map((p) => ({ ...p }))];
      if (sql.startsWith("UPDATE posts SET published = TRUE")) { posts.find((p) => p.id === params[0])!.published = true; return [{}]; }
      if (sql.startsWith("UPDATE posts SET published = FALSE")) { posts.find((p) => p.id === params[0])!.published = false; return [{}]; }
      if (sql.startsWith("DELETE FROM posts")) { const i = posts.findIndex((p) => p.id === params[0]); posts.splice(i, 1); drafts.splice(drafts.findIndex((d) => d.post_id === params[0]), 1); return [{}]; }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  return { pool, posts, drafts };
}

const servers: Array<{ close(): void }> = [];
afterEach(() => { servers.splice(0).forEach((s) => s.close()); });

async function start(tokens = { write: WRITE, publish: PUBLISH }) {
  const db = fakePool();
  const app = express(); app.use(express.json());
  app.use("/api/agent", createNewsAgentRouter({ pool: db.pool as never, tokens }));
  const server = app.listen(0); servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agent`;
  const call = async (path: string, token: string | null, body?: unknown) => {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, json: await response.json() as { post: { id: string; slug: string; published: boolean }; posts: Array<{ source_url: string }> } };
  };
  return { ...db, call };
}

const note = { title: "Nueva ley de apuestas en línea", content: "<h2>Qué cambia</h2><p>Texto propio.</p><h2>Qué implica</h2><p>Explicación.</p><script>alert(1)</script>", image_url: "https://images.example.com/news.jpg", source_url: "https://example.com/nota-1", meta_description: "Resumen" };

describe("API del agente de noticias", () => {
  it("rechaza sin credencial o con una incorrecta, y queda apagada sin token válido", async () => {
    const t = await start();
    expect((await t.call("/posts", null)).status).toBe(401);
    expect((await t.call("/posts", "x".repeat(40))).status).toBe(401);
    expect((await t.call("/posts", PUBLISH)).status).toBe(401);
    const off = await start({ write: "corto", publish: "" });
    expect((await off.call("/posts", "corto")).status).toBe(503);
  });

  it("crea un borrador, conserva las referencias internamente y agrega una sola firma", async () => {
    const t = await start();
    const res = await t.call("/posts", WRITE, { ...note, published: true });
    expect(res.status).toBe(201);
    expect(res.json.post.published).toBe(false);
    expect(t.posts[0]!.published).toBe(false);
    expect(t.posts[0]!.content).not.toContain("script");
    expect(t.posts[0]!.content).not.toContain('Fuente:');
    expect(t.posts[0]!.content).toContain('Dina - Agente Editora IA');
    expect(t.drafts[0].source_url).toBe(note.source_url);
    expect(t.posts[0]!.slug).toBe("nueva-ley-de-apuestas-en-linea");
  });

  it("exige fuente válida y no repite una fuente; el slug repetido se desambigua", async () => {
    const t = await start();
    expect((await t.call("/posts", WRITE, { ...note, source_url: "javascript:alert(1)" })).status).toBe(400);
    expect((await t.call("/posts", WRITE, { ...note, title: "" })).status).toBe(400);
    expect((await t.call("/posts", WRITE, note)).status).toBe(201);
    expect((await t.call("/posts", WRITE, note)).status).toBe(409);
    const again = await t.call("/posts", WRITE, { ...note, source_url: "https://example.com/otra" });
    expect(again.status).toBe(201);
    expect(again.json.post.slug).not.toBe("nueva-ley-de-apuestas-en-linea");
  });

  it("la clave de escritura no publica; la de aprobación publica o descarta solo borradores del agente", async () => {
    const t = await start();
    const id = (await t.call("/posts", WRITE, note)).json.post.id as string;
    expect((await t.call(`/posts/${id}/publish`, WRITE, {})).status).toBe(401);
    expect((await t.call(`/posts/${id}/publish`, PUBLISH, {})).status).toBe(200);
    expect(t.posts[0]!.published).toBe(true);
    expect((await t.call(`/posts/${id}/publish`, PUBLISH, {})).status).toBe(409);
    expect((await t.call(`/posts/${id}/discard`, PUBLISH, {})).status).toBe(409);
    expect((await t.call(`/posts/no-existe/publish`, PUBLISH, {})).status).toBe(404);
    const second = (await t.call("/posts", WRITE, { ...note, source_url: "https://example.com/b" })).json.post.id as string;
    expect((await t.call(`/posts/${second}/discard`, PUBLISH, {})).status).toBe(200);
    expect(t.posts.some((p) => p.id === second)).toBe(false);
  });

  it("baja una nota publicada por el agente a borrador, solo con la clave de aprobación", async () => {
    const t = await start();
    const id = (await t.call("/posts", WRITE, note)).json.post.id as string;
    expect((await t.call(`/posts/${id}/unpublish`, PUBLISH, {})).status).toBe(409);
    await t.call(`/posts/${id}/publish`, PUBLISH, {});
    expect((await t.call(`/posts/${id}/unpublish`, WRITE, {})).status).toBe(401);
    expect((await t.call(`/posts/${id}/unpublish`, PUBLISH, {})).status).toBe(200);
    expect(t.posts[0]!.published).toBe(false);
  });

  it("lista lo existente con su fuente para no repetir notas", async () => {
    const t = await start();
    await t.call("/posts", WRITE, note);
    const list = await t.call("/posts", WRITE);
    expect(list.json.posts[0].source_url).toBe("https://example.com/nota-1");
  });
});

describe("edición de noticias propias", () => {
  it("exige calidad editorial y no agrega fuentes ni firmas repetidas", async () => {
    const t = await start();
    expect((await t.call("/posts", WRITE, { ...note, image_url: null })).status).toBe(400);
    expect((await t.call("/posts", WRITE, { ...note, content: "<p>Sin subtítulos</p>" })).status).toBe(400);
    expect((await t.call("/posts", WRITE, { ...note, meta_description: "" })).status).toBe(400);
    await t.call("/posts", WRITE, { ...note, content: note.content + '<p class="source">Fuente: <a href="https://example.com">Fuente</a></p><p>Dina - Agente Editora IA</p>' });
    expect(t.posts[0].content).not.toContain("Fuente:");
    expect(t.posts[0].content.match(/Dina - Agente Editora IA/g)).toHaveLength(1);
  });
  it("actualiza y borra solo notas del agente con la clave de aprobación y revisión vigente", async () => {
    const t = await start();
    const id = (await t.call("/posts", WRITE, note)).json.post.id;
    await t.call('/posts/' + id + '/publish', PUBLISH, {});
    const own = (await t.call('/posts/' + id, PUBLISH)).json.post as typeof t.posts[number] & { revision: string };
    expect((await t.call('/posts/' + id + '/update', WRITE, { title: "Otro título", expectedRevision: own.revision })).status).toBe(401);
    expect((await t.call('/posts/' + id + '/update', PUBLISH, { title: "Otro título", expectedRevision: "vieja" })).status).toBe(409);
    expect((await t.call('/posts/' + id + '/update', PUBLISH, { title: "Otro título", expectedRevision: own.revision })).status).toBe(200);
    expect(t.posts[0].slug).toBe(own.slug);
    expect(t.posts[0].published).toBe(true);
    expect((await t.call('/posts/' + id + '/delete', PUBLISH, { expectedRevision: own.revision })).status).toBe(409);
    const current = (await t.call('/posts/' + id, PUBLISH)).json.post as typeof own;
    expect((await t.call('/posts/' + id + '/delete', WRITE, { expectedRevision: current.revision })).status).toBe(401);
    t.posts.push({ id: "human", title: "Humana", slug: "humana", content: "<p>Texto</p>", published: true, created_at: "now" });
    expect((await t.call('/posts/human/update', PUBLISH, { title: "No", expectedRevision: "x" })).status).toBe(404);
    expect((await t.call('/posts/human/delete', PUBLISH, { expectedRevision: "x" })).status).toBe(404);
    expect((await t.call('/posts/' + id + '/delete', PUBLISH, { expectedRevision: current.revision })).status).toBe(200);
    expect(t.posts.map(post=>post.id)).toEqual(["human"]);
  });
});
