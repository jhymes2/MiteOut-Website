import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, X, Check, Cpu, Settings } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

export interface HiveSetupMeta {
  location?: string | null;
  date_established?: string | null;
  colony_source?: string | null;
  bee_race?: string | null;
  hive_type?: string | null;
  num_deeps?: number;
  num_supers?: number | null;
  frames_per_box?: number;
  frame_size?: string | null;
  bottom_board?: string | null;
  queen_excluder?: string | null;
  harvest_window?: string | null;
  honey_crop?: string[] | null;
  mite_treatment?: string | string[] | null;
  mite_threshold?: string | null;
  inspection_frequency?: string | null;
  baseline_weight_lbs?: number | null;
}

// ─── Notes JSON helpers (used by HivePage) ───────────────────────

export function parseSetupNotes(raw: string | null): {
  meta: HiveSetupMeta | null;
  fieldNotes: string;
} {
  if (!raw) return { meta: null, fieldNotes: "" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const { field_notes, ...rest } = parsed as Record<string, unknown>;
      const isSetupJson = ["hive_type", "date_established", "colony_source", "num_deeps"].some(
        (k) => k in rest
      );
      if (isSetupJson) {
        return { meta: rest as HiveSetupMeta, fieldNotes: (field_notes as string) ?? "" };
      }
    }
  } catch {}
  return { meta: null, fieldNotes: raw };
}

export function buildNotesJson(meta: HiveSetupMeta | null, fieldNotes: string): string {
  if (!meta) return fieldNotes;
  const payload: Record<string, unknown> = { ...meta };
  if (fieldNotes) payload.field_notes = fieldNotes;
  return JSON.stringify(payload);
}

// ─── Defaults + normalizers ───────────────────────────────────────

const DEFAULT_META: Required<Omit<HiveSetupMeta, "baseline_weight_lbs">> & {
  baseline_weight_lbs: null;
} = {
  location: "",
  date_established: "",
  colony_source: "",
  bee_race: "",
  hive_type: "Langstroth",
  num_deeps: 2,
  num_supers: 1,
  frames_per_box: 10,
  frame_size: `Deep 9-1/8"`,
  bottom_board: "",
  queen_excluder: "",
  harvest_window: "",
  honey_crop: [],
  mite_treatment: [],
  mite_threshold: ">2% standard",
  inspection_frequency: "",
  baseline_weight_lbs: null,
};

function normalizeTreatment(t: string | string[] | null | undefined): string[] {
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function hiveAge(dateStr: string): string {
  const d = new Date(dateStr);
  const totalDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (totalDays < 0) return "";
  if (totalDays < 30) return `${totalDays}d`;
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  if (years === 0) return `${months}mo`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}mo`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Shared controls ──────────────────────────────────────────────

const ChipSelect = ({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) => {
  const toggle = (opt: string) => {
    if (multi) {
      const arr = (value as string[]) ?? [];
      onChange(arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt]);
    } else {
      onChange(value === opt ? "" : opt);
    }
  };
  const active = (opt: string) =>
    multi ? ((value as string[]) ?? []).includes(opt) : value === opt;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "px-3.5 py-2 rounded-inner text-sm font-medium transition-all duration-150 border btn-press brand-curve select-none",
            active(opt)
              ? "bg-gradient-to-r from-[#FFB347] to-[#FFD700] text-[#5C3500] border-transparent shadow-amber"
              : "honey-glass border-white/30 text-foreground hover:border-primary/50"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

const NumberStepper = ({
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) => (
  <div className="inline-flex items-center gap-3">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="w-9 h-9 rounded-inner honey-glass border border-white/30 flex items-center justify-center text-base font-bold hover:bg-primary/20 transition-colors btn-press disabled:opacity-35"
    >
      −
    </button>
    <span className="data-value text-xl font-semibold w-8 text-center">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="w-9 h-9 rounded-inner honey-glass border border-white/30 flex items-center justify-center text-base font-bold hover:bg-primary/20 transition-colors btn-press disabled:opacity-35"
    >
      +
    </button>
  </div>
);

const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
);

// ─── Summary display atoms ────────────────────────────────────────

const ReadPill = ({ value }: { value: string }) => (
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-[#5C3500] text-xs font-medium border border-primary/20">
    {value}
  </span>
);

const MetaItem = ({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
      {label}
    </p>
    <div className="flex flex-wrap gap-1 items-center min-h-[1.3rem]">
      {children ?? <span className="text-muted-foreground/35 text-xs">—</span>}
    </div>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-3.5 pb-2 border-b border-border/40">
    {children}
  </p>
);

// ─── Summary (read mode) ──────────────────────────────────────────

const SetupSummary = ({
  meta,
  hiveCode,
}: {
  meta: HiveSetupMeta;
  hiveCode: string | null;
}) => {
  const treatments = normalizeTreatment(meta.mite_treatment);
  const crops = meta.honey_crop ?? [];
  const showSupers = !["Top-bar", "Warré"].includes(meta.hive_type ?? "");

  const boxesText = [
    (meta.num_deeps ?? 0) > 0 && `${meta.num_deeps} deep${meta.num_deeps !== 1 ? "s" : ""}`,
    showSupers && (meta.num_supers ?? 0) > 0 && `${meta.num_supers} super${meta.num_supers !== 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasLogger = !!(hiveCode || meta.baseline_weight_lbs != null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
        {/* Identity */}
        <div className="space-y-3">
          <SectionLabel>Identity</SectionLabel>
          <MetaItem label="Location">
            {meta.location ? <span className="text-sm">{meta.location}</span> : undefined}
          </MetaItem>
          <MetaItem label="Established">
            {meta.date_established ? (
              <span className="text-sm">
                {fmtDate(meta.date_established)}{" "}
                <span className="data-value text-xs text-muted-foreground">
                  · {hiveAge(meta.date_established)}
                </span>
              </span>
            ) : undefined}
          </MetaItem>
          <MetaItem label="Colony source">
            {meta.colony_source ? <ReadPill value={meta.colony_source} /> : undefined}
          </MetaItem>
          <MetaItem label="Bee race">
            {meta.bee_race ? <ReadPill value={meta.bee_race} /> : undefined}
          </MetaItem>
        </div>

        {/* Structure */}
        <div className="space-y-3">
          <SectionLabel>Structure</SectionLabel>
          <MetaItem label="Hive type">
            {meta.hive_type ? <ReadPill value={meta.hive_type} /> : undefined}
          </MetaItem>
          <MetaItem label="Boxes">
            {boxesText ? <span className="data-value text-sm">{boxesText}</span> : undefined}
          </MetaItem>
          <MetaItem label="Frames">
            {meta.frames_per_box || meta.frame_size ? (
              <span className="text-sm text-foreground/80">
                {meta.frames_per_box ? `${meta.frames_per_box}/box` : ""}
                {meta.frames_per_box && meta.frame_size ? " · " : ""}
                {meta.frame_size ?? ""}
              </span>
            ) : undefined}
          </MetaItem>
          <MetaItem label="Bottom board">
            {meta.bottom_board ? <ReadPill value={meta.bottom_board} /> : undefined}
          </MetaItem>
          <MetaItem label="Queen excluder">
            {meta.queen_excluder ? <ReadPill value={meta.queen_excluder} /> : undefined}
          </MetaItem>
        </div>

        {/* Management */}
        <div className="space-y-3">
          <SectionLabel>Management</SectionLabel>
          <MetaItem label="Harvest">
            {meta.harvest_window ? <ReadPill value={meta.harvest_window} /> : undefined}
          </MetaItem>
          <MetaItem label="Honey crop">
            {crops.length > 0 ? crops.map((c) => <ReadPill key={c} value={c} />) : undefined}
          </MetaItem>
          <MetaItem label="Treatment">
            {treatments.length > 0 ? treatments.map((t) => <ReadPill key={t} value={t} />) : undefined}
          </MetaItem>
          <MetaItem label="Mite threshold">
            {meta.mite_threshold ? <ReadPill value={meta.mite_threshold} /> : undefined}
          </MetaItem>
          <MetaItem label="Inspections">
            {meta.inspection_frequency ? <ReadPill value={meta.inspection_frequency} /> : undefined}
          </MetaItem>
        </div>
      </div>

      {/* Logger footer row */}
      {hasLogger && (
        <div className="flex flex-wrap items-center gap-4 pt-3.5 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold">
              Logger
            </span>
          </div>
          {hiveCode && (
            <span className="data-value text-xs text-foreground/70">{hiveCode}</span>
          )}
          {meta.baseline_weight_lbs != null && (
            <span className="text-xs text-muted-foreground">
              Tare:{" "}
              <span className="data-value font-semibold text-foreground/80">
                {meta.baseline_weight_lbs} lbs
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Edit form ────────────────────────────────────────────────────

const SetupEditForm = ({
  meta: initial,
  hiveCode: initialHiveCode,
  onSave,
  onCancel,
}: {
  meta: HiveSetupMeta;
  hiveCode: string | null;
  onSave: (meta: HiveSetupMeta, hiveCode: string | null) => Promise<void>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState<HiveSetupMeta>({
    ...DEFAULT_META,
    ...initial,
    mite_treatment: normalizeTreatment(initial.mite_treatment),
    honey_crop: initial.honey_crop ?? [],
  });
  const [hiveCode, setHiveCode] = useState(initialHiveCode ?? "");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof HiveSetupMeta>(key: K, value: HiveSetupMeta[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const showSupers = !["Top-bar", "Warré"].includes(form.hive_type ?? "");
  const showWeatherWarning = normalizeTreatment(form.mite_treatment).some(
    (t) => t.toLowerCase().includes("formic") || t.toLowerCase().includes("oxalic")
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form, hiveCode.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7 animate-fade-in-up">
      {/* ── Identity ─── */}
      <div>
        <SectionLabel>Identity</SectionLabel>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold text-sm">Location / apiary</Label>
              <Input
                value={form.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g., Back garden apiary"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="font-semibold text-sm">Date established</Label>
              <Input
                type="date"
                value={form.date_established ?? ""}
                onChange={(e) => set("date_established", e.target.value)}
                className="mt-1.5"
              />
              <FieldHint>Used to calculate hive age</FieldHint>
            </div>
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">Colony source</Label>
            <ChipSelect
              options={["Package", "Nuc", "Swarm", "Split", "Overwintered"]}
              value={form.colony_source ?? ""}
              onChange={(v) => set("colony_source", v as string)}
            />
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">
              Bee race{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <ChipSelect
              options={["Italian", "Carniolan", "Buckfast", "Russian", "VSH", "Unknown"]}
              value={form.bee_race ?? ""}
              onChange={(v) => set("bee_race", v as string)}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* ── Structure ─── */}
      <div>
        <SectionLabel>Structure</SectionLabel>
        <div className="space-y-4">
          <div>
            <Label className="font-semibold text-sm mb-2 block">Hive type</Label>
            <ChipSelect
              options={["Langstroth", "Warré", "Top-bar", "Flow hive", "British National"]}
              value={form.hive_type ?? ""}
              onChange={(v) => set("hive_type", v as string)}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <Label className="font-semibold text-sm mb-2 block">Deeps</Label>
              <NumberStepper
                value={form.num_deeps ?? 2}
                onChange={(v) => set("num_deeps", v)}
                min={0}
                max={4}
              />
            </div>
            {showSupers && (
              <div>
                <Label className="font-semibold text-sm mb-2 block">Supers</Label>
                <NumberStepper
                  value={form.num_supers ?? 1}
                  onChange={(v) => set("num_supers", v)}
                  min={0}
                  max={8}
                />
              </div>
            )}
            <div>
              <Label className="font-semibold text-sm mb-2 block">Frames / box</Label>
              <NumberStepper
                value={form.frames_per_box ?? 10}
                onChange={(v) => set("frames_per_box", v)}
                min={4}
                max={14}
              />
            </div>
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">Frame size</Label>
            <ChipSelect
              options={[`Deep 9-1/8"`, `Medium 6-1/4"`, `Shallow 5-3/8"`]}
              value={form.frame_size ?? ""}
              onChange={(v) => set("frame_size", v as string)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label className="font-semibold text-sm mb-2 block">Bottom board</Label>
              <ChipSelect
                options={["Screened", "Solid"]}
                value={form.bottom_board ?? ""}
                onChange={(v) => set("bottom_board", v as string)}
              />
              <FieldHint>Screened boards enable mite drop monitoring</FieldHint>
            </div>
            <div>
              <Label className="font-semibold text-sm mb-2 block">Queen excluder</Label>
              <ChipSelect
                options={["Yes", "No"]}
                value={form.queen_excluder ?? ""}
                onChange={(v) => set("queen_excluder", v as string)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* ── Management ─── */}
      <div>
        <SectionLabel>Management</SectionLabel>
        <div className="space-y-4">
          <div>
            <Label className="font-semibold text-sm mb-2 block">Harvest window</Label>
            <ChipSelect
              options={["Early summer", "Late summer", "Fall", "No harvest planned"]}
              value={form.harvest_window ?? ""}
              onChange={(v) => set("harvest_window", v as string)}
            />
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">
              Honey crop{" "}
              <span className="text-muted-foreground font-normal text-xs">(select all that apply)</span>
            </Label>
            <ChipSelect
              options={["Wildflower", "Clover", "Buckwheat", "Varietal"]}
              value={form.honey_crop ?? []}
              onChange={(v) => set("honey_crop", v as string[])}
              multi
            />
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">
              Mite treatment{" "}
              <span className="text-muted-foreground font-normal text-xs">(select all that apply)</span>
            </Label>
            <ChipSelect
              options={[
                "Oxalic acid dribble",
                "Oxalic acid vaporize",
                "Formic acid (MAQS)",
                "Apivar",
                "Apiguard",
                "Treatment-free",
              ]}
              value={normalizeTreatment(form.mite_treatment)}
              onChange={(v) => set("mite_treatment", v as string[])}
              multi
            />
            {showWeatherWarning && (
              <div className="mt-2 px-3 py-2 rounded-inner bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Weather-based temperature warnings will appear in your calendar for this treatment.
              </div>
            )}
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">Mite action threshold</Label>
            <ChipSelect
              options={[">1% conservative", ">2% standard", ">3% relaxed", "Custom"]}
              value={form.mite_threshold ?? ""}
              onChange={(v) => set("mite_threshold", v as string)}
            />
            <FieldHint>Triggers alerts on mite count graphs</FieldHint>
          </div>
          <div>
            <Label className="font-semibold text-sm mb-2 block">Inspection frequency</Label>
            <ChipSelect
              options={["Weekly", "Biweekly", "Monthly", "Bimonthly"]}
              value={form.inspection_frequency ?? ""}
              onChange={(v) => set("inspection_frequency", v as string)}
            />
            <FieldHint>Seeds recurring calendar reminders on save</FieldHint>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* ── Logger ─── */}
      <div>
        <SectionLabel>Data logger</SectionLabel>
        <div className="rounded-outer border-2 border-dashed border-border/50 p-5 space-y-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">Hardware sensor pairing (optional)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold text-sm">Device serial number</Label>
              <Input
                value={hiveCode}
                onChange={(e) => setHiveCode(e.target.value)}
                placeholder="e.g., HIVE_ALPHA"
                className="mt-1.5 bg-white/60"
              />
            </div>
            <div>
              <Label className="font-semibold text-sm">Baseline tare weight (lbs)</Label>
              <Input
                type="number"
                value={form.baseline_weight_lbs ?? ""}
                onChange={(e) =>
                  set("baseline_weight_lbs", e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="e.g., 45.0"
                step="0.1"
                min="0"
                className="mt-1.5 bg-white/60"
              />
              <FieldHint>Subtracted from all future weight readings</FieldHint>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ─── */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/40">
        <Button variant="hero" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Check className="h-4 w-4" /> Save changes
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="honey-glass border-white/30 gap-2"
        >
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────

const HiveSetupPanel = ({
  meta,
  hiveCode,
  onSave,
}: {
  meta: HiveSetupMeta | null;
  hiveCode: string | null;
  onSave: (meta: HiveSetupMeta, hiveCode: string | null) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);

  const handleSave = async (newMeta: HiveSetupMeta, newHiveCode: string | null) => {
    await onSave(newMeta, newHiveCode);
    setEditing(false);
  };

  return (
    <div className="honey-glass rounded-outer p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-serif text-lg font-bold tracking-tight">Hive setup</h2>
          {!meta && !editing && (
            <p className="text-xs text-muted-foreground mt-0.5">
              No configuration yet — add details to unlock full insights.
            </p>
          )}
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-1.5 honey-glass border-white/30 hover:bg-primary/10 rounded-xl shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            {meta ? "Edit setup" : "Configure hive"}
          </Button>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <SetupEditForm
          meta={meta ?? {}}
          hiveCode={hiveCode}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : meta ? (
        <SetupSummary meta={meta} hiveCode={hiveCode} />
      ) : (
        <div className="tonal-well rounded-inner px-5 py-8 text-center">
          <Settings className="h-8 w-8 text-muted-foreground/25 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Add hive type, colony details, management protocol, and logger configuration.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="mt-3 text-primary hover:bg-primary/10"
          >
            Get started
          </Button>
        </div>
      )}
    </div>
  );
};

export default HiveSetupPanel;
