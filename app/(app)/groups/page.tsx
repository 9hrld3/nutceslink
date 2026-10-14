import Link from "next/link";
import { getContext } from "@/lib/auth";
import { assignClientAction, createGroupAction } from "./actions";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await getContext();
  const { data: groups } = await supabase.from("client_groups").select("id, name").eq("active", true).order("name");
  const { data: clients } = await supabase.from("clients").select("id, full_name, group_id").order("full_name");
  const members = (gid: string | null) => (clients ?? []).filter((c) => (c.group_id ?? null) === gid);

  return (
    <>
      <h1 className="text-5xl text-primary">Grupos</h1>
      <p className="mt-2 opacity-80">Agrupa a tus clientes (por equipo, categoría o programa).</p>
      {error && <p role="alert" className="mt-4 border-l-4 border-accent bg-white p-3">{error}</p>}

      <form action={createGroupAction} className="mt-6 flex max-w-lg gap-3">
        <input name="name" required placeholder="Nombre del grupo (ej. Sub-17)" className="field" />
        <button className="btn btn-accent whitespace-nowrap">Crear grupo</button>
      </form>

      <div className="mt-8 space-y-6">
        {(groups ?? []).map((g) => (
          <section key={g.id} className="border-2 border-primary bg-white">
            <h2 className="bg-primary px-4 py-2 text-2xl text-paper">{g.name} <span className="label ml-2 text-accent">{members(g.id).length} clientes</span></h2>
            <ul className="divide-y-2 divide-paper">
              {members(g.id).map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3">
                  <Link href={`/clients/${c.id}`} className="underline">{c.full_name}</Link>
                  <form action={assignClientAction}>
                    <input type="hidden" name="client_id" value={c.id} />
                    <input type="hidden" name="group_id" value="" />
                    <button className="text-sm underline">Quitar</button>
                  </form>
                </li>
              ))}
              {!members(g.id).length && <li className="p-3 text-sm opacity-70">Sin clientes.</li>}
            </ul>
          </section>
        ))}

        <section className="border-2 border-dashed border-primary bg-white">
          <h2 className="px-4 py-2 text-2xl text-primary">Sin grupo</h2>
          <ul className="divide-y-2 divide-paper">
            {members(null).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Link href={`/clients/${c.id}`} className="underline">{c.full_name}</Link>
                {!!groups?.length && (
                  <form action={assignClientAction} className="flex gap-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <select name="group_id" className="field !w-auto" aria-label={`Grupo de ${c.full_name}`}>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button className="btn btn-ghost !py-1">Asignar</button>
                  </form>
                )}
              </li>
            ))}
            {!members(null).length && <li className="p-3 text-sm opacity-70">Todos los clientes tienen grupo.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
