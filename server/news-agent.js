import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { cleanArticleHtml, cleanExternalUrl, cleanText, slugify } from "./content.js";

/**
 * API estrecha para el agente de noticias (Dina). No usa la sesión de administrador:
 *  - NEWS_AGENT_TOKEN: crear borradores y listar lo que ya existe (nunca publica ni borra).
 *  - NEWS_AGENT_PUBLISH_TOKEN: solo para el botón de aprobación; publica o descarta borradores
 *    que creó el agente (nunca toca publicaciones hechas por una persona).
 * Con un token ausente o de menos de 32 caracteres, esa parte queda deshabilitada.
 */

const MIN_TOKEN = 32;
const DEFAULT_CATEGORY_ID = "00000000-0000-4000-8000-000000000001";
const MAX_CONTENT = 200_000;

const digest = (value) => createHash("sha256").update(String(value)).digest();
const sameToken = (given, expected) => timingSafeEqual(digest(given), digest(expected));

const bearer = (req) => {
  const header = String(req.headers.authorization ?? "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

const requireToken = (expected) => (req, res, next) => {
  if (!expected || expected.length < MIN_TOKEN) return res.status(503).json({ error: "El acceso del agente no está habilitado" });
  const given = bearer(req);
  if (!given || !sameToken(given, expected)) return res.status(401).json({ error: "Credencial del agente inválida" });
  return next();
};

const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");
const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function createNewsAgentRouter({ pool, tokens }) {
  const router = express.Router();
  router.use(rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes del agente" } }));
  const write = requireToken(tokens?.write ?? "");
  const approve = requireToken(tokens?.publish ?? "");

  // Lo ya cargado (borradores incluidos), para que el agente no repita notas.
  router.get("/posts", write, async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.title, p.slug, p.published, p.created_at, d.source_url
           FROM posts p LEFT JOIN agent_drafts d ON d.post_id = p.id
          ORDER BY p.created_at DESC LIMIT 200`,
      );
      res.json({ posts: rows.map((row) => ({ ...row, published: Boolean(row.published) })) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Crea SIEMPRE un borrador. La fuente es obligatoria y queda citada al pie de la nota.
  router.post("/posts", write, async (req, res) => {
    const title = cleanText(req.body?.title, 255);
    const sourceUrl = cleanExternalUrl(req.body?.source_url, { required: true });
    let content = cleanArticleHtml(String(req.body?.content ?? "").slice(0, MAX_CONTENT));
    if (!title || !content) return res.status(400).json({ error: "Título y contenido son obligatorios" });
    if (!sourceUrl) return res.status(400).json({ error: "Falta la fuente (source_url con http o https)" });
    if (!content.includes(sourceUrl)) {
      content += `<p class="source">Fuente: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(sourceUrl))}</a></p>`;
    }
    const imageUrl = req.body?.image_url ? cleanExternalUrl(req.body.image_url) : null;
    const id = randomUUID();
    const baseSlug = slugify(req.body?.slug || title) || `nota-${id.slice(0, 8)}`;
    try {
      const [duplicate] = await pool.execute("SELECT post_id FROM agent_drafts WHERE source_url = ? LIMIT 1", [sourceUrl]);
      if (duplicate.length > 0) return res.status(409).json({ error: "Ya hay una nota de esa fuente" });
      let slug = baseSlug;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await pool.execute(
            `INSERT INTO posts (id, title, slug, content, image_url, category_id, published, meta_description, keywords)
             VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
            [id, title, slug, content, imageUrl, DEFAULT_CATEGORY_ID, cleanText(req.body?.meta_description, 320) || null, cleanText(req.body?.keywords, 500) || null],
          );
          break;
        } catch (error) {
          if (error?.errno !== 1062 || attempt === 4) throw error;
          slug = `${baseSlug.slice(0, 230)}-${randomUUID().slice(0, 6)}`;
        }
      }
      await pool.execute("INSERT INTO agent_drafts (post_id, source_url) VALUES (?, ?)", [id, sourceUrl]);
      return res.status(201).json({ post: { id, title, slug, published: false, source_url: sourceUrl } });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  const ownDraft = async (id) => {
    const [rows] = await pool.execute(
      `SELECT p.id, p.slug, p.published FROM posts p JOIN agent_drafts d ON d.post_id = p.id WHERE p.id = ? LIMIT 1`,
      [id],
    );
    return rows[0];
  };

  router.post("/posts/:id/publish", approve, async (req, res) => {
    try {
      const draft = await ownDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: "No existe ese borrador del agente" });
      if (draft.published) return res.status(409).json({ error: "Ya estaba publicada" });
      await pool.execute("UPDATE posts SET published = TRUE WHERE id = ?", [draft.id]);
      return res.json({ post: { id: draft.id, slug: draft.slug, published: true } });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.post("/posts/:id/discard", approve, async (req, res) => {
    try {
      const draft = await ownDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: "No existe ese borrador del agente" });
      if (draft.published) return res.status(409).json({ error: "Ya está publicada: se baja desde el panel" });
      await pool.execute("DELETE FROM posts WHERE id = ?", [draft.id]);
      return res.json({ discarded: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  return router;
}
