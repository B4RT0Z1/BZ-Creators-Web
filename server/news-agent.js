import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { editorialFields, articleRevision } from "./news-editorial.js";
import rateLimit from "express-rate-limit";
import { cleanExternalUrl, slugify } from "./content.js";

/**
 * API estrecha para el agente de noticias (Dina). No usa la sesión de administrador:
 *  - NEWS_AGENT_TOKEN: crear borradores y listar lo que ya existe (nunca publica ni borra).
 *  - NEWS_AGENT_PUBLISH_TOKEN: solo para el botón de aprobación; publica o descarta borradores
 *    que creó el agente (nunca toca publicaciones hechas por una persona).
 * Con un token ausente o de menos de 32 caracteres, esa parte queda deshabilitada.
 */

const MIN_TOKEN = 32;
const DEFAULT_CATEGORY_ID = "00000000-0000-4000-8000-000000000001";

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

  // Crea SIEMPRE un borrador. La fuente es obligatoria y se conserva solo en el registro interno.
  router.post("/posts", write, async (req, res) => {
    const sourceUrl = cleanExternalUrl(req.body?.source_url, { required: true });
    if (!sourceUrl || new URL(sourceUrl).username || new URL(sourceUrl).password) return res.status(400).json({ error: "Falta una fuente válida para el registro interno" });
    let fields;
    try { fields = editorialFields(req.body ?? {}); } catch (error) { return res.status(400).json({ error: error.message }); }
    const { title, content, image_url: imageUrl } = fields;
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
            [id, title, slug, content, imageUrl, DEFAULT_CATEGORY_ID, fields.meta_description, fields.keywords],
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
      `SELECT p.id, p.slug, p.published, p.title, p.content, p.image_url, p.meta_description, p.keywords FROM posts p JOIN agent_drafts d ON d.post_id = p.id WHERE p.id = ? LIMIT 1`,
      [id],
    );
    return rows[0];
  };

  router.get("/posts/:id", approve, async (req, res) => {
    try {
      const post = await ownDraft(req.params.id);
      if (!post) return res.status(404).json({ error: "No existe esa nota del agente" });
      return res.json({ post: { ...post, published: Boolean(post.published), revision: articleRevision(post) } });
    } catch (error) { console.error(error); return res.status(500).json({ error: "Error interno del servidor" }); }
  });
  router.post("/posts/:id/update", approve, async (req, res) => {
    try {
      const post = await ownDraft(req.params.id);
      if (!post) return res.status(404).json({ error: "No existe esa nota del agente" });
      if (req.body?.expectedRevision !== articleRevision(post)) return res.status(409).json({ error: "La nota cambió: volvé a leerla antes de editar" });
      if (!req.body || Object.keys(req.body).some(key => !["title", "content", "image_url", "meta_description", "keywords", "expectedRevision"].includes(key))) return res.status(400).json({ error: "El cambio contiene campos no admitidos" });
      let fields;
      try { fields = editorialFields({ ...post, ...req.body }); } catch (error) { return res.status(400).json({ error: error.message }); }
      const [changed] = await pool.execute("UPDATE posts p JOIN agent_drafts d ON d.post_id = p.id SET p.title = ?, p.content = ?, p.image_url = ?, p.meta_description = ?, p.keywords = ? WHERE p.id = ? AND BINARY p.title <=> BINARY ? AND BINARY p.content <=> BINARY ? AND BINARY p.image_url <=> BINARY ? AND BINARY p.meta_description <=> BINARY ? AND BINARY p.keywords <=> BINARY ? AND p.published <=> ?", [fields.title, fields.content, fields.image_url, fields.meta_description, fields.keywords, post.id, post.title, post.content, post.image_url, post.meta_description, post.keywords, post.published]);
      if (changed.affectedRows !== 1) return res.status(409).json({ error: "La nota cambió: volvé a leerla antes de editar" });
      return res.json({ post: { id: post.id, slug: post.slug, published: Boolean(post.published), ...fields } });
    } catch (error) { console.error(error); return res.status(500).json({ error: "Error interno del servidor" }); }
  });
  router.post("/posts/:id/delete", approve, async (req, res) => {
    try {
      const post = await ownDraft(req.params.id);
      if (!post) return res.status(404).json({ error: "No existe esa nota del agente" });
      if (req.body?.expectedRevision !== articleRevision(post)) return res.status(409).json({ error: "La nota cambió: pedí una nueva confirmación antes de borrar" });
      const [deleted] = await pool.execute("DELETE p FROM posts p JOIN agent_drafts d ON d.post_id = p.id WHERE p.id = ? AND BINARY p.title <=> BINARY ? AND BINARY p.content <=> BINARY ? AND BINARY p.image_url <=> BINARY ? AND BINARY p.meta_description <=> BINARY ? AND BINARY p.keywords <=> BINARY ? AND p.published <=> ?", [post.id, post.title, post.content, post.image_url, post.meta_description, post.keywords, post.published]);
      if (deleted.affectedRows !== 1) return res.status(409).json({ error: "La nota cambió: pedí otra confirmación" });
      return res.json({ deleted: true });
    } catch (error) { console.error(error); return res.status(500).json({ error: "Error interno del servidor" }); }
  });

  router.post("/posts/:id/publish", approve, async (req, res) => {
    try {
      const draft = await ownDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: "No existe ese borrador del agente" });
      if (draft.published) return res.status(409).json({ error: "Ya estaba publicada" });
      try { editorialFields(draft); } catch (error) { return res.status(400).json({ error: "Antes de publicar: " + error.message }); }
      await pool.execute("UPDATE posts SET published = TRUE WHERE id = ?", [draft.id]);
      return res.json({ post: { id: draft.id, slug: draft.slug, published: true } });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Takes down a note the agent published (it goes back to being a draft); never touches notes made by a person.
  router.post("/posts/:id/unpublish", approve, async (req, res) => {
    try {
      const draft = await ownDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: "No existe esa nota del agente" });
      if (!draft.published) return res.status(409).json({ error: "Ya estaba como borrador" });
      await pool.execute("UPDATE posts SET published = FALSE WHERE id = ?", [draft.id]);
      return res.json({ post: { id: draft.id, slug: draft.slug, published: false } });
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
