import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import LabSections from "@/components/LabSections";
import Footer from "@/components/Footer";

export default function Index() {
  return <div className="lab-page"><Navbar /><main id="main-content"><HeroSection /><LabSections /></main><Footer /></div>;
}
