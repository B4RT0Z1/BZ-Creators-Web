import { motion } from "framer-motion";

const tools = [
  "Codex", "Cline", "Kiro", "Trae", "Qoder", "Roo Code", "Cursor", 
  "Claude", "Copilot", "MySQL", "BrowserAct", "Qwen", "Seedance",
  "OpenAI", "Replicate", "Vercel", "Docker"
];

const ToolsSection = () => {
  return (
    <section className="relative overflow-hidden border-y border-border/30 bg-background/50 py-12 backdrop-blur-sm">
      <div className="container mx-auto px-4 mb-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          STACK TECNOLÓGICO DE ÚLTIMA GENERACIÓN
        </p>
      </div>
      
      <div className="relative flex overflow-hidden">
        <div className="absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
        
        <div className="flex animate-marquee pause-on-hover gap-16 whitespace-nowrap py-4">
          {[...tools, ...tools, ...tools].map((tool, i) => (
            <div
              key={i}
              className="flex items-center grayscale-logo"
            >
              <span className="text-2xl font-bold tracking-tighter text-foreground/80 hover:text-primary transition-colors cursor-default">
                {tool}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ToolsSection;
