import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface UploadResult {
  filename: string;
  readingsCount: number;
  hiveCode: string;
}

interface ParsedReading {
  timestamp: string;
  weight_lbs: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  ina260_current_ma: number | null;
  ina260_voltage_mv: number | null;
  ina260_power_mw: number | null;
  thermistor_ext_f: number | null;
  thermistor2_f: number | null;
  thermistor3_f: number | null;
}

export const CSVUploader = ({ hiveId, hiveName, onUploadComplete }: { hiveId?: string; hiveName?: string; onUploadComplete?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stripSpaces = (s: string): string => s.replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g, "");

  const cleanLine = (line: string): string => {
    // Remove surrounding quotes and strip internal spaces
    let cleaned = line.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    return stripSpaces(cleaned);
  };

  const parseCSVLine = (line: string): string[] => {
    const cleaned = cleanLine(line);
    // Split by pipe, then split comma-separated fields (temp,humidity)
    const pipeParts = cleaned.split("|");
    const result: string[] = [];
    for (const part of pipeParts) {
      if (part.includes(",")) {
        result.push(...part.split(","));
      } else {
        result.push(part);
      }
    }
    return result;
  };

  const parseTimestamp = (raw: string): Date | null => {
    const parts = raw.split(".");
    if (parts.length !== 5) return null;
    const [month, day, hour, minute, second] = parts.map(Number);
    if ([month, day, hour, minute, second].some(isNaN)) return null;
    const year = new Date().getFullYear();
    return new Date(year, month - 1, day, hour, minute, second);
  };

  const parseNumber = (val: string): number | null => {
    const cleaned = val.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  const processCSV = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

      if (lines.length < 2) {
        throw new Error("CSV file must contain at least a header and one data row.");
      }

      // Find hive code and data lines
      // Lines can be: blank, header (contains "Month" or column description), hive code, then data
      let hiveCode = "";
      let dataStartIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const cleaned = cleanLine(lines[i]);
        // Skip empty lines and header lines
        if (!cleaned || cleaned.toLowerCase().includes("month") || cleaned.toLowerCase().includes("weight")) {
          continue;
        }
        // First non-header, non-empty line without a pipe is the hive code
        if (!cleaned.includes("|")) {
          hiveCode = cleaned;
          continue;
        }
        // First line with pipes is data start
        dataStartIndex = i;
        break;
      }

      if (!hiveCode) {
        throw new Error("Could not find hive code in CSV file.");
      }

      // Determine target hive
      let targetHiveId = hiveId;
      if (!targetHiveId) {
        const { data: hives } = await supabase
          .from("hives")
          .select("id, name, hive_code")
          .eq("user_id", user.id);

        const match = hives?.find((h) => h.hive_code === hiveCode || h.name === hiveCode);
        if (!match) {
          throw new Error(`No hive found matching code "${hiveCode}". Please create the hive first or select one.`);
        }
        targetHiveId = match.id;
      }

      // Store raw file
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("csv-uploads")
        .upload(filePath, file);

      if (storageError) {
        throw new Error(`Storage error: ${storageError.message}`);
      }

      // Create upload record
      const { data: uploadRecord, error: uploadError } = await supabase
        .from("uploads")
        .insert({
          user_id: user.id,
          hive_id: targetHiveId,
          filename: file.name,
          file_path: filePath,
          rows_count: lines.length - 1,
        })
        .select()
        .single();

      if (uploadError) throw new Error(`Upload record error: ${uploadError.message}`);

      // Parse data rows starting from detected data start
      const readings: any[] = [];
      const timestamps = new Set<string>();

      console.log(`[CSV Debug] dataStartIndex=${dataStartIndex}, total lines=${lines.length}, hiveCode=${hiveCode}`);

      for (let i = dataStartIndex; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (i === dataStartIndex) {
          console.log(`[CSV Debug] First data line raw: "${lines[i]}"`);
          console.log(`[CSV Debug] First data line cols (${cols.length}):`, cols);
        }
        if (cols.length < 7) {
          if (i === dataStartIndex) console.log(`[CSV Debug] Skipped line ${i}: cols.length=${cols.length} < 7`);
          continue;
        }

        const ts = parseTimestamp(cols[0]);
        if (!ts) {
          if (i === dataStartIndex) console.log(`[CSV Debug] Skipped line ${i}: parseTimestamp failed for "${cols[0]}"`);
          continue;
        }

        const tsKey = ts.toISOString();
        if (timestamps.has(tsKey)) {
          throw new Error(`Duplicate timestamp found at line ${i + 1}: ${cols[0]}`);
        }
        timestamps.add(tsKey);

        readings.push({
          hive_id: targetHiveId,
          upload_id: uploadRecord.id,
          timestamp: tsKey,
          weight_lbs: parseNumber(cols[1]),
          temperature_c: parseNumber(cols[2]),
          humidity_pct: parseNumber(cols[3]),
          ina260_current_ma: parseNumber(cols[4]),
          ina260_voltage_mv: parseNumber(cols[5]),
          ina260_power_mw: parseNumber(cols[6]),
          thermistor_ext_f: cols[7] ? parseNumber(cols[7]) : null,
          thermistor2_f: cols[8] ? parseNumber(cols[8]) : null,
          thermistor3_f: cols[9] ? parseNumber(cols[9]) : null,
        });
      }

      console.log(`[CSV Debug] Parsed ${readings.length} readings`);

      if (readings.length === 0) {
        throw new Error("No valid data rows found in the CSV file.");
      }

      // Check for existing timestamps
      const { data: existing } = await supabase
        .from("readings")
        .select("timestamp")
        .eq("hive_id", targetHiveId)
        .in("timestamp", readings.map((r) => r.timestamp));

      if (existing && existing.length > 0) {
        throw new Error(`${existing.length} duplicate timestamp(s) already exist in this hive. Re-uploads of corrected data are not allowed.`);
      }

      // Insert in batches of 500
      for (let i = 0; i < readings.length; i += 500) {
        const batch = readings.slice(i, i + 500);
        const { error: insertError } = await supabase.from("readings").insert(batch);
        if (insertError) throw new Error(`Insert error: ${insertError.message}`);
      }

      setResult({
        filename: file.name,
        readingsCount: readings.length,
        hiveCode,
      });

      toast({
        title: "Upload successful",
        description: `${readings.length} new readings processed from ${file.name}`,
      });

      onUploadComplete?.();
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      processCSV(file);
    } else {
      setError("Please drop a .csv file");
    }
  }, [hiveId, user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSV(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload CSV Data
          {hiveName && <span className="text-muted-foreground font-normal text-sm">— {hiveName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-inner p-10 text-center transition-colors brand-curve ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              Processing CSV...
            </div>
          ) : (
            <>
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">Drop your CSV file here</p>
              <p className="text-xs text-muted-foreground/60 mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </>
          )}
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-inner bg-secondary/10 border border-secondary/20 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">{result.readingsCount} readings processed</p>
              <p className="text-xs text-muted-foreground">{result.filename} → {result.hiveCode}</p>
            </div>
            <button onClick={() => setResult(null)} className="ml-auto"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-inner bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm text-destructive">Upload Error</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVUploader;
