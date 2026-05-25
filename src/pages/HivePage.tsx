import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Thermometer, Droplets, Weight, Download,
  AlertTriangle, CheckCircle, Leaf, Bell, FileText,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import CSVUploader from "@/components/CSVUploader";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

const HivePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showThermistors, setShowThermistors] = useState(false);

  const { data: hive } = useQuery({
    queryKey: ["hive", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hives").select("*").eq("id", id!).single();
      if (error) throw error;
      if (data.notes) setNotes(data.notes);
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

  const { data: uploads } = useQuery({
    queryKey: ["hive-uploads", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*")
        .eq("hive_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase.from("hives").update({ notes }).eq("id", id);
      if (error) throw error;
      toast({ title: "Notes saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  const latest = readings && readings.length > 0 ? readings[readings.length - 1] : null;

  const chartData = useMemo(() =>
    (readings || []).map((r) => ({
      time: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      temp: r.temperature_c,
      humidity: r.humidity_pct,
    })), [readings]);

  const weightBarData = useMemo(() =>
    (readings || [])
      .filter((r) => r.weight_lbs != null)
      .slice(-12)
      .map((r, i, arr) => ({
        i,
        w: r.weight_lbs,
        isLast: i === arr.length - 1,
      })), [readings]);

  const weightTrend = useMemo(() => {
    const w = (readings || []).filter((r) => r.weight_lbs != null).slice(-5);
    if (w.length < 2) return null;
    return (w[w.length - 1].weight_lbs as number) - (w[0].weight_lbs as number);
  }, [readings]);

  const activityScore = useMemo(() => {
    const recent = (readings || []).slice(-24);
    const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
    if (temps.length < 3) return null;
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const variance = temps.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / temps.length;
    const stability = Math.max(0, Math.min(100, 100 - variance * 5));
    const range = avg >= 32 && avg <= 38 ? 100 : Math.max(0, 100 - Math.abs(avg - 35) * 8);
    return Math.round(stability * 0.6 + range * 0.4);
  }, [readings]);

  const insights = generateInsights(readings || []);

  const statusItems = useMemo(() => {
    const temps = (readings || []).filter((r) => r.temperature_c != null).slice(-5).map((r) => r.temperature_c as number);
    const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    const hasWarning = insights.some((i) => i.type === "warning");
    return [
      {
        label: "Nectar flow",
        value: avg && avg > 34 ? "Active foraging" : avg ? "Reduced activity" : "No data",
        accent: "amber",
        Icon: Droplets,
      },
      {
        label: "Colony status",
        value: avg && avg >= 32 && avg <= 38 ? "Stable / Optimal" : avg ? "Monitor closely" : "No data",
        accent: "green",
        Icon: Leaf,
      },
      {
        label: "Alerts",
        value: hasWarning ? "Anomaly detected" : "None detected",
        accent: hasWarning ? "amber" : "green",
        Icon: Bell,
      },
    ] as const;
  }, [readings, insights]);

  const thermistorData = useMemo(() =>
    chartData.filter((d) => d.temp != null), [chartData]);

  const hasThermistors = (readings || []).some((r) => r.thermistor_ext_f != null);

  return (
    <div className="min-h-[100dvh]">
      <nav className="glass-card-strong border-b border-white/20 sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-3 h-16 px-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight">{hive?.name || "Hive"}</h1>
            {hive?.hive_code && (
              <span className="data-value text-xs text-muted-foreground">{hive.hive_code}</span>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {readings && readings.length > 0 && (
              <span className="flex items-center gap-1.5 font-mono text-xs text-secondary bg-secondary/10 border border-secondary/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                LIVE
              </span>
            )}
            {uploads?.[0] && (
              <span className="font-mono text-xs text-muted-foreground">
                LAST_UPL: {new Date(uploads[0].created_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" className="honey-glass border-white/30 rounded-xl gap-1.5 hover:bg-primary/10">
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>

        {/* Temperature & Humidity Trends */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-serif text-xl font-bold text-primary">
                  Temperature & humidity trends
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-lg" style={{ textWrap: "pretty" }}>
                  Deep telemetry of the brood chamber conditions and forager activity patterns for the last 72 hours.
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0 mt-1">
                <span className="flex items-center gap-1.5 font-mono text-xs text-primary/80">
                  <span className="w-3 h-0.5 rounded bg-primary inline-block" /> Temp °C
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-sky-500/80">
                  <span className="w-3 h-0.5 rounded bg-sky-400 inline-block" /> Humidity %
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFB347" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#FFB347" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(35,18%,45%)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(35,18%,45%)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,250,235,0.88)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "14px",
                        fontFamily: "JetBrains Mono",
                        fontSize: "11px",
                      }}
                    />
                    <Area type="monotone" dataKey="temp" stroke="#FFB347" strokeWidth={2} fill="url(#tempGrad)" name="Temp °C" dot={false} />
                    <Area type="monotone" dataKey="humidity" stroke="#38BDF8" strokeWidth={1.5} fill="url(#humGrad)" name="Humidity %" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No temperature data yet — upload a CSV to populate this chart.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hive Weight + Activity Levels */}
        <div className="grid md:grid-cols-12 gap-5">

          {/* Hive Weight */}
          <div className="md:col-span-7 honey-glass rounded-outer p-7">
            <h2 className="font-serif text-xl font-bold text-primary mb-0.5">Hive weight</h2>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-5">Net nectar accumulation</p>

            {latest?.weight_lbs != null ? (
              <>
                <div className="flex items-end gap-3 mb-6">
                  <span className="data-value text-5xl font-bold text-foreground leading-none">
                    {latest.weight_lbs.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground mb-1 text-lg">lbs</span>
                  {weightTrend != null && (
                    <span className={`font-mono text-sm font-semibold mb-1 ${weightTrend >= 0 ? "text-secondary" : "text-primary"}`}>
                      {weightTrend >= 0 ? "+" : ""}{weightTrend.toFixed(2)} lbs
                    </span>
                  )}
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weightBarData} barCategoryGap="20%">
                      <Bar
                        dataKey="w"
                        radius={[4, 4, 0, 0]}
                        fill="#FFB347"
                        fillOpacity={0.45}
                      />
                      <XAxis hide />
                      <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,250,235,0.88)",
                          backdropFilter: "blur(16px)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          borderRadius: "12px",
                          fontFamily: "JetBrains Mono",
                          fontSize: "11px",
                        }}
                        formatter={(v: number) => [`${v?.toFixed(1)} lbs`, "Weight"]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No weight data yet.</p>
            )}
          </div>

          {/* Activity Levels */}
          <div className="md:col-span-5 honey-glass rounded-outer p-7 flex flex-col justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-0.5">Activity levels</h2>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide">Brood stability index</p>
            </div>

            <div className="flex justify-center py-6">
              {activityScore != null ? (
                <ActivityGauge score={activityScore} />
              ) : (
                <div className="w-32 h-32 rounded-full border-8 border-primary/10 flex items-center justify-center">
                  <span className="font-mono text-xs text-muted-foreground text-center leading-tight">No data<br />yet</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="tonal-well p-3 rounded-inner">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Temperature</p>
                <p className="data-value text-lg font-bold text-primary">
                  {latest?.temperature_c != null ? `${latest.temperature_c.toFixed(1)}°C` : "—"}
                </p>
              </div>
              <div className="tonal-well p-3 rounded-inner">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Humidity</p>
                <p className="data-value text-lg font-bold text-primary">
                  {latest?.humidity_pct != null ? `${latest.humidity_pct.toFixed(0)}%` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statusItems.map((item) => (
            <StatusChip key={item.label} {...item} />
          ))}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base font-bold">Diagnostic insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-inner border ${
                    insight.type === "warning"
                      ? "bg-primary/8 border-primary/20"
                      : "bg-secondary/8 border-secondary/20"
                  }`}
                >
                  {insight.type === "warning"
                    ? <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    : <CheckCircle className="h-4 w-4 text-secondary mt-0.5 shrink-0" />}
                  <p className="text-sm leading-relaxed">{insight.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Thermistor comparison — collapsible */}
        {hasThermistors && (
          <Card>
            <button
              className="w-full text-left"
              onClick={() => setShowThermistors((v) => !v)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-base font-bold flex items-center justify-between">
                  <span>Thermistor comparison</span>
                  <span className="font-mono text-xs text-muted-foreground font-normal">{showThermistors ? "hide" : "show"}</span>
                </CardTitle>
              </CardHeader>
            </button>
            {showThermistors && (
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} unit="°F" />
                      <Tooltip contentStyle={{ background: "rgba(255,250,235,0.88)", backdropFilter: "blur(16px)", borderRadius: "14px", fontFamily: "JetBrains Mono", fontSize: "11px" }} />
                      <Area type="monotone" dataKey="t1" stroke="#FFB347" strokeWidth={1.5} fill="none" dot={false} name="External" />
                      <Area type="monotone" dataKey="t2" stroke="#3f6833" strokeWidth={1.5} fill="none" dot={false} name="Thermistor 2" />
                      <Area type="monotone" dataKey="t3" stroke="#FFBF00" strokeWidth={1.5} fill="none" dot={false} name="Thermistor 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Data log */}
        <div className="honey-glass rounded-outer p-7">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">Data upload log</h2>
          {uploads && uploads.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {uploads.slice(0, 3).map((u) => (
                <div key={u.id} className="aspect-square rounded-inner tonal-well flex flex-col items-center justify-center gap-2 p-4">
                  <FileText className="h-7 w-7 text-primary/50" />
                  <p className="font-mono text-[10px] text-muted-foreground text-center leading-tight">{u.filename}</p>
                  <p className="data-value text-xs font-semibold text-primary">{u.rows_count} rows</p>
                  <p className="font-mono text-[9px] text-muted-foreground/60">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {uploads.length > 3 && (
                <div className="aspect-square rounded-inner tonal-well flex items-center justify-center">
                  <p className="font-serif font-bold text-primary/60 text-sm">+{uploads.length - 3} more</p>
                </div>
              )}
            </div>
          ) : null}
          <CSVUploader hiveId={id} hiveName={hive?.name} onUploadComplete={refetchReadings} />
        </div>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base font-bold">Field notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add observations, inspection notes, queen status..."
              className="min-h-[110px] mb-3 bg-white/30 border-white/30 focus:border-primary/40"
            />
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="rounded-xl">
              {savingNotes ? "Saving..." : "Save notes"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────── */

const ActivityGauge = ({ score }: { score: number }) => {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const label = score >= 80 ? "Optimal" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Low";

  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,179,71,0.15)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke="url(#amberArc)"
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="amberArc" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#FFB347" />
            <stop offset="100%" stopColor="#FFD700" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-value text-2xl font-bold text-foreground leading-none">{score}%</span>
        <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</span>
      </div>
    </div>
  );
};

const StatusChip = ({
  label,
  value,
  accent,
  Icon,
}: {
  label: string;
  value: string;
  accent: "amber" | "green";
  Icon: React.ElementType;
}) => {
  const borderColor = accent === "green" ? "border-l-secondary" : "border-l-primary";
  const bgColor = accent === "green" ? "bg-secondary/5" : "bg-primary/5";
  const iconBg = accent === "green" ? "bg-[#c0f0ad]" : "bg-[#ffddb6]";
  const iconColor = accent === "green" ? "text-secondary" : "text-primary";

  return (
    <div className={`honey-glass rounded-outer p-5 border-l-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
          <p className={`font-serif font-bold text-sm leading-snug ${iconColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
};

/* ── Insights engine ────────────────────────────────────────── */

interface Insight {
  type: "warning" | "good";
  message: string;
}

function generateInsights(readings: any[]): Insight[] {
  if (readings.length < 2) return [];
  const insights: Insight[] = [];
  const recent = readings.slice(-50);

  const withThermistors = recent.filter(
    (r) => r.thermistor_ext_f != null && r.thermistor2_f != null && r.thermistor3_f != null,
  );
  if (withThermistors.length > 0) {
    const last = withThermistors[withThermistors.length - 1];
    const vals = [last.thermistor_ext_f, last.thermistor2_f, last.thermistor3_f];
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread > 10) {
      insights.push({ type: "warning", message: "Uneven brood temperature — possible ventilation or distribution issue." });
    } else {
      insights.push({ type: "good", message: "Thermistor readings consistent — brood temperature well-regulated." });
    }
  }

  const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
  if (temps.length >= 5) {
    const drop = temps[0] - temps[temps.length - 1];
    if (drop > 5) {
      insights.push({ type: "warning", message: `Sudden temperature drop of ${drop.toFixed(1)}°C detected. Check for exposure or colony stress.` });
    }
  }

  if (temps.length >= 10) {
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const variance = temps.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / temps.length;
    if (variance < 2) {
      insights.push({ type: "good", message: "Stable temperature gradient — healthy brood regulation confirmed." });
    }
  }

  return insights;
}

export default HivePage;
