/** Edad en años completos a una fecha (por defecto hoy). null si no hay fecha de nacimiento. */
export function ageYears(birthDate: string | null | undefined, on: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  let a = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a--;
  return a;
}

export function isMinorWithoutConsent(c: { birth_date: string | null; guardian_consent: boolean }): boolean {
  const a = ageYears(c.birth_date);
  return a !== null && a < 18 && !c.guardian_consent;
}
