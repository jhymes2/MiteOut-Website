import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Hexagon, Cpu, Tag, Layers, ClipboardList } from "lucide-react";

// ─── Shared sub-components ───────────────────────────────────────────────────

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
  const handleClick = (opt: string) => {
    if (multi) {
      const arr = (value as string[]) ?? [];
      onChange(arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt]);
    } else {
      onChange(value === opt ? "" : opt);
    }
  };

  const isSelected = (opt: string) =>
    multi ? ((value as string[]) ?? []).includes(opt) : value === opt;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => handleClick(opt)}
          className={cn(
            "px-3.5 py-2 rounded-inner text-sm font-medium transition-all duration-150 border btn-press brand-curve select-none",
            isSelected(opt)
              ? "bg-gradient-to-r from-[#FFB347] to-[#FFD700] text-[#5C3500] border-transparent shadow-amber"
              : "honey-glass border-white/30 text-foreground hover:border-primary/50 hover:shadow-sm"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
);

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

// ─── Form state ───────────────────────────────────────────────────────────────

interface HiveForm {
  name: string;
  location: string;
  date_established: string;
  colony_source: string;
  bee_race: string;
  hive_type: string;
  num_deeps: number;
  num_supers: number;
  frames_per_box: number;
  frame_size: string;
  bottom_board: string;
  queen_excluder: string;
  harvest_window: string;
  honey_crop: string[];
  mite_treatment: string[];
  mite_threshold: string;
  inspection_frequency: string;
  device_serial: string;
  baseline_weight_lbs: string;
}

const DEFAULT_FORM: HiveForm = {
  name: "",
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
  device_serial: "",
  baseline_weight_lbs: "",
};

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEP_ICONS = [Tag, Layers, ClipboardList, Cpu];
const STEP_LABELS = ["Identity", "Structure", "Management", "Logger"];

// ─── Step 1: Hive identity ────────────────────────────────────────────────────

const Step1 = ({
  form,
  set,
  errors,
}: {
  form: HiveForm;
  set: <K extends keyof HiveForm>(k: K, v: HiveForm[K]) => void;
  errors: Partial<Record<keyof HiveForm, string>>;
}) => (
  <div className="space-y-6 animate-fade-in-up">
    <div>
      <h2 className="font-serif text-2xl font-bold tracking-tight mb-1">Hive identity</h2>
      <p className="text-sm text-muted-foreground">The basics — name, location, and lineage.</p>
    </div>

    <div className="honey-glass rounded-outer p-6 space-y-5">
      <div>
        <Label className="font-semibold">
          Hive name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g., Hive Alpha"
          className={cn("mt-1.5", errors.name && "border-destructive focus-visible:ring-destructive")}
        />
        {errors.name ? (
          <p className="text-xs text-destructive mt-1">{errors.name}</p>
        ) : (
          <FieldHint>How this hive appears across the app</FieldHint>
        )}
      </div>

      <div>
        <Label className="font-semibold">Location / apiary name</Label>
        <Input
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g., Back garden apiary"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label className="font-semibold">
          Date established <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={form.date_established}
          onChange={(e) => set("date_established", e.target.value)}
          className={cn("mt-1.5", errors.date_established && "border-destructive focus-visible:ring-destructive")}
        />
        {errors.date_established ? (
          <p className="text-xs text-destructive mt-1">{errors.date_established}</p>
        ) : (
          <FieldHint>Used to calculate hive age throughout the app</FieldHint>
        )}
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Colony source</Label>
        <ChipSelect
          options={["Package", "Nuc", "Swarm", "Split", "Overwintered"]}
          value={form.colony_source}
          onChange={(v) => set("colony_source", v as string)}
        />
      </div>

      <div>
        <Label className="font-semibold mb-2 block">
          Bee race{" "}
          <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <ChipSelect
          options={["Italian", "Carniolan", "Buckfast", "Russian", "VSH", "Unknown"]}
          value={form.bee_race}
          onChange={(v) => set("bee_race", v as string)}
        />
        <FieldHint>Used for AI mite resistance baselines</FieldHint>
      </div>
    </div>
  </div>
);

// ─── Step 2: Hive structure ───────────────────────────────────────────────────

const Step2 = ({
  form,
  set,
  showSupers,
}: {
  form: HiveForm;
  set: <K extends keyof HiveForm>(k: K, v: HiveForm[K]) => void;
  showSupers: boolean;
}) => (
  <div className="space-y-6 animate-fade-in-up">
    <div>
      <h2 className="font-serif text-2xl font-bold tracking-tight mb-1">Hive structure</h2>
      <p className="text-sm text-muted-foreground">Box configuration and hardware details.</p>
    </div>

    <div className="honey-glass rounded-outer p-6 space-y-5">
      <div>
        <Label className="font-semibold mb-2 block">
          Hive type <span className="text-destructive">*</span>
        </Label>
        <ChipSelect
          options={["Langstroth", "Warré", "Top-bar", "Flow hive", "British National"]}
          value={form.hive_type}
          onChange={(v) => set("hive_type", v as string)}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label className="font-semibold mb-2 block">Number of deeps</Label>
          <NumberStepper
            value={form.num_deeps}
            onChange={(v) => set("num_deeps", v)}
            min={0}
            max={4}
          />
        </div>
        {showSupers && (
          <div>
            <Label className="font-semibold mb-2 block">Number of supers</Label>
            <NumberStepper
              value={form.num_supers}
              onChange={(v) => set("num_supers", v)}
              min={0}
              max={8}
            />
          </div>
        )}
      </div>
      {!showSupers && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          Supers not applicable for {form.hive_type} hives
        </p>
      )}

      <div>
        <Label className="font-semibold mb-2 block">Frames per box</Label>
        <NumberStepper
          value={form.frames_per_box}
          onChange={(v) => set("frames_per_box", v)}
          min={4}
          max={14}
        />
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Frame size</Label>
        <ChipSelect
          options={[`Deep 9-1/8"`, `Medium 6-1/4"`, `Shallow 5-3/8"`]}
          value={form.frame_size}
          onChange={(v) => set("frame_size", v as string)}
        />
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Bottom board</Label>
        <ChipSelect
          options={["Screened", "Solid"]}
          value={form.bottom_board}
          onChange={(v) => set("bottom_board", v as string)}
        />
        <FieldHint>Screened boards enable mite drop monitoring</FieldHint>
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Queen excluder</Label>
        <ChipSelect
          options={["Yes", "No"]}
          value={form.queen_excluder}
          onChange={(v) => set("queen_excluder", v as string)}
        />
      </div>
    </div>
  </div>
);

// ─── Step 3: Management plan ──────────────────────────────────────────────────

const Step3 = ({
  form,
  set,
}: {
  form: HiveForm;
  set: <K extends keyof HiveForm>(k: K, v: HiveForm[K]) => void;
}) => {
  const showWeatherWarning = form.mite_treatment.some(
    (t) => t.toLowerCase().includes("formic") || t.toLowerCase().includes("oxalic")
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-1">Management plan</h2>
        <p className="text-sm text-muted-foreground">
          Harvest goals, mite protocols, and inspection schedule.
        </p>
      </div>

      <div className="honey-glass rounded-outer p-6 space-y-5">
        <div>
          <Label className="font-semibold mb-2 block">Intended harvest window</Label>
          <ChipSelect
            options={["Early summer", "Late summer", "Fall", "No harvest planned"]}
            value={form.harvest_window}
            onChange={(v) => set("harvest_window", v as string)}
          />
        </div>

        <div>
          <Label className="font-semibold mb-2 block">
            Honey crop type{" "}
            <span className="text-muted-foreground font-normal text-xs">(select all that apply)</span>
          </Label>
          <ChipSelect
            options={["Wildflower", "Clover", "Buckwheat", "Varietal"]}
            value={form.honey_crop}
            onChange={(v) => set("honey_crop", v as string[])}
            multi
          />
        </div>

        <div>
          <Label className="font-semibold mb-2 block">
            Mite treatment protocol{" "}
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
            value={form.mite_treatment}
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
          <Label className="font-semibold mb-2 block">Mite action threshold</Label>
          <ChipSelect
            options={[">1% conservative", ">2% standard", ">3% relaxed", "Custom"]}
            value={form.mite_threshold}
            onChange={(v) => set("mite_threshold", v as string)}
          />
          <FieldHint>Triggers alerts on mite count graphs</FieldHint>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">Inspection frequency</Label>
          <ChipSelect
            options={["Weekly", "Biweekly", "Monthly"]}
            value={form.inspection_frequency}
            onChange={(v) => set("inspection_frequency", v as string)}
          />
          <FieldHint>Seeds recurring calendar reminders on save</FieldHint>
        </div>
      </div>
    </div>
  );
};

// ─── Step 4: Data logger pairing (optional) ───────────────────────────────────

const Step4 = ({
  form,
  set,
  onSkip,
  saving,
}: {
  form: HiveForm;
  set: <K extends keyof HiveForm>(k: K, v: HiveForm[K]) => void;
  onSkip: () => void;
  saving: boolean;
}) => (
  <div className="space-y-6 animate-fade-in-up">
    <div>
      <h2 className="font-serif text-2xl font-bold tracking-tight mb-1">Data logger pairing</h2>
      <p className="text-sm text-muted-foreground">Optional — connect a hardware sensor to this hive.</p>
    </div>

    <div className="rounded-outer border-2 border-dashed border-border p-6 space-y-5 bg-muted/20">
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Cpu className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-sm">Hardware sensor</p>
          <p className="text-xs text-muted-foreground">MiteOut logger or compatible device</p>
        </div>
      </div>

      <div>
        <Label className="font-semibold">Device serial number</Label>
        <Input
          value={form.device_serial}
          onChange={(e) => set("device_serial", e.target.value)}
          placeholder="e.g., HIVE_ALPHA or device serial"
          className="mt-1.5 bg-white/60"
        />
      </div>

      <div>
        <Label className="font-semibold">Baseline tare weight (lbs)</Label>
        <Input
          type="number"
          value={form.baseline_weight_lbs}
          onChange={(e) => set("baseline_weight_lbs", e.target.value)}
          placeholder="e.g., 45.0"
          step="0.1"
          min="0"
          className="mt-1.5 bg-white/60"
        />
        <FieldHint>Subtracted from all future weight readings for accurate net weight</FieldHint>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onSkip}
        disabled={saving}
        className="w-full text-muted-foreground hover:text-foreground border border-dashed border-border"
      >
        {saving ? "Creating hive..." : "Do this later"}
      </Button>
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const HiveSetupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<HiveForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof HiveForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof HiveForm>(key: K, value: HiveForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const showSupers = !["Top-bar", "Warré"].includes(form.hive_type);

  const validateStep = (): boolean => {
    if (step === 0) {
      const next: typeof errors = {};
      if (!form.name.trim()) next.name = "Hive name is required";
      if (!form.date_established) next.date_established = "Date established is required";
      if (Object.keys(next).length > 0) {
        setErrors(next);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const handleSave = async (skipLogger: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      const metadata = {
        location: form.location || null,
        date_established: form.date_established,
        colony_source: form.colony_source || null,
        bee_race: form.bee_race || null,
        hive_type: form.hive_type,
        num_deeps: form.num_deeps,
        num_supers: showSupers ? form.num_supers : null,
        frames_per_box: form.frames_per_box,
        frame_size: form.frame_size,
        bottom_board: form.bottom_board || null,
        queen_excluder: form.queen_excluder || null,
        harvest_window: form.harvest_window || null,
        honey_crop: form.honey_crop.length > 0 ? form.honey_crop : null,
        mite_treatment: form.mite_treatment || null,
        mite_threshold: form.mite_threshold,
        inspection_frequency: form.inspection_frequency || null,
        ...(!skipLogger && {
          baseline_weight_lbs: form.baseline_weight_lbs
            ? parseFloat(form.baseline_weight_lbs)
            : null,
        }),
      };

      const { data, error } = await supabase
        .from("hives")
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          hive_code:
            !skipLogger && form.device_serial.trim() ? form.device_serial.trim() : null,
          notes: JSON.stringify(metadata),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: `${form.name} created`,
        description: form.inspection_frequency
          ? `${form.inspection_frequency} inspection reminders will be seeded to your calendar.`
          : "Your hive is ready.",
      });

      navigate(`/hive/${data.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error creating hive", description: message, variant: "destructive" });
      setSaving(false);
    }
  };

  const progressPct = ((step + 1) / 4) * 100;

  return (
    <div className="min-h-[100dvh]">
      {/* Nav */}
      <nav className="glass-card-strong border-b border-white/20 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Hexagon className="h-6 w-6 text-primary fill-primary/20" />
            <span className="font-serif text-lg font-bold tracking-tight">MiteOut</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </nav>

      {/* Step indicator + progress bar */}
      <div className="sticky top-16 z-30 glass-card-strong border-b border-white/10 py-4 px-6">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center mb-3">
            {STEP_LABELS.map((label, i) => {
              const Icon = STEP_ICONS[i];
              const isActive = i === step;
              const isDone = i < step;
              return (
                <React.Fragment key={label}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                        isDone
                          ? "bg-secondary text-white"
                          : isActive
                          ? "bg-gradient-to-br from-[#FFB347] to-[#FFD700] text-[#5C3500] shadow-amber"
                          : "honey-glass border border-white/30 text-muted-foreground"
                      )}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium hidden sm:block transition-colors duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div
                      className={cn(
                        "flex-1 h-px mx-1.5 transition-all duration-500",
                        isDone ? "bg-secondary/50" : "bg-border"
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FFB347] to-[#FFD700] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        {step === 0 && <Step1 form={form} set={set} errors={errors} />}
        {step === 1 && <Step2 form={form} set={set} showSupers={showSupers} />}
        {step === 2 && <Step3 form={form} set={set} />}
        {step === 3 && (
          <Step4
            form={form}
            set={set}
            onSkip={() => handleSave(true)}
            saving={saving}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
            className="gap-2 honey-glass border-white/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < 3 ? (
            <Button type="button" variant="hero" onClick={handleNext} className="gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="hero"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="gap-2"
            >
              {saving ? "Creating..." : (
                <>
                  Create hive
                  <Check className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HiveSetupPage;
