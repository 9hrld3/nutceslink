import { saveSessionAction } from "@/app/(app)/clients/[id]/sessions/actions";
import { SESSION_SECTIONS, rawValue } from "@/lib/session-form";

type Props = {
  clientId: string;
  session?: {
    id: string; measured_on: string; protocol: string; raw: unknown; patient_note: string | null;
    next_checkup_date: string | null; show_next_checkup_to_patient: boolean; supersedes_id: string | null;
  };
  /** Datos iniciales cuando se corrige otra sesión (se copian sus medidas). */
  prefillRaw?: unknown;
  supersedesId?: string | null;
};

export default function SessionForm({ clientId, session, prefillRaw, supersedesId }: Props) {
  const raw = session?.raw ?? prefillRaw ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={saveSessionAction} className="space-y-8">
      <input type="hidden" name="client_id" value={clientId} />
      {session && <input type="hidden" name="id" value={session.id} />}
      {(supersedesId ?? session?.supersedes_id) && <input type="hidden" name="supersedes_id" value={(supersedesId ?? session?.supersedes_id) as string} />}

      <section className="grid gap-4 border-2 border-primary bg-white p-6 sm:grid-cols-3">
        <label className="block">
          <span className="label">Fecha de medición</span>
          <input type="date" name="measured_on" required defaultValue={session?.measured_on ?? today} className="field mt-1" />
        </label>
        <label className="block">
          <span className="label">Protocolo</span>
          <input name="protocol" defaultValue={session?.protocol ?? "ISAK"} className="field mt-1" />
        </label>
        <label className="block">
          <span className="label">Próximo control</span>
          <input type="date" name="next_checkup_date" defaultValue={session?.next_checkup_date ?? ""} className="field mt-1" />
        </label>
      </section>

      {SESSION_SECTIONS.map((sec) => (
        <fieldset key={sec.key} className="border-2 border-primary bg-white p-6">
          <legend className="bg-primary px-3 py-1 font-display text-xl font-extrabold uppercase text-paper">{sec.title}</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sec.fields.map((f) => {
              const vals = rawValue(raw, sec.key, f.name);
              return (
                <div key={f.name}>
                  <span className="label">{f.label} ({f.unit})</span>
                  {f.repeats ? (
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((n) => (
                        <input key={n} type="number" step="any" min="0" name={`${sec.key}.${f.name}.${n}`} aria-label={`${f.label} repetición ${n}`}
                          defaultValue={vals[n - 1] ?? ""} className="field" />
                      ))}
                    </div>
                  ) : (
                    <input type="number" step="any" min="0" name={`${sec.key}.${f.name}`} aria-label={f.label} defaultValue={vals[0] ?? ""} className="field mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <section className="space-y-4 border-2 border-primary bg-white p-6">
        <label className="block">
          <span className="label">Nota para el paciente (la verá en su portal)</span>
          <textarea name="patient_note" rows={2} defaultValue={session?.patient_note ?? ""} className="field mt-1" />
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="show_next_checkup_to_patient" defaultChecked={session?.show_next_checkup_to_patient ?? true} className="h-5 w-5 accent-primary" />
          Mostrar el próximo control al paciente
        </label>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t-2 border-primary bg-paper px-4 py-3">
        <button name="intent" value="draft" className="btn btn-ghost">Guardar borrador</button>
        <button name="intent" value="final" className="btn btn-primary">Finalizar y calcular</button>
        <span className="self-center text-sm opacity-70">Al finalizar, las medidas quedan congeladas.</span>
      </div>
    </form>
  );
}
