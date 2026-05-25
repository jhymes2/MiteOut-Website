import heroBg from "@/assets/hero-bg.jpg";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Hexagon, Thermometer, Upload, BarChart3, ArrowRight } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-[100dvh] relative">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card-strong border-b border-white/20">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Hexagon className="h-7 w-7 text-primary fill-primary/20" />
            <span className="font-serif text-xl font-bold text-foreground tracking-tight">MiteOut</span>
          </div>
          <Link to="/login">
            <Button variant="hero" size="sm" className="h-9 px-5 text-sm rounded-xl">
              Log In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden min-h-[100dvh] flex items-center">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Beekeeper tending hives in morning light" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#fefccf]/85 via-[#fefccf]/70 to-[#fefccf]" />
        </div>
        <div className="relative container mx-auto px-6 py-24 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-block font-mono text-xs tracking-widest text-primary/70 uppercase mb-4 animate-fade-in-up">
              Hive health monitoring
            </span>
            <h1 className="text-5xl lg:text-7xl font-serif font-bold text-foreground tracking-tight leading-[1.05] mb-6 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
              Your hives are<br />
              <span className="text-primary">breathing.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-lg leading-relaxed animate-fade-in-up" style={{ animationDelay: "140ms" }}>
              Temperature-first hive monitoring. Upload your logger data, visualize brood health, and catch problems before they spread.
            </p>
            <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
              <Link to="/login">
                <Button variant="hero">
                  Get started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features — asymmetric 2-column grid */}
      <section className="py-28 relative">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl font-serif font-bold tracking-tight mb-3" style={{ textWrap: "balance" }}>
              Built for the field, not the office
            </h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              A digital field journal that prioritizes thermal health through high-contrast data visualization.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
            {/* Primary feature — taller card on left */}
            <FeatureCard
              icon={<Thermometer className="h-6 w-6" />}
              title="Temperature tracking"
              description="Multi-point thermistor monitoring shows brood temperature distribution across the entire hive body. Spot ventilation issues, uneven brood, and early colony stress before it escalates."
              accent
            />
            {/* Two stacked on right */}
            <div className="flex flex-col gap-6">
              <FeatureCard
                icon={<Upload className="h-6 w-6" />}
                title="CSV data upload"
                description="Drop your logger files. Data is parsed, validated, and stored — ready for analysis in seconds."
              />
              <FeatureCard
                icon={<BarChart3 className="h-6 w-6" />}
                title="Smart insights"
                description="Rule-based alerts flag uneven brood temperatures, sudden drops, and ventilation issues — plain language, not jargon."
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-28 relative">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-serif font-bold tracking-tight text-center mb-20" style={{ textWrap: "balance" }}>
            Three steps to clarity
          </h2>

          <div className="relative grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.6%+12px)] right-[calc(16.6%+12px)] h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />

            <Step number="01" title="Install the logger" description="Place the MiteOut data logger in your hive. It records temperature, humidity, weight, and thermistor data every 15 minutes." />
            <Step number="02" title="Upload your data" description="Remove the SD card and drop the CSV file. MiteOut parses every reading and stores it securely in your apiary." />
            <Step number="03" title="Monitor and act" description="View temperature trends, spot anomalies, and receive plain-language insights about hive health — no data science required." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border/40">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hexagon className="h-5 w-5" />
            <span className="font-serif text-sm font-medium">MiteOut © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  description,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: boolean;
}) => (
  <div className={`honey-glass rounded-outer p-8 flex flex-col gap-4 ${accent ? "md:py-12" : ""}`}>
    <div className="inline-flex items-center justify-center w-11 h-11 rounded-inner bg-primary/15 text-primary">
      {icon}
    </div>
    <div>
      <h3 className="font-serif text-lg font-bold mb-2 tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed" style={{ textWrap: "pretty" }}>{description}</p>
    </div>
  </div>
);

const Step = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="text-center relative">
    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full honey-glass mb-5">
      <span className="data-value text-2xl font-bold text-primary">{number}</span>
    </div>
    <h3 className="font-serif text-lg font-bold mb-2 tracking-tight">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed" style={{ textWrap: "pretty" }}>{description}</p>
  </div>
);

export default LandingPage;
