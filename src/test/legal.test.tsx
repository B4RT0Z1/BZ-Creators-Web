import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "@/App";
import Footer from "@/components/Footer";
import CommentsSection from "@/components/CommentsSection";
import CookieConsent from "@/components/CookieConsent";
import { commentsApi } from "@/lib/api";
import { legalPages } from "../../shared/legal-content.js";
import { CONSENT_KEY, CONSENT_MAX_AGE, openCookiePreferences, readCookieChoice } from "@/lib/cookie-consent";

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); document.getElementById("bz-optional-gtm")?.remove(); window.history.replaceState({}, "", "/"); });
describe("rutas y avisos legales", () => {
  for (const page of legalPages) it(`resuelve ${page.path} y su metadata en la SPA`, async () => {
    window.history.replaceState({}, "", page.path);
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: page.title })).toBeVisible();
    expect(document.title).toBe(`${page.title} | BZ Creators`);
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", page.description);
    expect(screen.queryByRole("heading", { name: "404" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Páginas legales" })).toBeVisible();
  });
  it("enlaza las cuatro páginas y permite reabrir las preferencias desde el footer", () => {
    render(<><Footer /><CookieConsent /></>);
    for (const page of legalPages) expect(screen.getByRole("link", { name: page.label })).toHaveAttribute("href", page.path);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar etiquetas opcionales" }));
    expect(screen.queryByRole("heading", { name: "Tu elección de privacidad" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preferencias de cookies" }));
    expect(screen.getByRole("heading", { name: "Tu elección de privacidad" })).toBeVisible();
  });
  it("no envía un comentario sin autorización y explica qué datos se publican", async () => {
    vi.spyOn(commentsApi, "list").mockResolvedValue([]);
    const create = vi.spyOn(commentsApi, "create").mockResolvedValue({ id: "1", author_name: "Ana", content: "Un comentario válido", created_at: new Date().toISOString() });
    render(<CommentsSection postId="nota" />);
    await screen.findByText("Sé el primero en comentar");
    fireEvent.change(screen.getByPlaceholderText("Tu nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu comentario aquí..."), { target: { value: "Un comentario válido" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("autorización");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await screen.findByText(/Comentario publicado con éxito/);
    expect(create).toHaveBeenCalledWith("nota", { author_name: "Ana", author_email: "ana@example.com", content: "Un comentario válido" });
    expect(screen.getByRole("link", { name: "Privacidad" })).toHaveAttribute("href", "/privacidad");
  });
});
describe("consentimiento opcional", () => {
  it("no carga Google antes de aceptar ni al rechazar, y recuerda el rechazo al volver", () => {
    const view = render(<CookieConsent />);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rechazar etiquetas opcionales" }));
    expect(readCookieChoice()).toBe("rejected");
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    view.unmount(); render(<CookieConsent />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
  it("carga sólo el contenedor existente después de aceptar y no lo duplica", () => {
    const view = render(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar etiquetas opcionales" }));
    expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
    expect(document.getElementById("bz-optional-gtm")).toHaveAttribute("src", "https://www.googletagmanager.com/gtm.js?id=GTM-NZJTZ9JT");
    view.unmount(); render(<CookieConsent />);
    expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
  });
  it("ignora elecciones vencidas, dañadas o con fechas futuras", () => {
    for (const at of [Date.now() - CONSENT_MAX_AGE - 1, Date.now() + 60_000]) { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", at })); expect(readCookieChoice()).toBeNull(); }
    localStorage.setItem(CONSENT_KEY, "broken"); expect(readCookieChoice()).toBeNull();
    render(<CookieConsent />); expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
  it("permite elegir incluso si el navegador bloquea localStorage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar etiquetas opcionales" }));
    expect(screen.queryByRole("heading")).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
});
