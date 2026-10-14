import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import ResultsView, { type StoredResult } from "@/components/ResultsView";
import { recalcSessionAction } from "../actions";
import { computeSession, pendingFormulas } from "@/lib/calc";
import { ageYears } from "@/lib/age";

export default async function SessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const { supabase } = await getContext();
  const { data: s } = await supabase.from("measurement_sessions").select("*").eq("id", sessionId).eq("client_id", id).maybeSingle();
  if (!s) notFound();
  const { data: client } = await supabase.from("clients").select("full_name, birth_date, biological_sex").eq("id", id).maybeSingle();
  const { data: results } = await supabase.from("measurement_results").select("id, formula_id, formula_version, output").eq("session_id", sessionId).order("computed_at");

  // Fórmulas verificadas que no se pudieron calcular por falta de medidas, y advertencias de plausibilidad.
  let skipped: { formula_id: string; title: string }[] = [];
  let plaus: string[] = [];
  try {
    const calc = computeSession(s.raw, {
      ageYears: ageYears(client?.birth_date, new Date(s.measured_on + "T00:00:00")),
      sex: client?.biological_sex === "M" || client?.biological_sex === "F" ? client.biological_sex : null,
    });
    skipped = calc.skipped;
    plaus = calc.warnings;
  } catch {}

  const isFinal = s.status === "final";
  return (
    <>
      <Link href={`/clients/${id}?tab=mediciones`} className="label underline">← {client?.full_name}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl text-primary">Sesión del {new Date(s.measured_on + "T00:00:00").toLocaleDateString("es-EC")}</h1>
        <span className={`label px-3 py-1 ${isFinal ? "bg-secondary" : "bg-accent"} text-ink`}>{isFinal ? "Finalizada" : "Borrador"}</span>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {!isFinal && <Link href={`/clients/${id}/sessions/${sessionId}/edit`} className="btn btn-accent">Editar y finalizar</Link>}
        {isFinal && (
          <>
            <Link href={`/clients/${id}/sessions/${sessionId}/report`} className="btn btn-primary">Imprimir informe</Link>
            <Link href={`/clients/${id}/sessions/new?supersedes=${sessionId}`} className="btn btn-ghost">Corregir con una nueva sesión</Link>
            <form action={recalcSessionAction}>
              <input type="hidden" name="session_id" value={sessionId} />
              <input type="hidden" name="client_id" value={id} />
              <button className="btn btn-ghost">Recalcular</button>
            </form>
          </>
        )}
      </div>

      {s.supersedes_id && <p className="mb-4 border-l-4 border-secondary bg-white p-3">Esta sesión corrige <Link className="underline" href={`/clients/${id}/sessions/${s.supersedes_id}`}>una sesión anterior</Link>.</p>}
      {!!plaus.length && (
        <ul className="mb-4 list-disc border-l-4 border-accent bg-white py-3 pl-8 pr-3" role="alert">
          {plaus.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {isFinal ? <ResultsView results={(results ?? []) as StoredResult[]} /> : (
        <p className="border-2 border-dashed border-primary p-6">Los resultados se calculan al finalizar la sesión.</p>
      )}

      {isFinal && !!skipped.length && (
        <section className="mt-8">
          <h2 className="mb-2 text-2xl text-primary">Cálculos no disponibles (faltan medidas)</h2>
          <ul className="list-disc pl-6 text-sm">{skipped.map((k) => <li key={k.formula_id}>{k.title}</li>)}</ul>
        </section>
      )}
      <p className="mt-8 text-sm opacity-70">
        Fórmulas pendientes de fuente (no se calculan ni se muestran): {pendingFormulas().length}. Se activan cuando se verifique su fuente original.
      </p>
    </>
  );
}
