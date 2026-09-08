import fs from "node:fs";
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
import { cleanArticleHtml, cleanText, parsePublished, slugify } from "./content.js";
import { deleteLocalImage, uploadImage } from "./uploads.js";

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
         meta_description, keywords, created_at, updated_at
  FROM posts
`;

const mapPost = (post) => ({ ...post, published: Boolean(post.published) });

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
    const [rows] = await pool.query(`${postSelect} WHERE published = TRUE ORDER BY created_at DESC`);
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
       (id, title, slug, content, image_url, category_id, published, meta_description, keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
       SET title = ?, slug = ?, content = ?, image_url = ?, category_id = ?, published = ?,
           meta_description = ?, keywords = ?
       WHERE id = ?`,
      [
        title,
        slug,
        content,
        imageUrl,
        req.body.category_id || "00000000-0000-4000-8000-000000000001",
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
    "SELECT slug, COALESCE(updated_at, created_at) AS last_modified FROM posts WHERE published = TRUE ORDER BY created_at DESC",
  );
  const urls = [
    `<url><loc>${config.publicSiteUrl}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${config.publicSiteUrl}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ...posts.map((post) => {
      const date = new Date(post.last_modified).toISOString().slice(0, 10);
      return `<url><loc>${config.publicSiteUrl}/blog/${encodeURIComponent(post.slug)}</loc><lastmod>${date}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    }),
  ];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
});

app.use("/uploads", express.static(config.uploadDir, { fallthrough: false, maxAge: "7d" }));

app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint no encontrado" }));

const distDir = path.join(config.projectRoot, "dist");
if (fs.existsSync(distDir)) {
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
