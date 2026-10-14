import { z } from "zod";
import { get } from "../raw.ts";
import type { Formula } from "../types.ts";

/**
 * Somatotipo antropométrico Heath-Carter (ecuaciones para somatotipo decimal).
 * FUENTE (verificada en las dos secciones del manual, "B. Equations for a decimal anthropometric somatotype" y
 * "Part 3, 1. The anthropometric somatotype"): Carter, J.E.L. (2002) Instruction Manual, San Diego State University.
 *
 *   endomorfia = -0.7182 + 0.1451 X - 0.00068 X² + 0.0000014 X³
 *       X = (tríceps + subescapular + supraespinal) × (170.18 / estatura cm)
 *   mesomorfia = 0.858 HB + 0.601 FB + 0.188 CAG + 0.161 CCG - 0.131 H + 4.5
 *       HB húmero, FB fémur (cm); H estatura (cm)
 *       CAG = perímetro de brazo flexionado - tríceps/10 ; CCG = perímetro máx. de pantorrilla - pliegue pantorrilla/10
 *   ectomorfia por HWR = estatura / masa^(1/3):
 *       HWR ≥ 40.75        → 0.732 HWR - 28.58
 *       38.25 < HWR < 40.75 → 0.463 HWR - 17.63
 *       HWR ≤ 38.25        → 0.1
 *   Si una componente resulta ≤ 0 se asigna 0.1 (por definición no puede ser cero o negativa).
 *   Coordenadas: X = ecto - endo ; Y = 2·meso - (endo + ecto).
 *
 * LIMITACIÓN DE LA VERIFICACIÓN: el ejemplo trabajado del manual (sujeto 573 → 1.6-5.4-3.2) está en la Figura 1,
 * una imagen cuyos datos crudos no son legibles en el PDF. Se prueba con (a) los valores publicados en el texto
 * (HWR 43.4 → ectomorfia 3.2; coordenadas 1.5/6.5 y 2.0/-4.0) y (b) cálculos manuales independientes. El resultado debe
 * validarse con un caso real antes de uso clínico.
 */
const CARTER = {
  endo: { c0: -0.7182, c1: 0.1451, c2: -0.00068, c3: 0.0000014, refHeight: 170.18 },
  meso: { hb: 0.858, fb: 0.601, cag: 0.188, ccg: 0.161, h: 0.131, k: 4.5 },
  ecto: { hi: 40.75, lo: 38.25, a1: 0.732, b1: -28.58, a2: 0.463, b2: -17.63, floor: 0.1 },
};

const floorRating = (n: number) => (n <= 0 ? 0.1 : n);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function endomorphy(sum3: number, heightCm: number): number {
  const x = sum3 * (CARTER.endo.refHeight / heightCm);
  const { c0, c1, c2, c3 } = CARTER.endo;
  return floorRating(c0 + c1 * x + c2 * x * x + c3 * x * x * x);
}

export function mesomorphy(i: {
  humerus: number; femur: number; arm_flexed: number; triceps: number; calf: number; calf_skinfold: number; height_cm: number;
}): number {
  const cag = i.arm_flexed - i.triceps / 10;
  const ccg = i.calf - i.calf_skinfold / 10;
  const m = CARTER.meso;
  return floorRating(m.hb * i.humerus + m.fb * i.femur + m.cag * cag + m.ccg * ccg - m.h * i.height_cm + m.k);
}

export function ectomorphy(heightCm: number, massKg: number): { hwr: number; ecto: number } {
  const hwr = heightCm / Math.cbrt(massKg);
  const e = CARTER.ecto;
  const raw = hwr >= e.hi ? e.a1 * hwr + e.b1 : hwr > e.lo ? e.a2 * hwr + e.b2 : e.floor;
  return { hwr, ecto: floorRating(raw) };
}

export function somatochart(endo: number, meso: number, ecto: number) {
  return { x: ecto - endo, y: 2 * meso - (endo + ecto) };
}

type In = {
  mass_kg: number; height_cm: number; triceps: number; subscapular: number; supraspinale: number;
  humerus: number; femur: number; arm_flexed: number; calf: number; calf_skinfold: number;
};

export const somatotypeHeathCarter: Formula<In> = {
  id: "somatotype_heath_carter",
  version: "1",
  title: "Somatotipo antropométrico (Heath-Carter)",
  citation: {
    authors: "Carter, J.E.L.",
    year: 2002,
    title: "The Heath-Carter Anthropometric Somatotype – Instruction Manual",
    source: "Manual_Heath-Carter_Somatotipo.pdf, ecuaciones para somatotipo decimal",
  },
  source_status: "verified",
  population: { notes: "Adultos y adolescentes. En niños pequeños la tabla de mesomorfia puede requerir extrapolación (manual)." },
  inputs: z.object({
    mass_kg: z.number().positive(), height_cm: z.number().positive(),
    triceps: z.number().positive(), subscapular: z.number().positive(), supraspinale: z.number().positive(),
    humerus: z.number().positive(), femur: z.number().positive(),
    arm_flexed: z.number().positive(), calf: z.number().positive(), calf_skinfold: z.number().positive(),
  }),
  pick: (raw) => ({
    mass_kg: get(raw, "basic.mass_kg"), height_cm: get(raw, "basic.height_cm"),
    triceps: get(raw, "skinfolds.triceps"), subscapular: get(raw, "skinfolds.subscapular"),
    supraspinale: get(raw, "skinfolds.supraspinale"),
    humerus: get(raw, "diameters.humerus"), femur: get(raw, "diameters.femur"),
    arm_flexed: get(raw, "perimeters.arm_flexed"), calf: get(raw, "perimeters.calf"),
    calf_skinfold: get(raw, "skinfolds.calf"),
  }),
  compute: (i, ctx) => {
    const endo = endomorphy(i.triceps + i.subscapular + i.supraspinale, i.height_cm);
    const meso = mesomorphy({ ...i, height_cm: i.height_cm });
    const { hwr, ecto } = ectomorphy(i.height_cm, i.mass_kg);
    const { x, y } = somatochart(endo, meso, ecto);
    const warnings: string[] = [];
    if (endo < 1 || meso < 1) warnings.push("Endomorfia o mesomorfia < 1.0: muy poco probable; revisa los datos crudos.");
    if (ctx.ageYears !== null && ctx.ageYears < 12) warnings.push("Menor de 12 años: la tabla de mesomorfia requiere extrapolación (manual); interpretar con cautela.");
    warnings.push("Estimación antropométrica; no es un diagnóstico.");
    return {
      values: { endomorphy: r1(endo), mesomorphy: r1(meso), ectomorphy: r1(ecto), hwr: Math.round(hwr * 100) / 100, x: r1(x), y: r1(y) },
      warnings,
    };
  },
};
