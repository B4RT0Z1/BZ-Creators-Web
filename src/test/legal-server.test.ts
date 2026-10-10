// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { legalPages } from "../../shared/legal-content.js";
const fixture = vi.hoisted(() => ({ root: "", query: vi.fn(async () => [[]]), execute: vi.fn(async () => [[]]) }));
vi.mock("../../server/db.js", () => ({ pool: { query: fixture.query, execute: fixture.execute } }));
vi.mock("../../server/config.js", () => ({ config: { projectRoot: fixture.root, uploadDir: path.join(fixture.root, "uploads"), publicSiteUrl: "https://bzcreators.com.ar", openSourceSiteUrl: "https://opensource.bzcreators.com.ar", jwtSecret: "x".repeat(40), maxUploadBytes: 5 * 1024 * 1024 } }));
let base: string;
let server: ReturnType<typeof import("node:http").createServer>;
beforeAll(async () => {
  fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), "bz-legal-test-"));
  fs.mkdirSync(path.join(fixture.root, "dist"));
  fs.writeFileSync(path.join(fixture.root, "dist", "index.html"), '<!doctype html><html lang="es"><head><title>Home</title><meta name="description" content="Home"></head><body><div id="root"></div></body></html>');
  const { default: app } = await import("../../server/app.js");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(fixture.root, { recursive: true, force: true }); });
describe("páginas legales públicas en Express", () => {
  for (const page of legalPages) it(`entrega ${page.path} con texto y metadata antes de ejecutar JavaScript`, async () => {
    const response = await fetch(base + page.path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain(`<h1>${page.title}</h1>`);
    expect(html).toContain(`<title>${page.title} | BZ Creators</title>`);
    expect(html).toContain(`rel="canonical" href="https://bzcreators.com.ar${page.path}"`);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain("Última actualización");
    expect(html).not.toContain("Page not found");
    for (const link of legalPages) expect(html).toContain(`href="${link.path}"`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("incluye las cuatro URLs canónicas y fecha en el sitemap real", async () => {
    const response = await fetch(base + "/sitemap.xml");
    expect(response.status).toBe(200);
    const xml = await response.text();
    for (const page of legalPages) expect(xml).toContain(`<loc>https://bzcreators.com.ar${page.path}</loc><lastmod>2026-10-10</lastmod>`);
  });
});
