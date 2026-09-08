import { useState } from "react";
import { ArrowDown, ArrowUpRight, Check, Code2, GitBranch, Layers3, Terminal } from "lucide-react";

const stages = [
  { label: "Explorar", title: "Toda solución empieza con una buena pregunta.", log: "Definir el problema · Identificar usuarios · Acordar el alcance", output: "Hipótesis de producto", icon: Layers3 },
  { label: "Construir", title: "De la hipótesis a un sistema que podés probar.", log: "Diseñar la experiencia · Conectar los datos · Iterar el prototipo", output: "Prototipo funcional", icon: Code2 },
  { label: "Validar", title: "Probar, aprender y volver a construir.", log: "Revisar los flujos · Medir el comportamiento · Preparar la entrega", output: "Plan de validación", icon: Check },
];

export default function HeroSection() {
  const [active, setActive] = useState(1);
  const stage = stages[active];
  return (
    <section id="inicio" className="lab-hero lab-shell">
      <div className="hero-copy">
        <p className="lab-eyebrow"><span className="signal-dot" /> LABORATORIO DE PRODUCTO TECNOLÓGICO</p>
        <h1>Ideas que se<br />convierten en<br /><span>tecnología.</span></h1>
        <p className="hero-description">Exploramos, diseñamos y construimos software.<br className="hidden lg:block" /> Unimos inteligencia artificial e ingeniería para llevar lo que imaginás al mundo real.</p>
        <div className="hero-actions">
          <a className="lab-button primary" href="#productos">Explorar proyectos <ArrowUpRight size={17} /></a>
          <a className="lab-text-link" href="#contacto">Construyamos algo <ArrowUpRight size={16} /></a>
        </div>
        <p className="hero-footnote"><span>SOFTWARE</span><span>IA APLICADA</span><span>OPEN SOURCE</span></p>
      </div>
      <div className="lab-workbench" aria-label="Demostración interactiva de nuestro proceso">
        <div className="workbench-top"><span><Terminal size={14} /> bz / workspace</span><span className="demo-label">DEMO INTERACTIVA</span></div>
        <div className="workbench-tabs" aria-label="Etapas del proceso">
          {stages.map((item, index) => <button key={item.label} aria-pressed={active === index} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.label}</button>)}
        </div>
        <div className="system-map" aria-hidden="true">
          <div className="map-grid" />
          <div className="map-orbit orbit-one" /><div className="map-orbit orbit-two" />
          <div className="map-line line-left" /><div className="map-line line-right" />
          <div className="map-node node-left"><Layers3 size={19} /><span>idea</span></div>
          <div className="map-core"><stage.icon size={35} strokeWidth={1.3} /><span>BZ ENGINE</span></div>
          <div className="map-node node-right"><Code2 size={19} /><span>producto</span></div>
          <span className="map-caption">INTELIGENCIA + INGENIERÍA</span>
        </div>
        <div className="workbench-output" aria-live="polite" aria-atomic="true">
          <span className="lab-eyebrow">0{active + 1} / {stage.output}</span>
          <h2>{stage.title}</h2>
          <p><span className="text-violet-400">›</span> {stage.log}</p>
        </div>
        <div className="workbench-bottom"><span><GitBranch size={13} /> idea → prototipo → producto</span><span>hecho para iterar</span></div>
      </div>
      <a className="hero-scroll" href="#productos"><ArrowDown size={14} /> DENTRO DEL LABORATORIO</a>
    </section>
  );
}
