import { z } from "zod";
import { get } from "../raw.ts";
import type { Formula } from "../types.ts";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** IMC = masa (kg) / estatura (m)². Verificada por definición. */
export const bmi: Formula<{ mass_kg: number; height_cm: number }> = {
  id: "bmi",
  version: "1",
  title: "Índice de masa corporal (IMC)",
  citation: { authors: "Definición estándar", year: 0, title: "masa / estatura²", source: "Definición" },
  source_status: "verified",
  population: { notes: "Todos. En menores se interpreta con curvas por edad, no con puntos de corte de adultos." },
  inputs: z.object({ mass_kg: z.number().positive(), height_cm: z.number().positive() }),
  pick: (raw) => ({ mass_kg: get(raw, "basic.mass_kg"), height_cm: get(raw, "basic.height_cm") }),
  compute: ({ mass_kg, height_cm }, ctx) => {
    const m = height_cm / 100;
    const warnings: string[] = [];
    if (ctx.ageYears !== null && ctx.ageYears < 18) {
      warnings.push("Menor de 18 años: no interpretar con puntos de corte de adultos.");
    }
    return { values: { bmi: r1(mass_kg / (m * m)) }, warnings };
  },
};

const SITES = ["biceps", "triceps", "subscapular", "iliac_crest", "supraspinale", "abdominal", "thigh", "calf"] as const;

/**
 * Suma de todos los pliegues registrados en la sesión (sin convención de grupo).
 * Verificada por definición; el resultado lista qué sitios entraron para que sea comparable entre fechas.
 */
export const skinfoldSumAll: Formula<Record<string, number>> = {
  id: "skinfold_sum_measured",
  version: "1",
  title: "Suma de pliegues medidos",
  citation: { authors: "Definición", year: 0, title: "Σ de los pliegues registrados", source: "Definición" },
  source_status: "verified",
  population: { notes: "Solo comparable entre sesiones con los mismos sitios medidos." },
  inputs: z.record(z.string(), z.number().positive()).refine((o) => Object.keys(o).length >= 2, "se requieren al menos 2 pliegues"),
  pick: (raw) => {
    const o: Record<string, number> = {};
    for (const s of SITES) {
      const v = get(raw, `skinfolds.${s}`);
      if (v !== undefined) o[s] = v;
    }
    return o;
  },
  compute: (input) => {
    const sites = Object.keys(input);
    const sum = Object.values(input).reduce((a, b) => a + b, 0);
    return {
      values: { sum_mm: r1(sum), sites_count: sites.length },
      warnings: [`Sitios incluidos: ${sites.join(", ")}.`],
    };
  },
};

/** Σ3 (tríceps + subescapular + supraespinal): definida en el manual Heath-Carter (paso 3 del formulario). */
export const skinfoldSum3: Formula<{ triceps: number; subscapular: number; supraspinale: number }> = {
  id: "skinfold_sum_3",
  version: "1",
  title: "Suma de 3 pliegues (tríceps, subescapular, supraespinal)",
  citation: {
    authors: "Carter, J.E.L.",
    year: 2002,
    title: "The Heath-Carter Anthropometric Somatotype – Instruction Manual",
    source: "Manual_Heath-Carter_Somatotipo.pdf, 'Endomorphy rating', paso 3",
  },
  source_status: "verified",
  population: { notes: "Todos." },
  inputs: z.object({ triceps: z.number().positive(), subscapular: z.number().positive(), supraspinale: z.number().positive() }),
  pick: (raw) => ({
    triceps: get(raw, "skinfolds.triceps"),
    subscapular: get(raw, "skinfolds.subscapular"),
    supraspinale: get(raw, "skinfolds.supraspinale"),
  }),
  compute: (i) => ({ values: { sum_mm: r1(i.triceps + i.subscapular + i.supraspinale) }, warnings: [] }),
};
