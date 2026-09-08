import bzLogo from "@/assets/logo-png.png";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center">
            <img src={bzLogo} alt="BZ Creators" className="h-12 w-auto object-contain" />
          </div>
          <div className="flex gap-6">
            <a href="https://bzcreators.com.ar/#servicios" className="text-sm text-muted-foreground hover:text-foreground">Servicios</a>
            <a href="https://bzcreators.com.ar/#productos" className="text-sm text-muted-foreground hover:text-foreground">Productos</a>
            <a href="https://opensource.bzcreators.com.ar" className="text-sm text-muted-foreground hover:text-foreground">OpenSource</a>
            <a href="https://bzcreators.com.ar/#contacto" className="text-sm text-muted-foreground hover:text-foreground">Contacto</a>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 BZ Creators. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
