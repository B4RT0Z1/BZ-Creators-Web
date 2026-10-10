import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import { legalPages, LEGAL_UPDATED } from "../shared/legal-content.js";
const plain = html => {
  const dom = new JSDOM(html);
  for (const table of dom.window.document.querySelectorAll("table")) {
    const rows = [...table.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.replace(/\s+/g, " ").trim()));
    const text = rows.map((row, i) => `| ${row.join(" | ")} |${i === 0 ? `\n| ${row.map(() => "---").join(" | ")} |` : ""}`).join("\n");
    table.replaceWith(dom.window.document.createTextNode(`\n\n${text}\n\n`));
  }
  return dom.window.document.body.innerHTML.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, "**$1**").replace(/<li>/g, "\n- ").replace(/<\/(?:p|ul|div)>/g, "\n\n").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
};
await fs.mkdir("docs", { recursive: true });
let review = `# Textos legales para revisión\n\nActualización: ${LEGAL_UPDATED}. Borrador local; no publicado.\n\nFuente única: shared/legal-content.js. Para regenerar: node scripts/export-legal-review.mjs.\n\n`;
for (const page of legalPages) {
  review += `## ${page.title}\n\nURL prevista: https://bzcreators.com.ar${page.path}\n\nDescripción SEO: ${page.description}\n\n${page.intro}\n\n`;
  for (const section of page.sections) review += `### ${section.title}\n\n${plain(section.html)}\n\n`;
}
const pending = [...new Set(legalPages.flatMap(page => page.sections.flatMap(section => section.html.match(/\[COMPLETAR:[^\]]+\]/g) || [])))];
review += `## Pendientes visibles\n\n${pending.map(p => `- ${p}`).join("\n")}\n`;
await fs.writeFile("docs/LEGAL-TEXTS.md", review);
console.log(`Exported 4 texts; ${pending.length} pending verification markers.`);
