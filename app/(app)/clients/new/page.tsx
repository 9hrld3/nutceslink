import { getContext } from "@/lib/auth";
import { ClientDataForm } from "@/components/ClientForm";

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await getContext();
  const { data: groups } = await supabase.from("client_groups").select("id, name").eq("active", true).order("name");
  return (
    <>
      <h1 className="mb-6 text-5xl text-primary">Nuevo cliente</h1>
      {error && <p role="alert" className="mb-4 border-l-4 border-accent bg-white p-3">{error}</p>}
      <ClientDataForm groups={groups ?? []} />
    </>
  );
}
