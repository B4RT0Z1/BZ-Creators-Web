import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { legalArticleHtml, legalPages } from "../../shared/legal-content.js";
import { mainSiteUrl } from "@/lib/constants";

export default function LegalPage() {
  const { pathname } = useLocation();
  const page = legalPages.find(p => p.path === pathname.replace(/\/$/, ""))!;
  useEffect(() => {
    const previousTitle = document.title;
    const restore: Array<() => void> = [];
    document.title = `${page.title} | BZ Creators`;
    const setMeta = (attribute: string, key: string, value: string) => {
      const previous = document.querySelector(`meta[${attribute}="${key}"]`);
      const node = previous || document.head.appendChild(document.createElement("meta"));
      const oldContent = node.getAttribute("content");
      node.setAttribute(attribute, key); node.setAttribute("content", value);
      restore.push(() => { if (!previous) node.remove(); else if (oldContent !== null) node.setAttribute("content", oldContent); else node.removeAttribute("content"); });
    };
    setMeta("name", "description", page.description);
    const canonical = document.querySelector('link[rel="canonical"]') || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical" }));
    const previousCanonical = canonical.getAttribute("href");
    canonical.setAttribute("href", `https://bzcreators.com.ar${page.path}`);
    for (const [property, content] of [["og:title", document.title], ["og:description", page.description], ["og:url", `https://bzcreators.com.ar${page.path}`]]) setMeta("property", property, content);
    setMeta("name", "twitter:title", document.title); setMeta("name", "twitter:description", page.description);
    return () => { document.title = previousTitle; if (previousCanonical) canonical.setAttribute("href", previousCanonical); else canonical.remove(); restore.forEach(reset => reset()); };
  }, [page]);
  return <div className="lab-page"><Navbar /><main id="main-content" className="lab-shell legal-main"><nav className="legal-nav" aria-label="Información legal">{legalPages.map(p => <a key={p.path} href={mainSiteUrl(p.path)} aria-current={p.path === page.path ? "page" : undefined}>{p.label}</a>)}</nav><article className="legal-document" dangerouslySetInnerHTML={{ __html: legalArticleHtml(page) }} /></main><Footer /></div>;
}
