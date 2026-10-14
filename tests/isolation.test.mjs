// Test de aislamiento entre studios (SPEC sección 8). Requiere `supabase start`.
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... node tests/isolation.test.mjs
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) throw new Error('faltan variables de entorno');

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const run = Date.now();
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`);
  if (!ok) failed++;
};

async function makeUser(tag) {
  const email = `${tag}-${run}@test.local`, password = 'Test-pass-12345';
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { data: studioId, error: e3 } = await c.rpc('create_studio', { p_name: `Studio ${tag}`, p_slug: `${tag}-${run}`, p_full_name: `Coach ${tag}` });
  if (e3) throw e3;
  return { c, studioId };
}

const A = await makeUser('a');
const B = await makeUser('b');

// A crea cliente y plan en su studio
const { data: clientA, error: ecA } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Cliente A', data_consent: true }).select().single();
check('A crea cliente en su studio', !!clientA, ecA?.message);
const { data: planA, error: epA } = await A.c.from('nutrition_plans').insert({ studio_id: A.studioId, client_id: clientA.id, plan_content: { x: 1 } }).select().single();
check('A crea plan borrador', !!planA, epA?.message);

// B no puede leer nada de A
for (const t of ['studios', 'coaches', 'clients', 'nutrition_plans', 'audit_log']) {
  const { data } = await B.c.from(t).select('*').eq(t === 'studios' ? 'id' : 'studio_id', A.studioId);
  check(`B no lee ${t} de A`, (data ?? []).length === 0, JSON.stringify(data));
}
const { data: byId } = await B.c.from('clients').select('*').eq('id', clientA.id);
check('B no lee cliente de A por id', (byId ?? []).length === 0);

// B no puede insertar en studio de A
const ins1 = await B.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Intruso' });
check('B no inserta cliente en studio de A', !!ins1.error);
const ins2 = await B.c.from('nutrition_plans').insert({ studio_id: A.studioId, client_id: clientA.id, plan_content: {} });
check('B no inserta plan en studio de A', !!ins2.error);
// B no puede insertar en su studio referenciando cliente de A
const ins3 = await B.c.from('nutrition_plans').insert({ studio_id: B.studioId, client_id: clientA.id, plan_content: {} });
check('B no crea plan en su studio con cliente de A', !!ins3.error);

// B no puede actualizar / borrar datos de A (RLS filtra: 0 filas afectadas)
const upd = await B.c.from('clients').update({ full_name: 'Hackeado' }).eq('id', clientA.id).select();
check('B no actualiza cliente de A', !upd.error ? (upd.data ?? []).length === 0 : true);
const del = await B.c.from('clients').delete().eq('id', clientA.id).select();
check('B no borra cliente de A', !del.error ? (del.data ?? []).length === 0 : true);
const { data: still } = await admin.from('clients').select('full_name').eq('id', clientA.id).single();
check('cliente de A intacto', still?.full_name === 'Cliente A');

// B no puede mover una fila propia al studio de A
const { data: clientB } = await B.c.from('clients').insert({ studio_id: B.studioId, full_name: 'Cliente B' }).select().single();
const mv = await B.c.from('clients').update({ studio_id: A.studioId }).eq('id', clientB.id);
check('B no mueve su cliente al studio de A', !!mv.error);

// B no puede aprobar el plan de A
const ap = await B.c.rpc('approve_plan', { p_plan_id: planA.id });
check('B no aprueba plan de A', !!ap.error);

// Aprobación: nadie puede marcar aprobado por update directo, ni A
const direct = await A.c.from('nutrition_plans').update({ coach_approved: true, status: 'approved' }).eq('id', planA.id);
check('A no aprueba por update directo', !!direct.error);
const badIns = await A.c.from('nutrition_plans').insert({ studio_id: A.studioId, client_id: clientA.id, plan_content: {}, coach_approved: true, status: 'approved' });
check('A no inserta plan ya aprobado', !!badIns.error);

// Aprobación legítima y auditoría
const ok = await A.c.rpc('approve_plan', { p_plan_id: planA.id });
check('A aprueba su plan vía approve_plan', !ok.error, ok.error?.message);
const { data: aud } = await A.c.from('audit_log').select('action').eq('entity_id', planA.id);
check('aprobación queda en audit_log', (aud ?? []).some((r) => r.action === 'plan.approved'));

// Editar contenido de un plan aprobado invalida la aprobación
await A.c.from('nutrition_plans').update({ plan_content: { x: 2 } }).eq('id', planA.id);
const { data: after } = await A.c.from('nutrition_plans').select('coach_approved,status').eq('id', planA.id).single();
check('editar plan aprobado lo devuelve a borrador', after?.coach_approved === false && after?.status === 'draft');

// audit_log no escribible por usuarios
const al = await A.c.from('audit_log').insert({ studio_id: A.studioId, action: 'x', entity: 'x' });
check('usuario no escribe audit_log', !!al.error);
const st = await A.c.from('studios').update({ name: 'x' }).eq('id', A.studioId).select();
check('usuario no modifica studios directo', !!st.error || (st.data ?? []).length === 0);

// anónimo sin acceso
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const an = await anon.from('clients').select('*');
check('anónimo no lee clientes', !!an.error || (an.data ?? []).length === 0);
const anRpc = await anon.rpc('create_studio', { p_name: 'x', p_slug: `x-${run}`, p_full_name: 'x' });
check('anónimo no crea studio', !!anRpc.error);

console.log(failed ? `\n${failed} FALLO(S) — NO AVANZAR` : '\nAISLAMIENTO OK');
process.exit(failed ? 1 : 0);
