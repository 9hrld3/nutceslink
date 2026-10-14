"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth";

const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const list = (f: FormData, k: string) =>
  String(f.get(k) ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

export async function saveClientAction(formData: FormData) {
  const { supabase, coach } = await getContext();
  const id = text(formData, "id");
  const section = text(formData, "section") ?? "datos";
  const back = id ? `/clients/${id}` : "/clients/new";
  const fail = (msg: string, tab = "datos") => redirect(`${back}?tab=${tab}&error=${encodeURIComponent(msg)}`);

  // ---- Historia clínica estructurada ----
  if (section === "historia" && id) {
    const { error } = await supabase.from("clients").update({
      medical_conditions: text(formData, "medical_conditions"),
      medical_history: {
        diagnoses: list(formData, "diagnoses"),
        medications: list(formData, "medications"),
        surgeries: text(formData, "surgeries"),
        family_history: text(formData, "family_history"),
        notes: text(formData, "notes"),
      },
    }).eq("id", id);
    if (error) fail("No se pudo guardar", "historia");
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}?tab=historia&saved=1`);
  }

  // ---- Estilo de vida ----
  if (section === "estilo" && id) {
    const { error } = await supabase.from("clients").update({
      lifestyle: {
        work: text(formData, "work"),
        stress_level: num(formData, "stress_level"),
        training_week: text(formData, "training_week"),
        sleep_usual_h: num(formData, "sleep_usual_h"),
        meal_times: {
          breakfast: text(formData, "meal_breakfast"),
          lunch: text(formData, "meal_lunch"),
          dinner: text(formData, "meal_dinner"),
        },
      },
    }).eq("id", id);
    if (error) fail("No se pudo guardar", "estilo");
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}?tab=estilo&saved=1`);
  }

  // ---- Datos ----
  const fullName = text(formData, "full_name");
  if (!fullName) fail("El nombre es obligatorio");
  const consent = formData.get("data_consent") === "on";
  const guardianConsent = formData.get("guardian_consent") === "on";
  const sex = text(formData, "biological_sex");
  const biological_sex = sex === "M" || sex === "F" ? sex : null;
  const groupId = text(formData, "group_id");

  const row = {
    full_name: fullName,
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    birth_date: text(formData, "birth_date"),
    biological_sex,
    gender: biological_sex === "M" ? "male" : biological_sex === "F" ? "female" : null,
    height_cm: num(formData, "height_cm"),
    weight_kg: num(formData, "weight_kg"),
    body_fat_pct: num(formData, "body_fat_pct"),
    sport: text(formData, "sport"),
    activity_level: text(formData, "activity_level"),
    goal: text(formData, "goal"),
    group_id: groupId,
    dietary_restrictions: list(formData, "dietary_restrictions"),
    allergies: list(formData, "allergies"),
    objectives: list(formData, "objectives"),
    guardian_name: text(formData, "guardian_name"),
    guardian_relationship: text(formData, "guardian_relationship"),
    guardian_phone: text(formData, "guardian_phone"),
    guardian_consent: guardianConsent,
    data_consent: consent,
  };

  if (id) {
    const { data: prev } = await supabase
      .from("clients").select("data_consent, consent_at, guardian_consent, guardian_consent_at").eq("id", id).maybeSingle();
    if (!prev) redirect("/clients");
    const now = new Date().toISOString();
    const consent_at = consent ? (prev.data_consent ? prev.consent_at : now) : null;
    const guardian_consent_at = guardianConsent ? (prev.guardian_consent ? prev.guardian_consent_at : now) : null;
    const { error } = await supabase.from("clients").update({ ...row, consent_at, guardian_consent_at }).eq("id", id);
    if (error) fail("No se pudo guardar");
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}?tab=datos&saved=1`);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...row,
      studio_id: coach.studio_id,
      coach_id: coach.id,
      consent_at: consent ? now : null,
      guardian_consent_at: guardianConsent ? now : null,
    })
    .select("id")
    .single();
  if (error || !data) fail("No se pudo crear el cliente");
  redirect(`/clients/${data!.id}`);
}

export async function deleteClientAction(formData: FormData) {
  const { supabase } = await getContext();
  const id = text(formData, "id");
  if (id) await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/clients");
  redirect("/clients");
}
