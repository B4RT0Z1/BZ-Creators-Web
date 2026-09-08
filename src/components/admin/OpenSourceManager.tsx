import { type ReactNode, useEffect, useState } from "react";
import { Edit, ExternalLink, Github, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, OpenSourceProject, openSourceApi } from "@/lib/api";

const emptyForm = {
  name: "",
  summary: "",
  description: "",
  githubUrl: "",
  websiteUrl: "",
  technologies: "",
  sortOrder: "0",
  published: true,
  featured: false,
};

export default function OpenSourceManager() {
  const [projects, setProjects] = useState<OpenSourceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    try {
      setProjects(await openSourceApi.listAdmin());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudieron cargar los proyectos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImage(null);
    setEditing(true);
  };

  const startEdit = (project: OpenSourceProject) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      summary: project.summary,
      description: project.description,
      githubUrl: project.github_url,
      websiteUrl: project.website_url || "",
      technologies: project.technologies.join(", "),
      sortOrder: String(project.sort_order),
      published: project.published,
      featured: project.featured,
    });
    setImage(null);
    setEditing(true);
  };

  const saveProject = async () => {
    if (!form.name.trim() || !form.summary.trim() || !form.description.trim() || !form.githubUrl.trim()) {
      toast.error("Completa nombre, resumen, descripción y enlace de GitHub");
      return;
    }

    const payload = new FormData();
    payload.set("name", form.name.trim());
    payload.set("summary", form.summary.trim());
    payload.set("description", form.description);
    payload.set("github_url", form.githubUrl.trim());
    payload.set("website_url", form.websiteUrl.trim());
    payload.set("technologies", form.technologies.trim());
    payload.set("sort_order", form.sortOrder);
    payload.set("published", String(form.published));
    payload.set("featured", String(form.featured));
    if (image) payload.set("image", image);

    setSaving(true);
    try {
      if (editingId) await openSourceApi.update(editingId, payload);
      else await openSourceApi.create(payload);
      toast.success(editingId ? "Proyecto actualizado" : "Proyecto OpenSource creado");
      setEditing(false);
      setEditingId(null);
      setForm(emptyForm);
      setImage(null);
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el proyecto");
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async (project: OpenSourceProject) => {
    if (!confirm(`¿Eliminar “${project.name}”?`)) return;
    try {
      await openSourceApi.remove(project.id);
      toast.success("Proyecto eliminado");
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar el proyecto");
    }
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">OpenSource</p>
            <h2 className="text-3xl font-bold text-slate-800">{editingId ? "Editar proyecto" : "Nuevo proyecto"}</h2>
          </div>
          <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>

        <div className="space-y-6 rounded-xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre de la app" />
            </Field>
            <Field label="Repositorio de GitHub">
              <Input type="url" value={form.githubUrl} onChange={(event) => setForm({ ...form, githubUrl: event.target.value })} placeholder="https://github.com/..." />
            </Field>
          </div>

          <Field label="Resumen corto">
            <Input maxLength={500} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Qué resuelve y para quién" />
          </Field>

          <Field label="Explicación completa">
            <RichTextEditor value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Web o demo (opcional)">
              <Input type="url" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Tecnologías">
              <Input value={form.technologies} onChange={(event) => setForm({ ...form, technologies: event.target.value })} placeholder="React, Node.js, MySQL" />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Imagen (opcional)">
              <Input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] || null)} />
            </Field>
            <Field label="Orden">
              <Input type="number" min={-9999} max={9999} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6 rounded-lg bg-slate-50 p-4">
            <CheckField label="Publicado" checked={form.published} onChange={(published) => setForm({ ...form, published })} />
            <CheckField label="Destacado" checked={form.featured} onChange={(featured) => setForm({ ...form, featured })} />
          </div>

          <Button disabled={saving} onClick={saveProject} className="bg-blue-600 px-8 text-white hover:bg-blue-700">
            {saving ? "Guardando..." : editingId ? "Actualizar proyecto" : "Publicar proyecto"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">Catálogo público</p>
          <h2 className="text-3xl font-bold text-slate-800">Proyectos OpenSource</h2>
        </div>
        <Button onClick={startNew} className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-2 h-5 w-5" /> Nuevo proyecto
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-white p-12 text-center text-slate-500">Cargando proyectos...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Github className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 font-medium text-slate-700">Aún no hay proyectos publicados.</p>
          <p className="mt-1 text-sm text-slate-500">Crea el primero para que aparezca en opensource.bzcreators.com.ar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800">{project.name}</h3>
                    {!project.published && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Borrador</span>}
                    {project.featured && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Destacado</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{project.summary}</p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">#{project.sort_order}</span>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon" title="Abrir GitHub"><ExternalLink className="h-4 w-4 text-blue-600" /></Button>
                </a>
                <Button variant="outline" size="icon" title="Editar" onClick={() => startEdit(project)}><Edit className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="Eliminar" onClick={() => removeProject(project)} className="hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
      {label}
    </label>
  );
}
