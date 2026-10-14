import { z } from "zod";
import type { Formula } from "../types.ts";

/**
 * Fórmulas SIN fuente original disponible: se registran para dejar constancia pero NO se calculan ni se muestran
 * (source_status = 'pending_source'). No contienen coeficientes. Cuando llegue el PDF, se transcribe desde ahí.
 */
function pending(id: string, title: string, authors: string, year: number, population: Formula["population"], why: string): Formula {
  return {
    id,
    version: "0",
    title,
    citation: { authors, year, title, source: `PENDIENTE: ${why}` },
    source_status: "pending_source",
    population,
    inputs: z.unknown(),
    pick: () => ({}),
    compute: () => {
      throw new Error(`Fórmula ${id} sin fuente verificada: no se puede calcular.`);
    },
  };
}

const group = "Falta confirmar con el profesional/ISAK qué sitios componen el grupo y conseguir la fuente.";

export const PENDING_FORMULAS: Formula[] = [
  pending("fat_slaughter_1988", "% grasa niños y adolescentes (Slaughter)", "Slaughter et al.", 1988, { ageMax: 18 }, "falta el PDF de Slaughter 1988"),
  pending("fat_durnin_womersley_1974", "% grasa por 4 pliegues (Durnin & Womersley)", "Durnin & Womersley", 1974, { ageMin: 17 }, "falta el PDF de Durnin & Womersley 1974"),
  pending("fat_withers_1987a", "% grasa deportistas (Withers) + conversión de densidad (Siri)", "Withers et al.; Siri", 1987, {}, "faltan los PDF de Withers 1987a y Siri 1961"),
  pending("skinfold_sum_4", "Suma de 4 pliegues", "ISAK (a confirmar)", 0, {}, group),
  pending("skinfold_sum_6", "Suma de 6 pliegues", "ISAK (a confirmar)", 0, {}, group),
  pending("skinfold_sum_8", "Suma de 8 pliegues", "ISAK (a confirmar)", 0, {}, group),
];
