import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, Trash2 } from "lucide-react";
import {
  CalendarEvent,
  EventType,
  EventStatus,
  EVENT_CONFIG,
  treatmentAutoEndDate,
  calcInfestationPct,
  parseThresholdPct,
  todayYMD,
} from "@/lib/calendar";

// ─── Shared controls ──────────────────────────────────────────────

const Chip = ({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-inner text-sm font-medium transition-all duration-150 border select-none btn-press brand-curve",
      active
        ? "text-[#5C3500] border-transparent shadow-amber"
        : "honey-glass border-white/30 text-foreground hover:border-primary/50"
    )}
    style={
      active
        ? { background: "linear-gradient(to right, #FFB347, #FFD700)" }
        : color
        ? { borderLeftColor: color, borderLeftWidth: "3px" }
        : {}
    }
  >
    {label}
  </button>
);

const ChipGroup = ({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = multi
        ? (value as string[]).includes(opt)
        : value === opt;
      return (
        <Chip
          key={opt}
          label={opt}
          active={active}
          onClick={() => {
            if (multi) {
              const arr = value as string[];
              onChange(active ? arr.filter((v) => v !== opt) : [...arr, opt]);
            } else {
              onChange(active ? "" : opt);
            }
          }}
        />
      );
    })}
  </div>
);

const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-muted-foreground mt-1">{children}</p>
);

const FieldRow = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <Label className="font-semibold text-sm">{label}</Label>
    <div className="mt-1.5">{children}</div>
    {hint && <FieldHint>{hint}</FieldHint>}
  </div>
);

// ─── Hive selector ────────────────────────────────────────────────

interface HiveOption {
  id: string;
  name: string;
  color: string;
  setupMeta?: { mite_threshold?: string | null; mite_treatment?: string | string[] | null } | null;
}

const HiveSelector = ({
  hives,
  value,
  onChange,
  multi = true,
}: {
  hives: HiveOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
}) => (
  <div className="flex flex-wrap gap-2">
    {hives.map((hive) => {
      const active = value.includes(hive.id);
      return (
        <button
          key={hive.id}
          type="button"
          onClick={() => {
            if (multi) {
              onChange(active ? value.filter((id) => id !== hive.id) : [...value, hive.id]);
            } else {
              onChange(active ? [] : [hive.id]);
            }
          }}
          className={cn(
            "px-3 py-1.5 rounded-inner text-sm font-medium transition-all duration-150 border btn-press",
            active ? "text-white" : "honey-glass border-white/30 text-foreground"
          )}
          style={
            active
              ? { backgroundColor: hive.color, borderColor: hive.color }
              : { borderLeftColor: hive.color, borderLeftWidth: "3px" }
          }
        >
          {hive.name}
        </button>
      );
    })}
  </div>
);

// ─── Type-specific field groups ───────────────────────────────────

const InspectionFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) => (
  <div className="space-y-4">
    <FieldRow label="Overall health">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange("health_rating", n)}
            className={cn(
              "w-9 h-9 rounded-inner text-sm font-bold border transition-all btn-press",
              meta.health_rating === n
                ? "bg-gradient-to-r from-[#FFB347] to-[#FFD700] text-[#5C3500] border-transparent shadow-amber"
                : "honey-glass border-white/30"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <FieldHint>1 = poor, 5 = excellent</FieldHint>
    </FieldRow>
    <FieldRow label="Brood pattern">
      <ChipGroup
        options={["Good", "Spotty", "None"]}
        value={(meta.brood_pattern as string) ?? ""}
        onChange={(v) => onChange("brood_pattern", v)}
      />
    </FieldRow>
    <FieldRow label="Stores level">
      <ChipGroup
        options={["Full", "Adequate", "Low"]}
        value={(meta.stores_level as string) ?? ""}
        onChange={(v) => onChange("stores_level", v)}
      />
    </FieldRow>
    <FieldRow label="Queen seen">
      <ChipGroup
        options={["Yes", "No", "Not checked"]}
        value={(meta.queen_seen as string) ?? ""}
        onChange={(v) => onChange("queen_seen", v)}
      />
    </FieldRow>
  </div>
);

const MiteTestFields = ({
  meta,
  onChange,
  hiveMeta,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
  hiveMeta?: HiveOption["setupMeta"];
}) => {
  const miteCount = Number(meta.mite_count ?? 0);
  const sampleSize = Number(meta.sample_size ?? 100);
  const pct = miteCount > 0 ? calcInfestationPct(miteCount, sampleSize) : null;
  const threshold = parseThresholdPct(hiveMeta?.mite_threshold);
  const overThreshold = pct !== null && pct > threshold;

  return (
    <div className="space-y-4">
      <FieldRow label="Test method">
        <ChipGroup
          options={["Alcohol wash", "Sugar roll", "Sticky board drop", "Visual"]}
          value={(meta.method as string) ?? ""}
          onChange={(v) => onChange("method", v)}
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Mite count">
          <Input
            type="number"
            min="0"
            value={(meta.mite_count as string) ?? ""}
            onChange={(e) => onChange("mite_count", e.target.value)}
            placeholder="0"
          />
        </FieldRow>
        <FieldRow
          label="Sample size"
          hint="bees counted"
        >
          <Input
            type="number"
            min="1"
            value={(meta.sample_size as string) ?? "100"}
            onChange={(e) => onChange("sample_size", e.target.value)}
            placeholder="100"
          />
        </FieldRow>
      </div>
      {pct !== null && (
        <div
          className={cn(
            "px-4 py-3 rounded-inner border text-sm",
            overThreshold
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-green-50 border-green-200 text-green-800"
          )}
        >
          <span className="data-value font-bold text-lg">{pct}%</span> infestation
          {hiveMeta?.mite_threshold && (
            <span className="ml-2 text-xs opacity-75">
              (threshold: {hiveMeta.mite_threshold})
            </span>
          )}
          {overThreshold && (
            <p className="mt-1 text-xs font-medium">
              Above action threshold — consider scheduling treatment.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const TreatmentFields = ({
  meta,
  onChange,
  startDate,
  onEndDateSuggest,
  hiveMeta,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
  startDate: string;
  onEndDateSuggest: (date: string) => void;
  hiveMeta?: HiveOption["setupMeta"];
}) => {
  const savedTreatments: string[] = (() => {
    const t = hiveMeta?.mite_treatment;
    if (!t) return [];
    return Array.isArray(t) ? t : [t];
  })();

  const options = savedTreatments.length > 0
    ? savedTreatments
    : ["Oxalic acid dribble", "Oxalic acid vaporize", "Formic acid (MAQS)", "Apivar", "Apiguard"];

  return (
    <div className="space-y-4">
      <FieldRow label="Treatment type">
        <ChipGroup
          options={options}
          value={(meta.treatment_type as string) ?? ""}
          onChange={(v) => {
            onChange("treatment_type", v);
            if (v) onEndDateSuggest(treatmentAutoEndDate(v as string, startDate));
          }}
        />
      </FieldRow>
      <FieldRow label="Product / lot notes">
        <Input
          value={(meta.product_notes as string) ?? ""}
          onChange={(e) => onChange("product_notes", e.target.value)}
          placeholder="e.g., Api-Bioxal lot 2024A"
        />
      </FieldRow>
    </div>
  );
};

const HarvestFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) => (
  <div className="space-y-4">
    <FieldRow label="Estimated yield (lbs)">
      <Input
        type="number"
        min="0"
        step="0.1"
        value={(meta.yield_lbs as string) ?? ""}
        onChange={(e) => onChange("yield_lbs", e.target.value)}
        placeholder="e.g., 12.5"
      />
    </FieldRow>
    <FieldRow label="Honey type">
      <ChipGroup
        options={["Wildflower", "Clover", "Buckwheat", "Varietal"]}
        value={(meta.honey_type as string) ?? ""}
        onChange={(v) => onChange("honey_type", v)}
      />
    </FieldRow>
  </div>
);

const FeedingFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) => (
  <div className="space-y-4">
    <FieldRow label="Feed type">
      <ChipGroup
        options={["Sugar syrup", "Fondant", "Pollen patty", "Other"]}
        value={(meta.feed_type as string) ?? ""}
        onChange={(v) => onChange("feed_type", v)}
      />
    </FieldRow>
    <FieldRow label="Quantity">
      <Input
        value={(meta.quantity as string) ?? ""}
        onChange={(e) => onChange("quantity", e.target.value)}
        placeholder="e.g., 2 quarts, 500g"
      />
    </FieldRow>
  </div>
);

const QueenEventFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) => {
  const type = meta.queen_event_type as string;
  const showSource = type === "Requeening" || type === "New queen introduced";

  return (
    <div className="space-y-4">
      <FieldRow label="Event type">
        <ChipGroup
          options={[
            "Supersedure noted",
            "Requeening",
            "New queen introduced",
            "Queen confirmed laying",
          ]}
          value={type ?? ""}
          onChange={(v) => onChange("queen_event_type", v)}
        />
      </FieldRow>
      {showSource && (
        <FieldRow label="New queen source">
          <Input
            value={(meta.new_queen_source as string) ?? ""}
            onChange={(e) => onChange("new_queen_source", e.target.value)}
            placeholder="e.g., local breeder, purchased online"
          />
        </FieldRow>
      )}
    </div>
  );
};

// ─── Event type config pills ──────────────────────────────────────

const TYPE_ORDER: EventType[] = [
  "inspection",
  "mite_test",
  "treatment",
  "harvest",
  "feeding",
  "queen_event",
];

// ─── Auto-generate title ──────────────────────────────────────────

function autoTitle(type: EventType, meta: Record<string, unknown>): string {
  switch (type) {
    case "inspection":
      return "Inspection";
    case "mite_test":
      return `Mite test${meta.method ? ` (${meta.method})` : ""}`;
    case "treatment":
      return meta.treatment_type ? `Treatment: ${meta.treatment_type}` : "Treatment";
    case "harvest":
      return "Honey harvest";
    case "feeding":
      return meta.feed_type ? `Feeding: ${meta.feed_type}` : "Feeding";
    case "queen_event":
      return (meta.queen_event_type as string) ?? "Queen event";
    default:
      return "Event";
  }
}

// ─── Main EventSheet component ────────────────────────────────────

interface EventSheetProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultEventType?: EventType;
  defaultHiveIds?: string[];
  editEvent?: CalendarEvent | null;
  hives: HiveOption[];
  userId: string;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

const EventSheet: React.FC<EventSheetProps> = ({
  open,
  onClose,
  defaultDate,
  defaultEventType,
  defaultHiveIds,
  editEvent,
  hives,
  userId,
  onSave,
  onDelete,
}) => {
  const [eventType, setEventType] = useState<EventType>(
    defaultEventType ?? "inspection"
  );
  const [hiveIds, setHiveIds] = useState<string[]>(defaultHiveIds ?? []);
  const [startDate, setStartDate] = useState(defaultDate ?? todayYMD());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<EventStatus>("scheduled");
  const [meta, setMeta] = useState<Record<string, unknown>>({});

  // Reset when sheet opens
  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setEventType(editEvent.event_type);
      setHiveIds(editEvent.hive_ids);
      setStartDate(editEvent.start_date);
      setEndDate(editEvent.end_date ?? "");
      setNotes(editEvent.notes ?? "");
      setStatus(editEvent.status);
      setMeta(editEvent.metadata ?? {});
    } else {
      setEventType(defaultEventType ?? "inspection");
      setHiveIds(defaultHiveIds ?? (hives.length === 1 ? [hives[0].id] : []));
      setStartDate(defaultDate ?? todayYMD());
      setEndDate("");
      setNotes("");
      setStatus("scheduled");
      setMeta({});
    }
  }, [open]);

  const setMetaKey = (k: string, v: unknown) => setMeta((prev) => ({ ...prev, [k]: v }));

  const firstHive = hives.find((h) => hiveIds.includes(h.id));
  const singleHiveEvent = eventType === "mite_test" || eventType === "queen_event";

  const handleSave = () => {
    if (hiveIds.length === 0) return;

    // Compute infestation pct for mite tests
    let finalMeta = { ...meta };
    if (eventType === "mite_test" && meta.mite_count && meta.sample_size) {
      finalMeta.infestation_pct = calcInfestationPct(
        Number(meta.mite_count),
        Number(meta.sample_size)
      );
    }

    const event: CalendarEvent = {
      id: editEvent?.id ?? crypto.randomUUID(),
      user_id: userId,
      hive_ids: hiveIds,
      event_type: eventType,
      title: autoTitle(eventType, finalMeta),
      start_date: startDate,
      end_date: endDate || null,
      status,
      notes: notes || undefined,
      metadata: finalMeta,
      created_at: editEvent?.created_at ?? new Date().toISOString(),
    };

    onSave(event);
    onClose();
  };

  const isMultiDay = eventType === "treatment";
  const cfg = EVENT_CONFIG[eventType];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] overflow-y-auto flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: cfg.color }}
            />
            <SheetTitle className="font-serif text-lg font-bold">
              {editEvent ? "Edit event" : "New event"}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Event type selector */}
          {!editEvent && (
            <div>
              <Label className="font-semibold text-sm mb-2 block">Event type</Label>
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map((type) => {
                  const c = EVENT_CONFIG[type];
                  const active = eventType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setEventType(type);
                        setMeta({});
                        setEndDate("");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-inner text-xs font-semibold border transition-all btn-press",
                        active ? "text-white border-transparent" : "honey-glass border-white/30 text-foreground"
                      )}
                      style={active ? { backgroundColor: c.color } : {}}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hive selector */}
          <div>
            <Label className="font-semibold text-sm mb-2 block">
              {singleHiveEvent ? "Hive" : "Hive(s)"}
            </Label>
            <HiveSelector
              hives={hives}
              value={hiveIds}
              onChange={setHiveIds}
              multi={!singleHiveEvent}
            />
            {hiveIds.length === 0 && (
              <p className="text-xs text-destructive mt-1">Select at least one hive</p>
            )}
          </div>

          {/* Date */}
          <div className={isMultiDay ? "grid grid-cols-2 gap-4" : ""}>
            <FieldRow label={isMultiDay ? "Start date" : "Date"}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (
                    eventType === "treatment" &&
                    meta.treatment_type &&
                    e.target.value
                  ) {
                    setEndDate(
                      treatmentAutoEndDate(meta.treatment_type as string, e.target.value)
                    );
                  }
                }}
              />
            </FieldRow>
            {isMultiDay && (
              <FieldRow label="End date" hint="Auto-filled by treatment type">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FieldRow>
            )}
          </div>

          {/* Type-specific fields */}
          {eventType === "inspection" && (
            <InspectionFields meta={meta} onChange={setMetaKey} />
          )}
          {eventType === "mite_test" && (
            <MiteTestFields
              meta={meta}
              onChange={setMetaKey}
              hiveMeta={firstHive?.setupMeta}
            />
          )}
          {eventType === "treatment" && (
            <TreatmentFields
              meta={meta}
              onChange={setMetaKey}
              startDate={startDate}
              onEndDateSuggest={setEndDate}
              hiveMeta={firstHive?.setupMeta}
            />
          )}
          {eventType === "harvest" && (
            <HarvestFields meta={meta} onChange={setMetaKey} />
          )}
          {eventType === "feeding" && (
            <FeedingFields meta={meta} onChange={setMetaKey} />
          )}
          {eventType === "queen_event" && (
            <QueenEventFields meta={meta} onChange={setMetaKey} />
          )}

          {/* Status (edit only) */}
          {editEvent && (
            <FieldRow label="Status">
              <ChipGroup
                options={["scheduled", "completed", "skipped"]}
                value={status}
                onChange={(v) => setStatus(v as EventStatus)}
              />
            </FieldRow>
          )}

          {/* Notes */}
          <FieldRow label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional observations..."
              className="min-h-[80px] bg-white/30 border-white/30 focus:border-primary/40"
            />
          </FieldRow>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex items-center gap-3">
          <Button
            variant="hero"
            onClick={handleSave}
            disabled={hiveIds.length === 0}
            className="flex-1 gap-2"
          >
            <Check className="h-4 w-4" />
            {editEvent ? "Save changes" : "Add to calendar"}
          </Button>
          {editEvent && onDelete && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                onDelete(editEvent.id);
                onClose();
              }}
              className="honey-glass border-white/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export type { HiveOption };
export default EventSheet;
