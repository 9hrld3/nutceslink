"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createStudioAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!name || !fullName) redirect("/onboarding?error=" + encodeURIComponent("Completa ambos campos"));
  const supabase = await createClient();
  const slug = `${slugify(name) || "studio"}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await supabase.rpc("create_studio", { p_name: name, p_slug: slug, p_full_name: fullName });
  if (error) redirect("/onboarding?error=" + encodeURIComponent("No se pudo crear el consultorio"));
  redirect("/clients");
}
