import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import Team from "./pages/Team";
import OpenSource from "./pages/OpenSource";

const queryClient = new QueryClient();

const isOpenSourceHost = window.location.hostname.toLowerCase() === "opensource.bzcreators.com.ar";

const AppRoutes = () => isOpenSourceHost ? (
  <Routes>
    <Route path="*" element={<OpenSource />} />
  </Routes>
) : (
  <Routes>
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
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
