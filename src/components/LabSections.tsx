import { ArrowRight, ArrowUpRight, Blocks, BrainCircuit, Code2, Database, GitBranch, Github, Layers3, ScanLine, ShoppingBag, Shirt, Footprints, Terminal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { assetUrl, openSourceApi } from "@/lib/api";
import { getWhatsAppUrl, openSourceUrl, OPEN_SOURCE_GITHUB_URL } from "@/lib/constants";

const capabilities = [
  { icon: Code2, number: "01", title: "Ingeniería de producto", text: "Aplicaciones web, plataformas y herramientas internas. De la primera decisión de arquitectura a una experiencia lista para usar.", tags: "SOFTWARE A MEDIDA / MVP / PLATAFORMAS" },
  { icon: BrainCircuit, number: "02", title: "Inteligencia aplicada", text: "Agentes, automatizaciones e integración de modelos. Partimos de un problema concreto para encontrar dónde la IA aporta valor.", tags: "AGENTES / AUTOMATIZACIÓN / IA" },
  { icon: Blocks, number: "03", title: "Sistemas conectados", text: "APIs, datos e infraestructura que trabajan juntos. Conectamos lo que ya existe y construimos lo que falta.", tags: "INTEGRACIONES / DATOS / INFRAESTRUCTURA" },
];

export function OpenSourcePreview() {
  const { data: projects = [], isPending, isError, refetch, isFetching } = useQuery({ queryKey: ["open-source", "public"], queryFn: openSourceApi.listPublic, retry: 1, staleTime: 60_000 });
  const selected = [...projects].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3);
  return <section className="lab-section open-source-section" id="codigo-abierto"><div className="lab-shell">
    <div className="section-heading"><div><p className="lab-eyebrow">04 / CONOCIMIENTO COMPARTIDO</p><h2>Construir. Compartir.<br /><span>Volver a construir.</span></h2></div><div className="section-aside"><p>Parte del laboratorio también vive fuera de él. Herramientas y código para que otras ideas sigan creciendo.</p><div className="flex flex-wrap gap-x-6"><a className="lab-text-link" href={openSourceUrl}>Explorar OpenSource <ArrowUpRight size={16} /></a><a className="lab-text-link" href={OPEN_SOURCE_GITHUB_URL} target="_blank" rel="noopener noreferrer"><Github size={16} /> Nuestro GitHub <ArrowUpRight size={16} /></a></div></div></div>
    {isPending ? <p className="repo-empty" role="status">Cargando proyectos del laboratorio…</p> : isError ? <div className="repo-empty" role="status"><Github size={25} /><p>No pudimos cargar los proyectos en este momento.</p><button className="lab-text-link" disabled={isFetching} onClick={() => refetch()}>{isFetching ? "Cargando…" : "Volver a intentar"} <ArrowRight size={16} /></button></div> : selected.length ? <div className="repo-grid">{selected.map(project => <article className="repo-card" key={project.id}>
      <div className="repo-card-top"><Github size={22} /><span className="lab-eyebrow">CÓDIGO ABIERTO</span></div>
      {project.image_url && <img className="repo-image" src={assetUrl(project.image_url)} alt={project.name} loading="lazy" width="480" height="240" />}
      <h3>{project.name}</h3><p>{project.summary}</p><div className="project-tags">{project.technologies.map(tech => <span key={tech}>{tech}</span>)}</div><a href={project.github_url} target="_blank" rel="noopener noreferrer" className="lab-text-link">Ver código <ArrowUpRight size={16} /></a>
    </article>)}</div> : <div className="repo-empty"><GitBranch size={28} /><div><h3>El próximo experimento empieza acá.</h3><p>Estamos preparando los primeros proyectos para compartir. Seguí las publicaciones del laboratorio en nuestro portal.</p></div><a className="lab-button" href={openSourceUrl}>Conocer el portal <ArrowUpRight size={16} /></a></div>}
  </div></section>;
}

export default function LabSections() {
  return <>
    <div className="lab-principles"><div className="lab-shell"><span>DE LA IDEA AL SISTEMA</span><p><Code2 size={17} /> Software con propósito</p><p><ScanLine size={17} /> Experimentación aplicada</p><p><GitBranch size={17} /> Cultura de código abierto</p></div></div>
    <section id="productos" className="lab-section lab-shell">
      <div className="section-heading"><div><p className="lab-eyebrow">01 / PROYECTOS SELECCIONADOS</p><h2>Lo que construimos<br /><span>habla por nosotros.</span></h2></div><p className="section-aside">Productos propios y herramientas que convierten problemas concretos en software.</p></div>
      <div className="projects-grid">
        <article className="project-card gym-project">
          <div className="project-visual gym-visual" aria-label="Áreas de producto de GymFlow">
            <div className="visual-top"><span>GF / GYMFLOW</span><span>SOFTWARE DE GESTIÓN</span></div>
            <div className="gym-wordmark">GymFlow<span>↗</span></div>
            <div className="gym-modules"><span><Layers3 size={19} /> Miembros</span><span><Database size={19} /> Gestión</span><span><ScanLine size={19} /> Seguimiento</span></div>
            <div className="visual-caption">UN SISTEMA. TODA LA OPERACIÓN.</div>
          </div>
          <div className="project-content"><div className="project-label"><span>PRODUCTO / GESTIÓN</span><span>01</span></div><h3>GymFlow</h3><p>La gestión de un gimnasio, en un solo lugar. Software para organizar miembros y acompañar la operación diaria.</p><div className="project-tags"><span>Plataforma web</span><span>Gestión de gimnasios</span></div><a className="lab-text-link" href="https://gymflow.one/" target="_blank" rel="noopener noreferrer">Explorar producto <ArrowUpRight size={16} /></a></div>
        </article>
        <article className="project-card">
          <div className="project-visual platform-visual" aria-label="Arquitectura de la plataforma BZ Creators">
            <div className="visual-top"><span>BZ / PUBLISHING SYSTEM</span><span>PLATAFORMA PROPIA</span></div>
            <div className="platform-diagram"><div className="platform-root"><Terminal size={22} /> BZ Creators</div><div className="platform-branches"><span>Bitácora</span><span>CMS</span><span>OpenSource</span></div></div>
            <div className="visual-caption">CONTENIDO Y CÓDIGO, CONECTADOS.</div>
          </div>
          <div className="project-content"><div className="project-label"><span>PLATAFORMA / PUBLICACIÓN</span><span>02</span></div><h3>El laboratorio, por dentro</h3><p>Nuestra plataforma de contenidos: blog, comentarios y proyectos abiertos gestionados desde un mismo CMS.</p><div className="project-tags"><span>React</span><span>Node.js</span><span>MySQL</span></div><a className="lab-text-link" href="/blog">Abrir la bitácora <ArrowUpRight size={16} /></a></div>
        </article>
        <article className="project-card honda-project">
          <div className="project-visual honda-visual" aria-label="Áreas de la tienda online InduHonda">
            <div className="visual-top"><span>IH / COMMERCE SYSTEM</span><span>INDUHONDA.UK</span></div>
            <div className="honda-wordmark">InduHonda<span>↗</span></div>
            <div className="honda-catalog" aria-hidden="true">
              <span><Shirt size={25} strokeWidth={1.3} />Indumentaria</span>
              <span><Footprints size={25} strokeWidth={1.3} />Calzado</span>
              <span><ShoppingBag size={25} strokeWidth={1.3} />Accesorios</span>
            </div>
            <div className="visual-caption">CATÁLOGO → VARIANTES → CONVERSACIÓN</div>
          </div>
          <div className="project-content">
            <div className="project-label"><span>E-COMMERCE / INDUMENTARIA</span><span>03</span></div>
            <h3>Honda Indumentaria</h3>
            <p>Una tienda de moda urbana de Navarro llevada al mundo digital. Catálogo por categorías, talles y variantes, con consultas por WhatsApp desde cada producto.</p>
            <div className="project-tags"><span>E-commerce</span><span>Catálogo</span><span>WhatsApp</span></div>
            <a className="lab-text-link" href="https://induhonda.uk/" target="_blank" rel="noopener noreferrer">Explorar tienda <ArrowUpRight size={16} /></a>
          </div>
        </article>
      </div>
    </section>
    <section id="servicios" className="lab-section capabilities-section"><div className="lab-shell">
      <div className="section-heading"><div><p className="lab-eyebrow">02 / CAPACIDADES</p><h2>Curiosidad sin límites.<br /><span>Ingeniería con criterio.</span></h2></div><p className="section-aside">Elegimos las herramientas según el problema. El objetivo siempre es construir algo útil.</p></div>
      <div className="capabilities-grid">{capabilities.map(item => <article key={item.number}><div className="capability-top"><item.icon size={25} strokeWidth={1.5} /><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.text}</p><span className="capability-tags">{item.tags}</span></article>)}</div>
    </div></section>
    <section id="proceso" className="lab-section lab-shell">
      <div className="section-heading"><div><p className="lab-eyebrow">03 / NUESTRO MÉTODO</p><h2>Menos suposiciones.<br /><span>Más iteraciones.</span></h2></div><p className="section-aside">Trabajamos en ciclos cortos, con entregables visibles y decisiones compartidas.</p></div>
      <ol className="process-pipeline">{[
        ["01", "Explorar", "Entendemos el problema, el contexto y qué vale la pena resolver.", "Alcance + hipótesis"],
        ["02", "Prototipar", "Convertimos las ideas en una experiencia que se puede recorrer y discutir.", "Prototipo + feedback"],
        ["03", "Construir", "Desarrollamos, conectamos y probamos el sistema por partes.", "Software + pruebas"],
        ["04", "Evolucionar", "Acompañamos la puesta en marcha y las siguientes decisiones de producto.", "Entrega + aprendizaje"],
      ].map(([number, title, text, output]) => <li key={number}><span className="process-number">{number}</span><h3>{title}</h3><p>{text}</p><span className="process-output">↳ {output}</span></li>)}</ol>
    </section>
    <OpenSourcePreview />
    <section id="contacto" className="lab-section lab-shell contact-section"><p className="lab-eyebrow"><span className="signal-dot" /> EL PRÓXIMO PROYECTO</p><h2>¿Y si lo<br /><span>construimos?</span></h2><div className="contact-bottom"><p>Una idea, un desafío técnico o algo que todavía no tiene nombre. Nos interesa escucharlo.</p><a className="lab-button primary" href={getWhatsAppUrl("Hola! Tengo una idea y me gustaría explorar cómo construirla con BZ Creators.")} target="_blank" rel="noopener noreferrer">Hablemos de tu proyecto <ArrowUpRight size={18} /></a></div></section>
  </>;
}
