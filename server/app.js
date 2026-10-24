import fs from "node:fs";
import { legalPages, LEGAL_UPDATED } from "../shared/legal-content.js";
import { renderLegalPage } from "./legal-page.js";
import { editorialContent, DINA_SIGNATURE } from "./news-editorial.js";
import { renderArticlePage } from "./article-page.js";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";
import { pool } from "./db.js";
import { clearSession, createSession, requireAdmin } from "./auth.js";
import { cleanArticleHtml, cleanExternalUrl, cleanText, parsePublished, slugify } from "./content.js";
import { deleteLocalImage, uploadImage } from "./uploads.js";
import { createNewsAgentRouter } from "./news-agent.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta nuevamente en 15 minutos." },
});

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados comentarios. Intenta nuevamente más tarde." },
});

const postSelect = `
  SELECT id, title, slug, content, image_url, category_id, published,
         meta_description, keywords, created_at, updated_at, published_at,
         EXISTS (SELECT 1 FROM agent_drafts d WHERE d.post_id = posts.id) AS agent_created
  FROM posts
`;

const mapPost = ({ agent_created, ...post }) => ({ ...post, published: Boolean(post.published), ...(agent_created ? { content: editorialContent(post.content), author_name: DINA_SIGNATURE } : {}) });

const openSourceSelect = `
  SELECT id, name, slug, summary, description, github_url, website_url, image_url,
         technologies, published, featured, sort_order, created_at, updated_at
  FROM open_source_projects
`;

const mapOpenSourceProject = (project) => {
  let technologies = project.technologies;
  if (typeof technologies === "string") {
    try { technologies = JSON.parse(technologies); } catch { technologies = []; }
  }
  return {
    ...project,
    technologies: Array.isArray(technologies) ? technologies : [],
    published: Boolean(project.published),
    featured: Boolean(project.featured),
    sort_order: Number(project.sort_order) || 0,
  };
};

const sendDatabaseError = (res, error) => {
  if (error?.errno === 1062) return res.status(409).json({ error: "Ya existe una publicación con ese slug" });
  console.error(error);
  return res.status(500).json({ error: "Error interno del servidor" });
};

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "mysql" });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const email = cleanText(req.body?.email, 255).toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Correo y contraseña son obligatorios" });

  const [rows] = await pool.execute(
    "SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
    [email],
  );
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

  createSession(res, user);
  return res.json({ user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

app.get("/api/auth/me", requireAdmin, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/posts", async (_req, res) => {
  try {
    const [rows] = await pool.query(`${postSelect} WHERE published = TRUE ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC`);
    res.json({ posts: rows.map(mapPost) });
  } catch (error) {
    sendDatabaseError(res, error);
  }
});

app.get("/api/posts/:slug", async (req, res) => {
  try {
    const [rows] = await pool.execute(`${postSelect} WHERE slug = ? AND published = TRUE LIMIT 1`, [req.params.slug]);
    if (rows.length === 0) return res.status(404).json({ error: "Publicación no encontrada" });
    return res.json({ post: mapPost(rows[0]) });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.get("/api/admin/posts", requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(`${postSelect} ORDER BY created_at DESC`);
    res.json({ posts: rows.map(mapPost) });
  } catch (error) {
    sendDatabaseError(res, error);
  }
});

const handleUpload = (req, res, next) => {
  uploadImage(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `La imagen supera el máximo de ${config.maxUploadBytes / 1024 / 1024} MB`
      : error.message;
    return res.status(400).json({ error: message });
  });
};

app.post("/api/admin/posts", requireAdmin, handleUpload, async (req, res) => {
  const title = cleanText(req.body.title, 255);
  const content = cleanArticleHtml(req.body.content);
  if (!title || !content) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Título y contenido son obligatorios" });
  }

  const id = randomUUID();
  const slug = slugify(req.body.slug || title) || `post-${id.slice(0, 8)}`;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    await pool.execute(
      `INSERT INTO posts
       (id, title, slug, content, image_url, category_id, published, meta_description, keywords, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = TRUE, CURRENT_TIMESTAMP(3), NULL))`,
      [
        id,
        title,
        slug,
        content,
        imageUrl,
        req.body.category_id || "00000000-0000-4000-8000-000000000001",
        parsePublished(req.body.published),
        cleanText(req.body.meta_description, 320) || null,
        cleanText(req.body.keywords, 500) || null,
        parsePublished(req.body.published),
      ],
    );
    const [rows] = await pool.execute(`${postSelect} WHERE id = ? LIMIT 1`, [id]);
    return res.status(201).json({ post: mapPost(rows[0]) });
  } catch (error) {
    if (imageUrl) await deleteLocalImage(imageUrl);
    return sendDatabaseError(res, error);
  }
});

app.put("/api/admin/posts/:id", requireAdmin, handleUpload, async (req, res) => {
  const title = cleanText(req.body.title, 255);
  const content = cleanArticleHtml(req.body.content);
  if (!title || !content) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Título y contenido son obligatorios" });
  }

  const [existingRows] = await pool.execute("SELECT id, image_url FROM posts WHERE id = ? LIMIT 1", [req.params.id]);
  if (existingRows.length === 0) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: "Publicación no encontrada" });
  }

  const oldImageUrl = existingRows[0].image_url;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : oldImageUrl;
  const slug = slugify(req.body.slug || title) || `post-${req.params.id.slice(0, 8)}`;

  try {
    await pool.execute(
      `UPDATE posts
       SET title = ?, slug = ?, content = ?, image_url = ?, category_id = ?,
           published_at = IF(? = TRUE AND published = FALSE, COALESCE(published_at, CURRENT_TIMESTAMP(3)), published_at),
           published = ?, meta_description = ?, keywords = ?
       WHERE id = ?`,
      [
        title,
        slug,
        content,
        imageUrl,
        req.body.category_id || "00000000-0000-4000-8000-000000000001",
        parsePublished(req.body.published),
        parsePublished(req.body.published),
        cleanText(req.body.meta_description, 320) || null,
        cleanText(req.body.keywords, 500) || null,
        req.params.id,
      ],
    );
    if (req.file && oldImageUrl && oldImageUrl !== imageUrl) await deleteLocalImage(oldImageUrl);
    const [rows] = await pool.execute(`${postSelect} WHERE id = ? LIMIT 1`, [req.params.id]);
    return res.json({ post: mapPost(rows[0]) });
  } catch (error) {
    if (req.file) await deleteLocalImage(imageUrl);
    return sendDatabaseError(res, error);
  }
});

app.delete("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  const [rows] = await pool.execute("SELECT image_url FROM posts WHERE id = ? LIMIT 1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Publicación no encontrada" });
  await pool.execute("DELETE FROM posts WHERE id = ?", [req.params.id]);
  await deleteLocalImage(rows[0].image_url);
  return res.status(204).end();
});

app.get("/api/open-source", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `${openSourceSelect} WHERE published = TRUE ORDER BY featured DESC, sort_order ASC, created_at DESC`,
    );
    res.json({ projects: rows.map(mapOpenSourceProject) });
  } catch (error) {
    sendDatabaseError(res, error);
  }
});

app.get("/api/admin/open-source", requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `${openSourceSelect} ORDER BY featured DESC, sort_order ASC, created_at DESC`,
    );
    res.json({ projects: rows.map(mapOpenSourceProject) });
  } catch (error) {
    sendDatabaseError(res, error);
  }
});

const readOpenSourceInput = (body) => {
  const rawWebsiteUrl = cleanText(body.website_url, 2048);
  const rawGithubUrl = cleanText(body.github_url, 2048);
  const parsedGithubUrl = cleanExternalUrl(rawGithubUrl, { required: true });
  const githubUrl = parsedGithubUrl && new URL(parsedGithubUrl).hostname.replace(/^www\./, "").toLowerCase() === "github.com"
    ? parsedGithubUrl
    : null;
  const websiteUrl = cleanExternalUrl(rawWebsiteUrl);
  const technologies = cleanText(body.technologies, 1000)
    .split(",")
    .map((technology) => technology.trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    name: cleanText(body.name, 255),
    summary: cleanText(body.summary, 500),
    description: cleanArticleHtml(body.description),
    githubUrl,
    websiteUrl,
    websiteUrlInvalid: Boolean(rawWebsiteUrl && !websiteUrl),
    technologies,
    published: parsePublished(body.published),
    featured: parsePublished(body.featured),
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0)),
  };
};

app.post("/api/admin/open-source", requireAdmin, handleUpload, async (req, res) => {
  const input = readOpenSourceInput(req.body);
  if (!input.name || !input.summary || !input.description || !input.githubUrl || input.websiteUrlInvalid) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Nombre, resumen, descripción y URL válida de GitHub son obligatorios" });
  }

  const id = randomUUID();
  const slug = slugify(req.body.slug || input.name) || `project-${id.slice(0, 8)}`;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    await pool.execute(
      `INSERT INTO open_source_projects
       (id, name, slug, summary, description, github_url, website_url, image_url, technologies, published, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, input.name, slug, input.summary, input.description, input.githubUrl, input.websiteUrl,
        imageUrl, JSON.stringify(input.technologies), input.published, input.featured, input.sortOrder,
      ],
    );
    const [rows] = await pool.execute(`${openSourceSelect} WHERE id = ? LIMIT 1`, [id]);
    return res.status(201).json({ project: mapOpenSourceProject(rows[0]) });
  } catch (error) {
    if (imageUrl) await deleteLocalImage(imageUrl);
    return sendDatabaseError(res, error);
  }
});

app.put("/api/admin/open-source/:id", requireAdmin, handleUpload, async (req, res) => {
  const input = readOpenSourceInput(req.body);
  if (!input.name || !input.summary || !input.description || !input.githubUrl || input.websiteUrlInvalid) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Nombre, resumen, descripción y URL válida de GitHub son obligatorios" });
  }

  const [existingRows] = await pool.execute(
    "SELECT id, image_url FROM open_source_projects WHERE id = ? LIMIT 1",
    [req.params.id],
  );
  if (existingRows.length === 0) {
    if (req.file) await deleteLocalImage(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: "Proyecto OpenSource no encontrado" });
  }

  const oldImageUrl = existingRows[0].image_url;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : oldImageUrl;
  const slug = slugify(req.body.slug || input.name) || `project-${req.params.id.slice(0, 8)}`;

  try {
    await pool.execute(
      `UPDATE open_source_projects
       SET name = ?, slug = ?, summary = ?, description = ?, github_url = ?, website_url = ?,
           image_url = ?, technologies = ?, published = ?, featured = ?, sort_order = ?
       WHERE id = ?`,
      [
        input.name, slug, input.summary, input.description, input.githubUrl, input.websiteUrl,
        imageUrl, JSON.stringify(input.technologies), input.published, input.featured, input.sortOrder,
        req.params.id,
      ],
    );
    if (req.file && oldImageUrl && oldImageUrl !== imageUrl) await deleteLocalImage(oldImageUrl);
    const [rows] = await pool.execute(`${openSourceSelect} WHERE id = ? LIMIT 1`, [req.params.id]);
    return res.json({ project: mapOpenSourceProject(rows[0]) });
  } catch (error) {
    if (req.file) await deleteLocalImage(imageUrl);
    return sendDatabaseError(res, error);
  }
});

app.delete("/api/admin/open-source/:id", requireAdmin, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT image_url FROM open_source_projects WHERE id = ? LIMIT 1",
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Proyecto OpenSource no encontrado" });
  await pool.execute("DELETE FROM open_source_projects WHERE id = ?", [req.params.id]);
  await deleteLocalImage(rows[0].image_url);
  return res.status(204).end();
});

app.get("/api/posts/:postId/comments", async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, author_name, content, created_at
     FROM comments
     WHERE post_id = ? AND approved = TRUE
     ORDER BY created_at DESC`,
    [req.params.postId],
  );
  res.json({ comments: rows });
});

app.post("/api/posts/:postId/comments", commentLimiter, async (req, res) => {
  const authorName = cleanText(req.body?.author_name, 120);
  const authorEmail = cleanText(req.body?.author_email, 255).toLowerCase();
  const content = cleanText(req.body?.content, 3000);
  if (!authorName || !/^\S+@\S+\.\S+$/.test(authorEmail) || content.length < 10) {
    return res.status(400).json({ error: "Revisa el nombre, correo y comentario" });
  }

  const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND published = TRUE LIMIT 1", [req.params.postId]);
  if (posts.length === 0) return res.status(404).json({ error: "Publicación no encontrada" });

  const id = randomUUID();
  await pool.execute(
    "INSERT INTO comments (id, post_id, author_name, author_email, content) VALUES (?, ?, ?, ?, ?)",
    [id, req.params.postId, authorName, authorEmail, content],
  );
  const [rows] = await pool.execute(
    "SELECT id, author_name, content, created_at FROM comments WHERE id = ? LIMIT 1",
    [id],
  );
  return res.status(201).json({ comment: rows[0] });
});

app.get("/sitemap.xml", async (_req, res) => {
  const [posts] = await pool.query(
    "SELECT slug, COALESCE(updated_at, created_at) AS last_modified FROM posts WHERE published = TRUE ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC",
  );
  const urls = [
    `<url><loc>${config.publicSiteUrl}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${config.publicSiteUrl}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${config.openSourceSiteUrl}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...legalPages.map(page => `<url><loc>${config.publicSiteUrl}${page.path}</loc><lastmod>${LEGAL_UPDATED}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>`),
    ...posts.map((post) => {
      const date = new Date(post.last_modified).toISOString().slice(0, 10);
      return `<url><loc>${config.publicSiteUrl}/blog/${encodeURIComponent(post.slug)}</loc><lastmod>${date}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    }),
  ];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
});

app.use("/api/agent", createNewsAgentRouter({ pool, tokens: { write: config.newsAgentToken, publish: config.newsAgentPublishToken } }));

app.use("/uploads", express.static(config.uploadDir, { fallthrough: false, maxAge: "7d" }));

app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint no encontrado" }));

const distDir = path.join(config.projectRoot, "dist");
if (fs.existsSync(distDir)) {
  for (const page of legalPages) {
    app.get(page.path, async (_req, res, next) => {
      try {
        const template = await fs.promises.readFile(path.join(distDir, "index.html"), "utf8");
        res.type("html").send(renderLegalPage(template, page, config.publicSiteUrl));
      } catch (error) { next(error); }
    });
  }
  app.get("/blog/:slug", async (req, res, next) => {
    try {
      const [rows] = await pool.execute(postSelect + " WHERE slug = ? AND published = TRUE LIMIT 1", [req.params.slug]);
      if (!rows.length) { res.status(404).type("html").send('<!doctype html><html lang="es"><head><meta name="robots" content="noindex"><title>Nota no encontrada | BZ Creators</title></head><body><a href="/blog">Volver a la bitácora</a></body></html>'); return; }
      const template = await fs.promises.readFile(path.join(distDir, "index.html"), "utf8");
      res.type("html").send(renderArticlePage(template, mapPost(rows[0]), config.publicSiteUrl));
    } catch (error) { next(error); }
  });
  app.use(express.static(distDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    return res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
});

export default app;
