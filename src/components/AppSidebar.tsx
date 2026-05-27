import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Hexagon, Plus, Settings, HelpCircle,
  CalendarDays, Upload, Activity, BarChart2, Users,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: BarChart2, href: "/dashboard" },
  { label: "Colonies", icon: Hexagon, href: "/colonies" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Upload CSV", icon: Upload, href: "/upload" },
  { label: "Analytics", icon: Activity, href: null },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const { data: hives } = useQuery({
    queryKey: ["hives-sidebar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hives")
        .select("id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto"
      style={{ background: "#2e2910" }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-2">
        <Hexagon className="h-6 w-6 text-amber-400 fill-amber-400/20" />
        <span className="font-serif text-lg font-bold text-white tracking-tight">MiteOut</span>
      </div>

      {/* Apiary selector */}
      <div
        className="mx-3 mb-4 rounded-xl px-3 py-2.5 flex items-center gap-2.5"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
          <Users className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold truncate">Apiary</p>
          <p className="text-white/40 text-[10px] font-mono">{hives?.length ?? 0} hives</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = href ? location.pathname === href : false;
          return (
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
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-3 pt-2 space-y-0.5 border-t border-white/8 mt-2">
        <button
          onClick={() => navigate("/settings")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
            location.pathname === "/settings"
              ? "bg-white/12 text-white font-semibold"
              : "text-white/45 hover:text-white/70 hover:bg-white/6"
          }`}
        >
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
  );
};

export default AppSidebar;
