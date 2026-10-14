// Definición única de los campos del formulario de sesión (render + lectura del FormData).
export interface FieldDef { name: string; label: string; unit: string; repeats?: boolean }
export interface SectionDef { key: "basic" | "diameters" | "perimeters" | "skinfolds" | "other"; title: string; fields: FieldDef[] }

export const SESSION_SECTIONS: SectionDef[] = [
  {
    key: "basic", title: "Básicas",
    fields: [
      { name: "mass_kg", label: "Peso", unit: "kg" },
      { name: "height_cm", label: "Estatura", unit: "cm" },
      { name: "sitting_height_cm", label: "Talla sentado", unit: "cm" },
    ],
  },
  {
    key: "skinfolds", title: "Pliegues cutáneos (hasta 3 repeticiones)",
    fields: [
      { name: "biceps", label: "Bíceps", unit: "mm", repeats: true },
      { name: "triceps", label: "Tríceps", unit: "mm", repeats: true },
      { name: "subscapular", label: "Subescapular", unit: "mm", repeats: true },
      { name: "iliac_crest", label: "Cresta ilíaca", unit: "mm", repeats: true },
      { name: "supraspinale", label: "Supraespinal", unit: "mm", repeats: true },
      { name: "abdominal", label: "Abdominal", unit: "mm", repeats: true },
      { name: "thigh", label: "Muslo", unit: "mm", repeats: true },
      { name: "calf", label: "Pantorrilla", unit: "mm", repeats: true },
    ],
  },
  {
    key: "diameters", title: "Diámetros",
    fields: [
      { name: "biacromial", label: "Biacromial", unit: "cm" },
      { name: "thorax_transverse", label: "Tórax transverso", unit: "cm" },
      { name: "thorax_ap", label: "Tórax anteroposterior", unit: "cm" },
      { name: "biiliocristal", label: "Biiliocristal", unit: "cm" },
      { name: "humerus", label: "Húmero (biepicondíleo)", unit: "cm" },
      { name: "femur", label: "Fémur (biepicondíleo)", unit: "cm" },
      { name: "bi_styloid", label: "Biestiloideo", unit: "cm" },
    ],
  },
  {
    key: "perimeters", title: "Perímetros",
    fields: [
      { name: "head", label: "Cabeza", unit: "cm" },
      { name: "arm_relaxed", label: "Brazo relajado", unit: "cm" },
      { name: "arm_flexed", label: "Brazo flexionado y contraído", unit: "cm" },
      { name: "forearm", label: "Antebrazo", unit: "cm" },
      { name: "thorax", label: "Tórax", unit: "cm" },
      { name: "waist", label: "Cintura", unit: "cm" },
      { name: "hips", label: "Caderas", unit: "cm" },
      { name: "thigh_gluteal", label: "Muslo glúteo", unit: "cm" },
      { name: "thigh_mid", label: "Muslo medio", unit: "cm" },
      { name: "calf", label: "Pantorrilla (máx.)", unit: "cm" },
    ],
  },
  {
    key: "other", title: "Otras",
    fields: [
      { name: "arm_span_cm", label: "Envergadura", unit: "cm" },
      { name: "arm_length_cm", label: "Longitud del brazo", unit: "cm" },
      { name: "leg_length_cm", label: "Longitud de la pierna", unit: "cm" },
    ],
  },
];

const parseNum = (v: FormDataEntryValue | null): number | null => {
  if (v === null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** FormData → objeto `raw` (solo incluye lo capturado). Los pliegues con repeticiones salen como número o arreglo. */
export function formToRaw(f: FormData): Record<string, Record<string, number | number[]>> {
  const raw: Record<string, Record<string, number | number[]>> = {};
  for (const sec of SESSION_SECTIONS) {
    for (const fld of sec.fields) {
      let value: number | number[] | undefined;
      if (fld.repeats) {
        const reps = [1, 2, 3].map((n) => parseNum(f.get(`${sec.key}.${fld.name}.${n}`))).filter((n): n is number => n !== null);
        if (reps.length === 1) value = reps[0];
        else if (reps.length > 1) value = reps;
      } else {
        const n = parseNum(f.get(`${sec.key}.${fld.name}`));
        if (n !== null) value = n;
      }
      if (value !== undefined) (raw[sec.key] ??= {})[fld.name] = value;
    }
  }
  return raw;
}

/** Valor de un campo guardado → entradas por repetición para precargar el formulario. */
export function rawValue(raw: unknown, section: string, name: string): (number | undefined)[] {
  const v = (raw as Record<string, Record<string, unknown>> | null)?.[section]?.[name];
  if (typeof v === "number") return [v];
  if (Array.isArray(v)) return v as number[];
  return [];
}
