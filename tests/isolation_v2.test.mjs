// Aislamiento y reglas de la migración v2.0. Requiere `supabase start`.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) throw new Error('faltan variables de entorno');
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const run = Date.now();
let failed = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + x}`); if (!ok) failed++; };

async function makeUser(tag) {
  const email = `${tag}-${run}@test.local`, password = 'Test-pass-12345';
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const { data: studioId, error: e3 } = await c.rpc('create_studio', { p_name: tag, p_slug: `${tag}-${run}`, p_full_name: tag });
  if (e3) throw e3;
  const { data: coach } = await c.from('coaches').select('id').eq('studio_id', studioId).single();
  return { c, studioId, coachId: coach.id };
}
const A = await makeUser('v2a');
const B = await makeUser('v2b');

const raw = { basic: { mass_kg: 70, height_cm: 175 }, skinfolds: { triceps: 10, subscapular: 12, supraspinale: 8 } };
const { data: cA } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'A1', data_consent: true, biological_sex: 'M' }).select().single();
const { data: gA, error: egA } = await A.c.from('client_groups').insert({ studio_id: A.studioId, name: 'Sub-17' }).select().single();
check('A crea grupo', !!gA, egA?.message);
const { data: sA, error: esA } = await A.c.from('measurement_sessions').insert({ studio_id: A.studioId, client_id: cA.id, measured_by: A.coachId, measured_on: '2026-10-01', raw }).select().single();
check('A crea sesión borrador', !!sA, esA?.message);
const { data: rA, error: erA } = await A.c.from('measurement_results').insert({ studio_id: A.studioId, session_id: sA.id, formula_id: 'bmi', formula_version: '1', output: { value: 22.9 } }).select().single();
check('A guarda resultado', !!rA, erA?.message);

// B no ve nada de A en las tablas nuevas
for (const t of ['client_groups', 'measurement_sessions', 'measurement_results']) {
  const { data } = await B.c.from(t).select('*').eq('studio_id', A.studioId);
  check(`B no lee ${t} de A`, (data ?? []).length === 0);
}
// B no escribe en el studio de A
check('B no inserta grupo en A', !!(await B.c.from('client_groups').insert({ studio_id: A.studioId, name: 'x' })).error);
check('B no inserta sesión en A', !!(await B.c.from('measurement_sessions').insert({ studio_id: A.studioId, client_id: cA.id, measured_on: '2026-10-02', raw })).error);
check('B no inserta resultado en A', !!(await B.c.from('measurement_results').insert({ studio_id: A.studioId, session_id: sA.id, formula_id: 'x', formula_version: '1', output: {} })).error);
// B no crea sesión propia sobre cliente ajeno
check('B no crea sesión en su studio con cliente de A', !!(await B.c.from('measurement_sessions').insert({ studio_id: B.studioId, client_id: cA.id, measured_on: '2026-10-02', raw })).error);
const upd = await B.c.from('measurement_sessions').update({ patient_note: 'hack' }).eq('id', sA.id).select();
check('B no actualiza sesión de A', !upd.error ? (upd.data ?? []).length === 0 : true);
const del = await B.c.from('measurement_sessions').delete().eq('id', sA.id).select();
check('B no borra sesión de A', !del.error ? (del.data ?? []).length === 0 : true);
// B no asigna cliente propio a grupo de A
const { data: cB } = await B.c.from('clients').insert({ studio_id: B.studioId, full_name: 'B1' }).select().single();
check('B no asigna su cliente a grupo de A', !!(await B.c.from('clients').update({ group_id: gA.id }).eq('id', cB.id)).error);
// plan con session_id de otro studio
check('B no crea plan con sesión de A', !!(await B.c.from('nutrition_plans').insert({ studio_id: B.studioId, client_id: cB.id, plan_content: {}, measurement_session_id: sA.id })).error);
// log_event: B no puede registrar en studio de A; acción no permitida falla
check('B no usa log_event en studio de A', !!(await B.c.rpc('log_event', { p_studio: A.studioId, p_action: 'minor.consent_missing_proceeded', p_entity: 'clients', p_entity_id: cA.id })).error);
check('log_event rechaza acciones no permitidas', !!(await A.c.rpc('log_event', { p_studio: A.studioId, p_action: 'otra.cosa', p_entity: 'clients', p_entity_id: cA.id })).error);
check('A registra minor.consent_missing_proceeded', !(await A.c.rpc('log_event', { p_studio: A.studioId, p_action: 'minor.consent_missing_proceeded', p_entity: 'clients', p_entity_id: cA.id })).error);

// Menores sin consentimiento: NO se bloquea (decisión del dueño)
const { data: minor, error: em } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Menor', birth_date: '2013-05-01', guardian_consent: false, data_consent: false }).select().single();
check('menor sin consentimiento se puede crear (sin bloqueo)', !!minor, em?.message);
const { data: sMinor, error: esm } = await A.c.from('measurement_sessions').insert({ studio_id: A.studioId, client_id: minor.id, measured_on: '2026-10-03', raw }).select().single();
check('menor sin consentimiento admite sesión de medición', !!sMinor, esm?.message);

// Sesión final: raw inmutable
const fin = await A.c.from('measurement_sessions').update({ status: 'final' }).eq('id', sA.id);
check('A finaliza la sesión', !fin.error, fin.error?.message);
check('sesión final: no cambia raw', !!(await A.c.from('measurement_sessions').update({ raw: { basic: { mass_kg: 99 } } }).eq('id', sA.id)).error);
check('sesión final: no vuelve a borrador', !!(await A.c.from('measurement_sessions').update({ status: 'draft' }).eq('id', sA.id)).error);
check('sesión final: no cambia fecha', !!(await A.c.from('measurement_sessions').update({ measured_on: '2020-01-01' }).eq('id', sA.id)).error);
check('sesión final: sí admite nota del paciente', !(await A.c.from('measurement_sessions').update({ patient_note: 'ok' }).eq('id', sA.id)).error);
const { data: still } = await admin.from('measurement_sessions').select('raw').eq('id', sA.id).single();
check('raw intacto tras intentos', still.raw.basic.mass_kg === 70);
// corrección = nueva sesión con supersedes_id
const { data: corr, error: ec } = await A.c.from('measurement_sessions').insert({ studio_id: A.studioId, client_id: cA.id, measured_on: '2026-10-01', raw: { basic: { mass_kg: 71 } }, supersedes_id: sA.id }).select().single();
check('corrección vía nueva sesión con supersedes_id', !!corr, ec?.message);
// auditoría de sesiones sin contenido médico
const { data: aud } = await A.c.from('audit_log').select('action,detail').eq('entity', 'measurement_sessions');
check('sesiones auditadas', (aud ?? []).length >= 2);
check('audit_log sin contenido de medidas', (aud ?? []).every((r) => r.detail === null));
// plan válido con sesión propia
const okPlan = await A.c.from('nutrition_plans').insert({ studio_id: A.studioId, client_id: cA.id, plan_content: {}, measurement_session_id: sA.id });
check('plan con sesión propia del mismo cliente', !okPlan.error, okPlan.error?.message);
// borrar cliente con sesión final sigue funcionando (cascade)
const delc = await A.c.from('clients').delete().eq('id', cA.id).select();
check('eliminar cliente con sesiones finales funciona', !delc.error && (delc.data ?? []).length === 1, delc.error?.message);

// anónimo
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
for (const t of ['client_groups', 'measurement_sessions', 'measurement_results']) {
  const r = await anon.from(t).select('*');
  check(`anónimo no lee ${t}`, !!r.error || (r.data ?? []).length === 0);
}
check('anónimo no usa log_event', !!(await anon.rpc('log_event', { p_studio: A.studioId, p_action: 'minor.consent_missing_proceeded', p_entity: 'x', p_entity_id: A.studioId })).error);

console.log(failed ? `\n${failed} FALLO(S) — NO AVANZAR` : '\nAISLAMIENTO V2 OK');
process.exit(failed ? 1 : 0);
