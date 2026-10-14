import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getContext } from "@/lib/auth";
import SessionForm from "@/components/SessionForm";

export default async function EditSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, sessionId } = await params;
  const { error } = await searchParams;
  const { supabase } = await getContext();
  const { data: s } = await supabase.from("measurement_sessions").select("*").eq("id", sessionId).eq("client_id", id).maybeSingle();
  if (!s) notFound();
  if (s.status === "final") redirect(`/clients/${id}/sessions/${sessionId}`);
  return (
    <>
      <Link href={`/clients/${id}?tab=mediciones`} className="label underline">← Mediciones</Link>
      <h1 className="mb-6 mt-2 text-5xl text-primary">Editar borrador</h1>
      {error && <p role="alert" className="mb-4 border-l-4 border-accent bg-white p-3">{error}</p>}
      <SessionForm clientId={id} session={s} />
    </>
  );
}
