import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  AlertTriangle,
  Sparkles,
  X,
  CheckCircle2,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  EventType,
  WeatherDay,
  AISuggestion,
  DayInfo,
  EVENT_CONFIG,
  HIVE_PALETTE,
  getHiveColor,
  todayYMD,
  toYMD,
  addDays,
  daysBetween,
  formatMonthYear,
  formatShortDate,
  formatMonthDay,
  generateMonthGrid,
  generateWeekDays,
  getWeekStart,
  getEventsForDay,
  getMultiDayEventsForWeek,
  eventColRange,
  getTreatmentWeatherWarning,
  inspFreqDays,
  parseThresholdPct,
  weatherDescription,
  loadAllEvents,
  persistAllEvents,
} from "@/lib/calendar";
import { parseSetupNotes } from "@/components/HiveSetupPanel";
import { useWeather, useGeolocation } from "@/hooks/useWeather";
import EventSheet, { HiveOption } from "@/components/calendar/EventSheet";

// ─── Types ────────────────────────────────────────────────────────

type CalendarView = "month" | "week" | "agenda";

interface HiveData {
  id: string;
  name: string;
  hive_code: string | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getHiveOptions(hives: HiveData[]): HiveOption[] {
  return hives.map((h, i) => {
    const { meta } = parseSetupNotes(h.notes);
    return {
      id: h.id,
      name: h.name,
      color: getHiveColor(i),
      setupMeta: meta
        ? {
            mite_threshold: meta.mite_threshold,
            mite_treatment: meta.mite_treatment,
          }
        : null,
    };
  });
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cls = cn("shrink-0", className);
  if (code === 0) return <Sun className={cls} />;
  if (code <= 3) return <Cloud className={cls} />;
  if (code <= 48) return <Wind className={cls} />;
  if (code <= 77) return <CloudRain className={cls} />;
  if (code <= 82) return <CloudSnow className={cls} />;
  return <CloudLightning className={cls} />;
}

function WeatherStrip({ weather }: { weather: WeatherDay | null }) {
  if (!weather) return null;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
      <WeatherIcon code={weather.condition_code} className="h-3 w-3" />
      <span className="text-foreground/70">{Math.round(weather.temp_max)}°</span>
      <span className="opacity-50">/</span>
      <span>{Math.round(weather.temp_min)}°</span>
    </div>
  );
}

// ─── Event display atoms ──────────────────────────────────────────

function EventPill({
  event,
  hiveOptions,
  compact = false,
  onClick,
}: {
  event: CalendarEvent;
  hiveOptions: HiveOption[];
  compact?: boolean;
  onClick?: () => void;
}) {
  const cfg = EVENT_CONFIG[event.event_type];
  const isCompleted = event.status === "completed";
  const isSkipped = event.status === "skipped";
  const hiveColors = event.hive_ids
    .slice(0, 3)
    .map((id) => hiveOptions.find((h) => h.id === id)?.color)
    .filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded-sm text-[10px] font-medium truncate transition-all hover:opacity-80 btn-press",
        isSkipped && "opacity-40 line-through"
      )}
      style={{ backgroundColor: cfg.bg, color: isCompleted ? "#6b7280" : cfg.color }}
    >
      <span className="flex items-center gap-1">
        {isCompleted && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
        {!compact && (
          <span className="flex gap-0.5 shrink-0">
            {hiveColors.map((c, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </span>
        )}
        <span className="truncate">{event.title}</span>
      </span>
    </button>
  );
}

function EventCard({
  event,
  hiveOptions,
  onClick,
}: {
  event: CalendarEvent;
  hiveOptions: HiveOption[];
  onClick?: () => void;
}) {
  const cfg = EVENT_CONFIG[event.event_type];
  const isCompleted = event.status === "completed";
  const isSkipped = event.status === "skipped";
  const hiveNames = event.hive_ids
    .map((id) => hiveOptions.find((h) => h.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const hiveColors = event.hive_ids
    .slice(0, 3)
    .map((id) => hiveOptions.find((h) => h.id === id)?.color)
    .filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 rounded-inner border transition-all hover:shadow-sm btn-press",
        isSkipped && "opacity-50",
        isCompleted && "opacity-75"
      )}
      style={{
        borderLeftColor: cfg.color,
        borderLeftWidth: "3px",
        borderTopColor: "rgba(255,255,255,0.3)",
        borderRightColor: "rgba(255,255,255,0.3)",
        borderBottomColor: "rgba(255,255,255,0.3)",
        backgroundColor: cfg.bg,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {hiveColors.map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
            ))}
            <span
              className={cn(
                "text-xs font-semibold truncate",
                isSkipped && "line-through"
              )}
              style={{ color: cfg.color }}
            >
              {event.title}
            </span>
          </div>
          {hiveNames && (
            <p className="text-xs text-muted-foreground truncate">{hiveNames}</p>
          )}
          {event.notes && (
            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{event.notes}</p>
          )}
        </div>
        <div className="shrink-0 mt-0.5">
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-secondary" />}
          {event.status === "scheduled" && <Clock className="h-4 w-4 text-muted-foreground/40" />}
        </div>
      </div>
    </button>
  );
}

// ─── Treatment span bars ──────────────────────────────────────────

function TreatmentSpanRow({
  week,
  treatments,
  onEventClick,
}: {
  week: DayInfo[];
  treatments: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  if (treatments.length === 0) return null;
  const cfg = EVENT_CONFIG.treatment;

  return (
    <div className="relative" style={{ height: `${treatments.length * 22}px` }}>
      {treatments.map((t, tIdx) => {
        const { colStart, colEnd, isFirst, isLast } = eventColRange(t, week);
        const isCompleted = t.status === "completed";
        const isSkipped = t.status === "skipped";

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onEventClick(t)}
            style={{
              position: "absolute",
              top: `${tIdx * 22}px`,
              left: `calc(${colStart} / 7 * 100% + 2px)`,
              width: `calc(${colEnd - colStart + 1} / 7 * 100% - 4px)`,
              height: "18px",
              backgroundColor: isCompleted ? "rgba(107,114,128,0.12)" : cfg.bg.replace("0.10", "0.25"),
              borderLeft: isFirst ? `3px solid ${isCompleted ? "#9ca3af" : cfg.color}` : "none",
              borderRadius: `${isFirst ? "4px" : "0"} ${isLast ? "4px" : "0"} ${isLast ? "4px" : "0"} ${isFirst ? "4px" : "0"}`,
              display: "flex",
              alignItems: "center",
              paddingLeft: "6px",
              overflow: "hidden",
              cursor: "pointer",
              opacity: isSkipped ? 0.4 : 1,
            }}
          >
            {isFirst && (
              <span
                style={{
                  fontSize: "10px",
                  color: isCompleted ? "#6b7280" : cfg.color,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textDecoration: isSkipped ? "line-through" : undefined,
                }}
              >
                {t.title}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  hiveOptions,
  getWeatherDay,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  hiveOptions: HiveOption[];
  getWeatherDay: (date: string) => WeatherDay | null;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weeks = useMemo(
    () => generateMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const today = todayYMD();

  return (
    <div className="honey-glass rounded-outer overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/30 bg-muted/10">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="py-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="divide-y divide-border/20">
        {weeks.map((week, wIdx) => {
          const treatments = getMultiDayEventsForWeek(events, week);

          return (
            <div key={wIdx}>
              {/* Treatment span layer */}
              {treatments.length > 0 && (
                <div className="border-b border-dashed border-border/20 bg-muted/5 px-0">
                  <TreatmentSpanRow
                    week={week}
                    treatments={treatments}
                    onEventClick={onEventClick}
                  />
                </div>
              )}

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-border/20">
                {week.map((day) => {
                  const dayEvents = events.filter(
                    (e) =>
                      e.start_date === day.date && e.event_type !== "treatment"
                  );
                  const w = getWeatherDay(day.date);
                  const isTreatmentDay = events.some(
                    (e) =>
                      e.event_type === "treatment" &&
                      day.date >= e.start_date &&
                      day.date <= (e.end_date || e.start_date)
                  );
                  // Treatment weather warnings
                  const warnings = w
                    ? events
                        .filter(
                          (e) =>
                            e.event_type === "treatment" &&
                            day.date >= e.start_date &&
                            day.date <= (e.end_date || e.start_date) &&
                            e.status === "scheduled"
                        )
                        .map((e) =>
                          getTreatmentWeatherWarning(
                            (e.metadata.treatment_type as string) ?? "",
                            w
                          )
                        )
                        .filter(Boolean)
                    : [];

                  return (
                    <div
                      key={day.date}
                      onClick={() => onDayClick(day.date)}
                      className={cn(
                        "min-h-[96px] p-1.5 cursor-pointer transition-colors hover:bg-primary/5",
                        !day.isCurrentMonth && "opacity-35",
                        day.isToday && "bg-primary/5"
                      )}
                    >
                      {/* Day number + weather */}
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                            day.isToday
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {day.dayNum}
                        </span>
                        <div className="flex items-center gap-1">
                          {warnings.length > 0 && (
                            <span title={warnings[0] as string}>
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            </span>
                          )}
                          <WeatherStrip weather={w} />
                        </div>
                      </div>

                      {/* Events */}
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <EventPill
                            key={e.id}
                            event={e}
                            hiveOptions={hiveOptions}
                            compact
                            onClick={(ev) => {
                              ev?.stopPropagation();
                              onEventClick(e);
                            }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[9px] font-mono text-muted-foreground pl-1">
                            +{dayEvents.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  hiveOptions,
  getWeatherDay,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  hiveOptions: HiveOption[];
  getWeatherDay: (date: string) => WeatherDay | null;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const days = useMemo(() => generateWeekDays(weekStart), [weekStart]);
  const treatments = useMemo(() => getMultiDayEventsForWeek(events, days), [events, days]);

  return (
    <div className="space-y-3">
      {/* Treatment spans */}
      {treatments.length > 0 && (
        <div className="honey-glass rounded-outer p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">
            Active treatments
          </p>
          <div className="relative" style={{ height: `${treatments.length * 22}px` }}>
            <TreatmentSpanRow
              week={days}
              treatments={treatments}
              onEventClick={onEventClick}
            />
          </div>
        </div>
      )}

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayEvents = events.filter(
            (e) => e.start_date === day.date && e.event_type !== "treatment"
          );
          const w = getWeatherDay(day.date);

          return (
            <div key={day.date} className="min-w-0">
              {/* Day header */}
              <button
                type="button"
                onClick={() => onDayClick(day.date)}
                className={cn(
                  "w-full text-center rounded-inner p-2 mb-2 transition-colors hover:bg-primary/5",
                  day.isToday
                    ? "bg-primary/10 border border-primary/20"
                    : "glass-card"
                )}
              >
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p
                  className={cn(
                    "font-serif font-bold text-lg leading-tight",
                    day.isToday && "text-primary"
                  )}
                >
                  {day.dayNum}
                </p>
                {w && (
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    <WeatherIcon code={w.condition_code} className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {Math.round(w.temp_max)}°/{Math.round(w.temp_min)}°
                    </span>
                  </div>
                )}
              </button>

              {/* Events */}
              <div className="space-y-1.5">
                {dayEvents.map((e) => (
                  <EventPill
                    key={e.id}
                    event={e}
                    hiveOptions={hiveOptions}
                    onClick={() => onEventClick(e)}
                  />
                ))}
                {dayEvents.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onDayClick(day.date)}
                    className="w-full h-8 rounded-inner border-2 border-dashed border-border/30 flex items-center justify-center hover:border-primary/30 transition-colors"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground/40" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agenda view ──────────────────────────────────────────────────

function AgendaView({
  events,
  hiveOptions,
  suggestions,
  getWeatherDay,
  onDayClick,
  onEventClick,
  onAddToCalendar,
  dismissedIds,
  onDismissSuggestion,
}: {
  events: CalendarEvent[];
  hiveOptions: HiveOption[];
  suggestions: AISuggestion[];
  getWeatherDay: (date: string) => WeatherDay | null;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddToCalendar: (s: AISuggestion) => void;
  dismissedIds: Set<string>;
  onDismissSuggestion: (id: string) => void;
}) {
  const today = todayYMD();
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  const activeSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  // Map suggestion to suggested date for inline placement
  const suggestionsByDate = useMemo(() => {
    const m: Record<string, AISuggestion[]> = {};
    for (const s of activeSuggestions) {
      const d = s.suggested_date ?? today;
      (m[d] ??= []).push(s);
    }
    return m;
  }, [activeSuggestions, today]);

  return (
    <div className="space-y-1">
      {days.map((date) => {
        const dayEvents = getEventsForDay(events, date);
        const daySuggestions = suggestionsByDate[date] ?? [];
        if (dayEvents.length === 0 && daySuggestions.length === 0) {
          return (
            <div
              key={date}
              className="flex items-center gap-3 px-3 py-1 cursor-pointer group"
              onClick={() => onDayClick(date)}
            >
              <span className="font-mono text-[10px] text-muted-foreground/30 w-16 shrink-0">
                {formatMonthDay(date)}
              </span>
              <div className="h-px flex-1 bg-border/20 group-hover:bg-border/50 transition-colors" />
            </div>
          );
        }

        const w = getWeatherDay(date);

        return (
          <div key={date} className="space-y-1.5">
            {/* Date header */}
            <div
              className="flex items-center gap-3 px-3 pt-3 cursor-pointer group"
              onClick={() => onDayClick(date)}
            >
              <div className="shrink-0">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="font-serif font-bold text-base leading-tight">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              {w && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <WeatherIcon code={w.condition_code} className="h-3.5 w-3.5" />
                  <span className="font-mono">
                    {Math.round(w.temp_max)}°/{Math.round(w.temp_min)}°
                  </span>
                  <span className="opacity-60">{weatherDescription(w.condition_code)}</span>
                </div>
              )}
              <div className="h-px flex-1 bg-border/30 group-hover:bg-border/60 transition-colors" />
              <Plus className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 shrink-0 transition-colors" />
            </div>

            {/* Events */}
            <div className="px-3 space-y-1.5">
              {dayEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  hiveOptions={hiveOptions}
                  onClick={() => onEventClick(e)}
                />
              ))}

              {/* AI suggestions for this date */}
              {daySuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAddToCalendar={onAddToCalendar}
                  onDismiss={() => onDismissSuggestion(s.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI suggestion card ───────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onAddToCalendar,
  onDismiss,
}: {
  suggestion: AISuggestion;
  onAddToCalendar: (s: AISuggestion) => void;
  onDismiss: () => void;
}) {
  const urgencyColor = {
    low: "#3f6833",
    medium: "#B45309",
    high: "#C0392B",
  }[suggestion.urgency];

  return (
    <div
      className="px-4 py-3 rounded-inner border border-dashed border-primary/30 bg-primary/5 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground/80 truncate">
                {suggestion.hive_name}
              </span>
              <span
                className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: urgencyColor + "18",
                  color: urgencyColor,
                }}
              >
                {suggestion.urgency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.trigger}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-0.5 hover:bg-black/5 rounded transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
      </div>
      <p className="text-xs text-foreground/70 pl-5">{suggestion.recommendation}</p>
      {suggestion.event_type && (
        <div className="pl-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddToCalendar(suggestion)}
            className="h-7 text-xs honey-glass border-white/30 gap-1.5"
          >
            <Plus className="h-3 w-3" /> Add to calendar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── AI suggestions panel (sidebar) ──────────────────────────────

function AISuggestionsPanel({
  suggestions,
  onAddToCalendar,
  dismissedIds,
  onDismiss,
  onCollapse,
}: {
  suggestions: AISuggestion[];
  onAddToCalendar: (s: AISuggestion) => void;
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  onCollapse: () => void;
}) {
  const visible = suggestions.filter((s) => !dismissedIds.has(s.id));

  return (
    <div className="honey-glass rounded-outer p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary/70" />
          <span className="font-semibold text-sm">Suggestions</span>
          {visible.length > 0 && (
            <span className="data-value text-xs px-1.5 py-0.5 bg-primary/15 text-primary rounded-full">
              {visible.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="p-1 hover:bg-black/5 rounded transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No suggestions right now — your hives are on track.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAddToCalendar={onAddToCalendar}
              onDismiss={() => onDismiss(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Suggestion generator ─────────────────────────────────────────

function generateSuggestions(
  hiveOptions: HiveOption[],
  hives: HiveData[],
  events: CalendarEvent[]
): AISuggestion[] {
  const today = todayYMD();
  const suggestions: AISuggestion[] = [];

  for (const hive of hives) {
    const opt = hiveOptions.find((h) => h.id === hive.id);
    const { meta } = parseSetupNotes(hive.notes);

    // 1. Overdue inspection
    const freq = inspFreqDays(meta?.inspection_frequency);
    const lastInspection = events
      .filter(
        (e) =>
          e.hive_ids.includes(hive.id) &&
          e.event_type === "inspection" &&
          e.status === "completed"
      )
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

    if (freq) {
      const since = lastInspection ? daysBetween(lastInspection.start_date, today) : 9999;
      if (since > freq) {
        suggestions.push({
          id: `overdue-insp-${hive.id}`,
          hive_id: hive.id,
          hive_name: hive.name,
          trigger: lastInspection
            ? `No completed inspection in ${since} days (frequency: ${meta?.inspection_frequency})`
            : `No inspections recorded (frequency: ${meta?.inspection_frequency})`,
          recommendation: `Schedule an inspection for ${hive.name}`,
          urgency: since > freq * 2 ? "high" : "medium",
          suggested_date: today,
          event_type: "inspection",
          prefill: { event_type: "inspection", hive_ids: [hive.id] },
        });
      }
    }

    // 2. Mite count above threshold
    const lastMiteTest = events
      .filter((e) => e.hive_ids.includes(hive.id) && e.event_type === "mite_test")
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

    if (lastMiteTest?.metadata.infestation_pct != null) {
      const pct = lastMiteTest.metadata.infestation_pct as number;
      const threshold = parseThresholdPct(meta?.mite_threshold);
      if (pct > threshold) {
        suggestions.push({
          id: `mite-alert-${hive.id}`,
          hive_id: hive.id,
          hive_name: hive.name,
          trigger: `Mite load at ${pct}% (action threshold: ${meta?.mite_threshold ?? ">2%"})`,
          recommendation: `Start a treatment window — review weather before applying`,
          urgency: pct > threshold * 1.5 ? "high" : "medium",
          suggested_date: addDays(today, 2),
          event_type: "treatment",
          prefill: { event_type: "treatment", hive_ids: [hive.id] },
        });
      }
    }

    // 3. Treatment end date passed and still scheduled
    const overduetreatments = events.filter(
      (e) =>
        e.hive_ids.includes(hive.id) &&
        e.event_type === "treatment" &&
        e.status === "scheduled" &&
        e.end_date &&
        e.end_date < today
    );

    for (const t of overduetreatments) {
      suggestions.push({
        id: `treatment-expired-${t.id}`,
        hive_id: hive.id,
        hive_name: hive.name,
        trigger: `Treatment "${t.title}" ended ${daysBetween(t.end_date!, today)} days ago`,
        recommendation: `Remove treatment materials and mark as completed`,
        urgency: "high",
        suggested_date: today,
      });
    }
  }

  return suggestions.slice(0, 6);
}

// ─── Location prompt banner ───────────────────────────────────────

function LocationBanner({
  onRequest,
}: {
  onRequest: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="honey-glass rounded-outer px-4 py-3 flex items-center gap-3 justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 text-primary/60 shrink-0" />
        Enable your location for weather-aware treatment planning
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRequest}
          className="honey-glass border-white/30 rounded-xl text-xs h-7"
        >
          Enable weather
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-black/5 rounded"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
      </div>
    </div>
  );
}

// ─── Main CalendarPage ────────────────────────────────────────────

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedHiveIds, setSelectedHiveIds] = useState<string[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<{
    defaultDate?: string;
    defaultEventType?: EventType;
    defaultHiveIds?: string[];
    editEvent?: CalendarEvent | null;
    prefill?: Partial<CalendarEvent>;
  }>({});

  // Load events from localStorage
  useEffect(() => {
    if (!user) return;
    const all = loadAllEvents();
    setEvents(all.filter((e) => e.user_id === user.id));
  }, [user?.id]);

  // Weather + geolocation
  const { coords, prompted, requestLocation } = useGeolocation();
  const { getDay: getWeatherDay } = useWeather(coords);

  // Hives
  const { data: hives = [] } = useQuery<HiveData[]>({
    queryKey: ["hives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hives")
        .select("id, name, hive_code, notes")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const hiveOptions = useMemo(() => getHiveOptions(hives), [hives]);

  // Filtered events
  const filteredEvents = useMemo(
    () =>
      selectedHiveIds.length === 0
        ? events
        : events.filter((e) => e.hive_ids.some((id) => selectedHiveIds.includes(id))),
    [events, selectedHiveIds]
  );

  // AI suggestions
  const suggestions = useMemo(
    () => generateSuggestions(hiveOptions, hives, events),
    [hiveOptions, hives, events]
  );

  // ── Sheet helpers ──────────────────────────────────────────────

  const openSheet = useCallback(
    (config: typeof sheetConfig) => {
      setSheetConfig(config);
      setSheetOpen(true);
    },
    []
  );

  const handleDayClick = (date: string) =>
    openSheet({ defaultDate: date });

  const handleEventClick = (event: CalendarEvent) =>
    openSheet({ editEvent: event });

  const handleAddToCalendar = (s: AISuggestion) =>
    openSheet({
      defaultDate: s.suggested_date ?? todayYMD(),
      defaultEventType: s.event_type,
      defaultHiveIds: s.prefill?.hive_ids,
    });

  // ── Event CRUD ────────────────────────────────────────────────

  const handleSave = (event: CalendarEvent) => {
    const all = loadAllEvents();
    const idx = all.findIndex((e) => e.id === event.id);
    const next = idx >= 0 ? all.map((e) => (e.id === event.id ? event : e)) : [...all, event];
    persistAllEvents(next);
    setEvents(next.filter((e) => e.user_id === user?.id));
  };

  const handleDelete = (id: string) => {
    const all = loadAllEvents();
    const next = all.filter((e) => e.id !== id);
    persistAllEvents(next);
    setEvents(next.filter((e) => e.user_id === user?.id));
  };

  // ── Navigation ────────────────────────────────────────────────

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const navigateToday = () => setCurrentDate(new Date());

  const periodLabel = useMemo(() => {
    if (view === "month") return formatMonthYear(currentDate);
    if (view === "week") {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const e2 = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${s} – ${e2}`;
    }
    return "Next 30 days";
  }, [view, currentDate]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>
      <AppSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {/* Top action bar */}
      <div className="flex items-center justify-end gap-2 px-6 h-14 border-b border-amber-200/60 bg-white/40 backdrop-blur-sm flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openSheet({ defaultDate: todayYMD() })}
          className="gap-1.5 honey-glass border-white/30 hover:bg-primary/10 rounded-xl"
        >
          <Plus className="h-4 w-4" /> Add event
        </Button>
        {!showSuggestions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuggestions(true)}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suggestions</span>
            {suggestions.filter((s) => !dismissedSuggestionIds.has(s.id)).length > 0 && (
              <span className="data-value text-[10px] bg-primary/15 text-primary px-1.5 rounded-full">
                {suggestions.filter((s) => !dismissedSuggestionIds.has(s.id)).length}
              </span>
            )}
          </Button>
        )}
      </div>

      <div className="px-4 md:px-6 py-5 space-y-4">
        {/* Location banner */}
        {prompted && !coords && (
          <LocationBanner onRequest={requestLocation} />
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {/* View tabs */}
          <div className="honey-glass rounded-outer p-1 flex gap-1">
            {(["month", "week", "agenda"] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-inner text-sm font-medium capitalize transition-all btn-press",
                  view === v
                    ? "bg-gradient-to-r from-[#FFB347] to-[#FFD700] text-[#5C3500] shadow-amber"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Period nav */}
          {view !== "agenda" && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={navigatePrev}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={navigateToday}
                className="font-semibold text-sm min-w-[160px] text-center hover:text-primary transition-colors"
              >
                {periodLabel}
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={navigateNext}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Hive filter */}
          {hiveOptions.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedHiveIds([])}
                className={cn(
                  "px-2.5 py-1 rounded-inner text-xs font-medium border transition-all btn-press",
                  selectedHiveIds.length === 0
                    ? "bg-foreground text-background border-foreground"
                    : "honey-glass border-white/30 text-muted-foreground"
                )}
              >
                All
              </button>
              {hiveOptions.map((h) => {
                const active = selectedHiveIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      setSelectedHiveIds((prev) =>
                        active ? prev.filter((id) => id !== h.id) : [...prev, h.id]
                      )
                    }
                    className={cn(
                      "px-2.5 py-1 rounded-inner text-xs font-medium border transition-all btn-press",
                      active ? "text-white border-transparent" : "honey-glass border-white/30"
                    )}
                    style={
                      active
                        ? { backgroundColor: h.color }
                        : { borderLeftColor: h.color, borderLeftWidth: "3px" }
                    }
                  >
                    {h.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => {
            const cfg = EVENT_CONFIG[type];
            return (
              <span key={type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
                <span className="text-[10px] font-mono text-muted-foreground">{cfg.label}</span>
              </span>
            );
          })}
        </div>

        {/* Main layout */}
        <div className={cn("flex gap-5 items-start", showSuggestions && view !== "agenda" && "md:flex-row flex-col")}>
          {/* Calendar view */}
          <div className="flex-1 min-w-0">
            {view === "month" && (
              <MonthView
                currentDate={currentDate}
                events={filteredEvents}
                hiveOptions={hiveOptions}
                getWeatherDay={getWeatherDay}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {view === "week" && (
              <WeekView
                currentDate={currentDate}
                events={filteredEvents}
                hiveOptions={hiveOptions}
                getWeatherDay={getWeatherDay}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                events={filteredEvents}
                hiveOptions={hiveOptions}
                suggestions={suggestions}
                getWeatherDay={getWeatherDay}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                onAddToCalendar={handleAddToCalendar}
                dismissedIds={dismissedSuggestionIds}
                onDismissSuggestion={(id) =>
                  setDismissedSuggestionIds((prev) => new Set([...prev, id]))
                }
              />
            )}
          </div>

          {/* AI suggestions sidebar (month/week only) */}
          {showSuggestions && view !== "agenda" && (
            <div className="w-full md:w-72 shrink-0">
              <AISuggestionsPanel
                suggestions={suggestions}
                onAddToCalendar={handleAddToCalendar}
                dismissedIds={dismissedSuggestionIds}
                onDismiss={(id) =>
                  setDismissedSuggestionIds((prev) => new Set([...prev, id]))
                }
                onCollapse={() => setShowSuggestions(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Event creation/editing sheet */}
      <EventSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultDate={sheetConfig.defaultDate}
        defaultEventType={sheetConfig.defaultEventType ?? sheetConfig.prefill?.event_type}
        defaultHiveIds={sheetConfig.defaultHiveIds ?? sheetConfig.prefill?.hive_ids}
        editEvent={sheetConfig.editEvent}
        hives={hiveOptions}
        userId={user?.id ?? ""}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      </main>
    </div>
  );
};

export default CalendarPage;
