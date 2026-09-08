import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HeroSection from "@/components/HeroSection";
import OpenSource from "@/pages/OpenSource";
import { openSourceApi, type OpenSourceProject } from "@/lib/api";

const project = (id: string, name: string, technologies: string[]): OpenSourceProject => ({ id, name, technologies, slug: id, summary: `Herramienta ${name}`, description: "<p>Descripción publicada.</p>", github_url: `https://github.com/example/${id}`, website_url: null, image_url: null, featured: false, published: true, sort_order: 0, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" });
const renderCatalog = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OpenSource /></QueryClientProvider>);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("laboratorio", () => {
  it("permite explorar las etapas sin presentar telemetría real", () => {
    render(<HeroSection />);
    const explore = screen.getByRole("button", { name: "01 Explorar" });
    fireEvent.click(explore);
    expect(explore).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Toda solución empieza con una buena pregunta." })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "03 Validar" }));
    expect(explore).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("DEMO INTERACTIVA")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Probar, aprender y volver a construir." })).toBeVisible();
  });
  it("combina búsqueda y tecnología, y permite recuperar resultados", async () => {
    vi.spyOn(openSourceApi, "listPublic").mockResolvedValue([project("alpha", "Alpha", ["React"]), project("beta", "Beta", ["Python"])]);
    renderCatalog();
    expect(await screen.findByRole("heading", { name: "Alpha" })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  ALPHA  " } });
    expect(screen.queryByRole("heading", { name: "Beta" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Python" } });
    expect(screen.getByText("No encontramos proyectos con esos filtros.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Beta" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Ver código" })[0]).toHaveAttribute("href", "https://github.com/example/alpha");
  });
  it("muestra el estado vacío sin inventar proyectos", async () => {
    vi.spyOn(openSourceApi, "listPublic").mockResolvedValue([]);
    renderCatalog();
    expect(await screen.findByRole("heading", { name: "Estamos preparando los primeros lanzamientos." })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Ver código" })).not.toBeInTheDocument();
  });
});
