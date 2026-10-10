import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve(process.env.BZ_GRAPHICS_MODULE_ROOT || ".", "package.json"));
const sharp = require("sharp");
// Preserve the official logo. Only scale it and add a separate brand accent.
const logo = await sharp("public/bz-logo-social.png").resize(840, 840).png().toBuffer();
const accent = Buffer.from('<svg width="1024" height="1024"><rect x="444" y="964" width="136" height="8" rx="4" fill="#A855F7"/></svg>');
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#000000" } })
  .composite([{ input: logo, left: 92, top: 64 }, { input: accent, left: 0, top: 0 }]).png().toFile("public/meta-app-icon-1024.png");
console.log("Created public/meta-app-icon-1024.png (1024 x 1024)");
