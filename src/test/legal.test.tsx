import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "@/App";
import Footer from "@/components/Footer";
import CommentsSection from "@/components/CommentsSection";
import { commentsApi } from "@/lib/api";
import { legalPages } from "../../shared/legal-content.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, "", "/"); });
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
  it("enlaza las cuatro páginas sin ofrecer preferencias de seguimiento", () => {
    render(<Footer />);
    for (const page of legalPages) expect(screen.getByRole("link", { name: page.label })).toHaveAttribute("href", page.path);
    expect(screen.queryByRole("button", { name: "Preferencias de cookies" })).toBeNull();
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
describe("navegación sin seguimiento", () => {
  it("no carga etiquetas ni banner aunque exista una aceptación antigua", async () => {
    localStorage.setItem("bz_cookie_choice_v1", JSON.stringify({ choice: "accepted", at: Date.now() }));
    window.history.replaceState({}, "", "/cookies");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Política de cookies" });
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tu elección de privacidad" })).toBeNull();
    expect(screen.getByText(/No mostramos un banner de consentimiento/)).toBeVisible();
  });
});
