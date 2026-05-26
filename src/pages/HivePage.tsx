import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Hexagon, Thermometer, Droplets, Weight, Upload,
  CalendarDays, LayoutDashboard, Activity, Settings,
  HelpCircle, Plus, AlertTriangle, CheckCircle, Clock,
  ChevronRight, Wifi, Sun, Users,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

/* ─── helpers ──────────────────────────────────────────────── */

function generateInsights(readings: any[]) {
  if (readings.length < 2) return [];
  const insights: { type: "warning" | "good" | "info"; message: string }[] = [];
  const recent = readings.slice(-50);
  const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
  const humids = recent.filter((r) => r.humidity_pct != null).map((r) => r.humidity_pct as number);

  if (humids.length > 0) {
    const avgH = humids.reduce((a, b) => a + b, 0) / humids.length;
    if (avgH > 70) insights.push({ type: "warning", message: "Humidity trending high" });
  }
  if (temps.length >= 5) {
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    if (avg >= 32 && avg <= 38)
      insights.push({ type: "good", message: "Optimal Foraging" });
  }
  insights.push({ type: "info", message: "Hive Treatment Due" });
  return insights;
}

function buildHeatmap(readings: any[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const map: Record<string, number> = {};
  for (const r of readings) {
    if (!r.timestamp || r.temperature_c == null) continue;
    const d = new Date(r.timestamp);
    const day = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const hr = d.getHours();
    const key = `${day}-${hr}`;
    map[key] = (map[key] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(map));
  return { days, hours, map, max };
}

/* ─── main component ──────────────────────────────────────── */

const HivePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab] = useState<"overview">("overview");
  const [heatmapRange, setHeatmapRange] = useState<"day" | "week" | "month">("week");

  const { data: hives } = useQuery({
    queryKey: ["hives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hives").select("*").eq("user_id", user!.id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: hive } = useQuery({
    queryKey: ["hive", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hives").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: readings, refetch: refetchReadings } = useQuery({
    queryKey: ["hive-readings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("*")
        .eq("hive_id", id!)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const latest = readings && readings.length > 0 ? readings[readings.length - 1] : null;

  const activityScore = useMemo(() => {
    const recent = (readings || []).slice(-24);
    const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
    if (temps.length < 3) return 82;
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const variance = temps.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / temps.length;
    const stability = Math.max(0, Math.min(100, 100 - variance * 5));
    const range = avg >= 32 && avg <= 38 ? 100 : Math.max(0, 100 - Math.abs(avg - 35) * 8);
    return Math.round(stability * 0.6 + range * 0.4);
  }, [readings]);

  const scoreLabel = activityScore >= 80 ? "Optimal" : activityScore >= 60 ? "Good" : activityScore >= 40 ? "Fair" : "Low";
  const insights = generateInsights(readings || []);
  const heatmap = useMemo(() => buildHeatmap(readings || []), [readings]);

  const chartData = useMemo(() =>
    (readings || []).map((r) => ({
      time: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      temp: r.temperature_c,
      humidity: r.humidity_pct,
    })), [readings]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto"
        style={{ background: "#2e2910" }}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-2">
          <Hexagon className="h-6 w-6 text-amber-400 fill-amber-400/20" />
          <span className="font-serif text-lg font-bold text-white tracking-tight">MiteOut</span>
        </div>

        {/* Hive selector */}
        <div className="mx-3 mb-4 rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Hexagon className="h-3.5 w-3.5 text-white fill-white/30" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{hive?.name || "Loading…"}</p>
            <p className="text-white/40 text-[10px] font-mono truncate">{hive?.hive_code || "—"}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {[
            { label: "Overview", icon: LayoutDashboard, active: true },
            { label: "Colonies", icon: Users, active: false, href: "/colonies" },
            { label: "Calendar", icon: CalendarDays, active: false, href: "/calendar" },
            { label: "Upload CSV", icon: Upload, active: false, href: "/upload" },
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

        {/* Bottom nav */}
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

        {/* Add hive */}
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

        {/* Top nav */}
        <header className="flex items-center justify-between px-6 h-14 border-b border-amber-200/60 bg-white/40 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-1">
            {["Dashboard", "Analytics", "Colonies", "Upload CSV"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === "Upload CSV") navigate("/upload");
                  else if (t === "Colonies") navigate("/colonies");
                  else if (t === "Dashboard") navigate("/dashboard");
                }}
                className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-amber-900/60 hover:text-amber-900 hover:bg-amber-100/60 transition-all"
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

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* Page title */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-amber-700/60 uppercase tracking-wider mb-0.5">Extended</p>
              <h1 className="font-serif text-2xl font-bold text-amber-950">
                {hive?.name ? `${hive.name} Overview` : "Hive Overview"}
              </h1>
            </div>
            <Link to="/dashboard" className="text-xs text-amber-700/60 hover:text-amber-800 flex items-center gap-1">
              All hives <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <>
              {/* ── Row 1: Health Score + Insights ─── */}
              <div className="grid grid-cols-5 gap-4">

                {/* Health Score */}
                <div className="col-span-3 bg-white/70 rounded-2xl p-5 border border-amber-200/50">
                  <p className="text-xs font-mono text-amber-700/60 uppercase tracking-wider mb-3">Hive Alpha Health Score</p>
                  <div className="flex items-center gap-6">
                    <HealthGauge score={activityScore} />
                    <div className="flex-1 space-y-3">
                      <p className="text-sm text-amber-900/70 leading-relaxed">
                        Colony viability score based on temperature stability, humidity patterns, and weight trends.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          {activityScore >= 80 ? "High (Est. 4hr)" : activityScore >= 60 ? "Moderate" : "Low Activity"}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {scoreLabel}
                        </span>
                      </div>
                      {chartData.length > 0 && (
                        <div className="h-16 mt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.slice(-20)}>
                              <defs>
                                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#16a085" stopOpacity={0.25} />
                                  <stop offset="100%" stopColor="#16a085" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="temp" stroke="#16a085" strokeWidth={1.5} fill="url(#hg)" dot={false} />
                              <XAxis hide /><YAxis hide />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actionable Insights */}
                <div className="col-span-2 bg-white/70 rounded-2xl p-5 border border-amber-200/50 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-amber-700" />
                    <p className="text-sm font-semibold text-amber-950">Actionable Insights</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {insights.length === 0 ? (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-xs text-emerald-800 font-medium">All systems normal</p>
                      </div>
                    ) : insights.map((ins, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                        ins.type === "warning"
                          ? "bg-red-50 border-red-100"
                          : ins.type === "good"
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-amber-50 border-amber-100"
                      }`}>
                        {ins.type === "warning"
                          ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          : ins.type === "good"
                          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          : <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                        <p className={`text-xs font-medium ${
                          ins.type === "warning" ? "text-red-800" : ins.type === "good" ? "text-emerald-800" : "text-amber-800"
                        }`}>{ins.message}</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 w-full text-center text-xs font-semibold text-amber-700 hover:text-amber-900 py-2 rounded-xl border border-amber-200 hover:bg-amber-50 transition-all">
                    View All Alerts
                  </button>
                </div>
              </div>

              {/* ── Row 2: Env metrics ─────────────────── */}
              <div className="bg-white/70 rounded-2xl px-5 py-4 border border-amber-200/50 flex items-center gap-6">
                <EnvMetric
                  icon={<Thermometer className="h-5 w-5 text-orange-500" />}
                  label="Temperature"
                  value={latest?.temperature_c != null ? `${latest.temperature_c.toFixed(1)}°C` : "34.8°C"}
                  sub="Brood temp"
                  bg="bg-orange-50"
                />
                <div className="w-px h-10 bg-amber-200/60" />
                <EnvMetric
                  icon={<Droplets className="h-5 w-5 text-sky-500" />}
                  label="Humidity"
                  value={latest?.humidity_pct != null ? `${latest.humidity_pct.toFixed(0)}%` : "78%"}
                  sub="Relative"
                  bg="bg-sky-50"
                />
                <div className="w-px h-10 bg-amber-200/60" />
                <EnvMetric
                  icon={<Weight className="h-5 w-5 text-amber-600" />}
                  label="Total Weight"
                  value={latest?.weight_lbs != null ? `${(latest.weight_lbs * 0.453592).toFixed(1)}kg` : "62.1kg"}
                  sub="Hive mass"
                  bg="bg-amber-50"
                />
                <div className="w-px h-10 bg-amber-200/60" />
                <EnvMetric
                  icon={<Sun className="h-5 w-5 text-yellow-500" />}
                  label="Burn Feed"
                  value="Active"
                  sub="Sugar syrup"
                  bg="bg-yellow-50"
                />
                <div className="w-px h-10 bg-amber-200/60" />
                <EnvMetric
                  icon={<Activity className="h-5 w-5 text-emerald-500" />}
                  label="Run Feed"
                  value="Idle"
                  sub="Pollen sub"
                  bg="bg-emerald-50"
                />
              </div>

              {/* ── Row 3: Activity Heatmap ────────────── */}
              <div className="bg-white/70 rounded-2xl p-5 border border-amber-200/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-serif font-bold text-base text-amber-950">Activity Heatmap</h2>
                    <p className="text-xs text-amber-700/60 mt-0.5">Sensor data mapping brood chamber activity patterns</p>
                  </div>
                  <div className="flex gap-1 bg-amber-50 rounded-lg p-0.5 border border-amber-200/50">
                    {(["day", "week", "month"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setHeatmapRange(r)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize ${
                          heatmapRange === r
                            ? "bg-white text-amber-900 shadow-sm"
                            : "text-amber-700/60 hover:text-amber-800"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <Heatmap data={heatmap} />
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-amber-700/60 font-mono">Low Activity</span>
                  <div className="flex gap-0.5">
                    {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0].map((o, i) => (
                      <div key={i} className="w-4 h-3 rounded-sm" style={{ background: `rgba(217, 119, 6, ${o})` }} />
                    ))}
                  </div>
                  <span className="text-[10px] text-amber-700/60 font-mono">High Activity</span>
                </div>
              </div>

              {/* ── Row 4: Image cards ─────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden border border-amber-200/50 relative group">
                  <div className="aspect-[16/9] bg-stone-900 flex items-center justify-center relative">
                    <div className="absolute inset-0"
                      style={{
                        background: "radial-gradient(ellipse at 40% 50%, rgba(180,120,60,0.3) 0%, rgba(10,8,4,0.95) 70%)",
                      }}
                    />
                    <div className="relative z-10 grid grid-cols-6 grid-rows-4 gap-0.5 p-4 w-full h-full opacity-70">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="rounded-sm"
                          style={{
                            background: `rgba(${180 + Math.random() * 60},${100 + Math.random() * 40},${20 + Math.random() * 20},${0.4 + Math.random() * 0.5})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/80 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <p className="text-xs font-bold text-amber-950">Infrared Hive Camera (Live)</p>
                      </div>
                      <p className="text-[10px] text-amber-700/60">Live thermal feed — brood cluster visible</p>
                    </div>
                    <Wifi className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden border border-amber-200/50">
                  <div className="aspect-[16/9] relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #87622a 0%, #d4920a 30%, #e8b84b 50%, #c4862a 70%, #7a5520 100%)",
                    }}
                  >
                    <div className="absolute inset-0 flex items-end justify-center gap-6 pb-4">
                      {[0, 1].map((i) => (
                        <div key={i} className="w-14 rounded-t-lg border-2 border-amber-300/60 flex flex-col justify-end"
                          style={{ height: `${60 + i * 12}px`, background: "rgba(80,50,10,0.7)" }}>
                          <div className="h-3 w-full rounded-t-sm" style={{ background: "rgba(180,120,40,0.8)" }} />
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0"
                      style={{ background: "linear-gradient(to bottom, rgba(255,180,60,0.2) 0%, transparent 50%)" }}
                    />
                  </div>
                  <div className="bg-white/80 px-4 py-3">
                    <p className="text-xs font-bold text-amber-950 mb-0.5">Apiary Environment</p>
                    <p className="text-[10px] text-amber-700/60">Outdoor conditions — Golden hour, 24°C, Partly cloudy</p>
                  </div>
                </div>
              </div>
          </>
        </div>
      </main>
    </div>
  );
};

/* ─── sub-components ──────────────────────────────────────── */

const HealthGauge = ({ score }: { score: number }) => {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(22,160,133,0.12)" strokeWidth="9" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#16a085" strokeWidth="9"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-bold text-amber-950 leading-none">{score}%</span>
        <span className="font-mono text-[9px] text-amber-700/60 uppercase tracking-wider mt-0.5">Health</span>
      </div>
    </div>
  );
};

const EnvMetric = ({
  icon, label, value, sub, bg,
}: { icon: React.ReactNode; label: string; value: string; sub: string; bg: string }) => (
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
    <div className="min-w-0">
      <p className="font-mono text-[10px] text-amber-700/55 uppercase tracking-wide truncate">{label}</p>
      <p className="font-serif font-bold text-base text-amber-950 leading-tight">{value}</p>
      <p className="text-[10px] text-amber-700/50">{sub}</p>
    </div>
  </div>
);

const Heatmap = ({ data }: { data: ReturnType<typeof buildHeatmap> }) => {
  const { days, hours, map, max } = data;
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1" style={{ minWidth: "fit-content" }}>
        <div className="flex flex-col gap-0.5 justify-around pt-5">
          {days.map((d) => (
            <span key={d} className="text-[10px] text-amber-700/50 font-mono w-6 text-right">{d}</span>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-0.5 mb-1 pl-1">
            {hours.filter((h) => h % 3 === 0).map((h) => (
              <div key={h} style={{ width: `${100 / 8}%` }}>
                <span className="text-[9px] text-amber-700/40 font-mono">{h}h</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {days.map((day) => (
              <div key={day} className="flex gap-0.5">
                {hours.map((hr) => {
                  const count = map[`${day}-${hr}`] ?? 0;
                  const intensity = count / max;
                  return (
                    <div
                      key={hr}
                      title={`${day} ${hr}:00 — ${count} readings`}
                      className="rounded-sm flex-1 transition-opacity hover:opacity-80"
                      style={{
                        height: "14px",
                        background: intensity > 0
                          ? `rgba(217,119,6,${0.15 + intensity * 0.85})`
                          : "rgba(217,119,6,0.08)",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HivePage;
