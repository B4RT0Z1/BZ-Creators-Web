const techs = [
  "React", "TypeScript", "Python", "Node.js", "OpenAI", "AWS", "MySQL", "Figma",
  "Next.js", "TailwindCSS", "PostgreSQL", "Docker",
];

const TechBar = () => {
  return (
    <section className="relative overflow-hidden border-y border-border/30 py-8">
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background z-10 pointer-events-none" />
      <div className="flex animate-marquee gap-12 whitespace-nowrap">
        {[...techs, ...techs].map((tech, i) => (
          <span
            key={i}
            className="text-sm font-medium text-muted-foreground/60 uppercase tracking-widest"
          >
            {tech}
          </span>
        ))}
      </div>
    </section>
  );
};

export default TechBar;
