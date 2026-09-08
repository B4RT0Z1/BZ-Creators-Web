import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, User, Mail, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Comment, commentsApi } from "@/lib/api";

interface CommentsSectionProps {
  postId: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `hace ${diffDay} día${diffDay > 1 ? "s" : ""}`;
  if (diffHour > 0) return `hace ${diffHour} hora${diffHour > 1 ? "s" : ""}`;
  if (diffMin > 0) return `hace ${diffMin} minuto${diffMin > 1 ? "s" : ""}`;
  return "ahora mismo";
}

// Avatar colors based on name hash
const avatarColors = [
  "from-purple-500 to-violet-600",
  "from-orange-400 to-red-500",
  "from-blue-500 to-cyan-600",
  "from-emerald-400 to-teal-600",
  "from-pink-500 to-rose-600",
  "from-amber-400 to-orange-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", content: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string; content?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      setComments(await commentsApi.list(postId));
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) fetchComments();
  }, [postId, fetchComments]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) newErrors.name = "El nombre es requerido";
    if (!form.email.trim()) {
      newErrors.email = "El correo es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Ingresa un correo válido";
    }
    if (!form.content.trim()) newErrors.content = "El comentario no puede estar vacío";
    else if (form.content.trim().length < 10) newErrors.content = "El comentario debe tener al menos 10 caracteres";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitStatus("idle");

    try {
      const comment = await commentsApi.create(postId, {
        author_name: form.name.trim(),
        author_email: form.email.trim().toLowerCase(),
        content: form.content.trim(),
      });
      setComments((current) => [comment, ...current]);
      setSubmitStatus("success");
      setForm({ name: "", email: "", content: "" });
      setErrors({});
      setTimeout(() => setSubmitStatus("idle"), 5000);
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-xl px-4 py-3 text-[hsl(0_0%_90%)] placeholder-[hsl(0_0%_40%)] focus:outline-none focus:ring-2 focus:ring-[hsl(265_80%_60%)] focus:border-transparent transition-all duration-200";

  return (
    <div className="mt-16">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[hsl(0_0%_95%)]">Comentarios</h2>
          <p className="text-[hsl(0_0%_55%)] text-sm">
            {loadingComments ? "Cargando..." : `${comments.length} comentario${comments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Comment form */}
      <div className="bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] rounded-2xl p-6 mb-10 shadow-xl">
        <h3 className="text-lg font-semibold text-[hsl(0_0%_90%)] mb-5">Deja tu comentario</h3>

        {submitStatus === "success" && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-5 animate-in fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-sm font-medium">¡Comentario publicado con éxito! Gracias por tu aporte.</p>
          </div>
        )}

        {submitStatus === "error" && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm font-medium">Ocurrió un error al publicar. Intenta de nuevo.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(0_0%_55%)] uppercase tracking-wider mb-1.5">
                Nombre <span className="text-[hsl(265_80%_60%)]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(0_0%_40%)]" />
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: undefined }); }}
                  className={`${inputBase} pl-10 ${errors.name ? "border-red-500/60 ring-1 ring-red-500/30" : ""}`}
                />
              </div>
              {errors.name && <p className="text-red-400 text-xs mt-1.5">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(0_0%_55%)] uppercase tracking-wider mb-1.5">
                Correo electrónico <span className="text-[hsl(265_80%_60%)]">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(0_0%_40%)]" />
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: undefined }); }}
                  className={`${inputBase} pl-10 ${errors.email ? "border-red-500/60 ring-1 ring-red-500/30" : ""}`}
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
            </div>
          </div>

          {/* Content */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-[hsl(0_0%_55%)] uppercase tracking-wider mb-1.5">
              Comentario <span className="text-[hsl(265_80%_60%)]">*</span>
            </label>
            <textarea
              placeholder="Escribe tu comentario aquí..."
              rows={4}
              value={form.content}
              onChange={(e) => { setForm({ ...form, content: e.target.value }); setErrors({ ...errors, content: undefined }); }}
              className={`${inputBase} resize-none ${errors.content ? "border-red-500/60 ring-1 ring-red-500/30" : ""}`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.content ? (
                <p className="text-red-400 text-xs">{errors.content}</p>
              ) : (
                <span />
              )}
              <span className="text-[hsl(0_0%_40%)] text-xs">{form.content.length} caracteres</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[hsl(0_0%_40%)] text-xs">
              Tu correo no será visible públicamente.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publicar comentario
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Comments list */}
      {loadingComments ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[hsl(265_80%_60%)/30] border-t-[hsl(265_80%_60%)] rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-[hsl(0_0%_18%)] bg-[hsl(0_0%_6%)]">
          <MessageCircle className="w-12 h-12 text-[hsl(0_0%_25%)] mx-auto mb-3" />
          <p className="text-[hsl(0_0%_45%)] font-medium">Sé el primero en comentar</p>
          <p className="text-[hsl(0_0%_35%)] text-sm mt-1">¡Tu opinión importa!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="group bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_14%)] hover:border-[hsl(265_80%_60%/30)] rounded-2xl p-5 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-purple-900/10"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className={`shrink-0 w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(comment.author_name)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                >
                  {getInitials(comment.author_name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span className="font-semibold text-[hsl(0_0%_90%)] text-sm">{comment.author_name}</span>
                    <div className="flex items-center gap-1.5 text-[hsl(0_0%_40%)] text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(comment.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-[hsl(0_0%_70%)] text-sm leading-relaxed whitespace-pre-line">{comment.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
