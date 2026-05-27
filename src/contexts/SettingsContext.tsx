import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type WeightUnit = "lbs" | "kg";
export type TempUnit = "F" | "C";
export type PlanTier = "free" | "pro";

interface SettingsContextType {
  weightUnit: WeightUnit;
  tempUnit: TempUnit;
  planTier: PlanTier;
  setWeightUnit: (u: WeightUnit) => void;
  setTempUnit: (u: TempUnit) => void;
  setPlanTier: (t: PlanTier) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  weightUnit: "lbs",
  tempUnit: "C",
  planTier: "free",
  setWeightUnit: () => {},
  setTempUnit: () => {},
  setPlanTier: () => {},
});

export const useSettings = () => useContext(SettingsContext);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() => load("setting_weightUnit", "lbs"));
  const [tempUnit, setTempUnitState] = useState<TempUnit>(() => load("setting_tempUnit", "C"));
  const [planTier, setPlanTierState] = useState<PlanTier>(() => load("setting_planTier", "free"));

  const setWeightUnit = (u: WeightUnit) => {
    setWeightUnitState(u);
    localStorage.setItem("setting_weightUnit", JSON.stringify(u));
  };
  const setTempUnit = (u: TempUnit) => {
    setTempUnitState(u);
    localStorage.setItem("setting_tempUnit", JSON.stringify(u));
  };
  const setPlanTier = (t: PlanTier) => {
    setPlanTierState(t);
    localStorage.setItem("setting_planTier", JSON.stringify(t));
  };

  return (
    <SettingsContext.Provider value={{ weightUnit, tempUnit, planTier, setWeightUnit, setTempUnit, setPlanTier }}>
      {children}
    </SettingsContext.Provider>
  );
};
