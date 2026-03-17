import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Thermometer, Droplets, Weight, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import CSVUploader from "@/components/CSVUploader";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const HivePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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

  const chartData = readings?.map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" }),
    temp: r.temperature_c,
    humidity: r.humidity_pct,
    weight: r.weight_lbs,
    t1: r.thermistor_ext_f,
    t2: r.thermistor2_f,
    t3: r.thermistor3_f,
  })) || [];

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

  // Generate insights
  const insights = generateInsights(readings || []);

  const latest = readings && readings.length > 0 ? readings[readings.length - 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-4 h-16 px-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="font-serif font-semibold text-lg leading-tight">{hive?.name || "Hive"}</h1>
            {hive?.hive_code && <span className="data-value text-xs text-muted-foreground">{hive.hive_code}</span>}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats */}
        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Thermometer />} label="Temperature" value={`${latest.temperature_c?.toFixed(1)}°C`} color="text-primary" />
            <StatCard icon={<Droplets />} label="Humidity" value={`${latest.humidity_pct?.toFixed(0)}%`} color="text-blue-500" />
            <StatCard icon={<Weight />} label="Weight" value={`${latest.weight_lbs?.toFixed(1)} lbs`} color="text-secondary" />
            <StatCard icon={<Zap />} label="Power" value={`${latest.ina260_power_mw?.toFixed(0)} mW`} color="text-accent-foreground" />
          </div>
        )}

        {/* Temperature Chart (PRIMARY) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-primary" />
              Temperature Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="honeyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(28, 80%, 52%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(28, 80%, 52%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(40,10%,45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(40,10%,45%)" }} axisLine={false} tickLine={false} unit="°C" />
                    <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "16px" }} />
                    <Area type="monotone" dataKey="temp" stroke="hsl(28,80%,52%)" strokeWidth={2} fill="url(#honeyGrad)" name="Temperature (°C)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No temperature data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Thermistors Chart */}
        {chartData.some((d) => d.t1 !== null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thermistor Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(40,10%,45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(40,10%,45%)" }} axisLine={false} tickLine={false} unit="°F" />
                    <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderRadius: "16px" }} />
                    <Line type="monotone" dataKey="t1" stroke="hsl(28,80%,52%)" strokeWidth={1.5} dot={false} name="External" />
                    <Line type="monotone" dataKey="t2" stroke="hsl(145,63%,42%)" strokeWidth={1.5} dot={false} name="Thermistor 2" />
                    <Line type="monotone" dataKey="t3" stroke="hsl(48,95%,40%)" strokeWidth={1.5} dot={false} name="Thermistor 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Humidity & Weight */}
        {chartData.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Humidity</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                      <Area type="monotone" dataKey="humidity" stroke="hsl(210,70%,55%)" fill="hsl(210,70%,55%)" fillOpacity={0.1} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Weight</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit=" lb" />
                      <Area type="monotone" dataKey="weight" stroke="hsl(145,63%,42%)" fill="hsl(145,63%,42%)" fillOpacity={0.1} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Insights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-inner ${insight.type === "warning" ? "bg-primary/5" : "bg-secondary/5"}`}>
                  {insight.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                  )}
                  <p className="text-sm">{insight.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add observations, inspection notes..."
              className="min-h-[120px] mb-3"
            />
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </CardContent>
        </Card>

        {/* Upload for this hive */}
        <CSVUploader hiveId={id} hiveName={hive?.name} onUploadComplete={refetchReadings} />

        {/* Upload History */}
        {uploads && uploads.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Upload History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <span className="text-sm font-medium">{u.filename}</span>
                      <span className="data-value text-xs text-muted-foreground ml-2">{u.rows_count} rows</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) => (
  <Card>
    <CardContent className="p-5">
      <div className={`${color} mb-2 [&_svg]:h-5 [&_svg]:w-5`}>{icon}</div>
      <span className="data-value text-xl font-semibold block">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </CardContent>
  </Card>
);

interface Insight {
  type: "warning" | "good";
  message: string;
}

function generateInsights(readings: any[]): Insight[] {
  if (readings.length < 2) return [];
  const insights: Insight[] = [];
  const recent = readings.slice(-50);

  // Check thermistor discrepancy
  const withThermistors = recent.filter((r) => r.thermistor_ext_f != null && r.thermistor2_f != null && r.thermistor3_f != null);
  if (withThermistors.length > 0) {
    const last = withThermistors[withThermistors.length - 1];
    const vals = [last.thermistor_ext_f, last.thermistor2_f, last.thermistor3_f];
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread > 10) {
      insights.push({ type: "warning", message: "Hive shows uneven brood temperature — possible ventilation or brood distribution issue." });
    } else {
      insights.push({ type: "good", message: "Thermistor readings are consistent — brood temperature appears well-regulated." });
    }
  }

  // Check sudden temperature drops
  const temps = recent.filter((r) => r.temperature_c != null).map((r) => r.temperature_c as number);
  if (temps.length >= 5) {
    const lastFive = temps.slice(-5);
    const drop = lastFive[0] - lastFive[lastFive.length - 1];
    if (drop > 5) {
      insights.push({ type: "warning", message: `Sudden temperature drop detected (${drop.toFixed(1)}°C over recent readings). Check for exposure or colony loss.` });
    }
  }

  // Check temperature stability
  if (temps.length >= 10) {
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const variance = temps.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / temps.length;
    if (variance < 2) {
      insights.push({ type: "good", message: "Stable temperature suggests healthy brood regulation." });
    }
  }

  return insights;
}

export default HivePage;
