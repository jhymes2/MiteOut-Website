import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Hexagon, Plus, LayoutGrid, List,
  Thermometer, Droplets,
  Weight, ChevronRight, AlertTriangle, CheckCircle, Leaf,
  Crown, Activity, BarChart2,
} from "lucide-react";
import { useMemo, useState } from "react";
import AppSidebar from "@/components/AppSidebar";

/* ─── helpers ──────────────────────────────────────────────── */

function computeScore(readings: any[]): number {
  const recent = readings.slice(-24);
  const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
  if (temps.length < 3) return 72;
  const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
  const variance = temps.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / temps.length;
  const stability = Math.max(0, Math.min(100, 100 - variance * 5));
  const range = avg >= 32 && avg <= 38 ? 100 : Math.max(0, 100 - Math.abs(avg - 35) * 8);
  return Math.round(stability * 0.6 + range * 0.4);
}

function hiveStatus(score: number): { label: string; color: string; bg: string; dot: string } {
  if (score >= 80) return { label: "Active", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  if (score >= 60) return { label: "Monitoring", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  return { label: "Alert", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500 animate-pulse" };
}

/* ─── main ──────────────────────────────────────────────────── */

const ColoniesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const { data: hives } = useQuery({
    queryKey: ["hives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hives").select("*").eq("user_id", user!.id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: allReadings } = useQuery({
    queryKey: ["all-readings-colonies", user?.id, (hives || []).map((h) => h.id).join(",")],
    queryFn: async () => {
      if (!hives || hives.length === 0) return [];
      const hiveIds = hives.map((h) => h.id);
      const { data, error } = await supabase
        .from("readings")
        .select("*")
        .in("hive_id", hiveIds)
        .order("timestamp", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !!hives && hives.length > 0,
  });

  const hiveStats = useMemo(() => {
    return (hives || []).map((hive) => {
      const readings = (allReadings || []).filter((r) => r.hive_id === hive.id);
      const latest = readings.length > 0 ? readings[readings.length - 1] : null;
      const score = computeScore(readings);
      const status = hiveStatus(score);
      return { hive, readings, latest, score, status };
    });
  }, [hives, allReadings]);

  const networkStats = useMemo(() => {
    const allTemps = (allReadings || []).filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
    const avgTemp = allTemps.length ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : 34.6;
    const avgScore = hiveStats.length ? hiveStats.reduce((s, h) => s + h.score, 0) / hiveStats.length : 78;
    const alertCount = hiveStats.filter((h) => h.score < 60).length;
    return { avgTemp, avgScore, alertCount };
  }, [allReadings, hiveStats]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>

      <AppSidebar />

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-bold text-amber-950">Colony Summaries</h1>
              <p className="text-sm text-amber-800/60 mt-0.5">Real-time stats for your ecological apiary network.</p>
            </div>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "grid" ? "bg-amber-500 text-white shadow-sm" : "text-amber-700/60 hover:text-amber-800"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "table" ? "bg-amber-500 text-white shadow-sm" : "text-amber-700/60 hover:text-amber-800"
                }`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          </div>

          {/* Empty state */}
          {(!hives || hives.length === 0) && (
            <div className="bg-white/70 rounded-2xl border border-amber-200/50 py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Hexagon className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="font-serif text-lg font-bold text-amber-950 mb-2">No colonies yet</h2>
              <p className="text-sm text-amber-800/60 mb-5">Add your first hive to see colony summaries here.</p>
              <Button onClick={() => navigate("/hive/new")} style={{ background: "#d4820a", color: "white" }}
                className="rounded-xl">
                Set up first hive
              </Button>
            </div>
          )}

          {/* ── Grid view ───────────────────────────────── */}
          {viewMode === "grid" && hiveStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hiveStats.map(({ hive, latest, score, status }) => (
                <ColonyCard
                  key={hive.id}
                  hive={hive}
                  latest={latest}
                  score={score}
                  status={status}
                />
              ))}
            </div>
          )}

          {/* ── Table view ──────────────────────────────── */}
          {viewMode === "table" && hiveStats.length > 0 && (
            <div className="bg-white/70 rounded-2xl border border-amber-200/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Hive</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Health</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Temp</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Humidity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700/60 uppercase tracking-wide">Weight</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {hiveStats.map(({ hive, latest, score, status }, i) => (
                    <tr key={hive.id} className={`border-b border-amber-100/60 hover:bg-amber-50/40 transition-colors ${i % 2 === 0 ? "" : "bg-amber-50/20"}`}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-amber-950">{hive.name}</p>
                        {hive.hive_code && <p className="text-[10px] font-mono text-amber-700/50">{hive.hive_code}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.bg} ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${score}%`,
                              background: score >= 80 ? "#27ae60" : score >= 60 ? "#d4820a" : "#e74c3c",
                            }} />
                          </div>
                          <span className="text-xs font-mono font-semibold text-amber-900">{score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-amber-900">
                        {latest?.temperature_c != null ? `${latest.temperature_c.toFixed(1)}°C` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-amber-900">
                        {latest?.humidity_pct != null ? `${latest.humidity_pct.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-amber-900">
                        {latest?.weight_lbs != null ? `${(latest.weight_lbs * 0.453592).toFixed(1)}kg` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/hive/${hive.id}`}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1">
                          Details <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Network Stats ──────────────────────────── */}
          {hiveStats.length > 0 && (
            <div className="grid grid-cols-3 gap-4">

              {/* Network Productivity */}
              <div className="bg-white/70 rounded-2xl p-5 border border-amber-200/50">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-amber-700" />
                  <p className="text-sm font-semibold text-amber-950">Network Productivity</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700/60">Avg Pollination Radius</span>
                    <span className="font-mono text-sm font-bold text-amber-950">3.2km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-xs text-amber-700/60">Hive Temp Stability</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-950">
                      {networkStats.avgTemp.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 text-sky-500" />
                      <span className="text-xs text-amber-700/60">Network Health</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-950">
                      {networkStats.avgScore.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Solar Harvest */}
              <div className="bg-white/70 rounded-2xl p-5 border border-amber-200/50">
                <div className="flex items-center gap-2 mb-4">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-amber-950">Solar Harvest</p>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Leaf className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold text-amber-950">
                      {((allReadings?.length ?? 0) * 12.4).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-amber-700/50 font-mono">action units generated</p>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (allReadings?.length ?? 0) / 5)}%` }} />
                </div>
                <p className="text-[10px] text-amber-700/50 mt-1.5">
                  {hiveStats.length} active hives contributing
                </p>
              </div>

              {/* Queen Stability */}
              <div className="bg-white/70 rounded-2xl p-5 border border-amber-200/50">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-950">Queen Stability</p>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    networkStats.alertCount === 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
                  }`}>
                    {networkStats.alertCount === 0
                      ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                      : <AlertTriangle className="h-5 w-5 text-red-500" />
                    }
                  </div>
                  <div>
                    <p className={`font-serif text-xl font-bold ${
                      networkStats.alertCount === 0 ? "text-emerald-700" : "text-red-600"
                    }`}>
                      {networkStats.alertCount === 0 ? "Optimal" : `${networkStats.alertCount} Alert${networkStats.alertCount > 1 ? "s" : ""}`}
                    </p>
                    <p className="text-[10px] text-amber-700/50 font-mono">
                      {networkStats.alertCount === 0 ? "All colonies stable" : "Needs attention"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {hiveStats.slice(0, 6).map(({ hive, score }) => (
                    <div key={hive.id}
                      title={hive.name}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold cursor-pointer`}
                      style={{ background: score >= 80 ? "#27ae60" : score >= 60 ? "#d4820a" : "#e74c3c" }}
                      onClick={() => navigate(`/hive/${hive.id}`)}
                    >
                      {hive.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {hiveStats.length > 6 && (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[9px] font-bold">
                      +{hiveStats.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/* ─── ColonyCard ───────────────────────────────────────────── */

const ColonyCard = ({
  hive,
  latest,
  score,
  status,
}: {
  hive: any;
  latest: any;
  score: number;
  status: ReturnType<typeof hiveStatus>;
}) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const isAlert = score < 60;
  const gaugeColor = score >= 80 ? "#27ae60" : score >= 60 ? "#d4820a" : "#e74c3c";

  return (
    <div className={`bg-white/70 rounded-2xl p-5 border flex flex-col gap-4 ${
      isAlert ? "border-red-200" : "border-amber-200/50"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] text-amber-700/50 uppercase tracking-wider mb-0.5">
            {hive.hive_code || "Colony"}
          </p>
          <h3 className="font-serif font-bold text-base text-amber-950">{hive.name}</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.bg} ${status.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Gauge + weight */}
      <div className="flex items-center gap-5">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r={r} fill="none" stroke={`${gaugeColor}22`} strokeWidth="7" />
            <circle
              cx="44" cy="44" r={r} fill="none"
              stroke={gaugeColor} strokeWidth="7"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-2xl font-bold text-amber-950 leading-none">{score}%</span>
            <span className="font-mono text-[8px] text-amber-700/50 uppercase tracking-wider mt-0.5">health</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Weight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <div>
              <p className="font-mono text-[10px] text-amber-700/50 uppercase tracking-wide">Current Weight</p>
              <p className="font-serif font-bold text-base text-amber-950">
                {latest?.weight_lbs != null ? `${(latest.weight_lbs * 0.453592).toFixed(1)}kg` : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <div>
              <p className="font-mono text-[10px] text-amber-700/50 uppercase tracking-wide">Temperature</p>
              <p className="font-serif font-bold text-base text-amber-950">
                {latest?.temperature_c != null ? `${latest.temperature_c.toFixed(1)}°C` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      {isAlert ? (
        <Link to={`/hive/${hive.id}`}>
          <button className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: "#e74c3c" }}>
            Check Urgent Details
          </button>
        </Link>
      ) : (
        <Link to={`/hive/${hive.id}`}
          className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors">
          View Details <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
};

export default ColoniesPage;
