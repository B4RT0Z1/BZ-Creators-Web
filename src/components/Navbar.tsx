import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import bzLogo from "@/assets/logo-png.png";
import { getWhatsAppUrl } from "@/lib/constants";

const navLinks = [
  { label: "Inicio", href: "https://bzcreators.com.ar/#inicio" },
  { label: "Servicios", href: "https://bzcreators.com.ar/#servicios" },
  { label: "Proceso", href: "https://bzcreators.com.ar/#proceso" },
  { label: "OpenSource", href: "https://opensource.bzcreators.com.ar" },
  { label: "Blog", href: "https://bzcreators.com.ar/blog" },
];

const comenzarUrl = getWhatsAppUrl("Hola! Quiero comenzar un proyecto con BZ Creators.");

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-primary to-accent py-2 md:py-1.5 text-center text-xs md:text-sm font-medium text-primary-foreground">
        <span className="px-4 leading-snug block">🔥 Solo aceptamos 3 proyectos nuevos por mes — <strong>1 lugar disponible</strong></span>
      </div>
      <nav className="fixed top-[40px] md:top-[32px] left-0 right-0 z-50 border-b border-border/30" style={{ background: "linear-gradient(135deg, hsl(0 0% 12%) 0%, hsl(0 0% 6%) 100%)" }}>
        <div className="container mx-auto flex items-center justify-between py-[4px]">
          <a href="https://bzcreators.com.ar/#inicio">
            <img src={bzLogo} alt="BZ Creators" className="h-14 w-auto object-contain" />
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          <a
            href={comenzarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-glow-primary md:inline-block"
          >
            Comenzar
          </a>

          <button
            className="text-foreground md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-background md:hidden"
            >
              <div className="container mx-auto flex flex-col gap-4 py-6">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href={comenzarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full bg-gradient-primary px-6 py-2.5 text-center text-sm font-medium text-primary-foreground"
                >
                  Comenzar
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navbar;
