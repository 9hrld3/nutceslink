export type StoredResult = {
  id: string;
  formula_id: string;
  formula_version: string;
  output: {
    title?: string;
    citation?: { authors: string; year: number; title: string; source: string };
    values?: Record<string, number>;
    warnings?: string[];
  };
};

const VALUE_LABEL: Record<string, string> = {
  bmi: "IMC (kg/m²)",
  sum_mm: "Suma (mm)",
  sites_count: "Sitios incluidos",
  endomorphy: "Endomorfia",
  mesomorphy: "Mesomorfia",
  ectomorphy: "Ectomorfia",
  hwr: "Índice altura/∛peso (HWR)",
  x: "Coordenada X",
  y: "Coordenada Y",
};

/** Resultados con su fuente y versión visibles en cada cálculo. */
export default function ResultsView({ results }: { results: StoredResult[] }) {
  if (!results.length) {
    return <p className="border-2 border-dashed border-primary p-6">Aún no hay resultados calculados.</p>;
  }
  return (
    <div className="space-y-4">
      {results.map((r) => (
        <article key={r.id} className="break-inside-avoid border-2 border-primary bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 bg-primary px-4 py-2 text-paper">
            <h3 className="text-xl">{r.output.title ?? r.formula_id}</h3>
            <span className="label">fórmula {r.formula_id} · v{r.formula_version}</span>
          </header>
          <dl className="grid gap-x-6 gap-y-1 p-4 sm:grid-cols-3">
            {Object.entries(r.output.values ?? {}).map(([k, v]) => (
              <div key={k}>
                <dt className="label">{VALUE_LABEL[k] ?? k}</dt>
                <dd className="text-2xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          {!!r.output.warnings?.length && (
            <ul className="mx-4 mb-3 list-disc border-l-4 border-accent bg-paper py-2 pl-8 pr-3 text-sm">
              {r.output.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {r.output.citation && (
            <p className="border-t-2 border-paper px-4 py-2 text-sm opacity-80">
              Fuente: {r.output.citation.authors}
              {r.output.citation.year ? ` (${r.output.citation.year})` : ""}. {r.output.citation.title}. <em>{r.output.citation.source}</em>
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
