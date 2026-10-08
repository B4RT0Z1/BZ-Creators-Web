import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createNewsAgentRouter } from "../../server/news-agent.js";

const WRITE = "w".repeat(40);
const PUBLISH = "p".repeat(40);

type Post = { id: string; title: string; slug: string; content: string; published: boolean; created_at: string };

function fakePool() {
  const posts: Post[] = [];
  const drafts: Array<{ post_id: string; source_url: string }> = [];
  const pool = {
    async query() { return [posts.map((p) => ({ ...p, source_url: drafts.find((d) => d.post_id === p.id)?.source_url ?? null }))]; },
    async execute(sql: string, params: unknown[]) {
      if (sql.startsWith("SELECT post_id FROM agent_drafts")) return [drafts.filter((d) => d.source_url === params[0])];
      if (sql.includes("INSERT INTO posts")) {
        if (posts.some((p) => p.slug === params[2])) throw Object.assign(new Error("dup"), { errno: 1062 });
        posts.push({ id: params[0] as string, title: params[1] as string, slug: params[2] as string, content: params[3] as string, published: false, created_at: "now" });
        return [{}];
      }
      if (sql.startsWith("INSERT INTO agent_drafts")) { drafts.push({ post_id: params[0] as string, source_url: params[1] as string }); return [{}]; }
      if (sql.includes("JOIN agent_drafts")) return [posts.filter((p) => p.id === params[0] && drafts.some((d) => d.post_id === p.id)).map((p) => ({ id: p.id, slug: p.slug, published: p.published }))];
      if (sql.startsWith("UPDATE posts SET published")) { posts.find((p) => p.id === params[0])!.published = true; return [{}]; }
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

const note = { title: "Nueva ley de apuestas en línea", content: "<h2>Qué cambia</h2><p>Texto propio.</p><script>alert(1)</script>", source_url: "https://example.com/nota-1", meta_description: "Resumen" };

describe("API del agente de noticias", () => {
  it("rechaza sin credencial o con una incorrecta, y queda apagada sin token válido", async () => {
    const t = await start();
    expect((await t.call("/posts", null)).status).toBe(401);
    expect((await t.call("/posts", "x".repeat(40))).status).toBe(401);
    expect((await t.call("/posts", PUBLISH)).status).toBe(401);
    const off = await start({ write: "corto", publish: "" });
    expect((await off.call("/posts", "corto")).status).toBe(503);
  });

  it("crea siempre un borrador, limpia el HTML y cita la fuente", async () => {
    const t = await start();
    const res = await t.call("/posts", WRITE, { ...note, published: true });
    expect(res.status).toBe(201);
    expect(res.json.post.published).toBe(false);
    expect(t.posts[0]!.published).toBe(false);
    expect(t.posts[0]!.content).not.toContain("script");
    expect(t.posts[0]!.content).toContain('Fuente: <a href="https://example.com/nota-1"');
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

  it("lista lo existente con su fuente para no repetir notas", async () => {
    const t = await start();
    await t.call("/posts", WRITE, note);
    const list = await t.call("/posts", WRITE);
    expect(list.json.posts[0].source_url).toBe("https://example.com/nota-1");
  });
});
