import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hexagon, LogOut, Plus, Thermometer, Droplets, Weight, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import CSVUploader from "@/components/CSVUploader";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);
  const [newHiveName, setNewHiveName] = useState("");
  const [newHiveCode, setNewHiveCode] = useState("");
  const [addingHive, setAddingHive] = useState(false);

  const { data: hives, refetch: refetchHives } = useQuery({
    queryKey: ["hives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hives")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: recentReadings, refetch: refetchReadings } = useQuery({
    queryKey: ["recent-readings", user?.id],
    queryFn: async () => {
      if (!hives || hives.length === 0) return [];
      const hiveIds = hives.map((h) => h.id);
      const { data, error } = await supabase
        .from("readings")
        .select("*")
        .in("hive_id", hiveIds)
        .order("timestamp", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!hives && hives.length > 0,
  });

  const chartData = recentReadings?.map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    temp: r.temperature_c,
    humidity: r.humidity_pct,
  })) || [];

  const latestByHive = (hiveId: string) => {
    if (!recentReadings) return null;
    const hiveReadings = recentReadings.filter((r) => r.hive_id === hiveId);
    return hiveReadings.length > 0 ? hiveReadings[hiveReadings.length - 1] : null;
  };

  const handleAddHive = async () => {
    if (!user || !newHiveName.trim()) return;
    setAddingHive(true);
    try {
      const { error } = await supabase.from("hives").insert({
        user_id: user.id,
        name: newHiveName.trim(),
        hive_code: newHiveCode.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Hive created", description: `${newHiveName} added to your apiary.` });
      setNewHiveName("");
      setNewHiveCode("");
      refetchHives();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingHive(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh]">
      {/* Top Bar */}
      <nav className="glass-card-strong border-b border-white/20 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Hexagon className="h-6 w-6 text-primary fill-primary/20" />
            <span className="font-serif text-lg font-bold tracking-tight">MiteOut</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUploader(!showUploader)}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Upload Section */}
        {showUploader && (
          <div className="animate-fade-in-up">
            <CSVUploader onUploadComplete={() => { refetchReadings(); setShowUploader(false); }} />
          </div>
        )}

        {/* Temperature Chart */}
        {chartData.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Thermometer className="h-4 w-4 text-primary" />
                Temperature overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="honeyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFB347" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#FFB347" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(35,18%,45%)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(35,18%,45%)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} unit="°C" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,250,235,0.85)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "16px",
                        boxShadow: "0 10px 30px -10px rgba(132,84,0,0.15)",
                        fontFamily: "JetBrains Mono",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="temp" stroke="#FFB347" strokeWidth={2} fill="url(#honeyGradient)" name="Temperature (°C)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
                <Thermometer className="h-7 w-7 text-primary/50" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-2">No data yet</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                Upload a CSV file from your hive logger to start seeing temperature trends.
              </p>
              <Button variant="hero" onClick={() => setShowUploader(true)}>
                Upload your first CSV
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Hives Grid */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl font-bold tracking-tight">Your hives</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl honey-glass border-white/30 hover:bg-primary/10">
                  <Plus className="h-4 w-4" /> Add hive
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a new hive</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Hive name</Label>
                    <Input value={newHiveName} onChange={(e) => setNewHiveName(e.target.value)} placeholder="e.g., Hive Alpha" className="mt-1" />
                  </div>
                  <div>
                    <Label>Hive code (from logger)</Label>
                    <Input value={newHiveCode} onChange={(e) => setNewHiveCode(e.target.value)} placeholder="e.g., HIVE_ALPHA" className="mt-1" />
                  </div>
                  <Button onClick={handleAddHive} disabled={addingHive || !newHiveName.trim()} className="w-full">
                    {addingHive ? "Creating..." : "Create hive"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(!hives || hives.length === 0) ? (
            <Card>
              <CardContent className="py-14 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                  <Hexagon className="h-6 w-6 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm">No hives yet. Add your first hive to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hives.map((hive) => {
                const latest = latestByHive(hive.id);
                return (
                  <Link key={hive.id} to={`/hive/${hive.id}`}>
                    <div className="honey-glass rounded-outer p-6 transition-all duration-200 hover:shadow-amber hover:scale-[1.01] brand-curve cursor-pointer">
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <h3 className="font-serif font-bold text-lg tracking-tight">{hive.name}</h3>
                          {hive.hive_code && (
                            <span className="data-value text-xs text-muted-foreground">{hive.hive_code}</span>
                          )}
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${latest ? "bg-secondary amber-glow" : "bg-muted-foreground/30"}`} />
                      </div>
                      {latest ? (
                        <div className="tonal-well p-3 grid grid-cols-3 gap-3">
                          <MetricChip icon={<Thermometer className="h-3.5 w-3.5" />} label="Temp" value={`${latest.temperature_c?.toFixed(1)}°C`} />
                          <MetricChip icon={<Droplets className="h-3.5 w-3.5" />} label="Humidity" value={`${latest.humidity_pct?.toFixed(0)}%`} />
                          <MetricChip icon={<Weight className="h-3.5 w-3.5" />} label="Weight" value={`${latest.weight_lbs?.toFixed(1)} lb`} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground tonal-well px-3 py-2 rounded-inner">No readings yet</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="text-center">
    <div className="flex items-center justify-center text-primary mb-1">{icon}</div>
    <span className="data-value text-sm font-semibold block">{value}</span>
    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
  </div>
);

export default Dashboard;
