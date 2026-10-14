// Motor de cálculo (lib/calc). Ejecutar: npm run test:calc  (usa el test runner nativo de Node 24, sin dependencias).
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_FORMULAS, computeSession, pendingFormulas, plausibilityWarnings, reduceRepeats, visibleFormulas } from "../lib/calc/index.ts";
import { ectomorphy, endomorphy, mesomorphy, somatochart } from "../lib/calc/formulas/somatotype.ts";

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ---- Valores PUBLICADOS en el manual Heath-Carter (texto) ----
test("manual: sujeto 573, HWR 43.4 → ectomorfia 3.2", () => {
  // masa 64 kg (∛64 = 4) y estatura 173.6 cm → HWR = 43.4 exactamente
  const { hwr, ecto } = ectomorphy(173.6, 64);
  near(hwr, 43.4);
  assert.equal(Math.round(ecto * 10) / 10, 3.2); // 0.732·43.4 − 28.58 = 3.1888
});

test("manual: coordenadas somatocarta (3-2-5 → 2.0, -4.0; 1.5-5.5-3 → 1.5, 6.5)", () => {
  assert.deepEqual(somatochart(3, 2, 5), { x: 2, y: -4 });
  assert.deepEqual(somatochart(1.5, 5.5, 3), { x: 1.5, y: 6.5 });
});

// ---- Cálculos manuales INDEPENDIENTES (hechos a mano con los coeficientes del manual) ----
test("endomorfia: Σ3 = 30 mm a 170.18 cm → X = 30 → 3.0606", () => {
  // -0.7182 + 0.1451·30 − 0.00068·900 + 0.0000014·27000 = -0.7182 + 4.353 − 0.612 + 0.0378
  near(endomorphy(30, 170.18), 3.0606, 1e-4);
});

test("endomorfia: la corrección por estatura escala la suma (X = Σ·170.18/H)", () => {
  near(endomorphy(30, 170.18), endomorphy(30 * (180 / 170.18), 180), 1e-9);
});

test("endomorfia: resultado ≤ 0 se asigna 0.1", () => {
  assert.equal(endomorphy(0, 170.18), 0.1);
});

test("mesomorfia: HB 7, FB 9.8, brazo flex. 31 − tríceps 10/10, pantorrilla 37 − pliegue 10/10, H 175 → 4.9068", () => {
  // 0.858·7 + 0.601·9.8 + 0.188·30 + 0.161·36 − 0.131·175 + 4.5 = 23.3318 − 22.925 + 4.5
  near(mesomorphy({ humerus: 7, femur: 9.8, arm_flexed: 31, triceps: 10, calf: 37, calf_skinfold: 10, height_cm: 175 }), 4.9068, 1e-4);
});

test("ectomorfia: ramas y límites de HWR (masa 64 kg ⇒ HWR = H/4)", () => {
  near(ectomorphy(163, 64).ecto, 0.732 * 40.75 - 28.58); // HWR = 40.75 → rama ≥ 40.75 (1.249)
  near(ectomorphy(160, 64).ecto, 0.463 * 40 - 17.63); // 38.25 < HWR < 40.75 (0.89)
  near(ectomorphy(156, 64).ecto, 0.463 * 39 - 17.63); // (0.427)
  assert.equal(ectomorphy(153, 64).ecto, 0.1); // HWR = 38.25 → 0.1
  assert.equal(ectomorphy(140, 64).ecto, 0.1); // HWR < 38.25 → 0.1
});

test("repeticiones de pliegue: duplicado → promedio; triplicado → mediana", () => {
  assert.equal(reduceRepeats([10, 12]), 11);
  assert.equal(reduceRepeats([10, 12, 11]), 11);
  assert.equal(reduceRepeats([9, 15, 10]), 10);
  assert.equal(reduceRepeats(8), 8);
  assert.equal(reduceRepeats(undefined), undefined);
});

// ---- Registro de fórmulas ----
test("solo las fórmulas verificadas son visibles; las pendientes no", () => {
  const vis = visibleFormulas().map((f) => f.id);
  assert.deepEqual(vis.sort(), ["bmi", "skinfold_sum_3", "skinfold_sum_measured", "somatotype_heath_carter"]);
  const pend = pendingFormulas().map((f) => f.id);
  for (const id of ["fat_slaughter_1988", "fat_durnin_womersley_1974", "fat_withers_1987a", "skinfold_sum_4", "skinfold_sum_6", "skinfold_sum_8"]) {
    assert.ok(pend.includes(id), id);
  }
});

test("fórmulas pendientes no se pueden calcular", () => {
  for (const f of pendingFormulas()) assert.throws(() => f.compute({} as never, { ageYears: null, sex: null }));
});

test("toda fórmula visible tiene versión, cita y fuente (nunca 'PENDIENTE')", () => {
  for (const f of visibleFormulas()) {
    assert.ok(f.version && f.citation.authors && f.citation.source, f.id);
    assert.ok(!f.citation.source.startsWith("PENDIENTE"), f.id);
  }
  assert.equal(new Set(ALL_FORMULAS.map((f) => f.id)).size, ALL_FORMULAS.length, "ids únicos");
});

// ---- Sesión completa ----
const raw = {
  basic: { mass_kg: 70, height_cm: 175 },
  diameters: { humerus: 7, femur: 9.8 },
  perimeters: { arm_flexed: 31, calf: 37 },
  skinfolds: { triceps: 10, subscapular: [12, 14], supraspinale: 8, calf: 10 },
};

test("sesión completa: IMC, Σ3, suma medida y somatotipo; ninguna pendiente", () => {
  const out = computeSession(raw, { ageYears: 25, sex: "M" });
  const ids = out.results.map((r) => r.formula_id).sort();
  assert.deepEqual(ids, ["bmi", "skinfold_sum_3", "skinfold_sum_measured", "somatotype_heath_carter"]);
  const get = (id: string) => out.results.find((r) => r.formula_id === id)!.output.values;
  assert.equal(get("bmi").bmi, 22.9); // 70 / 1.75² = 22.857
  assert.equal(get("skinfold_sum_3").sum_mm, 31); // 10 + 13 (promedio de 12 y 14) + 8
  assert.equal(get("skinfold_sum_measured").sum_mm, 41); // + calf 10
  const s = get("somatotype_heath_carter");
  near(s.mesomorphy, 4.9, 0.051);
  near(s.hwr, 175 / Math.cbrt(70), 0.006);
  near(s.x, s.ectomorphy - s.endomorphy, 0.11);
  assert.ok(out.results.every((r) => r.formula_version && r.output.inputs_used));
});

test("determinismo: misma entrada → misma salida", () => {
  const a = computeSession(raw, { ageYears: 25, sex: "M" });
  const b = computeSession(structuredClone(raw), { ageYears: 25, sex: "M" });
  assert.deepEqual(a, b);
});

test("faltan medidas: la fórmula se omite, no falla", () => {
  const out = computeSession({ basic: { mass_kg: 70, height_cm: 175 } }, { ageYears: 25, sex: "M" });
  assert.deepEqual(out.results.map((r) => r.formula_id), ["bmi"]);
  assert.ok(out.skipped.some((s) => s.formula_id === "somatotype_heath_carter"));
});

test("valores fuera de rango generan advertencia (no bloqueo)", () => {
  const w = plausibilityWarnings({ basic: { mass_kg: 700, height_cm: 175 } });
  assert.equal(w.length, 1);
  assert.match(w[0], /Peso/);
  assert.equal(computeSession({ basic: { mass_kg: 700, height_cm: 175 } }, { ageYears: 25, sex: "M" }).results.length, 1);
});

test("menores: IMC advierte, somatotipo de < 12 años advierte", () => {
  const out = computeSession(raw, { ageYears: 10, sex: "M" });
  assert.ok(out.results.find((r) => r.formula_id === "bmi")!.output.warnings.some((w) => /menor/i.test(w)));
  assert.ok(out.results.find((r) => r.formula_id === "somatotype_heath_carter")!.output.warnings.some((w) => /12 años/.test(w)));
});

test("entradas inválidas (negativas) se rechazan", () => {
  assert.throws(() => computeSession({ basic: { mass_kg: -5 } }, { ageYears: 25, sex: "M" }));
});
