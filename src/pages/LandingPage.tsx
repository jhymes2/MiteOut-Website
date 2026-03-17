import heroBg from "@/assets/hero-bg.jpg";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Hexagon, Thermometer, Upload, BarChart3 } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card-strong border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Hexagon className="h-7 w-7 text-primary fill-primary/20" />
            <span className="font-serif text-xl font-semibold text-foreground tracking-tight">MiteOut</span>
          </div>
          <Link to="/login">
            <Button variant="hero" size="sm" className="h-10 px-6 text-sm rounded-lg">
              Log In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        <div className="relative container mx-auto px-6 py-32 lg:py-44">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-6xl font-serif font-semibold text-foreground tracking-tight leading-tight mb-6 animate-fade-in-up">
              Your hives are breathing.<br />
              <span className="text-primary">Here is the rhythm.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-lg animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              Temperature-first hive monitoring. Upload your logger data, visualize brood health, and catch problems before they spread.
            </p>
            <Link to="/login">
              <Button variant="hero" className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-serif font-semibold text-center mb-4 tracking-tight">
            Built for the field, not the office
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-md mx-auto">
            A digital field journal that prioritizes thermal health through high-contrast data visualization.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <FeatureCard
              icon={<Thermometer className="h-6 w-6" />}
              title="Temperature Tracking"
              description="Multi-point thermistor monitoring shows brood temperature distribution and ventilation issues."
            />
            <FeatureCard
              icon={<Upload className="h-6 w-6" />}
              title="CSV Data Upload"
              description="Drop your logger files. Data is parsed, validated, and stored — ready for analysis in seconds."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Smart Insights"
              description="Rule-based and AI-style alerts flag uneven brood temperatures, sudden drops, and ventilation issues."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-serif font-semibold text-center mb-16 tracking-tight">
            How MiteOut Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <Step number="01" title="Install the Logger" description="Place the MiteOut data logger in your hive. It records temperature, humidity, weight, and thermistor data." />
            <Step number="02" title="Upload Your Data" description="Remove the SD card and upload the CSV file. MiteOut parses every reading and stores it securely." />
            <Step number="03" title="Monitor & Act" description="View temperature trends, spot anomalies, and receive plain-language insights about your hive health." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hexagon className="h-5 w-5" />
            <span className="font-serif text-sm">MiteOut © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="glass-card-strong rounded-outer p-8 text-center">
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-inner bg-primary/10 text-primary mb-5">
      {icon}
    </div>
    <h3 className="font-serif text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

const Step = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="text-center">
    <span className="data-value text-4xl font-semibold text-primary/30 block mb-3">{number}</span>
    <h3 className="font-serif text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
