import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TeamSection from "@/components/TeamSection";
import { motion } from "framer-motion";

const Team = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content" className="pt-32">
        <div className="container mx-auto px-4 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold md:text-6xl mb-6">
              El Equipo Detrás de <span className="text-gradient-primary">BZ Creators</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Conoce a las mentes que están transformando la industria del desarrollo de software a través de la Inteligencia Artificial.
            </p>
          </motion.div>
        </div>
        <TeamSection />
      </main>
      <Footer />
    </div>
  );
};

export default Team;
