import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createStudioAction } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (coach) redirect("/clients");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="bg-primary p-10 text-paper">
        <p className="label text-accent">Primer paso</p>
        <h1 className="mt-2 text-5xl">Crea tu consultorio</h1>
      </div>
      <form action={createStudioAction} className="space-y-4 border-2 border-t-0 border-primary bg-white p-10">
        <label className="block">
          <span className="label">Nombre del consultorio</span>
          <input name="name" className="field mt-1" required placeholder="Mi consultorio" />
        </label>
        <label className="block">
          <span className="label">Tu nombre</span>
          <input name="full_name" className="field mt-1" required placeholder="Nombre Apellido" />
        </label>
        {error && <p role="alert" className="border-l-4 border-accent bg-paper p-2 text-sm">{error}</p>}
        <button className="btn btn-primary w-full">Crear consultorio</button>
      </form>
    </main>
  );
}
