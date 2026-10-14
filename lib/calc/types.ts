import type { ZodType } from "zod";

export type SourceStatus = "verified" | "pending_source";

export interface Citation {
  authors: string;
  year: number;
  title: string;
  source: string;
}

export interface Population {
  sex?: "M" | "F";
  ageMin?: number;
  ageMax?: number;
  notes?: string;
}

/** Contexto de la persona (no son medidas): lo necesitan fórmulas por edad/sexo. */
export interface CalcContext {
  ageYears: number | null;
  sex: "M" | "F" | null;
}

export interface FormulaOutput {
  values: Record<string, number>;
  warnings: string[];
}

export interface Formula<I = unknown> {
  id: string;
  version: string;
  title: string;
  citation: Citation;
  /** Solo las fórmulas `verified` se calculan y se muestran. */
  source_status: SourceStatus;
  population: Population;
  /** Valida y normaliza las entradas tomadas de `raw` + contexto. */
  inputs: ZodType<I>;
  pick: (raw: unknown, ctx: CalcContext) => unknown;
  compute: (input: I, ctx: CalcContext) => FormulaOutput;
}

export interface CalcResult {
  formula_id: string;
  formula_version: string;
  title: string;
  citation: Citation;
  output: FormulaOutput & { inputs_used: Record<string, number> };
}
