// Edge Function: genera un borrador de plan nutricional con IA (SPEC sección 6).
// Secretos requeridos: ANTHROPIC_API_KEY. Opcional: ANTHROPIC_MODEL (por defecto claude-sonnet-5).
// Nunca se loguea contenido médico ni el plan.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const DAILY_LIMIT_PER_STUDIO = 30;
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const MEALS = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"] as const;

// Mantener sincronizado con lib/plan.ts
const meal = z.object({ name: z.string().min(1), description: z.string(), calories: z.number().nonnegative() });
const day = z.object(Object.fromEntries(MEALS.map((m) => [m, meal])) as Record<(typeof MEALS)[number], typeof meal>);
const planSchema = z.object({
  calories_target: z.number().positive().transform(Math.round),
  protein_g: z.number().nonnegative().transform(Math.round),
  carbs_g: z.number().nonnegative().transform(Math.round),
  fat_g: z.number().nonnegative().transform(Math.round),
  reasoning: z.string(),
  weekly_plan: z.object(Object.fromEntries(DAYS.map((d) => [d, day])) as Record<(typeof DAYS)[number], typeof day>),
  shopping_list: z.array(z.object({ item: z.string(), quantity: z.string() })).min(1),
  sport_recommendations: z.string(),
  timing: z.object({ pre_workout: z.string(), during: z.string(), post_workout: z.string() }),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function age(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

function extractJson(raw: string) {
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error("sin JSON");
  return JSON.parse(raw.slice(s, e + 1));
}

const SYSTEM = `Eres un nutricionista deportivo experto. Generas planes para clientes en Ecuador usando SOLO alimentos disponibles localmente (arroz, papa, yuca, plátano, quinua, choclo, huevos, pollo, pescado, atún, carne, lentejas, fréjol, frutas locales, etc.).
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código.
Estructura exacta:
{"calories_target":int,"protein_g":int,"carbs_g":int,"fat_g":int,"reasoning":"breve justificación del cálculo",
"weekly_plan":{"monday":{"breakfast":M,"morning_snack":M,"lunch":M,"afternoon_snack":M,"dinner":M},"tuesday":{...},"wednesday":{...},"thursday":{...},"friday":{...},"saturday":{...},"sunday":{...}},
"shopping_list":[{"item":"...","quantity":"..."}],
"sport_recommendations":"...",
"timing":{"pre_workout":"...","during":"...","post_workout":"..."}}
Donde M = {"name":"nombre del plato","description":"alimentos con gramajes, máximo 15 palabras","calories":number}.
Incluye los 7 días y las 5 comidas por día. Respeta estrictamente restricciones y alergias. La suma diaria debe aproximar calories_target. Sé conciso para responder rápido.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No autenticado" }, 401);
    const { client_id, session_id } = await req.json().catch(() => ({}));
    if (!client_id || typeof client_id !== "string") return json({ error: "client_id requerido" }, 400);
    if (session_id !== undefined && typeof session_id !== "string") return json({ error: "session_id inválido" }, 400);

    // Cliente con el JWT del usuario: RLS decide qué puede ver.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
    if (!client) return json({ error: "Cliente no encontrado" }, 404);
    // Adultos: se exige el consentimiento. Menores: solo aviso y auditoría, no se bloquea (decisión de producto, configurable).
    const clientAge = age(client.birth_date);
    const isMinor = clientAge !== null && clientAge < 18;
    if (!client.data_consent && !isMinor) return json({ error: "El cliente no tiene consentimiento de datos de salud." }, 400);

    const { data: coach } = await supabase.from("coaches").select("id, role")
      .eq("user_id", user.id).eq("studio_id", client.studio_id).eq("active", true).maybeSingle();
    if (!coach || coach.role === "assistant") return json({ error: "Sin permiso" }, 403);

    if (isMinor && !client.guardian_consent) {
      await supabase.rpc("log_event", {
        p_studio: client.studio_id, p_action: "minor.consent_missing_proceeded", p_entity: "clients", p_entity_id: client.id,
      });
    }

    // Resumen estructurado de la sesión de medición (solo valores; sin identificadores).
    let sessionSummary = "";
    let sessionIdForPlan: string | null = null;
    if (session_id) {
      const { data: sess } = await supabase.from("measurement_sessions")
        .select("id, measured_on, raw, status").eq("id", session_id).eq("client_id", client.id).maybeSingle();
      if (!sess || sess.status !== "final") return json({ error: "Sesión de medición no encontrada." }, 404);
      sessionIdForPlan = sess.id;
      const { data: results } = await supabase.from("measurement_results")
        .select("formula_id, formula_version, output").eq("session_id", sess.id);
      const latest = new Map<string, { v: string; values: Record<string, number> }>();
      for (const r of results ?? []) {
        const cur = latest.get(r.formula_id);
        if (!cur || r.formula_version > cur.v) latest.set(r.formula_id, { v: r.formula_version, values: r.output?.values ?? {} });
      }
      const lines: string[] = [`Fecha: ${sess.measured_on}`];
      const basic = sess.raw?.basic ?? {};
      if (basic.mass_kg) lines.push(`Peso: ${basic.mass_kg} kg`);
      if (basic.height_cm) lines.push(`Estatura: ${basic.height_cm} cm`);
      for (const [fid, { values }] of latest) {
        lines.push(`${fid}: ` + Object.entries(values).map(([k, v]) => `${k}=${v}`).join(", "));
      }
      sessionSummary = "\nÚLTIMA MEDICIÓN ANTROPOMÉTRICA (estimaciones):\n" + lines.join("\n");
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase.from("nutrition_plans").select("id", { count: "exact", head: true })
      .eq("studio_id", client.studio_id).eq("ai_generated", true).gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= DAILY_LIMIT_PER_STUDIO) return json({ error: "Límite diario de planes alcanzado." }, 429);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Servicio de IA no configurado." }, 500);
    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";
    const anthropic = new Anthropic({ apiKey });

    // Datos mínimos: no se envía nombre, teléfono ni correo.
    const profile = [
      `Edad: ${age(client.birth_date) ?? "no indicada"}`,
      `Sexo biológico: ${client.biological_sex ?? client.gender ?? "no indicado"}`,
      `Peso: ${client.weight_kg ?? "?"} kg | Talla: ${client.height_cm ?? "?"} cm | % grasa: ${client.body_fat_pct ?? "?"}`,
      `Deporte: ${client.sport ?? "no indicado"} | Nivel: ${client.activity_level ?? "no indicado"}`,
      `Objetivo: ${client.goal ?? "no indicado"}`,
      `Restricciones: ${client.dietary_restrictions?.join(", ") || "ninguna"}`,
      `Alergias: ${client.allergies?.join(", ") || "ninguna"}`,
      `Objetivos: ${client.objectives?.join(", ") || "no indicados"}`,
      `Condiciones médicas: ${client.medical_conditions || "ninguna"}`,
    ].join("\n") + sessionSummary;

    let plan: z.infer<typeof planSchema> | null = null;
    for (let attempt = 0; attempt < 2 && !plan; attempt++) {
      try {
        const msg = await anthropic.messages.create({
          model,
          max_tokens: 12000,
          system: SYSTEM,
          messages: [{ role: "user", content: `Genera el plan semanal para este cliente:\n${profile}` }],
        });
        const block = msg.content.find((b: { type: string }) => b.type === "text") as { text: string } | undefined;
        const parsed = planSchema.safeParse(extractJson(block?.text ?? ""));
        if (parsed.success) plan = parsed.data;
      } catch {
        // reintento; no se registra contenido
      }
    }
    if (!plan) return json({ error: "La IA devolvió un plan inválido. Intenta de nuevo." }, 502);

    const today = new Date();
    const until = new Date(today.getTime() + 28 * 86400000);
    const { data: row, error } = await supabase.from("nutrition_plans").insert({
      studio_id: client.studio_id,
      client_id: client.id,
      coach_id: coach.id,
      measurement_session_id: sessionIdForPlan,
      calories_target: plan.calories_target,
      protein_g: plan.protein_g,
      carbs_g: plan.carbs_g,
      fat_g: plan.fat_g,
      plan_content: plan,
      ai_generated: true,
      ai_model: model,
      coach_approved: false,
      status: "draft",
      valid_from: today.toISOString().slice(0, 10),
      valid_until: until.toISOString().slice(0, 10),
    }).select("id").single();
    if (error || !row) return json({ error: "No se pudo guardar el plan." }, 500);

    return json({ plan_id: row.id });
  } catch {
    return json({ error: "Error interno." }, 500);
  }
});
