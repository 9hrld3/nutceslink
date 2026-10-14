"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DAYS, DAY_LABEL, MEALS, MEAL_LABEL, planSchema, type Plan } from "@/lib/plan";

type Props = {
  planId: string;
  initial: Plan;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
};

export default function PlanEditor({ planId, initial, approved, approvedAt, approvedBy }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(fn: (p: Plan) => void) {
    setPlan((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
    setMsg("");
  }

  async function save(): Promise<boolean> {
    const parsed = planSchema.safeParse(plan);
    if (!parsed.success) {
      setMsg("Hay campos inválidos (revisa que las cantidades sean números).");
      return false;
    }
    const supabase = createClient();
    const p = parsed.data;
    const { error } = await supabase
      .from("nutrition_plans")
      .update({ plan_content: p, calories_target: p.calories_target, protein_g: p.protein_g, carbs_g: p.carbs_g, fat_g: p.fat_g })
      .eq("id", planId);
    if (error) {
      setMsg("No se pudo guardar.");
      return false;
    }
    setDirty(false);
    return true;
  }

  async function onSave() {
    setBusy(true);
    const ok = await save();
    setBusy(false);
    if (ok) {
      setMsg(approved ? "Guardado. El plan volvió a borrador: debes aprobarlo de nuevo." : "Cambios guardados.");
      router.refresh();
    }
  }

  async function onApprove() {
    setBusy(true);
    if (dirty && !(await save())) return setBusy(false);
    const supabase = createClient();
    const { error } = await supabase.rpc("approve_plan", { p_plan_id: planId });
    setBusy(false);
    if (error) return setMsg("No se pudo aprobar: " + error.message);
    setMsg("Plan aprobado.");
    router.refresh();
  }

  const isApproved = approved && !dirty;
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-8">
      <div className={`border-l-8 p-4 ${isApproved ? "border-secondary bg-white" : "border-accent bg-white"}`}>
        {isApproved ? (
          <p><strong>Aprobado</strong> por {approvedBy ?? "—"} el {approvedAt ? new Date(approvedAt).toLocaleString("es-EC") : "—"}. Si editas el contenido, vuelve a borrador.</p>
        ) : (
          <p><strong>Borrador generado por IA.</strong> Revísalo, ajústalo y apruébalo. No es enviable hasta que lo apruebes.</p>
        )}
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {([["calories_target", "Calorías"], ["protein_g", "Proteína (g)"], ["carbs_g", "Carbos (g)"], ["fat_g", "Grasas (g)"]] as const).map(([k, l]) => (
          <label key={k} className="block">
            <span className="label">{l}</span>
            <input type="number" className="field mt-1" value={plan[k]} onChange={(e) => edit((p) => { p[k] = num(e.target.value); })} />
          </label>
        ))}
      </section>

      <label className="block">
        <span className="label">Justificación del cálculo</span>
        <textarea rows={3} className="field mt-1" value={plan.reasoning} onChange={(e) => edit((p) => { p.reasoning = e.target.value; })} />
      </label>

      <section>
        <h2 className="mb-3 text-3xl text-primary">Plan semanal</h2>
        <div className="space-y-3">
          {DAYS.map((d) => (
            <details key={d} className="border-2 border-primary bg-white">
              <summary className="cursor-pointer bg-primary px-4 py-2 font-display text-xl font-extrabold uppercase text-paper">{DAY_LABEL[d]}</summary>
              <div className="space-y-4 p-4">
                {MEALS.map((m) => (
                  <div key={m} className="grid gap-2 sm:grid-cols-[140px_1fr_90px]">
                    <span className="label self-center">{MEAL_LABEL[m]}</span>
                    <div className="space-y-1">
                      <input className="field" aria-label={`${DAY_LABEL[d]} ${MEAL_LABEL[m]} nombre`} value={plan.weekly_plan[d][m].name} onChange={(e) => edit((p) => { p.weekly_plan[d][m].name = e.target.value; })} />
                      <textarea rows={2} className="field" aria-label={`${DAY_LABEL[d]} ${MEAL_LABEL[m]} descripción`} value={plan.weekly_plan[d][m].description} onChange={(e) => edit((p) => { p.weekly_plan[d][m].description = e.target.value; })} />
                    </div>
                    <input type="number" className="field h-fit" aria-label="kcal" value={plan.weekly_plan[d][m].calories} onChange={(e) => edit((p) => { p.weekly_plan[d][m].calories = num(e.target.value); })} />
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-3xl text-primary">Lista de compras</h2>
        <ul className="space-y-2">
          {plan.shopping_list.map((s, i) => (
            <li key={i} className="grid grid-cols-[1fr_160px] gap-2">
              <input className="field" aria-label="Producto" value={s.item} onChange={(e) => edit((p) => { p.shopping_list[i].item = e.target.value; })} />
              <input className="field" aria-label="Cantidad" value={s.quantity} onChange={(e) => edit((p) => { p.shopping_list[i].quantity = e.target.value; })} />
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {([["pre_workout", "Pre-entreno"], ["during", "Durante"], ["post_workout", "Post-entreno"]] as const).map(([k, l]) => (
          <label key={k} className="block">
            <span className="label">{l}</span>
            <textarea rows={4} className="field mt-1" value={plan.timing[k]} onChange={(e) => edit((p) => { p.timing[k] = e.target.value; })} />
          </label>
        ))}
      </section>
      <label className="block">
        <span className="label">Recomendaciones deportivas</span>
        <textarea rows={3} className="field mt-1" value={plan.sport_recommendations} onChange={(e) => edit((p) => { p.sport_recommendations = e.target.value; })} />
      </label>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t-2 border-primary bg-paper px-4 py-3">
        <button className="btn btn-ghost" disabled={busy || !dirty} onClick={onSave}>Guardar cambios</button>
        <button className="btn btn-primary" disabled={busy || isApproved} onClick={onApprove}>
          {isApproved ? "Aprobado" : "Aprobar plan"}
        </button>
        {msg && <span role="status" className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
