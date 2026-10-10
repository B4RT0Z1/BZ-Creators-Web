import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { legalPages } from "../shared/legal-content.js";
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BlogList = lazy(() => import("./pages/BlogList"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Team = lazy(() => import("./pages/Team"));
const OpenSource = lazy(() => import("./pages/OpenSource"));

const queryClient = new QueryClient();
const AdminFooter = () => useLocation().pathname.startsWith("/admin") ? <Footer /> : null;

const isOpenSourceHost = window.location.hostname.toLowerCase() === "opensource.bzcreators.com.ar";

const AppRoutes = () => isOpenSourceHost ? (
  <Routes>
    {legalPages.map(page => <Route key={page.path} path={page.path} element={<LegalPage />} />)}
    <Route path="*" element={<OpenSource />} />
  </Routes>
) : (
  <Routes>
    {legalPages.map(page => <Route key={page.path} path={page.path} element={<LegalPage />} />)}
    <Route path="/" element={<Index />} />
    <Route path="/blog" element={<BlogList />} />
    <Route path="/blog/:slug" element={<BlogPost />} />
    <Route path="/equipo" element={<Team />} />
    <Route path="/opensource" element={<OpenSource />} />
    <Route path="/admin" element={<AdminLogin />} />
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<main className="lab-shell py-32" role="status">Cargando el laboratorio…</main>}><AppRoutes /></Suspense>
        <AdminFooter />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
