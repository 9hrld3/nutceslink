// Siembra datos 100 % FICTICIOS para la demo y las capturas de pantalla.
// Uso (con `supabase start` activo):
//   SUPABASE_URL=http://127.0.0.1:57321 SUPABASE_ANON_KEY=<publishable> SUPABASE_SERVICE_KEY=<secret> node scripts/seed-demo.mjs
// Crea el usuario demo@nutceslink.local y un consultorio de ejemplo. Toda la escritura de negocio pasa por la sesión del
// usuario (con RLS, triggers y auditoría reales); la clave de servicio solo se usa para crear el usuario de Auth.
import { createClient } from '@supabase/supabase-js';
import { computeSession } from '../lib/calc/index.ts';
import { ageYears } from '../lib/age.ts';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) throw new Error('faltan SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_KEY');

export const DEMO_EMAIL = 'demo@nutceslink.local';
export const DEMO_PASSWORD = 'demo-nutceslink-2026';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { error: eu } = await admin.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true });
if (eu && !/already/i.test(eu.message)) throw eu;

const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: es } = await c.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
if (es) throw es;
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

const studioId = must(await c.rpc('create_studio', { p_name: 'Estudio Demo', p_slug: `demo-${Date.now()}`, p_full_name: 'Alex Demo' }), 'create_studio');
const coach = must(await c.from('coaches').select('id').eq('studio_id', studioId).single(), 'coach');

// ---- grupos ----
const g17 = must(await c.from('client_groups').insert({ studio_id: studioId, name: 'Sub-17' }).select().single(), 'grupo');
const gRun = must(await c.from('client_groups').insert({ studio_id: studioId, name: 'Corredores' }).select().single(), 'grupo');

// ---- clientes (personas inventadas) ----
const mk = async (row) => must(await c.from('clients').insert({ studio_id: studioId, coach_id: coach.id, ...row }).select().single(), row.full_name);
const lucas = await mk({
  full_name: 'Lucas Andrade', birth_date: '2009-08-14', biological_sex: 'M', gender: 'male', height_cm: 174, weight_kg: 65,
  sport: 'Fútbol', activity_level: 'semiprofesional', goal: 'rendimiento', group_id: g17.id,
  dietary_restrictions: [], allergies: [], objectives: ['mejorar rendimiento', 'ganar masa magra'],
  guardian_name: 'Patricia Andrade', guardian_relationship: 'Madre', guardian_phone: '+593 99 000 0001', guardian_consent: true,
  guardian_consent_at: new Date().toISOString(), data_consent: true, consent_at: new Date().toISOString(),
});
const mateo = await mk({
  full_name: 'Mateo Villacís', birth_date: '2012-03-02', biological_sex: 'M', gender: 'male', height_cm: 158, weight_kg: 48,
  sport: 'Fútbol', activity_level: 'amateur', goal: 'masa_muscular', group_id: g17.id, objectives: ['crecer de forma saludable'],
  guardian_consent: false, data_consent: false,
});
const maria = await mk({
  full_name: 'María Torres', birth_date: '1994-05-21', biological_sex: 'F', gender: 'female', height_cm: 164, weight_kg: 57,
  sport: 'Running', activity_level: 'amateur', goal: 'rendimiento', group_id: gRun.id, dietary_restrictions: ['sin lactosa'],
  objectives: ['preparar media maratón'], data_consent: true, consent_at: new Date().toISOString(),
});
await mk({
  full_name: 'Diego Paredes', birth_date: '1988-11-09', biological_sex: 'M', gender: 'male', height_cm: 178, weight_kg: 82,
  sport: 'Ciclismo', activity_level: 'amateur', goal: 'perdida_grasa', group_id: gRun.id, objectives: ['reducir grasa corporal'],
  data_consent: true, consent_at: new Date().toISOString(),
});

// ---- sesiones de medición (finalizadas, con resultados calculados por el motor real) ----
async function session(client, measuredOn, raw, extra = {}) {
  const s = must(await c.from('measurement_sessions').insert({
    studio_id: studioId, client_id: client.id, measured_by: coach.id, measured_on: measuredOn, raw, ...extra,
  }).select().single(), 'sesión');
  const calc = computeSession(raw, { ageYears: ageYears(client.birth_date, new Date(measuredOn + 'T00:00:00')), sex: client.biological_sex });
  must(await c.from('measurement_results').insert(calc.results.map((r) => ({
    studio_id: studioId, session_id: s.id, formula_id: r.formula_id, formula_version: r.formula_version,
    output: { title: r.title, citation: r.citation, ...r.output },
  }))), 'resultados');
  must(await c.from('measurement_sessions').update({ status: 'final' }).eq('id', s.id), 'finalizar');
  return s;
}
const lucasRaw = (mass, h, tri, sub, sup, calf) => ({
  basic: { mass_kg: mass, height_cm: h, sitting_height_cm: 90.5 },
  skinfolds: { triceps: tri, subscapular: sub, supraspinale: sup, calf, abdominal: [11.2, 11.6] },
  diameters: { humerus: 6.9, femur: 9.5 }, perimeters: { arm_flexed: 28.4, calf: 36.2, waist: 72 },
});
await session(lucas, '2026-06-10', lucasRaw(61.8, 171.5, [8.4, 8.8, 8.6], 8.0, 6.2, 6.6), { next_checkup_date: '2026-08-10', patient_note: 'Buen punto de partida. Priorizar proteína en el desayuno.' });
await session(lucas, '2026-08-12', lucasRaw(63.4, 172.8, [8.0, 8.2], 7.8, 6.0, 6.4), { next_checkup_date: '2026-10-07' });
const lucasLast = await session(lucas, '2026-10-07', lucasRaw(65.1, 174.0, [7.6, 7.8, 7.7], 7.4, 5.8, 6.0), { next_checkup_date: '2026-12-10', patient_note: 'Excelente progreso: más masa magra con menos pliegues.' });
const mariaRaw = (mass, tri, sub, sup, calf) => ({
  basic: { mass_kg: mass, height_cm: 164 },
  skinfolds: { triceps: [14.2, 14.6], subscapular: 11.8, supraspinale: 9.4, calf },
  diameters: { humerus: 5.8, femur: 8.9 }, perimeters: { arm_flexed: 26.2, calf: 34.1 },
});
await session(maria, '2026-08-20', mariaRaw(58.4, 14, 11.8, 9.4, 12.1));
await session(maria, '2026-10-05', mariaRaw(57.1, 13, 11, 8.8, 11.4));
// una sesión en borrador (muestra el estado "Borrador")
must(await c.from('measurement_sessions').insert({ studio_id: studioId, client_id: mateo.id, measured_by: coach.id, measured_on: '2026-10-12', raw: { basic: { mass_kg: 48, height_cm: 158 } } }), 'borrador');

// ---- planes (contenido inventado) ----
const B = [['Avena con plátano y chía', '60 g avena, 1 plátano, 250 ml leche, 1 cdta chía', 460], ['Tortilla de huevo y pan integral', '3 huevos, 2 rebanadas pan integral, papaya 150 g', 520], ['Yogur con granola y frutilla', '200 g yogur natural, 40 g granola, 100 g frutilla', 430]];
const S1 = [['Batido de banano y maní', '1 banano, 20 g mantequilla de maní, 250 ml leche', 310], ['Fruta y frutos secos', 'Manzana y 30 g almendras', 260]];
const L = [['Pollo con arroz y menestra', '150 g pollo a la plancha, 150 g arroz, 100 g lenteja, ensalada', 720], ['Pescado con papa y verduras', '160 g tilapia, 200 g papa cocida, brócoli al vapor', 650], ['Carne magra con quinua', '140 g carne magra, 120 g quinua, ensalada de tomate', 690]];
const S2 = [['Sánduche de atún', '2 rebanadas pan integral, 80 g atún, aguacate', 340], ['Choclo con queso', '1 choclo mediano, 40 g queso fresco', 330]];
const D = [['Sopa de quinua y huevo', '300 ml sopa, 1 huevo, 60 g pan', 480], ['Arroz con pollo y verduras', '120 g arroz, 120 g pollo, vegetales salteados', 560], ['Tortilla de verde y ensalada', '1 tortilla de verde, 2 huevos, ensalada', 520]];
const pick = (arr, i) => { const [name, description, calories] = arr[i % arr.length]; return { name, description, calories }; };
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const planContent = (kcal, p, cb, f) => ({
  calories_target: kcal, protein_g: p, carbs_g: cb, fat_g: f,
  reasoning: 'Ejemplo ficticio: energía ajustada a la carga de entrenamiento y a la composición corporal de la última medición.',
  weekly_plan: Object.fromEntries(days.map((d, i) => [d, {
    breakfast: pick(B, i), morning_snack: pick(S1, i), lunch: pick(L, i), afternoon_snack: pick(S2, i), dinner: pick(D, i),
  }])),
  shopping_list: [{ item: 'Avena', quantity: '500 g' }, { item: 'Huevos', quantity: '2 docenas' }, { item: 'Pollo', quantity: '1 kg' }, { item: 'Arroz', quantity: '1 kg' }, { item: 'Quinua', quantity: '500 g' }, { item: 'Frutas de temporada', quantity: '3 kg' }],
  sport_recommendations: 'Hidratación constante durante el entrenamiento. Priorizar sueño de 8 horas.',
  timing: { pre_workout: '2–3 h antes: comida con carbohidratos complejos y proteína magra.', during: 'Sesiones > 60 min: 30–60 g de carbohidrato por hora.', post_workout: 'En los 60 min posteriores: proteína (20–30 g) y carbohidrato.' },
});
const planRow = (client, content, sessionId) => ({
  studio_id: studioId, client_id: client.id, coach_id: coach.id, calories_target: content.calories_target, protein_g: content.protein_g,
  carbs_g: content.carbs_g, fat_g: content.fat_g, plan_content: content, ai_generated: true, ai_model: 'demo', measurement_session_id: sessionId ?? null,
  valid_from: '2026-10-08', valid_until: '2026-11-05',
});
const pL = must(await c.from('nutrition_plans').insert(planRow(lucas, planContent(2900, 145, 400, 80), lucasLast.id)).select().single(), 'plan');
must(await c.rpc('approve_plan', { p_plan_id: pL.id }), 'aprobar');
must(await c.from('nutrition_plans').insert(planRow(maria, planContent(2200, 110, 300, 62))), 'plan borrador');

console.log('Demo lista. Entra con', DEMO_EMAIL, '/', DEMO_PASSWORD);
console.log(JSON.stringify({ studioId, lucas: lucas.id, mateo: mateo.id, maria: maria.id, lucasSession: lucasLast.id, lucasPlan: pL.id }));
