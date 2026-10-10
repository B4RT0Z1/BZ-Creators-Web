import bzLogo from "@/assets/logo-web.webp";
import { mainSiteUrl, openSourceUrl, OPEN_SOURCE_GITHUB_URL } from "@/lib/constants";
import { legalPages } from "../../shared/legal-content.js";

export default function Footer() {
  return <footer className="lab-footer"><div className="lab-shell">
    <div className="footer-top"><a href={mainSiteUrl("/")}><img src={bzLogo} alt="BZ Creators" width="132" height="48" /></a><p>Curiosidad para explorar.<br />Ingeniería para hacerlo real.</p><div className="footer-links"><a href={openSourceUrl}>OpenSource</a><a href={OPEN_SOURCE_GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a><a href={mainSiteUrl("/blog")}>Bitácora</a><a href={mainSiteUrl("/equipo")}>Equipo</a><a href={mainSiteUrl("/#contacto")}>Contacto</a></div></div>
    <nav className="footer-legal" aria-label="Páginas legales">{legalPages.map(page => <a key={page.path} href={mainSiteUrl(page.path)}>{page.label}</a>)}</nav>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} BZ Creators</span><span>LABORATORIO DE PRODUCTO TECNOLÓGICO</span><span>Diseñado para evolucionar ↗</span></div>
  </div></footer>;
}
