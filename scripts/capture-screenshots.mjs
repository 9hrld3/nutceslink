// Genera las capturas de docs/screenshots con la demo (datos ficticios). Requiere: `supabase start`, `node scripts/seed-demo.mjs`,
// `npm run dev -- -p 3200` y Chrome o Edge instalado (se usa puppeteer-core, sin descargar navegadores).
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... [BASE_URL=http://localhost:3200] [CHROME_PATH=...] node scripts/capture-screenshots.mjs
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const EMAIL = 'demo@nutceslink.local', PASSWORD = 'demo-nutceslink-2026';
const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('No se encontró Chrome/Edge: define CHROME_PATH');

// IDs de la demo (leídos con la sesión del usuario demo; respeta RLS)
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
const byName = async (n) => (await sb.from('clients').select('id').eq('full_name', n).single()).data.id;
const lucas = await byName('Lucas Andrade'), mateo = await byName('Mateo Villacís');
const lastSession = (await sb.from('measurement_sessions').select('id').eq('client_id', lucas).eq('status', 'final').order('measured_on', { ascending: false }).limit(1).single()).data.id;
const plan = (await sb.from('nutrition_plans').select('id').eq('client_id', lucas).eq('coach_approved', true).limit(1).single()).data.id;

const out = path.resolve('docs/screenshots');
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 860, deviceScaleFactor: 1 });

const shot = async (name, url, { full = false, wait = 600, scrollTop = 0 } = {}) => {
  await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, wait));
  if (scrollTop) await page.evaluate((y) => window.scrollTo(0, y), scrollTop);
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: full });
  console.log('✓', name);
};

await shot('01-login', '/login');
await page.type('input[type=email]', EMAIL);
await page.type('input[type=password]', PASSWORD);
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }), page.click('form button')]);

await shot('02-clientes', '/clients');
await shot('03-ficha-menor-aviso', `/clients/${mateo}`);
await shot('04-mediciones', `/clients/${lucas}?tab=mediciones`);
await shot('05-nueva-sesion', `/clients/${lucas}/sessions/new`, { full: false });
await shot('06-resultados-con-fuente', `/clients/${lucas}/sessions/${lastSession}`, { full: true });
await shot('07-progreso', `/clients/${lucas}/progress`, { full: true });
await shot('08-informe-imprimible', `/clients/${lucas}/sessions/${lastSession}/report`, { full: true });
await shot('09-plan-aprobado', `/clients/${lucas}/plans/${plan}`);
await shot('10-grupos', '/groups');
await browser.close();
