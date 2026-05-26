import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CSVUploader from "@/components/CSVUploader";
import {
  Hexagon, Plus, Settings, HelpCircle, Upload,
  CalendarDays, Activity, Users, BarChart2,
} from "lucide-react";

const UploadPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto" style={{ background: "#2e2910" }}>
        <div className="px-5 pt-5 pb-4 flex items-center gap-2">
          <Hexagon className="h-6 w-6 text-amber-400 fill-amber-400/20" />
          <span className="font-serif text-lg font-bold text-white tracking-tight">MiteOut</span>
        </div>

        <div className="mx-3 mb-4 rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.email?.split("@")[0] ?? "Apiary"}</p>
            <p className="text-white/40 text-[10px] font-mono">your account</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {[
            { label: "Dashboard", icon: BarChart2, href: "/dashboard" },
            { label: "Colonies", icon: Hexagon, href: "/colonies" },
            { label: "Calendar", icon: CalendarDays, href: "/calendar" },
            { label: "Upload CSV", icon: Upload, active: true },
            { label: "Analytics", icon: Activity },
          ].map(({ label, icon: Icon, active, href }) => (
            <button
              key={label}
              onClick={() => href && navigate(href)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-white/12 text-white font-semibold"
                  : "text-white/55 hover:text-white/80 hover:bg-white/6"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-3 pt-2 space-y-0.5 border-t border-white/8 mt-2">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/45 hover:text-white/70 hover:bg-white/6 transition-all">
            <Settings className="h-4 w-4" /> Settings
          </button>
          <button
            onClick={() => window.open("https://calendly.com/jonahhymes/new-meeting", "_blank")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/45 hover:text-white/70 hover:bg-white/6 transition-all"
          >
            <HelpCircle className="h-4 w-4" /> Support
          </button>
        </div>

        <div className="px-3 pb-5">
          <Button
            onClick={() => navigate("/hive/new")}
            className="w-full gap-2 rounded-xl text-sm font-semibold h-9"
            style={{ background: "#27ae60", color: "white" }}
          >
            <Plus className="h-4 w-4" /> Add New Hive
          </Button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="flex items-center justify-between px-6 h-14 border-b border-amber-200/60 bg-white/40 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-1">
            {["Dashboard", "Analytics", "Colonies", "Upload CSV"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === "Dashboard") navigate("/dashboard");
                  if (t === "Colonies") navigate("/colonies");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  t === "Upload CSV"
                    ? "bg-amber-100 text-amber-900 font-semibold"
                    : "text-amber-900/60 hover:text-amber-900 hover:bg-amber-100/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="h-8 px-4 rounded-xl text-xs font-bold"
            style={{ background: "#d4820a", color: "white" }}
          >
            Upgrade Now
          </Button>
        </header>

        <div className="flex-1 px-6 py-8 max-w-3xl">
          <div className="mb-6">
            <h1 className="font-serif text-2xl font-bold text-amber-950">Upload Hive Data</h1>
            <p className="text-sm text-amber-800/60 mt-1">
              Drop a CSV from your hive logger. The hive is detected automatically from the file's hive code.
            </p>
          </div>
          <CSVUploader onUploadComplete={() => navigate("/dashboard")} />
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
