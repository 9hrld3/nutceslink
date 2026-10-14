import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, full_name, studio_id, role, studios(name)")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!coach) redirect("/onboarding");
  const studios = coach.studios as unknown as { name: string } | { name: string }[] | null;
  const studioName = Array.isArray(studios) ? studios[0]?.name : studios?.name;
  return { supabase, user, coach: { id: coach.id, full_name: coach.full_name, studio_id: coach.studio_id, role: coach.role }, studioName: studioName ?? "" };
}
