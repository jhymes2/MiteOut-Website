import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hexagon, LogOut, Plus, Thermometer, Droplets, Weight } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="glass-card-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Hexagon className="h-6 w-6 text-primary fill-primary/20" />
            <span className="font-serif text-lg font-semibold tracking-tight">MiteOut</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowUploader(!showUploader)}>
              Upload CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
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
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                Temperature Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="honeyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(28, 80%, 52%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(28, 80%, 52%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: "hsl(40, 10%, 45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(40, 10%, 45%)" }} axisLine={false} tickLine={false} unit="°C" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.85)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "16px",
                        boxShadow: "0 10px 30px -10px rgba(45,42,34,0.15)",
                      }}
                    />
                    <Area type="monotone" dataKey="temp" stroke="hsl(28, 80%, 52%)" strokeWidth={2} fill="url(#honeyGradient)" name="Temperature (°C)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {chartData.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Thermometer className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-serif text-lg font-semibold mb-2">No data yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Upload a CSV file to start seeing temperature trends</p>
              <Button onClick={() => setShowUploader(true)}>Upload Your First CSV</Button>
            </CardContent>
          </Card>
        )}

        {/* Hives Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold">Your Hives</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Hive
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a New Hive</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Hive Name</Label>
                    <Input value={newHiveName} onChange={(e) => setNewHiveName(e.target.value)} placeholder="e.g., Hive Alpha" className="mt-1" />
                  </div>
                  <div>
                    <Label>Hive Code (from logger)</Label>
                    <Input value={newHiveCode} onChange={(e) => setNewHiveCode(e.target.value)} placeholder="e.g., HIVE_ALPHA" className="mt-1" />
                  </div>
                  <Button onClick={handleAddHive} disabled={addingHive || !newHiveName.trim()} className="w-full">
                    {addingHive ? "Creating..." : "Create Hive"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(!hives || hives.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Hexagon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No hives yet. Add your first hive to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hives.map((hive) => {
                const latest = latestByHive(hive.id);
                return (
                  <Link key={hive.id} to={`/hive/${hive.id}`}>
                    <Card className="hover:shadow-soil transition-shadow brand-curve cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-serif font-semibold text-lg">{hive.name}</h3>
                            {hive.hive_code && (
                              <span className="data-value text-xs text-muted-foreground">{hive.hive_code}</span>
                            )}
                          </div>
                          <div className={`w-3 h-3 rounded-full ${latest ? "bg-secondary" : "bg-muted-foreground/30"}`} />
                        </div>
                        {latest ? (
                          <div className="grid grid-cols-3 gap-3">
                            <MetricChip icon={<Thermometer className="h-3.5 w-3.5" />} label="Temp" value={`${latest.temperature_c?.toFixed(1)}°C`} />
                            <MetricChip icon={<Droplets className="h-3.5 w-3.5" />} label="Humid" value={`${latest.humidity_pct?.toFixed(0)}%`} />
                            <MetricChip icon={<Weight className="h-3.5 w-3.5" />} label="Weight" value={`${latest.weight_lbs?.toFixed(1)} lb`} />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No readings yet</p>
                        )}
                      </CardContent>
                    </Card>
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
    <span className="data-value text-sm font-medium block">{value}</span>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

export default Dashboard;
