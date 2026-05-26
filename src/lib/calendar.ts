// ─── Event types ─────────────────────────────────────────────────

export type EventType =
  | "inspection"
  | "mite_test"
  | "treatment"
  | "harvest"
  | "feeding"
  | "queen_event";

export type EventStatus = "scheduled" | "completed" | "skipped";

export interface CalendarEvent {
  id: string;
  user_id: string;
  hive_ids: string[];
  event_type: EventType;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  status: EventStatus;
  notes?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WeatherDay {
  date: string;
  temp_max: number; // Fahrenheit
  temp_min: number;
  condition_code: number;
}

export interface AISuggestion {
  id: string;
  hive_id: string;
  hive_name: string;
  trigger: string;
  recommendation: string;
  urgency: "low" | "medium" | "high";
  suggested_date?: string;
  event_type?: EventType;
  prefill?: Partial<CalendarEvent>;
}

export interface DayInfo {
  date: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

// ─── Event configuration ─────────────────────────────────────────

export const EVENT_CONFIG: Record<
  EventType,
  { label: string; color: string; bg: string; border: string }
> = {
  inspection: {
    label: "Inspection",
    color: "#3f6833",
    bg: "rgba(63,104,51,0.10)",
    border: "#3f6833",
  },
  mite_test: {
    label: "Mite test",
    color: "#B45309",
    bg: "rgba(180,83,9,0.10)",
    border: "#B45309",
  },
  treatment: {
    label: "Treatment",
    color: "#C0392B",
    bg: "rgba(192,57,43,0.10)",
    border: "#C0392B",
  },
  harvest: {
    label: "Harvest",
    color: "#92400E",
    bg: "rgba(146,64,14,0.10)",
    border: "#D97706",
  },
  feeding: {
    label: "Feeding",
    color: "#0F766E",
    bg: "rgba(15,118,110,0.10)",
    border: "#0F766E",
  },
  queen_event: {
    label: "Queen event",
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.10)",
    border: "#7C3AED",
  },
};

// ─── Hive color palette ───────────────────────────────────────────

export const HIVE_PALETTE = [
  "#FFB347",
  "#3f6833",
  "#7C6B9E",
  "#E88068",
  "#2E9E9A",
  "#C0A060",
];

export function getHiveColor(index: number): string {
  return HIVE_PALETTE[index % HIVE_PALETTE.length];
}

// ─── Date utilities ───────────────────────────────────────────────

export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYMD(): string {
  return toYMD(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function isSameMonth(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

// ─── Calendar grid generation ─────────────────────────────────────

export function generateMonthGrid(year: number, month: number): DayInfo[][] {
  const today = todayYMD();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: DayInfo[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    const date = toYMD(d);
    days.push({ date, dayNum: d.getDate(), isCurrentMonth: false, isToday: date === today });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const date = toYMD(d);
    days.push({ date, dayNum: i, isCurrentMonth: true, isToday: date === today });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    const date = toYMD(d);
    days.push({ date, dayNum: i, isCurrentMonth: false, isToday: date === today });
  }

  const weeks: DayInfo[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

export function generateWeekDays(weekStart: Date): DayInfo[] {
  const today = todayYMD();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const date = toYMD(d);
    return { date, dayNum: d.getDate(), isCurrentMonth: true, isToday: date === today };
  });
}

// ─── Event filtering ──────────────────────────────────────────────

export function eventSpansDay(event: CalendarEvent, date: string): boolean {
  const end = event.end_date || event.start_date;
  return date >= event.start_date && date <= end;
}

export function getEventsForDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => eventSpansDay(e, date));
}

export function getMultiDayEventsForWeek(
  events: CalendarEvent[],
  week: DayInfo[]
): CalendarEvent[] {
  const weekStart = week[0].date;
  const weekEnd = week[6].date;
  return events.filter(
    (e) =>
      e.end_date &&
      e.end_date !== e.start_date &&
      e.start_date <= weekEnd &&
      e.end_date >= weekStart
  );
}

// Column range within a week (0–6)
export function eventColRange(
  event: CalendarEvent,
  week: DayInfo[]
): { colStart: number; colEnd: number; isFirst: boolean; isLast: boolean } {
  const weekStart = week[0].date;
  const weekEnd = week[6].date;
  const eventEnd = event.end_date || event.start_date;

  const isFirst = event.start_date >= weekStart;
  const isLast = eventEnd <= weekEnd;

  const colStart = isFirst ? week.findIndex((d) => d.date === event.start_date) : 0;
  let colEnd = 6;
  if (isLast) {
    const idx = [...week].reverse().findIndex((d) => d.date <= eventEnd);
    colEnd = idx >= 0 ? 6 - idx : 6;
  }

  return { colStart: Math.max(0, colStart), colEnd, isFirst, isLast };
}

// ─── Treatment handling ───────────────────────────────────────────

const TREATMENT_DURATIONS: Array<[string, number]> = [
  ["apivar", 42],
  ["maqs", 7],
  ["formic", 7],
  ["apiguard", 28],
  ["thymol", 28],
];

export function treatmentDurationDays(treatmentType: string): number {
  const lower = treatmentType.toLowerCase();
  for (const [key, days] of TREATMENT_DURATIONS) {
    if (lower.includes(key)) return days;
  }
  return 0; // single-day by default (OA vaporize, OA dribble)
}

export function treatmentAutoEndDate(treatmentType: string, startDate: string): string {
  const days = treatmentDurationDays(treatmentType);
  return days > 0 ? addDays(startDate, days) : startDate;
}

export function getTreatmentWeatherWarning(
  treatmentType: string,
  weather: WeatherDay
): string | null {
  const lower = treatmentType.toLowerCase();
  if (lower.includes("maqs") || lower.includes("formic")) {
    if (weather.temp_max > 85)
      return `Too hot for MAQS (${Math.round(weather.temp_max)}°F forecast, max 85°F)`;
    if (weather.temp_min < 50)
      return `Too cold for MAQS (${Math.round(weather.temp_min)}°F forecast, min 50°F)`;
  }
  if (lower.includes("apiguard") || lower.includes("thymol")) {
    if (weather.temp_min < 59)
      return `Apiguard may be ineffective (${Math.round(weather.temp_min)}°F forecast, needs 59°F+)`;
  }
  return null;
}

// ─── Mite calculations ────────────────────────────────────────────

export function calcInfestationPct(miteCount: number, sampleSize: number): number {
  if (!sampleSize) return 0;
  return Math.round((miteCount / sampleSize) * 1000) / 10;
}

export function parseThresholdPct(threshold: string | null | undefined): number {
  if (!threshold) return 2;
  if (threshold.includes("1%")) return 1;
  if (threshold.includes("3%")) return 3;
  return 2;
}

// ─── Inspection frequency ─────────────────────────────────────────

export function inspFreqDays(freq: string | null | undefined): number | null {
  if (freq === "Weekly") return 7;
  if (freq === "Biweekly") return 14;
  if (freq === "Monthly") return 30;
  return null;
}

// ─── Weather descriptions ─────────────────────────────────────────

export function weatherDescription(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

// ─── Calendar storage ─────────────────────────────────────────────

const EVENTS_KEY = "hivemind_calendar_v1";

export function loadAllEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}

export function persistAllEvents(events: CalendarEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}
