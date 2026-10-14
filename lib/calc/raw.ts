import { z } from "zod";

/** Pliegue: un valor o hasta 3 repeticiones. */
const skinfold = z.union([z.number().positive(), z.array(z.number().positive()).min(1).max(3)]);
const cm = z.number().positive();

/**
 * Medidas crudas de una sesión. Unidades fijas: kg, cm, mm.
 * Todo es opcional; cada fórmula exige solo lo que necesita.
 */
export const rawSchema = z.object({
  basic: z.object({ mass_kg: z.number().positive(), height_cm: cm, sitting_height_cm: cm }).partial().optional(),
  diameters: z
    .object({
      biacromial: cm, thorax_transverse: cm, thorax_ap: cm, biiliocristal: cm,
      humerus: cm, femur: cm, bi_styloid: cm,
    })
    .partial()
    .optional(),
  perimeters: z
    .object({
      head: cm, arm_relaxed: cm, arm_flexed: cm, forearm: cm, thorax: cm, waist: cm,
      hips: cm, thigh_gluteal: cm, thigh_mid: cm, calf: cm,
    })
    .partial()
    .optional(),
  skinfolds: z
    .object({
      biceps: skinfold, triceps: skinfold, subscapular: skinfold, iliac_crest: skinfold,
      supraspinale: skinfold, abdominal: skinfold, thigh: skinfold, calf: skinfold,
    })
    .partial()
    .optional(),
  other: z.object({ arm_span_cm: cm, arm_length_cm: cm, leg_length_cm: cm }).partial().optional(),
});
export type Raw = z.infer<typeof rawSchema>;

/**
 * Valor representativo de un pliegue con repeticiones, según el manual Heath-Carter (Carter 2002):
 * duplicado → promedio; triplicado → mediana ("relatively inexperienced measurers ... triplicate ... median").
 * Pendiente de confirmar si el protocolo ISAK del profesional usa otra regla.
 */
export function reduceRepeats(v: number | number[] | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (v.length === 1) return v[0];
  if (v.length === 2) return (v[0] + v[1]) / 2;
  const s = [...v].sort((a, b) => a - b);
  return s[1];
}

/** Rangos de plausibilidad (detectar errores de captura). NO son normas poblacionales. */
export const PLAUSIBLE: { path: string; label: string; min: number; max: number; unit: string }[] = [
  { path: "basic.mass_kg", label: "Peso", min: 10, max: 250, unit: "kg" },
  { path: "basic.height_cm", label: "Estatura", min: 80, max: 230, unit: "cm" },
  { path: "basic.sitting_height_cm", label: "Talla sentado", min: 40, max: 130, unit: "cm" },
  { path: "diameters.humerus", label: "Diámetro húmero", min: 4, max: 10, unit: "cm" },
  { path: "diameters.femur", label: "Diámetro fémur", min: 5, max: 14, unit: "cm" },
  { path: "perimeters.arm_flexed", label: "Perímetro brazo flexionado", min: 15, max: 55, unit: "cm" },
  { path: "perimeters.calf", label: "Perímetro pantorrilla", min: 20, max: 60, unit: "cm" },
  { path: "skinfolds.triceps", label: "Pliegue tríceps", min: 2, max: 60, unit: "mm" },
  { path: "skinfolds.subscapular", label: "Pliegue subescapular", min: 2, max: 60, unit: "mm" },
  { path: "skinfolds.supraspinale", label: "Pliegue supraespinal", min: 2, max: 60, unit: "mm" },
  { path: "skinfolds.calf", label: "Pliegue pantorrilla", min: 2, max: 60, unit: "mm" },
];

export function get(raw: unknown, path: string): number | undefined {
  const parts = path.split(".");
  let cur: unknown = raw;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur === "number") return cur;
  if (Array.isArray(cur) && cur.every((x) => typeof x === "number")) return reduceRepeats(cur as number[]);
  return undefined;
}

export function plausibilityWarnings(raw: unknown): string[] {
  const out: string[] = [];
  for (const r of PLAUSIBLE) {
    const v = get(raw, r.path);
    if (v !== undefined && (v < r.min || v > r.max)) {
      out.push(`${r.label} ${v} ${r.unit} fuera del rango esperado (${r.min}–${r.max}); revisa la captura.`);
    }
  }
  return out;
}
