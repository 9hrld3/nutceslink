import { saveClientAction } from "@/app/(app)/clients/actions";

export type ClientRow = {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  biological_sex?: string | null;
  group_id?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  sport?: string | null;
  activity_level?: string | null;
  goal?: string | null;
  dietary_restrictions?: string[] | null;
  allergies?: string[] | null;
  objectives?: string[] | null;
  medical_conditions?: string | null;
  medical_history?: { diagnoses?: string[]; medications?: string[]; surgeries?: string | null; family_history?: string | null; notes?: string | null } | null;
  lifestyle?: { work?: string | null; stress_level?: number | null; training_week?: string | null; sleep_usual_h?: number | null; meal_times?: { breakfast?: string | null; lunch?: string | null; dinner?: string | null } } | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_phone?: string | null;
  guardian_consent?: boolean;
  data_consent?: boolean;
};

export function Field({ label, name, defaultValue, type = "text", required, placeholder }: {
  label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} type={type} step="any" required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} className="field mt-1" />
    </label>
  );
}

function Select({ label, name, options, value }: { label: string; name: string; options: [string, string][]; value?: string | null }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field mt-1">
        <option value="">—</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Area({ label, name, defaultValue, rows = 3, placeholder }: { label: string; name: string; defaultValue?: string | null; rows?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea name={name} rows={rows} placeholder={placeholder} defaultValue={defaultValue ?? ""} className="field mt-1" />
    </label>
  );
}

const form = "space-y-6 border-2 border-primary bg-white p-6";

export function ClientDataForm({ client, groups = [] }: { client?: ClientRow; groups?: { id: string; name: string }[] }) {
  const c = client ?? {};
  return (
    <form action={saveClientAction} className={form}>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="section" value="datos" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" name="full_name" defaultValue={c.full_name} required />
        <Field label="Teléfono (WhatsApp)" name="phone" defaultValue={c.phone} />
        <Field label="Correo" name="email" type="email" defaultValue={c.email} />
        <Field label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={c.birth_date} />
        <Select label="Sexo biológico" name="biological_sex" value={c.biological_sex} options={[["F", "Mujer"], ["M", "Hombre"]]} />
        <label className="block">
          <span className="label">Grupo</span>
          <select name="group_id" defaultValue={c.group_id ?? ""} className="field mt-1">
            <option value="">Sin grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <Field label="Estatura (cm)" name="height_cm" type="number" defaultValue={c.height_cm} />
        <Field label="Peso (kg)" name="weight_kg" type="number" defaultValue={c.weight_kg} />
        <Field label="% grasa corporal (referencia)" name="body_fat_pct" type="number" defaultValue={c.body_fat_pct} />
        <Field label="Deporte" name="sport" defaultValue={c.sport} placeholder="Fútbol" />
        <Select label="Nivel de actividad" name="activity_level" value={c.activity_level}
          options={[["amateur", "Amateur"], ["semiprofesional", "Semiprofesional"], ["profesional", "Profesional"]]} />
        <Select label="Objetivo principal" name="goal" value={c.goal}
          options={[["masa_muscular", "Masa muscular"], ["perdida_grasa", "Pérdida de grasa"], ["rendimiento", "Rendimiento"], ["mantenimiento", "Mantenimiento"]]} />
        <Field label="Restricciones (separadas por coma)" name="dietary_restrictions" defaultValue={c.dietary_restrictions?.join(", ")} placeholder="sin gluten, vegetariano" />
        <Field label="Alergias (separadas por coma)" name="allergies" defaultValue={c.allergies?.join(", ")} />
        <Field label="Objetivos (separados por coma)" name="objectives" defaultValue={c.objectives?.join(", ")} placeholder="recomposición corporal, mejorar rendimiento" />
      </div>

      <fieldset id="representante" className="border-2 border-secondary p-4">
        <legend className="label px-2">Representante (si es menor de edad)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre del representante" name="guardian_name" defaultValue={c.guardian_name} />
          <Field label="Parentesco" name="guardian_relationship" defaultValue={c.guardian_relationship} />
          <Field label="Teléfono" name="guardian_phone" defaultValue={c.guardian_phone} />
        </div>
        <label className="mt-4 flex items-start gap-3">
          <input type="checkbox" name="guardian_consent" defaultChecked={c.guardian_consent} className="mt-1 h-5 w-5 accent-primary" />
          <span><strong>El representante autorizó</strong> el tratamiento de los datos de salud del menor y su plan nutricional.</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-3 border-l-4 border-accent bg-paper p-4">
        <input type="checkbox" name="data_consent" defaultChecked={c.data_consent} className="mt-1 h-5 w-5 accent-primary" />
        <span>
          <strong>Consentimiento de datos de salud.</strong> El cliente autorizó el tratamiento de sus datos de salud para
          elaborar su plan nutricional (LOPDP). En adultos, sin esto no se generan planes.
        </span>
      </label>
      <button className="btn btn-primary">{c.id ? "Guardar cambios" : "Crear cliente"}</button>
    </form>
  );
}

export function ClientHistoryForm({ client }: { client: ClientRow }) {
  const h = client.medical_history ?? {};
  return (
    <form action={saveClientAction} className={form}>
      <input type="hidden" name="id" value={client.id} />
      <input type="hidden" name="section" value="historia" />
      <Area label="Condiciones médicas relevantes (resumen)" name="medical_conditions" defaultValue={client.medical_conditions} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Area label="Diagnósticos (uno por línea o separados por coma)" name="diagnoses" defaultValue={h.diagnoses?.join("\n")} />
        <Area label="Medicamentos" name="medications" defaultValue={h.medications?.join("\n")} />
        <Area label="Cirugías" name="surgeries" defaultValue={h.surgeries} />
        <Area label="Antecedentes familiares" name="family_history" defaultValue={h.family_history} />
      </div>
      <Area label="Notas" name="notes" defaultValue={h.notes} />
      <p className="text-sm opacity-70">Datos de salud sensibles: solo lo necesario. No se registran en el historial de auditoría.</p>
      <button className="btn btn-primary">Guardar historia</button>
    </form>
  );
}

export function ClientLifestyleForm({ client }: { client: ClientRow }) {
  const l = client.lifestyle ?? {};
  return (
    <form action={saveClientAction} className={form}>
      <input type="hidden" name="id" value={client.id} />
      <input type="hidden" name="section" value="estilo" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ocupación / actividad laboral" name="work" defaultValue={l.work} />
        <Field label="Nivel de estrés (1 a 5)" name="stress_level" type="number" defaultValue={l.stress_level} />
        <Field label="Entrenamiento semanal (días y horarios)" name="training_week" defaultValue={l.training_week} placeholder="Lun-Mié-Vie 17:00, partido sábado" />
        <Field label="Horas de sueño habituales" name="sleep_usual_h" type="number" defaultValue={l.sleep_usual_h} />
        <Field label="Hora de desayuno" name="meal_breakfast" defaultValue={l.meal_times?.breakfast} placeholder="07:00" />
        <Field label="Hora de almuerzo" name="meal_lunch" defaultValue={l.meal_times?.lunch} placeholder="13:00" />
        <Field label="Hora de cena" name="meal_dinner" defaultValue={l.meal_times?.dinner} placeholder="20:00" />
      </div>
      <button className="btn btn-primary">Guardar estilo de vida</button>
    </form>
  );
}

/** Compatibilidad: el formulario de alta usa la pestaña de datos. */
export default ClientDataForm;
