import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import bzLogo from "@/assets/logo-web.webp";
import { mainSiteUrl, openSourceUrl } from "@/lib/constants";

const navLinks = [
  { label: "Proyectos", href: mainSiteUrl("/#productos") },
  { label: "Capacidades", href: mainSiteUrl("/#servicios") },
  { label: "El proceso", href: mainSiteUrl("/#proceso") },
  { label: "OpenSource", href: openSourceUrl },
  { label: "Bitácora", href: mainSiteUrl("/blog") },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); menuButton.current?.focus(); }
    };
    const onResize = () => { if (window.innerWidth >= 1024) setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [isOpen]);
  return (
    <header className="lab-header">
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <nav className="lab-shell lab-nav" aria-label="Navegación principal">
        <a href={mainSiteUrl("/")} className="lab-brand" aria-label="BZ Creators — inicio"><img src={bzLogo} alt="BZ Creators" width="132" height="48" /><span><strong>BZ Creators</strong><small>PRODUCT LAB</small></span></a>
        <div className="desktop-nav">{navLinks.map(link => <a key={link.label} href={link.href}>{link.label}</a>)}</div>
        <a className="nav-contact" href={mainSiteUrl("/#contacto")}>Hablemos <ArrowUpRight size={15} /></a>
        <button ref={menuButton} className="menu-toggle" aria-label={isOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={isOpen} aria-controls="mobile-navigation" onClick={() => setIsOpen(!isOpen)}>{isOpen ? <X /> : <Menu />}</button>
      </nav>
      {isOpen && <div id="mobile-navigation" className="mobile-nav lab-shell">{[...navLinks, { label: "Hablemos", href: mainSiteUrl("/#contacto") }].map(link => <a key={link.label} href={link.href} onClick={() => setIsOpen(false)}>{link.label}<ArrowUpRight size={16} /></a>)}</div>}
    </header>
  );
}
