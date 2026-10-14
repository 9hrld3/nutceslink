import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import SessionForm from "@/components/SessionForm";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; supersedes?: string }>;
}) {
  const { id } = await params;
  const { error, supersedes } = await searchParams;
  const { supabase } = await getContext();
  const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", id).maybeSingle();
  if (!client) notFound();
  let prefill: unknown = undefined;
  if (supersedes) {
    const { data: prev } = await supabase.from("measurement_sessions").select("raw").eq("id", supersedes).eq("client_id", id).maybeSingle();
    prefill = prev?.raw;
  }
  return (
    <>
      <Link href={`/clients/${id}?tab=mediciones`} className="label underline">← {client.full_name}</Link>
      <h1 className="mb-6 mt-2 text-5xl text-primary">{supersedes ? "Sesión de corrección" : "Nueva sesión de medición"}</h1>
      {supersedes && <p className="mb-4 border-l-4 border-secondary bg-white p-3">Las medidas de la sesión anterior se copiaron como punto de partida. La anterior no se modifica.</p>}
      {error && <p role="alert" className="mb-4 border-l-4 border-accent bg-white p-3">{error}</p>}
      <SessionForm clientId={id} prefillRaw={prefill} supersedesId={supersedes ?? null} />
    </>
  );
}
