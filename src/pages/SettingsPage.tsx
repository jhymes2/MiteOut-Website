import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import AppSidebar from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  User, MapPin, Bell, Database, CreditCard, AlertTriangle,
  Trash2, Download, Plus, X, Check, Pencil, Shield,
  Hexagon, Cpu, Upload, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

type Section = "account" | "apiary" | "notifications" | "data" | "billing" | "danger";

const SECTIONS: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: "account",       label: "Account",         Icon: User },
  { id: "apiary",        label: "Apiary",           Icon: MapPin },
  { id: "notifications", label: "Notifications",    Icon: Bell },
  { id: "data",          label: "Data & Devices",   Icon: Database },
  { id: "billing",       label: "Plan & Billing",   Icon: CreditCard },
  { id: "danger",        label: "Danger Zone",      Icon: AlertTriangle },
];

// ─── Small shared atoms ───────────────────────────────────────────

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6">
    <h2 className="font-serif text-xl font-bold text-amber-950">{title}</h2>
    {sub && <p className="text-sm text-amber-700/60 mt-0.5">{sub}</p>}
  </div>
);

const FieldRow = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-4 border-b border-amber-100/80 last:border-0">
    <div>
      <p className="text-sm font-semibold text-amber-950">{label}</p>
      {hint && <p className="text-xs text-amber-700/55 mt-0.5 leading-relaxed">{hint}</p>}
    </div>
    <div>{children}</div>
  </div>
);

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${value ? "bg-amber-500" : "bg-amber-200"}`}
    style={{ height: "22px", width: "40px" }}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-[18px]" : "translate-x-0"}`}
      style={{ width: "18px", height: "18px" }}
    />
  </button>
);

const ChipSelect = ({
  options, value, onChange,
}: {
  options: string[]; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? "" : opt)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
          value === opt
            ? "bg-amber-500 text-white border-amber-500"
            : "bg-white text-amber-800 border-amber-200 hover:border-amber-400"
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const UnitToggle = ({
  options, value, onChange,
}: {
  options: [string, string]; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg p-0.5 w-fit">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
          value === opt ? "bg-amber-500 text-white shadow-sm" : "text-amber-700/60 hover:text-amber-800"
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

// ─── Confirm modal ─────────────────────────────────────────────────

function ConfirmModal({
  open, onClose, title, description, confirmLabel = "Confirm", onConfirm,
  requireText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  requireText?: string;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => { if (!open) setTyped(""); }, [open]);
  if (!open) return null;
  const ready = requireText ? typed === requireText : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-amber-950">{title}</h3>
            <div className="text-sm text-amber-800/70 mt-1 leading-relaxed">{description}</div>
          </div>
        </div>
        {requireText && (
          <div>
            <p className="text-xs text-amber-700/70 mb-1.5">
              Type <strong className="text-amber-900">{requireText}</strong> to confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              className="border-amber-200 focus:border-red-400"
            />
          </div>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl border-amber-200">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!ready}
            onClick={() => { onConfirm(); onClose(); }}
            className="rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Account ─────────────────────────────────────────────

function AccountSection({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name ?? "");
  const [experience, setExperience] = useState(user?.user_metadata?.experience ?? "");
  const [years, setYears] = useState<string>(user?.user_metadata?.years_keeping ?? "");
  const [saved, setSaved] = useState(false);

  const original = useRef({ displayName, experience, years });
  const isDirty =
    displayName !== original.current.displayName ||
    experience !== original.current.experience ||
    years !== original.current.years;

  useEffect(() => { onDirty(isDirty); }, [isDirty]);

  const handleSave = async () => {
    await supabase.auth.updateUser({
      data: { display_name: displayName, experience, years_keeping: years },
    });
    original.current = { displayName, experience, years };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onDirty(false);
  };

  return (
    <div>
      <SectionTitle title="Account" sub="Manage your personal information and beekeeper profile." />

      <div className="bg-white/80 rounded-2xl border border-amber-200/60 px-6 divide-y divide-amber-100/80">

        {/* Avatar */}
        <FieldRow label="Profile photo" hint="Shown on your profile and in team views.">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-lg select-none">
              {initials}
            </div>
            <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all">
              Upload photo
            </button>
          </div>
        </FieldRow>

        {/* Display name */}
        <FieldRow label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="max-w-xs border-amber-200"
          />
        </FieldRow>

        {/* Email */}
        <FieldRow label="Email address" hint="Used for login and notifications.">
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-900 font-mono">{email}</span>
            <button className="text-xs font-semibold text-amber-600 hover:text-amber-800 underline underline-offset-2">
              Change email
            </button>
          </div>
        </FieldRow>

        {/* Password */}
        <FieldRow label="Password">
          <Button
            variant="outline"
            size="sm"
            className="border-amber-200 text-amber-800 hover:bg-amber-50 rounded-xl"
            onClick={async () => {
              await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/settings`,
              });
              alert("Password reset email sent.");
            }}
          >
            Change password
          </Button>
        </FieldRow>

        {/* Experience */}
        <FieldRow label="Experience level" hint="Calibrates AI suggestion detail and tooltip depth.">
          <ChipSelect
            options={["Beginner", "Hobbyist", "Sideliner", "Semi-commercial"]}
            value={experience}
            onChange={setExperience}
          />
        </FieldRow>

        {/* Years */}
        <FieldRow label="Years keeping bees">
          <Input
            type="number"
            min={0}
            max={60}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="e.g. 3"
            className="w-24 border-amber-200"
          />
        </FieldRow>
      </div>

      {isDirty && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            className="rounded-xl px-6 font-semibold gap-2"
            style={{ background: "#27ae60", color: "white" }}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Apiary ──────────────────────────────────────────────

const CLIMATE_ZONES = [
  "Zone 1 (below -50°F)", "Zone 2 (-50 to -40°F)", "Zone 3 (-40 to -30°F)",
  "Zone 4 (-30 to -20°F)", "Zone 5 (-20 to -10°F)", "Zone 6 (-10 to 0°F)",
  "Zone 7 (0 to 10°F)", "Zone 8 (10 to 20°F)", "Zone 9 (20 to 30°F)",
  "Zone 10 (30 to 40°F)", "Zone 11 (above 40°F)",
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Berlin",
  "Australia/Sydney",
];

function ApiarySection({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { weightUnit, tempUnit, setWeightUnit, setTempUnit } = useSettings();

  const [apiaryName, setApiaryName] = useState(
    () => localStorage.getItem("setting_apiaryName") ?? "My Apiary"
  );
  const [location, setLocation] = useState(
    () => localStorage.getItem("setting_location") ?? ""
  );
  const [climateZone, setClimateZone] = useState(
    () => localStorage.getItem("setting_climateZone") ?? "Zone 6 (-10 to 0°F)"
  );
  const [timezone, setTimezone] = useState(
    () => localStorage.getItem("setting_timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [nectarEarly, setNectarEarly] = useState(
    () => localStorage.getItem("setting_nectarEarly") ?? ""
  );
  const [nectarMid, setNectarMid] = useState(
    () => localStorage.getItem("setting_nectarMid") ?? ""
  );
  const [nectarLate, setNectarLate] = useState(
    () => localStorage.getItem("setting_nectarLate") ?? ""
  );
  const [localWeight, setLocalWeight] = useState(weightUnit);
  const [localTemp, setLocalTemp] = useState(tempUnit);
  const [saved, setSaved] = useState(false);

  const original = useRef({ apiaryName, location, climateZone, timezone, nectarEarly, nectarMid, nectarLate, localWeight, localTemp });
  const isDirty =
    apiaryName !== original.current.apiaryName ||
    location !== original.current.location ||
    climateZone !== original.current.climateZone ||
    timezone !== original.current.timezone ||
    nectarEarly !== original.current.nectarEarly ||
    nectarMid !== original.current.nectarMid ||
    nectarLate !== original.current.nectarLate ||
    localWeight !== original.current.localWeight ||
    localTemp !== original.current.localTemp;

  useEffect(() => { onDirty(isDirty); }, [isDirty]);

  const handleSave = () => {
    localStorage.setItem("setting_apiaryName", apiaryName);
    localStorage.setItem("setting_location", location);
    localStorage.setItem("setting_climateZone", climateZone);
    localStorage.setItem("setting_timezone", timezone);
    localStorage.setItem("setting_nectarEarly", nectarEarly);
    localStorage.setItem("setting_nectarMid", nectarMid);
    localStorage.setItem("setting_nectarLate", nectarLate);
    setWeightUnit(localWeight);
    setTempUnit(localTemp);
    original.current = { apiaryName, location, climateZone, timezone, nectarEarly, nectarMid, nectarLate, localWeight, localTemp };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onDirty(false);
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div>
      <SectionTitle title="Apiary" sub="Configure your apiary details and display preferences." />

      <div className="bg-white/80 rounded-2xl border border-amber-200/60 px-6 divide-y divide-amber-100/80">

        <FieldRow label="Apiary name" hint="Shown throughout the app wherever your apiary is referenced.">
          <Input
            value={apiaryName}
            onChange={(e) => setApiaryName(e.target.value)}
            placeholder="My Apiary"
            className="max-w-xs border-amber-200"
          />
        </FieldRow>

        <FieldRow label="Location" hint="Used for weather integration in the calendar.">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State or lat, lng"
            className="max-w-xs border-amber-200"
          />
        </FieldRow>

        <FieldRow label="Climate zone" hint="Auto-detected from location. Override if needed.">
          <select
            value={climateZone}
            onChange={(e) => setClimateZone(e.target.value)}
            className="text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-xs w-full"
          >
            {CLIMATE_ZONES.map((z) => <option key={z}>{z}</option>)}
          </select>
        </FieldRow>

        <FieldRow label="Nectar flow timing" hint="Helps AI contextualize weight plateaus and harvest suggestions.">
          <div className="space-y-2">
            {[
              { label: "Early season", value: nectarEarly, set: setNectarEarly },
              { label: "Mid season",   value: nectarMid,   set: setNectarMid },
              { label: "Late season",  value: nectarLate,  set: setNectarLate },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-amber-700/60 w-24 shrink-0">{label}</span>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Not set</option>
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Weight unit">
          <UnitToggle options={["lbs", "kg"]} value={localWeight} onChange={(v) => setLocalWeight(v as "lbs" | "kg")} />
        </FieldRow>

        <FieldRow label="Temperature unit">
          <UnitToggle options={["°F", "°C"]} value={localTemp === "F" ? "°F" : "°C"} onChange={(v) => setLocalTemp(v === "°F" ? "F" : "C")} />
        </FieldRow>

        <FieldRow label="Time zone">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-xs w-full"
          >
            {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </FieldRow>
      </div>

      {isDirty && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            className="rounded-xl px-6 font-semibold gap-2"
            style={{ background: "#27ae60", color: "white" }}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Notifications ───────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) { localStorage.setItem(key, JSON.stringify(v)); }

function NotificationsSection({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [inspOn,    setInspOn]    = useState(() => load("notif_inspOn", true));
  const [inspLead,  setInspLead]  = useState(() => load("notif_inspLead", "2d"));
  const [treatOn,   setTreatOn]   = useState(() => load("notif_treatOn", true));
  const [miteOn,    setMiteOn]    = useState(() => load("notif_miteOn", true));
  const [weightOn,  setWeightOn]  = useState(() => load("notif_weightOn", true));
  const [weightLbs, setWeightLbs] = useState(() => load("notif_weightLbs", 5));
  const [aiOn,      setAiOn]      = useState(() => load("notif_aiOn", true));
  const [aiFreq,    setAiFreq]    = useState(() => load("notif_aiFreq", "realtime"));
  const [harvestOn, setHarvestOn] = useState(() => load("notif_harvestOn", true));
  const [saved, setSaved] = useState(false);

  const original = useRef({ inspOn, inspLead, treatOn, miteOn, weightOn, weightLbs, aiOn, aiFreq, harvestOn });
  const isDirty =
    inspOn !== original.current.inspOn || inspLead !== original.current.inspLead ||
    treatOn !== original.current.treatOn || miteOn !== original.current.miteOn ||
    weightOn !== original.current.weightOn || weightLbs !== original.current.weightLbs ||
    aiOn !== original.current.aiOn || aiFreq !== original.current.aiFreq ||
    harvestOn !== original.current.harvestOn;

  useEffect(() => { onDirty(isDirty); }, [isDirty]);

  const handleSave = () => {
    save("notif_inspOn", inspOn); save("notif_inspLead", inspLead);
    save("notif_treatOn", treatOn); save("notif_miteOn", miteOn);
    save("notif_weightOn", weightOn); save("notif_weightLbs", weightLbs);
    save("notif_aiOn", aiOn); save("notif_aiFreq", aiFreq);
    save("notif_harvestOn", harvestOn);
    original.current = { inspOn, inspLead, treatOn, miteOn, weightOn, weightLbs, aiOn, aiFreq, harvestOn };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onDirty(false);
  };

  const NotifRow = ({
    label, hint, enabled, onToggle, children,
  }: {
    label: string; hint?: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
  }) => (
    <div className="py-4 border-b border-amber-100/80 last:border-0 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950">{label}</p>
          {hint && <p className="text-xs text-amber-700/55 mt-0.5">{hint}</p>}
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {enabled && children && <div className="pl-0">{children}</div>}
    </div>
  );

  return (
    <div>
      <SectionTitle title="Notifications" sub="Control what reminders and alerts you receive." />

      <div className="bg-white/80 rounded-2xl border border-amber-200/60 px-6 mb-4">
        <NotifRow
          label="Inspection reminders"
          hint="Remind you before scheduled inspections."
          enabled={inspOn}
          onToggle={setInspOn}
        >
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-amber-700/60">Lead time:</span>
            <ChipSelect
              options={["1 day", "2 days", "1 week"]}
              value={inspLead === "1d" ? "1 day" : inspLead === "2d" ? "2 days" : "1 week"}
              onChange={(v) => setInspLead(v === "1 day" ? "1d" : v === "2 days" ? "2d" : "1w")}
            />
          </div>
        </NotifRow>

        <NotifRow
          label="Treatment reminders"
          hint="Same-day morning alert — treatments are time-sensitive."
          enabled={treatOn}
          onToggle={setTreatOn}
        />

        <NotifRow
          label="Mite threshold alerts"
          hint="Alert when a hive's mite load exceeds your set threshold."
          enabled={miteOn}
          onToggle={setMiteOn}
        />

        <NotifRow
          label="Weight anomaly alerts"
          hint="Alert on unusual weight drops (possible swarm or robbing)."
          enabled={weightOn}
          onToggle={setWeightOn}
        >
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-amber-700/60">Trigger on drop &gt;</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={weightLbs}
              onChange={(e) => setWeightLbs(Number(e.target.value))}
              className="w-16 h-7 text-sm border-amber-200 text-center"
            />
            <span className="text-xs text-amber-700/60">lbs in 24 hrs</span>
          </div>
        </NotifRow>

        <NotifRow
          label="AI suggestions"
          hint="Proactive recommendations based on hive data patterns."
          enabled={aiOn}
          onToggle={setAiOn}
        >
          <ChipSelect
            options={["As they arise", "Daily digest", "Weekly digest"]}
            value={aiFreq === "realtime" ? "As they arise" : aiFreq === "daily" ? "Daily digest" : "Weekly digest"}
            onChange={(v) => setAiFreq(v === "As they arise" ? "realtime" : v === "Daily digest" ? "daily" : "weekly")}
          />
        </NotifRow>

        <NotifRow
          label="Harvest window reminders"
          hint="Based on nectar flow timing set in Apiary settings."
          enabled={harvestOn}
          onToggle={setHarvestOn}
        />
      </div>

      {/* Delivery methods */}
      <div className="bg-white/80 rounded-2xl border border-amber-200/60 px-6 py-4">
        <p className="text-xs font-semibold text-amber-700/50 uppercase tracking-wider mb-3">Delivery methods</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-amber-950">In-app</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Active</span>
          </div>
          {["Email", "Push notifications"].map((m) => (
            <div key={m} className="flex items-center gap-3 opacity-40">
              <div className="w-2 h-2 rounded-full bg-amber-300" />
              <span className="text-sm font-semibold text-amber-950">{m}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-semibold">Coming soon</span>
            </div>
          ))}
        </div>
      </div>

      {isDirty && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            className="rounded-xl px-6 font-semibold gap-2"
            style={{ background: "#27ae60", color: "white" }}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Data & Devices ──────────────────────────────────────

const MOCK_DEVICES = [
  { serial: "HML-20241-A", hive: "Hive Alpha", lastSync: "2 hrs ago", battery: 82 },
  { serial: "HML-20241-B", hive: "Hive Beta",  lastSync: "4 hrs ago", battery: 61 },
];

const MOCK_IMPORTS = [
  { filename: "alpha_readings_q1.csv", hive: "Hive Alpha", rows: 1240, date: "Apr 2, 2025", status: "success" },
  { filename: "beta_export.csv",       hive: "Hive Beta",  rows: 887,  date: "Mar 15, 2025", status: "success" },
  { filename: "colony3_raw.csv",       hive: "Hive Gamma", rows: 312,  date: "Feb 28, 2025", status: "partial" },
];

function DataSection() {
  const [retention, setRetention] = useState(() => load("setting_retention", "all"));

  return (
    <div className="space-y-5">
      <SectionTitle title="Data & Devices" sub="Manage paired sensors, import history, and data retention." />

      {/* Devices */}
      <div className="bg-white/80 rounded-2xl border border-amber-200/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-amber-100 flex items-center justify-between">
          <p className="text-sm font-bold text-amber-950">Paired devices</p>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all">
            <Plus className="h-3.5 w-3.5" /> Pair new device
          </button>
        </div>
        {MOCK_DEVICES.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-amber-700/60">No devices paired yet.</div>
        ) : (
          <div className="divide-y divide-amber-100/60">
            {MOCK_DEVICES.map((d) => (
              <div key={d.serial} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Cpu className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-950 font-mono">{d.serial}</p>
                  <p className="text-xs text-amber-700/60">{d.hive} · last sync {d.lastSync}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-14 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.battery}%`, background: d.battery > 40 ? "#27ae60" : "#e74c3c" }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-amber-700/60">{d.battery}%</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="text-xs text-amber-700 hover:text-amber-900 font-semibold border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-50 transition-all">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button className="text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-all">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import history */}
      <div className="bg-white/80 rounded-2xl border border-amber-200/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-amber-100">
          <p className="text-sm font-bold text-amber-950">CSV import history</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-100/60">
              {["File", "Hive", "Rows", "Date", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-amber-700/50 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_IMPORTS.map((imp) => (
              <tr key={imp.filename} className="border-b border-amber-100/40 hover:bg-amber-50/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-amber-900 max-w-[160px] truncate">{imp.filename}</td>
                <td className="px-4 py-3 text-xs text-amber-800">{imp.hive}</td>
                <td className="px-4 py-3 font-mono text-xs text-amber-700">{imp.rows.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-amber-700/70">{imp.date}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    imp.status === "success"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : imp.status === "partial"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {imp.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-amber-600 hover:text-amber-800 font-semibold">Re-import</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export + retention */}
      <div className="bg-white/80 rounded-2xl border border-amber-200/60 px-6 divide-y divide-amber-100/80">
        <FieldRow label="Export my data" hint="Download all hive readings as a CSV zip.">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-amber-200 text-amber-800 hover:bg-amber-50 rounded-xl"
          >
            <Download className="h-4 w-4" /> Export all data
          </Button>
        </FieldRow>
        <FieldRow label="Data retention" hint="Controls how long raw readings are kept.">
          <select
            value={retention}
            onChange={(e) => { setRetention(e.target.value); save("setting_retention", e.target.value); }}
            className="text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="all">Keep all data</option>
            <option value="2y">Auto-archive data older than 2 years</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// ─── Section: Plan & Billing ──────────────────────────────────────

const FREE_LIMITS = { hives: 3, history: "90 days", ai: false, weather: false };

function BillingSection() {
  const { planTier, setPlanTier } = useSettings();

  return (
    <div className="space-y-5">
      <SectionTitle title="Plan & Billing" sub="Manage your subscription and understand what's included." />

      {/* Current plan badge */}
      <div className={`rounded-2xl border-2 px-6 py-5 flex items-center justify-between ${
        planTier === "pro"
          ? "border-amber-400 bg-amber-50"
          : "border-amber-200 bg-white/80"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${planTier === "pro" ? "bg-amber-500" : "bg-amber-100"}`}>
            {planTier === "pro"
              ? <Shield className="h-5 w-5 text-white" />
              : <Hexagon className="h-5 w-5 text-amber-600" />
            }
          </div>
          <div>
            <p className="font-serif font-bold text-lg text-amber-950">
              {planTier === "pro" ? "MiteOut Pro" : "Free tier"}
            </p>
            <p className="text-xs text-amber-700/60">
              {planTier === "pro" ? "Renews Jan 1, 2026 · $9/month" : `Up to ${FREE_LIMITS.hives} hives · ${FREE_LIMITS.history} history`}
            </p>
          </div>
        </div>
        {planTier === "pro" ? (
          <div className="flex items-center gap-3">
            <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
              Manage subscription
            </button>
            <button className="text-xs font-semibold text-red-500 hover:text-red-700 underline underline-offset-2">
              Cancel plan
            </button>
          </div>
        ) : null}
      </div>

      {/* Upgrade card (free only) */}
      {planTier === "free" && (
        <div className="bg-white/80 rounded-2xl border border-amber-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white">
            <p className="font-serif font-bold text-base text-amber-950">Upgrade to Pro</p>
            <p className="text-xs text-amber-700/60 mt-0.5">Everything in Free, plus the features serious beekeepers need.</p>
          </div>
          <div className="px-6 py-4">
            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="border-b border-amber-100">
                  <th className="text-left py-2 text-xs text-amber-700/50 font-semibold uppercase tracking-wide">Feature</th>
                  <th className="text-center py-2 text-xs text-amber-700/50 font-semibold uppercase tracking-wide">Free</th>
                  <th className="text-center py-2 text-xs text-amber-500 font-semibold uppercase tracking-wide">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60">
                {[
                  ["Hives", "Up to 3", "Unlimited"],
                  ["Data history", "90 days", "Full history"],
                  ["AI suggestions", "—", "✓"],
                  ["Weather calendar", "—", "✓"],
                  ["Priority support", "—", "✓"],
                ].map(([feat, free, pro]) => (
                  <tr key={feat}>
                    <td className="py-2.5 text-amber-900 font-medium">{feat}</td>
                    <td className="py-2.5 text-center text-amber-700/60">{free}</td>
                    <td className="py-2.5 text-center text-emerald-600 font-semibold">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              className="w-full rounded-xl font-bold h-10"
              style={{ background: "#d4820a", color: "white" }}
              onClick={() => setPlanTier("pro")}
            >
              Upgrade to Pro — $9/month
            </Button>
            <p className="text-[10px] text-amber-700/50 text-center mt-2">Cancel anytime. No contracts.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Danger Zone ─────────────────────────────────────────

function DangerSection() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleteHiveModal, setDeleteHiveModal] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [selectedHive, setSelectedHive] = useState("");

  const { data: hives = [] } = useQuery({
    queryKey: ["hives-danger", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("hives").select("id, name").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleDeleteHive = async () => {
    const hive = hives.find((h: any) => h.name === selectedHive);
    if (!hive) return;
    await supabase.from("readings").delete().eq("hive_id", hive.id);
    await supabase.from("hives").delete().eq("id", hive.id);
    setSelectedHive("");
  };

  const handleDeleteAccount = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div>
      <SectionTitle title="Danger Zone" sub="Irreversible actions. Read carefully before proceeding." />

      <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 overflow-hidden divide-y divide-red-100">

        {/* Delete hive */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-900">Delete a hive</p>
              <p className="text-xs text-red-700/70 mt-0.5 leading-relaxed">
                Permanently deletes the hive and all associated readings, events, and logs. This cannot be undone.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <select
                  value={selectedHive}
                  onChange={(e) => setSelectedHive(e.target.value)}
                  className="text-sm border border-red-200 rounded-lg px-3 py-1.5 bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-red-400"
                >
                  <option value="">Select hive…</option>
                  {hives.map((h: any) => <option key={h.id}>{h.name}</option>)}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedHive}
                  onClick={() => setDeleteHiveModal(true)}
                  className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-40"
                >
                  Delete hive
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete account */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-900">Delete account</p>
              <p className="text-xs text-red-700/70 mt-0.5 leading-relaxed">
                Deletes your account and all data. Your data will be permanently wiped in 30 days — email us within
                that window to cancel the deletion.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteAccountModal(true)}
                className="mt-3 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
              >
                Delete my account
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteHiveModal}
        onClose={() => setDeleteHiveModal(false)}
        title={`Delete "${selectedHive}"?`}
        description={
          <>
            This will permanently delete <strong>{selectedHive}</strong> and all its readings,
            events, and logs. <strong>This cannot be undone.</strong>
          </>
        }
        confirmLabel="Delete hive"
        requireText={selectedHive}
        onConfirm={handleDeleteHive}
      />

      <ConfirmModal
        open={deleteAccountModal}
        onClose={() => setDeleteAccountModal(false)}
        title="Delete your account?"
        description={
          <>
            All hives and data will be permanently deleted after a 30-day grace period.
            Email <strong>support@miteout.app</strong> within 30 days to cancel.
          </>
        }
        confirmLabel="Delete my account"
        requireText={user?.email}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

// ─── Main SettingsPage ────────────────────────────────────────────

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState<Section>("account");
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#fefccf" }}>
      <AppSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page header */}
        <div className="px-8 h-14 border-b border-amber-200/60 bg-white/40 backdrop-blur-sm flex-shrink-0 flex items-center">
          <h1 className="font-serif text-base font-bold text-amber-950">Settings</h1>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Section nav */}
          <nav
            className="w-48 flex-shrink-0 flex flex-col border-r border-amber-200/60 py-4 px-2 overflow-y-auto"
            style={{ background: "rgba(255,255,255,0.5)" }}
          >
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full mb-0.5 ${
                  activeSection === id
                    ? "bg-amber-100 text-amber-900 font-semibold"
                    : "text-amber-800/60 hover:text-amber-900 hover:bg-amber-50"
                } ${id === "danger" ? "mt-auto text-red-600 hover:bg-red-50 hover:text-red-700" : ""}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${id === "danger" ? "text-red-500" : ""}`} />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-7 pb-24 min-w-0">
            {activeSection === "account"       && <AccountSection       onDirty={setDirty} />}
            {activeSection === "apiary"        && <ApiarySection        onDirty={setDirty} />}
            {activeSection === "notifications" && <NotificationsSection onDirty={setDirty} />}
            {activeSection === "data"          && <DataSection />}
            {activeSection === "billing"       && <BillingSection />}
            {activeSection === "danger"        && <DangerSection />}
          </div>
        </div>

        {/* Unsaved changes bar */}
        {dirty && (
          <div
            className="absolute bottom-0 left-56 right-0 px-8 py-3 flex items-center justify-between border-t border-amber-200/60 backdrop-blur-sm"
            style={{ background: "rgba(255,255,235,0.95)" }}
          >
            <p className="text-sm font-semibold text-amber-900">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-200 rounded-xl text-amber-700"
                onClick={() => window.location.reload()}
              >
                Discard
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsPage;
