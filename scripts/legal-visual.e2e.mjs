import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve(process.env.BZ_BROWSER_MODULE_ROOT || ".", "package.json"));
const { chromium } = require("playwright");
process.env.PUBLIC_SITE_URL = "https://bzcreators.com.ar";
const { pool } = await import("../server/db.js");
// UI fixture: no real database, credentials, migrations, or content writes.
pool.query = async () => [[]];
pool.execute = async () => [[]];
const { default: app } = await import("../server/app.js");
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const output = path.resolve("dist/legal-review");
await fs.mkdir(output, { recursive: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const external = [], errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await context.route("**/*", route => {
    if (route.request().url().startsWith(base)) return route.continue();
    external.push(route.request().url()); return route.fulfill({ contentType: "application/javascript", body: "/* blocked external fixture */" });
  });
  const pages = ["privacidad", "eliminacion-de-datos", "terminos", "cookies"];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const slug of pages) {
      await page.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator('meta[name="description"]').count(), 1);
      assert.equal(await page.locator('meta[property="og:title"]').count(), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(external.length, 0, "No optional requests before consent or after rejection");
      if (await page.getByRole("button", { name: "Rechazar etiquetas opcionales" }).count()) {
        const accept = await page.getByRole("button", { name: "Aceptar etiquetas opcionales" }).boundingBox();
        const reject = await page.getByRole("button", { name: "Rechazar etiquetas opcionales" }).boundingBox();
        assert.equal(Math.round(accept.width), Math.round(reject.width)); assert.equal(Math.round(accept.height), Math.round(reject.height));
        await page.screenshot({ path: `${output}/consent-${width}.png` });
        await page.getByRole("button", { name: "Rechazar etiquetas opcionales" }).click();
      }
      await page.screenshot({ path: `${output}/${slug}-${width}.png`, fullPage: true });
    }
  }
  await page.getByRole("button", { name: "Preferencias de cookies" }).click();
  await page.getByRole("button", { name: "Aceptar etiquetas opcionales" }).click();
  await page.waitForTimeout(200);
  assert.equal(external.length, 1); assert(external[0].includes("GTM-NZJTZ9JT"));
  await page.getByRole("button", { name: "Preferencias de cookies" }).click();
  await page.getByRole("button", { name: "Rechazar etiquetas opcionales" }).click();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bz_cookie_choice_v1")).choice), "rejected");
  assert.equal(await page.locator("#bz-optional-gtm").count(), 0);
  assert.equal(external.length, 1);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  for (const slug of pages) { await staticPage.goto(`${base}/${slug}`); assert.equal(await staticPage.locator("h1").count(), 1); assert.equal(await staticPage.locator('footer a[href="/privacidad"]').count(), 1); }
  assert.deepEqual(errors, []);
  const result = { pages, widths: [1440, 390], beforeConsentExternalRequests: 0, acceptedContainerRequests: external.length, noJavaScriptReadable: true, revokedReloadVerified: true, errors };
  await fs.writeFile(`${output}/checks.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await noJs.close(); await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await pool.end(); }
