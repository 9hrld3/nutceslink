import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import ResultsView, { type StoredResult } from "@/components/ResultsView";
import PrintButton from "@/components/PrintButton";
import { ageYears } from "@/lib/age";

export default async function ReportPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const { supabase, studioName, coach } = await getContext();
  const { data: s } = await supabase.from("measurement_sessions").select("*").eq("id", sessionId).eq("client_id", id).maybeSingle();
  if (!s || s.status !== "final") notFound();
  const { data: c } = await supabase.from("clients").select("full_name, birth_date, sport").eq("id", id).maybeSingle();
  const { data: results } = await supabase.from("measurement_results").select("id, formula_id, formula_version, output").eq("session_id", sessionId).order("computed_at");
  const age = ageYears(c?.birth_date, new Date(s.measured_on + "T00:00:00"));
  const raw = s.raw as { basic?: { mass_kg?: number; height_cm?: number } };

  return (
    <article className="report mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/clients/${id}/sessions/${sessionId}`} className="label underline">← Volver</Link>
        <PrintButton />
      </div>

      <header className="bg-primary p-8 text-paper">
        <p className="label text-accent">{studioName || "Mi consultorio"} · Nutrición deportiva</p>
        <h1 className="mt-2 text-5xl">Informe antropométrico</h1>
      </header>

      <section className="grid gap-x-8 gap-y-1 border-2 border-t-0 border-primary bg-white p-6 sm:grid-cols-2">
        <p><span className="label">Paciente</span><br /><strong>{c?.full_name}</strong></p>
        <p><span className="label">Fecha de medición</span><br /><strong>{new Date(s.measured_on + "T00:00:00").toLocaleDateString("es-EC")}</strong></p>
        <p><span className="label">Edad</span><br />{age !== null ? `${age} años` : "—"}</p>
        <p><span className="label">Deporte</span><br />{c?.sport ?? "—"}</p>
        <p><span className="label">Peso / Estatura</span><br />{raw.basic?.mass_kg ?? "—"} kg · {raw.basic?.height_cm ?? "—"} cm</p>
        <p><span className="label">Protocolo</span><br />{s.protocol}</p>
      </section>

      <div className="mt-6"><ResultsView results={(results ?? []) as StoredResult[]} /></div>

      {s.patient_note && (
        <section className="mt-6 break-inside-avoid border-l-8 border-secondary bg-white p-4">
          <p className="label">Nota del profesional</p>
          <p>{s.patient_note}</p>
        </section>
      )}
      {s.next_checkup_date && s.show_next_checkup_to_patient && (
        <p className="mt-4"><span className="label">Próximo control</span><br /><strong>{new Date(s.next_checkup_date + "T00:00:00").toLocaleDateString("es-EC")}</strong></p>
      )}

      <footer className="mt-8 border-t-4 border-accent pt-3 text-sm">
        <p>Medido por {coach.full_name}. Los resultados son estimaciones antropométricas con fuente citada; no constituyen un diagnóstico.</p>
      </footer>
    </article>
  );
}
