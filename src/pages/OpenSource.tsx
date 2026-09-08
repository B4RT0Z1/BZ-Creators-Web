import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Code2, ExternalLink, Github, HeartHandshake, Sparkles } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { assetUrl, OpenSourceProject, openSourceApi } from "@/lib/api";

export default function OpenSource() {
  const [projects, setProjects] = useState<OpenSourceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = "OpenSource | BZ Creators";
    openSourceApi.listPublic()
      .then(setProjects)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));

    return () => { document.title = "BZ Creators"; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-36 md:pt-32">
        <section className="relative overflow-hidden border-b border-border/40 px-4 pb-20 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.22),transparent_58%)]" />
          <div className="container relative mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"
            >
              <HeartHandshake className="h-4 w-4" />
              Tecnología abierta por BZ Creators
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="font-heading text-5xl font-bold tracking-tight md:text-7xl"
            >
              Open<span className="bg-gradient-primary bg-clip-text text-transparent">Source</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              Apps, herramientas y software que compartimos con la comunidad para que otras ideas puedan crecer más rápido.
            </motion.p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20">
          {loading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl border border-border bg-card" />)}
            </div>
          )}

          {!loading && failed && (
            <div className="mx-auto max-w-xl rounded-3xl border border-destructive/30 bg-destructive/10 p-8 text-center">
              <p className="font-medium">No pudimos cargar los proyectos en este momento.</p>
              <p className="mt-2 text-sm text-muted-foreground">Vuelve a intentarlo en unos minutos.</p>
            </div>
          )}

          {!loading && !failed && projects.length === 0 && (
            <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-primary/30 bg-card/60 p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mt-6 font-heading text-2xl font-bold">Estamos preparando nuestros primeros lanzamientos</h2>
              <p className="mt-3 text-muted-foreground">Muy pronto vas a encontrar aquí herramientas abiertas creadas y mantenidas por la agencia.</p>
            </div>
          )}

          {!loading && !failed && projects.length > 0 && (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, index) => (
                <motion.article
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: Math.min(index * 0.05, 0.25) }}
                  className="group flex overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow-primary"
                >
                  <div className="flex w-full flex-col">
                    <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 via-background to-accent/15">
                      {project.image_url ? (
                        <img src={assetUrl(project.image_url)} alt={project.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <Code2 className="h-16 w-16 text-primary/70" />
                      )}
                      {project.featured && (
                        <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Destacado</span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="font-heading text-2xl font-bold">{project.name}</h2>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
                      <div
                        className="prose prose-sm prose-invert mt-4 line-clamp-5 max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                      />

                      {project.technologies.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {project.technologies.map((technology) => (
                            <span key={technology} className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">{technology}</span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap gap-3 pt-7">
                        <a
                          href={project.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85"
                        >
                          <Github className="h-4 w-4" /> Código
                        </a>
                        {project.website_url && (
                          <a
                            href={project.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/50 hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" /> Ver proyecto
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
