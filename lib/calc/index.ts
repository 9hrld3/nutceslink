import { bmi, skinfoldSum3, skinfoldSumAll } from "./formulas/basic.ts";
import { somatotypeHeathCarter } from "./formulas/somatotype.ts";
import { PENDING_FORMULAS } from "./formulas/pending.ts";
import { plausibilityWarnings, rawSchema } from "./raw.ts";
import type { CalcContext, CalcResult, Formula } from "./types.ts";

export * from "./types.ts";
export { rawSchema, plausibilityWarnings, reduceRepeats, type Raw } from "./raw.ts";

// Cada fórmula tiene su propio tipo de entrada; el registro las guarda de forma heterogénea.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormula = Formula<any>;

/** Todas las fórmulas conocidas (incluye las pendientes, que nunca se calculan). */
export const ALL_FORMULAS: AnyFormula[] = [bmi, skinfoldSum3, skinfoldSumAll, somatotypeHeathCarter, ...PENDING_FORMULAS];

/** Solo lo verificado puede aparecer en la interfaz o calcularse. */
export const visibleFormulas = (): AnyFormula[] => ALL_FORMULAS.filter((f) => f.source_status === "verified");
export const pendingFormulas = (): AnyFormula[] => ALL_FORMULAS.filter((f) => f.source_status !== "verified");

export interface SessionCalc {
  results: CalcResult[];
  /** Fórmulas verificadas que no se pudieron calcular por falta de medidas. */
  skipped: { formula_id: string; title: string }[];
  warnings: string[];
}

/** Calcula todas las fórmulas verificadas posibles a partir de las medidas crudas. Determinista y sin red. */
export function computeSession(rawInput: unknown, ctx: CalcContext): SessionCalc {
  const raw = rawSchema.parse(rawInput);
  const results: CalcResult[] = [];
  const skipped: SessionCalc["skipped"] = [];
  for (const f of visibleFormulas()) {
    const parsed = f.inputs.safeParse(f.pick(raw, ctx));
    if (!parsed.success) {
      skipped.push({ formula_id: f.id, title: f.title });
      continue;
    }
    const out = f.compute(parsed.data, ctx);
    results.push({
      formula_id: f.id,
      formula_version: f.version,
      title: f.title,
      citation: f.citation,
      output: { ...out, inputs_used: parsed.data as Record<string, number> },
    });
  }
  return { results, skipped, warnings: plausibilityWarnings(raw) };
}
