"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth";

export async function createGroupAction(formData: FormData) {
  const { supabase, coach } = await getContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/groups?error=" + encodeURIComponent("Escribe un nombre"));
  const { error } = await supabase.from("client_groups").insert({ studio_id: coach.studio_id, name });
  if (error) redirect("/groups?error=" + encodeURIComponent("No se pudo crear (¿ya existe ese nombre?)"));
  revalidatePath("/groups");
  redirect("/groups");
}

export async function assignClientAction(formData: FormData) {
  const { supabase } = await getContext();
  const clientId = String(formData.get("client_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "") || null;
  if (clientId) await supabase.from("clients").update({ group_id: groupId }).eq("id", clientId);
  revalidatePath("/groups");
  redirect("/groups");
}
