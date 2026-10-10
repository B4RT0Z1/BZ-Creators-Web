import { useEffect, useRef, useState } from "react";
import { CONSENT_EVENT, CookieChoice, loadOptionalTags, readCookieChoice, saveCookieChoice } from "@/lib/cookie-consent";
import { mainSiteUrl } from "@/lib/constants";

export default function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice | null>(readCookieChoice);
  const [editing, setEditing] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (choice === "accepted") loadOptionalTags();
  }, [choice]);
  useEffect(() => {
    const open = () => { opener.current = document.activeElement as HTMLElement; setEditing(true); };
    window.addEventListener(CONSENT_EVENT, open);
    return () => window.removeEventListener(CONSENT_EVENT, open);
  }, []);
  useEffect(() => { if (editing) region.current?.focus(); }, [editing]);
  const choose = (next: CookieChoice) => {
    const revoking = next === "rejected" && !!document.getElementById("bz-optional-gtm");
    saveCookieChoice(next);
    setChoice(next);
    setEditing(false);
    opener.current?.focus();
    // Removing a script element cannot stop code already executed by a container.
    if (revoking) window.location.reload();
  };
  if (choice && !editing) return null;
  return <div ref={region} tabIndex={-1} className="cookie-notice" role="region" aria-labelledby="cookie-heading">
    <div><h2 id="cookie-heading">Tu elección de privacidad</h2><p>La sesión de administración es esencial. El contenedor existente de Google Tag Manager sólo se carga si aceptás; en la auditoría no tenía etiquetas activas. Podés cambiar tu elección desde el pie del sitio. <a href={mainSiteUrl("/cookies")}>Ver política de cookies</a>.</p></div>
    <div className="cookie-actions"><button type="button" onClick={() => choose("rejected")}>Rechazar etiquetas opcionales</button><button type="button" onClick={() => choose("accepted")}>Aceptar etiquetas opcionales</button></div>
  </div>;
}
