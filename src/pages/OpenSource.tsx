import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Code2, Github, Search } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { assetUrl, openSourceApi } from "@/lib/api";
import { OPEN_SOURCE_GITHUB_ACCOUNT, OPEN_SOURCE_GITHUB_URL } from "@/lib/constants";

export default function OpenSource() {
  const [search, setSearch] = useState("");
  const [technology, setTechnology] = useState("");
  const { data: projects = [], isPending, isError, refetch, isFetching } = useQuery({ queryKey: ["open-source", "public"], queryFn: openSourceApi.listPublic, retry: 1, staleTime: 60_000 });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "OpenSource | BZ Creators";
    return () => { document.title = previousTitle; };
  }, []);
  const technologies = [...new Set(projects.flatMap(project => project.technologies))].sort();
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const filtered = projects.filter(project => (!technology || project.technologies.includes(technology)) && [project.name, project.summary, ...project.technologies].join(" ").toLocaleLowerCase("es").includes(normalizedSearch));
  const ordered = [...filtered].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order);
  return <div className="lab-page"><Navbar /><main id="main-content" className="opensource-main">
    <section className="lab-shell lab-section"><p className="lab-eyebrow"><Github size={15} /> BZ CREATORS / CÓDIGO ABIERTO</p><div className="section-heading"><div><h1 className="opensource-title">El laboratorio.<br /><span>Abierto.</span></h1></div><div className="section-aside"><p>Apps, herramientas y experimentos que compartimos para que otras ideas puedan crecer. Explorá el código y construí a partir de él.</p><a className="lab-text-link" href={OPEN_SOURCE_GITHUB_URL} target="_blank" rel="noopener noreferrer"><Github size={16} /> @{OPEN_SOURCE_GITHUB_ACCOUNT} <ArrowUpRight size={16} /></a></div></div>
      <div className="repo-filters"><label className="repo-search"><Search size={17} /><span className="sr-only">Buscar proyectos</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o tecnología…" /></label><label className="repo-select"><span className="sr-only">Filtrar por tecnología</span><select value={technology} onChange={event => setTechnology(event.target.value)}><option value="">Todas las tecnologías</option>{technologies.map(item => <option key={item}>{item}</option>)}</select></label></div>
      {isPending ? <p role="status" className="repo-empty">Cargando proyectos…</p> : isError ? <div className="repo-empty" role="status"><p>No pudimos cargar los proyectos en este momento.</p><button className="lab-button" disabled={isFetching} onClick={() => refetch()}>{isFetching ? "Cargando…" : "Volver a intentar"}</button></div> : projects.length === 0 ? <div className="repo-empty"><Code2 size={30} /><div><h2>Estamos preparando los primeros lanzamientos.</h2><p>Este espacio va a reunir herramientas abiertas creadas por el laboratorio.</p></div></div> : <>
      <p className="repo-count" role="status">{ordered.length} {ordered.length === 1 ? "proyecto" : "proyectos"}{search || technology ? " encontrados" : " publicados"}</p>
      {ordered.length === 0 ? <div className="repo-empty"><p>No encontramos proyectos con esos filtros.</p><button className="lab-button" onClick={() => { setSearch(""); setTechnology(""); }}>Limpiar filtros</button></div> : <div className="repo-grid catalog-grid">{ordered.map((project, index) => <article key={project.id} className={`repo-card ${project.featured && index === 0 && !search && !technology ? "featured-repo" : ""}`}>
        <div className="repo-card-top"><Github size={22} /><span className="lab-eyebrow">{project.featured ? "DESTACADO" : "CÓDIGO ABIERTO"}</span></div>
        {project.image_url && <img className="repo-image" src={assetUrl(project.image_url)} alt={project.name} loading="lazy" width="640" height="320" />}
        <h2>{project.name}</h2><p>{project.summary}</p><div className="prose prose-sm prose-invert mt-4 max-w-none text-muted-foreground break-words" dangerouslySetInnerHTML={{ __html: project.description }} />
        <div className="project-tags">{project.technologies.map(item => <span key={item}>{item}</span>)}</div>
        <p className="repo-date">Actualizado el {new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(project.updated_at))}</p>
        <div className="repo-actions"><a className="lab-button" href={project.github_url} target="_blank" rel="noopener noreferrer"><Github size={15} /> Ver código</a>{project.website_url && <a className="lab-text-link" href={project.website_url} target="_blank" rel="noopener noreferrer">Ver proyecto <ArrowUpRight size={16} /></a>}</div>
      </article>)}</div>}</>}
    </section></main><Footer /></div>;
}
