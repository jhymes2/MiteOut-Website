import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Plus, AlertTriangle, CheckCircle2, ChevronRight, Sparkles,
  Lock, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind,
  Upload, Eye, Shield, X, FlaskConical,
} from "lucide-react";
import {
  CalendarEvent, EventType, EVENT_CONFIG, WeatherDay,
  loadAllEvents, persistAllEvents,
  todayYMD, addDays, daysBetween, inspFreqDays,
  parseThresholdPct, getHiveColor,
} from "@/lib/calendar";
import { parseSetupNotes } from "@/components/HiveSetupPanel";
import EventSheet, { HiveOption } from "@/components/calendar/EventSheet";
import CSVUploader from "@/components/CSVUploader";
import { useWeather, useGeolocation } from "@/hooks/useWeather";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────

const FREE_HIVE_LIMIT = 3;
const AI_CACHE_KEY = "dashboard_ai_insight";
const AI_CACHE_TTL = 6 * 60 * 60 * 1000;

// ─── Health computation (shared) ─────────────────────────────────

type HealthDot = "green" | "amber" | "red";
interface HiveHealth { dot: HealthDot; urgentLine: string }

export function computeHiveHealth(
  hive: any,
  readings: any[],
  events: CalendarEvent[]
): HiveHealth {
  const { meta } = parseSetupNotes(hive.notes);

  // Mite threshold
  const lastMite = events
    .filter(e => e.hive_ids.includes(hive.id) && e.event_type === "mite_test" && e.status === "completed")
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const miteAbove = lastMite?.metadata.infestation_pct != null
    ? (lastMite.metadata.infestation_pct as number) > parseThresholdPct(meta?.mite_threshold)
    : false;

  // Inspection frequency
  const lastInsp = events
    .filter(e => e.hive_ids.includes(hive.id) && e.event_type === "inspection" && e.status === "completed")
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const freqDays = inspFreqDays(meta?.inspection_frequency) ?? 14;
  const daysSince = lastInsp ? daysBetween(lastInsp.start_date, todayYMD()) : 999;

  // Weight anomaly
  const cutoff = Date.now() - 7 * 86400000;
  const recent = readings
    .filter(r => r.hive_id === hive.id && new Date(r.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let maxDrop = 0;
  for (let i = 1; i < recent.length; i++) {
    const dt = new Date(recent[i].timestamp).getTime() - new Date(recent[i - 1].timestamp).getTime();
    if (dt <= 86400000 && recent[i - 1].weight_lbs != null && recent[i].weight_lbs != null)
      maxDrop = Math.max(maxDrop, recent[i - 1].weight_lbs - recent[i].weight_lbs);
  }

  if (miteAbove || maxDrop > 5 || daysSince > freqDays * 1.5) {
    if (miteAbove) return { dot: "red", urgentLine: "Mite count above threshold" };
    if (maxDrop > 5) return { dot: "red", urgentLine: `Weight drop ${maxDrop.toFixed(1)} lbs in 24 hrs` };
    return { dot: "red", urgentLine: `Inspect overdue ${Math.round(daysSince - freqDays)} days` };
  }
  if (daysSince > freqDays)
    return { dot: "amber", urgentLine: `Inspection due (${daysSince}d since last)` };
  return { dot: "green", urgentLine: "All good" };
}

// ─── Weight sparkline ─────────────────────────────────────────────

function getWeightDays(readings: any[], hiveId: string): (number | null)[] {
  return Array.from({ length: 7 }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (6 - i));
    const end = new Date(start.getTime() + 86400000);
    const day = readings.filter(r =>
      r.hive_id === hiveId && r.weight_lbs != null &&
      new Date(r.timestamp) >= start && new Date(r.timestamp) < end
    );
    if (!day.length) return null;
    return day.reduce((s: number, r: any) => s + r.weight_lbs, 0) / day.length;
  });
}

function WeightSparkline({ readings, hiveId, width = 72, height = 24 }: {
  readings: any[]; hiveId: string; width?: number; height?: number;
}) {
  const days = getWeightDays(readings, hiveId);
  const valid = days.filter((d): d is number => d !== null);

  if (valid.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={3} y1={height / 2} x2={width - 3} y2={height / 2}
          stroke="rgba(120,90,40,0.25)" strokeDasharray="3,2" strokeWidth="1.5" />
      </svg>
    );
  }

  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 0.1;

  let maxDrop = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i] != null && days[i - 1] != null)
      maxDrop = Math.max(maxDrop, (days[i - 1] as number) - (days[i] as number));
  }
  const net = valid[valid.length - 1] - valid[0];
  const color = maxDrop > 5 ? "#e74c3c" : net < -5 ? "#d4820a" : "#27ae60";

  const pad = 2, W = width - pad * 2, H = height - pad * 2;
  const step = W / (days.length - 1);
  const points = days.map((d, i) => ({
    x: pad + i * step,
    y: d != null ? pad + H - ((d - min) / range) * H : null,
  }));

  let path = "";
  points.forEach(({ x, y }) => {
    if (y == null) return;
    path += path === "" ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
      <svg width="128" height="110" viewBox="0 0 128 110" fill="none">
        {[
          [32,20],[64,20],[96,20],
          [16,47],[48,47],[80,47],[112,47],
          [32,74],[64,74],[96,74],
        ].map(([cx, cy], i) => (
          <polygon key={i}
            points={`${cx},${cy - 14} ${cx + 12},${cy - 7} ${cx + 12},${cy + 7} ${cx},${cy + 14} ${cx - 12},${cy + 7} ${cx - 12},${cy - 7}`}
            fill={["#FFB347","#FFD580","#FFF3CC"][i % 3]}
            stroke="#D97706" strokeWidth="1" opacity={0.65 + (i % 3) * 0.1}
          />
        ))}
      </svg>
      <div>
        <h1 className="font-serif text-2xl font-bold text-amber-950 mb-2">Welcome to your apiary</h1>
        <p className="text-sm text-amber-700/70 max-w-sm mx-auto leading-relaxed">
          Set up your first hive to start tracking health, planning treatments, and getting insights.
        </p>
      </div>
      <Button onClick={() => navigate("/hive/new")} className="rounded-xl px-8 font-bold h-11"
        style={{ background: "#d4820a", color: "white" }}>
        Set up your first hive
      </Button>
    </div>
  );
}

// ─── Hive card ────────────────────────────────────────────────────

const DOT = { green: "#27ae60", amber: "#d4820a", red: "#e74c3c" };

function HiveCard({ hive, idx, readings, events }: {
  hive: any; idx: number; readings: any[]; events: CalendarEvent[];
}) {
  const health = useMemo(() => computeHiveHealth(hive, readings, events), [hive, readings, events]);
  const color = getHiveColor(idx);
  return (
    <Link to={`/hive/${hive.id}`}>
      <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/70 border border-amber-200/50 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer group">
        <div className="w-1 h-9 rounded-full shrink-0" style={{ background: color }} />
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: DOT[health.dot], boxShadow: health.dot === "red" ? `0 0 5px ${DOT.red}55` : undefined }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-950 truncate">{hive.name}</p>
          <p className={`text-[10px] truncate font-medium ${
            health.dot === "red" ? "text-red-500" : health.dot === "amber" ? "text-amber-500" : "text-emerald-600"
          }`}>{health.urgentLine}</p>
        </div>
        <WeightSparkline readings={readings} hiveId={hive.id} />
        <ChevronRight className="h-3.5 w-3.5 text-amber-300 group-hover:text-amber-500 transition-colors shrink-0" />
      </div>
    </Link>
  );
}

// ─── Action items ─────────────────────────────────────────────────

interface ActionItem { event: CalendarEvent; badge?: string; meta?: string }

function buildActionItems(events: CalendarEvent[], userId: string): ActionItem[] {
  const today = todayYMD();
  const in48 = addDays(today, 2);
  const items: { item: ActionItem; pri: number }[] = [];

  for (const e of events.filter(ev => ev.user_id === userId && ev.status === "scheduled")) {
    if (e.start_date < today) {
      items.push({ item: { event: e, badge: "Overdue" }, pri: 0 });
    } else if (e.event_type === "treatment" && e.end_date && e.start_date <= today && e.end_date >= today) {
      const day = daysBetween(e.start_date, today) + 1;
      const total = daysBetween(e.start_date, e.end_date) + 1;
      items.push({ item: { event: e, meta: `Day ${day} of ${total}` }, pri: 1 });
    } else if (e.start_date === today) {
      items.push({ item: { event: e }, pri: 2 });
    } else if (e.start_date <= in48) {
      items.push({ item: { event: e }, pri: 3 });
    }
  }

  return items
    .sort((a, b) => a.pri - b.pri || a.item.event.start_date.localeCompare(b.item.event.start_date))
    .slice(0, 6)
    .map(x => x.item);
}

function ActionItems({ events, hiveOptions, userId, onMark, onOpen }: {
  events: CalendarEvent[]; hiveOptions: HiveOption[]; userId: string;
  onMark: (id: string) => void; onOpen: (e: CalendarEvent) => void;
}) {
  const items = useMemo(() => buildActionItems(events, userId), [events, userId]);
  const today = todayYMD();

  if (!items.length) {
    return <p className="text-sm text-amber-700/50 py-2">Nothing scheduled in the next 48 hours.</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map(({ event: e, badge, meta }) => {
        const cfg = EVENT_CONFIG[e.event_type];
        const names = e.hive_ids.map(id => hiveOptions.find(h => h.id === id)?.name).filter(Boolean).join(", ");
        const isOverdue = badge === "Overdue";
        const dateLabel = e.start_date === today ? "Today"
          : e.start_date === addDays(today, 1) ? "Tomorrow"
          : e.start_date;
        return (
          <div key={e.id}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
            style={{
              borderLeftWidth: "3px", borderLeftColor: cfg.color,
              borderTopColor: isOverdue ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.4)",
              borderRightColor: isOverdue ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.4)",
              borderBottomColor: isOverdue ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.4)",
              background: isOverdue ? "rgba(231,76,60,0.05)" : cfg.bg,
            }}
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: cfg.color + "20" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-amber-950 truncate">{e.title}</span>
                {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">{badge}</span>}
                {meta && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
                  style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + "40" }}>{meta}</span>}
              </div>
              {names && <p className="text-[10px] text-amber-700/55 truncate">{names}</p>}
            </div>
            <span className="text-[10px] font-mono text-amber-700/45 shrink-0">{dateLabel}</span>
            <button onClick={() => onMark(e.id)} title="Mark complete"
              className="shrink-0 hover:bg-emerald-50 p-1 rounded-lg transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 hover:text-emerald-600" />
            </button>
            <button onClick={() => onOpen(e)} title="Edit"
              className="shrink-0 hover:bg-amber-50 p-1 rounded-lg transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-amber-300 hover:text-amber-600" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI insight ───────────────────────────────────────────────────

interface AIInsight { hive_name: string; trigger: string; recommendation: string; urgency: "low" | "medium" | "high" }

async function fetchAIInsight(payload: Record<string, unknown>): Promise<AIInsight | null> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const cached = localStorage.getItem(AI_CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < AI_CACHE_TTL) return data as AIInsight;
    }
  } catch {}
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-request-header": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: 'You are an expert beekeeper assistant. Given the apiary data, identify the single most important insight or action for today. Be specific — name the hive, cite the data, give a clear recommendation. Max 2 sentences. Respond ONLY in JSON: { "hive_name": string, "trigger": string, "recommendation": string, "urgency": "low" | "medium" | "high" }',
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = JSON.parse(json.content?.[0]?.text ?? "{}") as AIInsight;
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch { return null; }
}

const URGENCY_DOT = { low: "#3B82F6", medium: "#D97706", high: "#DC2626" };

function AIInsightCard({ insight, loading, locked, onAddToCalendar }: {
  insight: AIInsight | null; loading: boolean; locked: boolean; onAddToCalendar: (i: AIInsight) => void;
}) {
  if (!locked && !loading && !insight) return null;
  return (
    <div className="relative rounded-2xl border border-amber-200/60 overflow-hidden bg-white/70">
      <div className={cn("p-4 space-y-2", locked && "blur-sm select-none pointer-events-none")}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-bold text-amber-950">AI Insight</span>
          {loading && <div className="w-2.5 h-2.5 rounded-full border border-amber-400 border-t-transparent animate-spin ml-auto" />}
          {insight && <div className="w-2 h-2 rounded-full ml-auto" style={{ background: URGENCY_DOT[insight.urgency] }} />}
        </div>
        {insight ? (
          <>
            <p className="text-[10px] font-mono font-semibold text-amber-600">{insight.hive_name}</p>
            <p className="text-xs font-semibold text-amber-900 leading-snug">{insight.trigger}</p>
            <p className="text-[11px] text-amber-700/70 leading-relaxed">{insight.recommendation}</p>
            <Button size="sm" variant="outline" onClick={() => onAddToCalendar(insight)}
              className="h-6 text-[10px] border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg gap-1 px-2">
              <Plus className="h-2.5 w-2.5" /> Add to calendar
            </Button>
          </>
        ) : (
          <div className="space-y-1.5">
            {[70, 100, 85].map((w, i) => (
              <div key={i} className="h-2.5 bg-amber-100 rounded animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70 backdrop-blur-[2px]">
          <Lock className="h-4 w-4 text-amber-600" />
          <p className="text-[10px] font-bold text-amber-900 text-center px-3">Upgrade to Pro for AI insights</p>
        </div>
      )}
    </div>
  );
}

// ─── Weather strip ────────────────────────────────────────────────

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cls = cn("shrink-0 text-amber-600/70", className);
  if (code === 0) return <Sun className={cls} />;
  if (code <= 3) return <Cloud className={cls} />;
  if (code <= 48) return <Wind className={cls} />;
  if (code <= 77) return <CloudRain className={cls} />;
  if (code <= 82) return <CloudSnow className={cls} />;
  return <CloudLightning className={cls} />;
}

function WeatherStrip({ weather, events, tempUnit, locked, onDayClick }: {
  weather: WeatherDay[]; events: CalendarEvent[]; tempUnit: "F" | "C";
  locked: boolean; onDayClick: (date: string) => void;
}) {
  const today = todayYMD();
  const days = weather.slice(0, 5);
  const fmt = (f: number) => tempUnit === "C" ? `${Math.round((f - 32) * 5 / 9)}°` : `${Math.round(f)}°`;
  const label = (d: string) => d === today ? "Today" : d === addDays(today, 1) ? "Tmrw"
    : new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

  const flag = (day: WeatherDay): string | null => {
    const evts = events.filter(e => e.status === "scheduled" && e.start_date <= day.date && (e.end_date ?? e.start_date) >= day.date);
    for (const e of evts) {
      if (e.event_type === "treatment" && String(e.metadata.treatment_type ?? "").toLowerCase().includes("formic") && day.temp_max > 85) return "red";
      if (e.event_type === "inspection" && day.temp_max < 40) return "amber";
      if ([51,53,55,61,63,65,71,73,75,80,81,82].includes(day.condition_code)) return "amber";
    }
    return null;
  };

  if (!days.length) {
    return (
      <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4 flex items-center justify-center">
        <p className="text-xs text-amber-700/50 text-center">Enable location for weather</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-white/70 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-100 flex items-center justify-between">
        <p className="text-xs font-bold text-amber-950">5-day forecast</p>
        {locked && <span className="text-[9px] text-amber-600/60 font-semibold">Pro: full forecast</span>}
      </div>
      <div className="flex divide-x divide-amber-100/60">
        {days.map((day, i) => {
          const blur = locked && i > 0;
          const f = !blur ? flag(day) : null;
          return (
            <div key={day.date}
              className={cn("flex-1 flex flex-col items-center py-3 gap-1 cursor-pointer hover:bg-amber-50/40 transition-colors",
                blur && "blur-[3px] pointer-events-none")}
              onClick={() => !blur && onDayClick(day.date)}
            >
              <p className="text-[9px] font-mono text-amber-700/50">{label(day.date)}</p>
              <WeatherIcon code={day.condition_code} className="h-3.5 w-3.5" />
              <p className="text-xs font-bold text-amber-950">{fmt(day.temp_max)}</p>
              <p className="text-[10px] text-amber-700/50">{fmt(day.temp_min)}</p>
              {f && <div className={`w-1.5 h-1.5 rounded-full ${f === "red" ? "bg-red-500" : "bg-amber-400"}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weight column (right) ────────────────────────────────────────

function WeightColumn({ hives, readings, hiveOptions }: {
  hives: any[]; readings: any[]; hiveOptions: HiveOption[];
}) {
  if (!hives.length) return null;
  return (
    <div className="rounded-2xl border border-amber-200/60 bg-white/70 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-100">
        <p className="text-xs font-bold text-amber-950">7-day weight trends</p>
      </div>
      <div className="divide-y divide-amber-100/60">
        {hives.map((hive, i) => {
          const days = getWeightDays(readings, hive.id);
          const valid = days.filter((d): d is number => d !== null);
          const latest = valid[valid.length - 1];
          return (
            <Link key={hive.id} to={`/hive/${hive.id}`}>
              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/40 transition-colors cursor-pointer">
                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: getHiveColor(i) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-950 truncate">{hive.name}</p>
                  <p className="text-[10px] text-amber-700/50">
                    {latest != null ? `${latest.toFixed(1)} lbs` : "No data"}
                  </p>
                </div>
                <WeightSparkline readings={readings} hiveId={hive.id} width={64} height={24} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────

function QuickActions({ onAction }: { onAction: (t: EventType | "csv") => void }) {
  const actions: { type: EventType | "csv"; label: string; Icon: React.ElementType; color: string }[] = [
    { type: "mite_test",  label: "Log mite test",   Icon: FlaskConical, color: "#B45309" },
    { type: "inspection", label: "Add inspection",   Icon: Eye,          color: "#3f6833" },
    { type: "csv",        label: "Upload CSV",       Icon: Upload,       color: "#0F766E" },
    { type: "other",      label: "Add event",        Icon: Plus,         color: "#7C3AED" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map(({ type, label, Icon, color }) => (
        <button key={type} onClick={() => onAction(type)}
          className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-white/70 border border-amber-200/50 hover:border-amber-300 hover:shadow-sm transition-all group">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform"
            style={{ background: color + "18" }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <span className="text-[10px] font-semibold text-amber-800 text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Upgrade modal ────────────────────────────────────────────────

function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            <h3 className="font-serif font-bold text-base text-amber-950">Upgrade to Pro</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-50 rounded-lg">
            <X className="h-4 w-4 text-amber-700/50" />
          </button>
        </div>
        <p className="text-sm text-amber-800/70 leading-relaxed">
          You've reached the {FREE_HIVE_LIMIT}-hive limit on the free plan. Upgrade for unlimited hives, AI insights, and full weather integration.
        </p>
        <Button className="w-full rounded-xl font-bold h-10" style={{ background: "#d4820a", color: "white" }}>
          Upgrade to Pro — $9/month
        </Button>
        <p className="text-[10px] text-amber-700/50 text-center">Cancel anytime. No contracts.</p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const { planTier, tempUnit } = useSettings();
  const navigate = useNavigate();
  const isPro = planTier === "pro";

  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    user ? loadAllEvents().filter(e => e.user_id === user.id) : []
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<{
    defaultEventType?: EventType; defaultHiveIds?: string[]; editEvent?: CalendarEvent;
  }>({});
  const [showCSV, setShowCSV] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { coords } = useGeolocation();
  const { weather } = useWeather(coords);

  const { data: hives = [], isLoading: hivesLoading } = useQuery({
    queryKey: ["hives", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("hives").select("*").eq("user_id", user!.id).order("created_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: readings = [], refetch: refetchReadings } = useQuery({
    queryKey: ["readings-7d", hives.map(h => h.id).join(",")],
    queryFn: async () => {
      if (!hives.length) return [];
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("readings").select("*")
        .in("hive_id", hives.map((h: any) => h.id))
        .gte("timestamp", since)
        .order("timestamp", { ascending: true });
      return data ?? [];
    },
    enabled: !!hives.length,
  });

  const hiveOptions = useMemo<HiveOption[]>(() =>
    hives.map((h: any, i: number) => {
      const { meta } = parseSetupNotes(h.notes);
      return {
        id: h.id, name: h.name, color: getHiveColor(i),
        setupMeta: meta ? { mite_threshold: meta.mite_threshold, mite_treatment: meta.mite_treatment as string | undefined } : null,
      };
    }), [hives]
  );

  // AI insight (Pro only)
  useEffect(() => {
    if (!hives.length || !isPro) return;
    setAiLoading(true);
    fetchAIInsight({
      date: todayYMD(),
      hives: hives.map((h: any) => ({ name: h.name, ...parseSetupNotes(h.notes).meta })),
      events: events.slice(-20).map(e => ({ type: e.event_type, date: e.start_date, status: e.status })),
      weather: weather.slice(0, 5),
    }).then(setAiInsight).finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hives.length, isPro, weather.length]);

  const handleSave = (event: CalendarEvent) => {
    const all = loadAllEvents();
    const idx = all.findIndex(e => e.id === event.id);
    const next = idx >= 0 ? all.map(e => e.id === event.id ? event : e) : [...all, event];
    persistAllEvents(next);
    setEvents(next.filter(e => e.user_id === user?.id));
  };
  const handleDelete = (id: string) => {
    const next = loadAllEvents().filter(e => e.id !== id);
    persistAllEvents(next);
    setEvents(next.filter(e => e.user_id === user?.id));
  };
  const handleMarkComplete = (id: string) => {
    const all = loadAllEvents().map(e => e.id === id ? { ...e, status: "completed" as const } : e);
    persistAllEvents(all);
    setEvents(all.filter(e => e.user_id === user?.id));
  };
  const handleQuickAction = (type: EventType | "csv") => {
    if (type === "csv") { setShowCSV(true); return; }
    setSheetConfig({ defaultEventType: type as EventType });
    setSheetOpen(true);
  };
  const handleAddHive = () => {
    if (!isPro && hives.length >= FREE_HIVE_LIMIT) { setShowUpgrade(true); return; }
    navigate("/hive/new");
  };

  // ── Layout ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>
      <AppSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-amber-200/60 bg-white/40 backdrop-blur-sm flex-shrink-0">
          <div>
            <h1 className="font-serif text-base font-bold text-amber-950">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h1>
          </div>
          <Button size="sm" onClick={handleAddHive}
            className="h-8 gap-1.5 rounded-xl text-xs font-bold"
            style={{ background: "#27ae60", color: "white" }}>
            <Plus className="h-3.5 w-3.5" /> Add hive
          </Button>
        </div>

        {/* Body */}
        {hivesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          </div>
        ) : hives.length === 0 ? (
          <EmptyState />
        ) : (
          /* ── Three-column grid ──────────────────────────────────── */
          <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "248px 1fr 272px", gap: "16px", padding: "16px" }}>

            {/* ── Left: health summary + quick actions ───────────── */}
            <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-950/70 uppercase tracking-wider">Hive health</p>
                <span className="text-[10px] text-amber-700/50">{hives.length} hive{hives.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {hives.map((hive: any, i: number) => (
                  <HiveCard key={hive.id} hive={hive} idx={i} readings={readings} events={events} />
                ))}
              </div>

              <div className="mt-auto pt-3">
                <p className="text-xs font-bold text-amber-950/70 uppercase tracking-wider mb-2">Quick actions</p>
                <QuickActions onAction={handleQuickAction} />
              </div>
            </div>

            {/* ── Center: action items + AI ──────────────────────── */}
            <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
              {/* Action items */}
              <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-amber-950">Today's actions</p>
                  <Link to="/calendar"
                    className="text-[10px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-0.5">
                    Calendar <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <ActionItems
                  events={events}
                  hiveOptions={hiveOptions}
                  userId={user?.id ?? ""}
                  onMark={handleMarkComplete}
                  onOpen={(e) => { setSheetConfig({ editEvent: e }); setSheetOpen(true); }}
                />
              </div>

              {/* AI insight */}
              <AIInsightCard
                insight={aiInsight}
                loading={aiLoading}
                locked={!isPro}
                onAddToCalendar={(insight) => {
                  const hive = hives.find((h: any) => h.name === insight.hive_name);
                  setSheetConfig({ defaultHiveIds: hive ? [hive.id] : [] });
                  setSheetOpen(true);
                }}
              />
            </div>

            {/* ── Right: weather + weight sparklines ─────────────── */}
            <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
              <WeatherStrip
                weather={weather}
                events={events}
                tempUnit={tempUnit}
                locked={!isPro}
                onDayClick={(date) => navigate(`/calendar`)}
              />
              <WeightColumn hives={hives} readings={readings} hiveOptions={hiveOptions} />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCSV && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-base text-amber-950">Upload CSV</h3>
              <button onClick={() => setShowCSV(false)} className="p-1 hover:bg-amber-50 rounded-lg">
                <X className="h-4 w-4 text-amber-700/50" />
              </button>
            </div>
            <CSVUploader onUploadComplete={() => { setShowCSV(false); refetchReadings(); }} />
          </div>
        </div>
      )}

      <EventSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultEventType={sheetConfig.defaultEventType}
        defaultHiveIds={sheetConfig.defaultHiveIds}
        editEvent={sheetConfig.editEvent}
        hives={hiveOptions}
        userId={user?.id ?? ""}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default Dashboard;
