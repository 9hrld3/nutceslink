import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { ageYears, isMinorWithoutConsent } from "@/lib/age";
import { ClientDataForm, ClientHistoryForm, ClientLifestyleForm, type ClientRow } from "@/components/ClientForm";
import GeneratePlanButton from "@/components/GeneratePlanButton";
import { deleteClientAction } from "../actions";

const TABS = [
  ["datos", "Datos"],
  ["historia", "Historia"],
  ["estilo", "Estilo de vida"],
  ["mediciones", "Mediciones"],
  ["planes", "Planes"],
] as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { error, saved, tab: tabParam } = await searchParams;
  const tab = TABS.some(([k]) => k === tabParam) ? (tabParam as (typeof TABS)[number][0]) : "datos";
  const { supabase } = await getContext();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  const age = ageYears(client.birth_date);
  const minorNoConsent = isMinorWithoutConsent(client);

  return (
    <>
      <Link href="/clients" className="label underline">← Clientes</Link>
      <h1 className="mt-2 text-5xl text-primary">{client.full_name}</h1>
      {age !== null && <p className="label mt-1">{age} años{age < 18 ? " · menor de edad" : ""}</p>}

      {minorNoConsent && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l-8 border-red-700 bg-white p-4">
          <p><strong>Menor de edad sin consentimiento del representante.</strong> Puedes seguir trabajando; las acciones sensibles quedan auditadas.</p>
          <Link href={`/clients/${id}?tab=datos#representante`} className="btn btn-primary">Registrar consentimiento</Link>
        </div>
      )}
      {error && <p role="alert" className="mt-4 border-l-4 border-accent bg-white p-3">{error}</p>}
      {saved && <p className="mt-4 border-l-4 border-secondary bg-white p-3">Cambios guardados.</p>}

      <nav aria-label="Secciones de la ficha" className="mt-6 flex flex-wrap gap-1 border-b-4 border-primary">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/clients/${id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`label px-4 py-2 ${tab === k ? "bg-primary text-paper" : "bg-white text-primary hover:bg-paper"}`}>
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        {tab === "datos" && (
          <>
            <ClientDataForm client={client as ClientRow} groups={(await supabase.from("client_groups").select("id, name").eq("active", true).order("name")).data ?? []} />
            <form action={deleteClientAction} className="mt-6">
              <input type="hidden" name="id" value={client.id} />
              <button className="btn btn-ghost text-sm">Eliminar cliente y sus datos</button>
            </form>
          </>
        )}
        {tab === "historia" && <ClientHistoryForm client={client as ClientRow} />}
        {tab === "estilo" && <ClientLifestyleForm client={client as ClientRow} />}
        {tab === "mediciones" && <Measurements clientId={id} />}
        {tab === "planes" && <Plans clientId={id} client={client} />}
      </section>
    </>
  );
}

async function Measurements({ clientId }: { clientId: string }) {
  const { supabase } = await getContext();
  const { data: sessions } = await supabase
    .from("measurement_sessions").select("id, measured_on, status, protocol, supersedes_id")
    .eq("client_id", clientId).order("measured_on", { ascending: false }).order("created_at", { ascending: false });
  const finals = (sessions ?? []).filter((s) => s.status === "final").length;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href={`/clients/${clientId}/sessions/new`} className="btn btn-accent">Nueva sesión de medición</Link>
        <Link href={`/clients/${clientId}/progress`} className="btn btn-ghost">Ver progreso{finals < 2 ? " (necesita 2 sesiones finalizadas)" : ""}</Link>
      </div>
      {!sessions?.length ? (
        <p className="border-2 border-dashed border-primary p-6">Sin sesiones de medición todavía.</p>
      ) : (
        <ul className="divide-y-2 divide-paper border-2 border-primary bg-white">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/clients/${clientId}/sessions/${s.id}`} className="flex items-center justify-between p-4 hover:bg-paper">
                <span>{new Date(s.measured_on + "T00:00:00").toLocaleDateString("es-EC")} · {s.protocol}{s.supersedes_id ? " · corrección" : ""}</span>
                <span className={`label px-2 text-ink ${s.status === "final" ? "bg-secondary" : "bg-accent"}`}>{s.status === "final" ? "Finalizada" : "Borrador"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Plans({ clientId, client }: { clientId: string; client: { data_consent: boolean; birth_date: string | null; guardian_consent: boolean } }) {
  const { supabase } = await getContext();
  const { data: plans } = await supabase
    .from("nutrition_plans").select("id, calories_target, status, coach_approved, created_at")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  const { data: finals } = await supabase
    .from("measurement_sessions").select("id, measured_on")
    .eq("client_id", clientId).eq("status", "final").order("measured_on", { ascending: false });
  const age = ageYears(client.birth_date);
  return (
    <>
      <GeneratePlanButton
        clientId={clientId}
        hasConsent={client.data_consent}
        isMinor={age !== null && age < 18}
        minorWithoutConsent={isMinorWithoutConsent(client)}
        sessions={(finals ?? []).map((s) => ({ id: s.id, label: new Date(s.measured_on + "T00:00:00").toLocaleDateString("es-EC") }))}
      />
      {!!plans?.length && (
        <ul className="mt-6 divide-y-2 divide-paper border-2 border-primary bg-white">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/clients/${clientId}/plans/${p.id}`} className="flex items-center justify-between p-4 hover:bg-paper">
                <span>{new Date(p.created_at).toLocaleDateString("es-EC")} · {p.calories_target ?? "—"} kcal</span>
                <span className={`label px-2 text-ink ${p.coach_approved ? "bg-secondary" : "bg-accent"}`}>{p.coach_approved ? "Aprobado" : "Borrador"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
