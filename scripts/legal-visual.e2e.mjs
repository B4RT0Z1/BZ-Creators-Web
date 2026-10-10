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
      assert.equal(external.length, 0, "No external scripts or fonts on legal routes");
      assert.equal(await page.locator(".cookie-notice").count(), 0);
      await page.screenshot({ path: `${output}/${slug}-${width}.png`, fullPage: true });
    }
  }
  assert.equal(external.length, 0);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  for (const slug of pages) { await staticPage.goto(`${base}/${slug}`); assert.equal(await staticPage.locator("h1").count(), 1); assert.equal(await staticPage.locator('footer a[href="/privacidad"]').count(), 1); }
  assert.deepEqual(errors, []);
  const result = { pages, widths: [1440, 390], externalRequests: external.length, noJavaScriptReadable: true, trackingScripts: false, consentBanner: false, errors };
  await fs.writeFile(`${output}/checks.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await noJs.close(); await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await pool.end(); }
