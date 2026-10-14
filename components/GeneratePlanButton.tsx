"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  clientId: string;
  /** Adultos: se exige el consentimiento de datos de salud. */
  hasConsent: boolean;
  /** Menores: solo aviso (decisión del dueño); el sistema no bloquea y lo audita. */
  isMinor: boolean;
  minorWithoutConsent: boolean;
  sessions: { id: string; label: string }[];
};

export default function GeneratePlanButton({ clientId, hasConsent, isMinor, minorWithoutConsent, sessions }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");

  async function generate() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("generate_nutrition_plan", {
      body: { client_id: clientId, session_id: sessionId || undefined },
    });
    if (error) {
      let msg = "No se pudo generar el plan. Intenta de nuevo.";
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch {}
      setBusy(false);
      return setError(msg);
    }
    router.push(`/clients/${clientId}/plans/${data.plan_id}`);
  }

  if (!hasConsent && !isMinor) {
    return (
      <p className="border-l-4 border-accent bg-white p-4">
        Falta el <strong>consentimiento de datos de salud</strong>. Márcalo en la ficha antes de generar un plan.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {minorWithoutConsent && (
        <p role="alert" className="border-l-4 border-red-700 bg-white p-3 text-sm">
          Menor sin consentimiento del representante registrado. Puedes continuar; la acción quedará auditada.
        </p>
      )}
      {sessions.length > 0 && (
        <label className="block max-w-sm">
          <span className="label">Basar el plan en la medición</span>
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="field mt-1">
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            <option value="">Sin medición</option>
          </select>
        </label>
      )}
      <button onClick={generate} disabled={busy} className="btn btn-accent">
        {busy ? "Generando plan… (hasta 1 min)" : "Generar plan con IA"}
      </button>
      {error && <p role="alert" className="border-l-4 border-accent bg-white p-3">{error}</p>}
    </div>
  );
}
