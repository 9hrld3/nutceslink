import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import LineChart from "@/components/LineChart";
import PrintButton from "@/components/PrintButton";

type Val = Record<string, number>;

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", id).maybeSingle();
  if (!client) notFound();

  const { data: sessions } = await supabase
    .from("measurement_sessions").select("id, measured_on, raw")
    .eq("client_id", id).eq("status", "final").order("measured_on", { ascending: true });
  const ids = (sessions ?? []).map((s) => s.id);
  const { data: res } = ids.length
    ? await supabase.from("measurement_results").select("session_id, formula_id, formula_version, output").in("session_id", ids)
    : { data: [] as { session_id: string; formula_id: string; formula_version: string; output: { values?: Val } }[] };

  // Último resultado (por versión) de cada fórmula, por sesión.
  const byKey = new Map<string, { version: string; values: Val }>();
  for (const r of res ?? []) {
    const k = `${r.session_id}|${r.formula_id}`;
    const cur = byKey.get(k);
    if (!cur || r.formula_version > cur.version) byKey.set(k, { version: r.formula_version, values: (r.output as { values?: Val }).values ?? {} });
  }
  const val = (sid: string, f: string, key: string): number | null => byKey.get(`${sid}|${f}`)?.values[key] ?? null;

  const rows = (sessions ?? []).map((s) => {
    const raw = s.raw as { basic?: { mass_kg?: number } };
    return {
      id: s.id,
      date: new Date(s.measured_on + "T00:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "2-digit" }),
      mass: raw.basic?.mass_kg ?? null,
      bmi: val(s.id, "bmi", "bmi"),
      sum3: val(s.id, "skinfold_sum_3", "sum_mm"),
      sumAll: val(s.id, "skinfold_sum_measured", "sum_mm"),
      sitesCount: val(s.id, "skinfold_sum_measured", "sites_count"),
      endo: val(s.id, "somatotype_heath_carter", "endomorphy"),
      meso: val(s.id, "somatotype_heath_carter", "mesomorphy"),
      ecto: val(s.id, "somatotype_heath_carter", "ectomorphy"),
    };
  });
  const labels = rows.map((r) => r.date);
  const sitesVary = new Set(rows.map((r) => r.sitesCount).filter((v) => v !== null)).size > 1;
  const f = (v: number | null) => (v === null ? "—" : v);

  return (
    <>
      <Link href={`/clients/${id}?tab=mediciones`} className="label underline no-print">← {client.full_name}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl text-primary">Progreso</h1>
        <PrintButton label="Imprimir comparación" />
      </div>

      {rows.length < 2 ? (
        <p className="border-2 border-dashed border-primary p-6">
          {rows.length === 0 ? "Aún no hay sesiones finalizadas." : "Hay una sola sesión finalizada: se necesitan al menos dos para comparar."}
        </p>
      ) : null}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto border-2 border-primary bg-white">
            <table className="w-full text-left">
              <thead className="bg-primary text-paper">
                <tr className="label">
                  <th className="p-2">Fecha</th><th className="p-2">Peso (kg)</th><th className="p-2">IMC</th>
                  <th className="p-2">Σ3 (mm)</th><th className="p-2">Σ medidos (mm)</th>
                  <th className="p-2">Endo</th><th className="p-2">Meso</th><th className="p-2">Ecto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t-2 border-paper">
                    <td className="p-2"><Link className="underline" href={`/clients/${id}/sessions/${r.id}`}>{r.date}</Link></td>
                    <td className="p-2">{f(r.mass)}</td><td className="p-2">{f(r.bmi)}</td>
                    <td className="p-2">{f(r.sum3)}</td><td className="p-2">{f(r.sumAll)}</td>
                    <td className="p-2">{f(r.endo)}</td><td className="p-2">{f(r.meso)}</td><td className="p-2">{f(r.ecto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sitesVary && (
            <p className="mt-3 border-l-4 border-accent bg-white p-3 text-sm">
              La cantidad de pliegues medidos cambió entre sesiones: la columna «Σ medidos» no es comparable. Usa Σ3 (tríceps, subescapular, supraespinal).
            </p>
          )}

          {rows.length >= 2 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <LineChart title="Peso" unit="kg" labels={labels} series={[{ name: "Peso", color: "#12355b", values: rows.map((r) => r.mass) }]} />
              <LineChart title="Σ3 pliegues" unit="mm" labels={labels} series={[{ name: "Σ3", color: "#4fa3a5", values: rows.map((r) => r.sum3) }]} />
              <LineChart title="Somatotipo" labels={labels} series={[
                { name: "Endomorfia", color: "#12355b", values: rows.map((r) => r.endo) },
                { name: "Mesomorfia", color: "#4fa3a5", values: rows.map((r) => r.meso) },
                { name: "Ectomorfia", color: "#f4b942", values: rows.map((r) => r.ecto) },
              ]} />
              <LineChart title="IMC" labels={labels} series={[{ name: "IMC", color: "#0b1b2b", values: rows.map((r) => r.bmi) }]} />
            </div>
          )}
          <p className="mt-6 text-sm opacity-70">% de grasa: se mostrará cuando se verifique la fuente original de las fórmulas (hoy pendientes).</p>
        </>
      )}
    </>
  );
}
