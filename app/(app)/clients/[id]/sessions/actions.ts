"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth";
import { ageYears } from "@/lib/age";
import { computeSession, rawSchema } from "@/lib/calc";
import { formToRaw } from "@/lib/session-form";

const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

type Ctx = Awaited<ReturnType<typeof getContext>>;

/** Calcula las fórmulas verificadas y guarda un resultado por fórmula/versión (no sobrescribe versiones previas). */
async function storeResults(ctx: Ctx, session: { id: string; studio_id: string; raw: unknown; measured_on: string }, client: { birth_date: string | null; biological_sex: string | null }) {
  const calc = computeSession(session.raw, {
    ageYears: ageYears(client.birth_date, new Date(session.measured_on + "T00:00:00")),
    sex: client.biological_sex === "M" || client.biological_sex === "F" ? client.biological_sex : null,
  });
  if (calc.results.length) {
    const rows = calc.results.map((r) => ({
      studio_id: session.studio_id,
      session_id: session.id,
      formula_id: r.formula_id,
      formula_version: r.formula_version,
      output: { title: r.title, citation: r.citation, ...r.output },
    }));
    const { error } = await ctx.supabase
      .from("measurement_results")
      .upsert(rows, { onConflict: "session_id,formula_id,formula_version", ignoreDuplicates: true });
    if (error) throw new Error("No se pudieron guardar los resultados");
  }
}

export async function saveSessionAction(formData: FormData) {
  const ctx = await getContext();
  const { supabase, coach } = ctx;
  const id = text(formData, "id");
  const clientId = text(formData, "client_id");
  if (!clientId) redirect("/clients");
  const intent = text(formData, "intent") === "final" ? "final" : "draft";
  const supersedes = text(formData, "supersedes_id");
  const base = id ? `/clients/${clientId}/sessions/${id}/edit` : `/clients/${clientId}/sessions/new`;
  const qs = !id && supersedes ? `supersedes=${supersedes}&` : "";
  const fail = (msg: string): never => redirect(`${base}?${qs}error=${encodeURIComponent(msg)}`);

  const raw = formToRaw(formData);
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) fail("Hay valores inválidos: usa números positivos.");
  if (intent === "final" && Object.keys(raw).length === 0) fail("Registra al menos una medida antes de finalizar.");

  const { data: client } = await supabase
    .from("clients").select("id, birth_date, biological_sex, guardian_consent").eq("id", clientId).maybeSingle();
  if (!client) redirect("/clients");

  const fields = {
    measured_on: text(formData, "measured_on") ?? new Date().toISOString().slice(0, 10),
    protocol: text(formData, "protocol") ?? "ISAK",
    raw,
    patient_note: text(formData, "patient_note"),
    next_checkup_date: text(formData, "next_checkup_date"),
    show_next_checkup_to_patient: formData.get("show_next_checkup_to_patient") === "on",
  };

  let sessionId = id;
  if (id) {
    const { data: cur } = await supabase.from("measurement_sessions").select("status").eq("id", id).maybeSingle();
    if (!cur) redirect(`/clients/${clientId}?tab=mediciones`);
    if (cur.status === "final") fail("Una sesión finalizada no se puede editar. Crea una sesión que la corrija.");
    const { error } = await supabase.from("measurement_sessions").update(fields).eq("id", id);
    if (error) fail("No se pudo guardar la sesión.");
  } else {
    const { data, error } = await supabase
      .from("measurement_sessions")
      .insert({ ...fields, studio_id: coach.studio_id, client_id: clientId, measured_by: coach.id, supersedes_id: supersedes })
      .select("id")
      .single();
    if (error || !data) fail("No se pudo crear la sesión.");
    sessionId = data!.id;
  }

  if (intent === "final" && sessionId) {
    try {
      await storeResults(ctx, { id: sessionId, studio_id: coach.studio_id, raw, measured_on: fields.measured_on }, client);
    } catch {
      redirect(`/clients/${clientId}/sessions/${sessionId}/edit?error=${encodeURIComponent("No se pudieron calcular los resultados. La sesión sigue como borrador.")}`);
    }
    const { error } = await supabase.from("measurement_sessions").update({ status: "final" }).eq("id", sessionId);
    if (error) redirect(`/clients/${clientId}/sessions/${sessionId}/edit?error=${encodeURIComponent("No se pudo finalizar la sesión.")}`);
    const a = ageYears(client.birth_date);
    if (a !== null && a < 18 && !client.guardian_consent) {
      await supabase.rpc("log_event", { p_studio: coach.studio_id, p_action: "minor.consent_missing_proceeded", p_entity: "clients", p_entity_id: clientId });
    }
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/sessions/${sessionId}`);
}

/** Recalcula una sesión (p. ej. tras publicar una nueva versión de fórmula): agrega filas nuevas, no sobrescribe. */
export async function recalcSessionAction(formData: FormData) {
  const ctx = await getContext();
  const sessionId = text(formData, "session_id");
  const clientId = text(formData, "client_id");
  if (!sessionId || !clientId) redirect("/clients");
  const { data: s } = await ctx.supabase.from("measurement_sessions").select("id, studio_id, raw, measured_on, client_id").eq("id", sessionId).maybeSingle();
  const { data: c } = await ctx.supabase.from("clients").select("birth_date, biological_sex").eq("id", clientId).maybeSingle();
  if (!s || !c) redirect(`/clients/${clientId}`);
  await storeResults(ctx, s, c);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  redirect(`/clients/${clientId}/sessions/${sessionId}`);
}
