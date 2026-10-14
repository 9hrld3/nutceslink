import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import PlanEditor from "@/components/PlanEditor";
import { planSchema } from "@/lib/plan";

export default async function PlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  const { supabase } = await getContext();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, plan_content, coach_approved, approved_at, approved_by, clients(full_name)")
    .eq("id", planId)
    .eq("client_id", id)
    .maybeSingle();
  if (!plan) notFound();

  const parsed = planSchema.safeParse(plan.plan_content);
  let approverName: string | null = null;
  if (plan.approved_by) {
    const { data: a } = await supabase.from("coaches").select("full_name").eq("id", plan.approved_by).maybeSingle();
    approverName = a?.full_name ?? null;
  }
  const c = plan.clients as unknown as { full_name: string } | { full_name: string }[] | null;
  const clientName = Array.isArray(c) ? c[0]?.full_name : c?.full_name;

  return (
    <>
      <Link href={`/clients/${id}`} className="label underline">← {clientName}</Link>
      <h1 className="mb-6 mt-2 text-5xl text-primary">Plan nutricional</h1>
      {parsed.success ? (
        <PlanEditor planId={plan.id} initial={parsed.data} approved={plan.coach_approved} approvedAt={plan.approved_at} approvedBy={approverName} />
      ) : (
        <p role="alert" className="border-l-4 border-accent bg-white p-4">El contenido de este plan no tiene el formato esperado.</p>
      )}
    </>
  );
}
