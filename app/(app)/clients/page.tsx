import Link from "next/link";
import { getContext } from "@/lib/auth";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await getContext();
  const { q } = await searchParams;
  let query = supabase.from("clients").select("id, full_name, sport, goal, status, data_consent").order("created_at", { ascending: false });
  if (q) query = query.ilike("full_name", `%${q.replace(/[%,]/g, "")}%`);
  const { data: clients } = await query;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl text-primary">Clientes</h1>
        <Link href="/clients/new" className="btn btn-accent">Nuevo cliente</Link>
      </div>
      <form className="mt-6">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre" className="field max-w-sm" />
      </form>
      {!clients?.length ? (
        <p className="mt-10 border-2 border-dashed border-primary p-10 text-center">
          {q ? "Sin resultados." : "Aún no tienes clientes. Crea el primero."}
        </p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-paper border-2 border-primary bg-white">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-paper">
                <span>
                  <strong>{c.full_name}</strong>
                  <span className="ml-3 text-sm opacity-70">{[c.sport, c.goal?.replace("_", " ")].filter(Boolean).join(" · ")}</span>
                </span>
                {!c.data_consent && <span className="label bg-accent px-2 text-ink">Sin consentimiento</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
