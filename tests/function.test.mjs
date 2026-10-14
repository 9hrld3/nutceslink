// Pruebas de la Edge Function generate_nutrition_plan. Requiere `supabase start` y `supabase functions serve`.
// Con ANTHROPIC_API_KEY configurada en supabase/functions/.env, define RUN_AI=1 para probar la generación real.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, RUN_AI } = process.env;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const run = Date.now();
let failed = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + x}`); if (!ok) failed++; };

async function makeUser(tag) {
  const email = `${tag}-${run}@test.local`, password = 'Test-pass-12345';
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const { data: studioId } = await c.rpc('create_studio', { p_name: tag, p_slug: `${tag}-${run}`, p_full_name: tag });
  return { c, studioId };
}
const A = await makeUser('fa');
const B = await makeUser('fb');
const { data: noConsent } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Sin consent', data_consent: false }).select().single();
const { data: withConsent } = await A.c.from('clients').insert({
  studio_id: A.studioId, full_name: 'Con consent', data_consent: true, birth_date: '2002-03-01', gender: 'male',
  height_cm: 178, weight_kg: 75, sport: 'fútbol', activity_level: 'semiprofesional', goal: 'masa_muscular', dietary_restrictions: ['sin gluten'],
}).select().single();

const call = (c, body) => c.functions.invoke('generate_nutrition_plan', { body });
const status = async (r) => r.error?.context?.status;

check('sin consentimiento → 400', (await status(await call(A.c, { client_id: noConsent.id }))) === 400);
check('cliente de otro studio → 404', (await status(await call(B.c, { client_id: withConsent.id }))) === 404);
check('sin client_id → 400', (await status(await call(A.c, {}))) === 400);
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
check('sin sesión → rechazado', !!(await call(anon, { client_id: withConsent.id })).error);

// v2.0: menores sin consentimiento NO se bloquean (se audita); sesiones inválidas → 404
const { data: minorC } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Menor', birth_date: '2013-05-01', data_consent: false, guardian_consent: false }).select().single();
const rMinor = await call(A.c, { client_id: minorC.id });
check('menor sin consentimiento no se bloquea con 400', (await status(rMinor)) !== 400, `status ${await status(rMinor)}`);
const { data: audMinor } = await A.c.from('audit_log').select('action').eq('entity_id', minorC.id);
check('menor sin consentimiento queda auditado', (audMinor ?? []).some((r) => r.action === 'minor.consent_missing_proceeded'));
check('session_id inexistente → 404', (await status(await call(A.c, { client_id: withConsent.id, session_id: '00000000-0000-0000-0000-000000000000' }))) === 404);
const { data: draftS } = await A.c.from('measurement_sessions').insert({ studio_id: A.studioId, client_id: withConsent.id, measured_on: '2026-10-01', raw: { basic: { mass_kg: 70 } } }).select().single();
check('sesión en borrador no sirve para el plan → 404', (await status(await call(A.c, { client_id: withConsent.id, session_id: draftS.id }))) === 404);
const { data: otherC } = await A.c.from('clients').insert({ studio_id: A.studioId, full_name: 'Otro', data_consent: true }).select().single();
check('sesión de otro cliente → 404', (await status(await call(A.c, { client_id: otherC.id, session_id: draftS.id }))) === 404);

if (RUN_AI) {
  const t0 = Date.now();
  const r = await call(A.c, { client_id: withConsent.id });
  check('genera plan con IA', !r.error && !!r.data?.plan_id, JSON.stringify(r.error?.message));
  check('en menos de 60 s', Date.now() - t0 < 60000, `${Date.now() - t0} ms`);
  if (r.data?.plan_id) {
    const { data: p } = await A.c.from('nutrition_plans').select('coach_approved,status,ai_generated').eq('id', r.data.plan_id).single();
    check('queda como borrador sin aprobar', p.coach_approved === false && p.status === 'draft' && p.ai_generated === true);
  }
} else {
  const r = await call(A.c, { client_id: withConsent.id });
  const s = await status(r);
  check('sin API key configurada → error claro (500), sin insertar', s === 500);
  const { count } = await admin.from('nutrition_plans').select('id', { count: 'exact', head: true }).eq('client_id', withConsent.id);
  check('no se insertó ningún plan', count === 0);
}
console.log(failed ? `\n${failed} FALLO(S)` : '\nFUNCIÓN OK');
process.exit(failed ? 1 : 0);
