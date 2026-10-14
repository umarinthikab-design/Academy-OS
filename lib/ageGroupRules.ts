// Inclusive calendar-date rules. Skill rating bands are a separate concept.
export type EligibilityRule = { id: string; birthDateFrom: Date | null; birthDateTo: Date | null };

export function parseCalendarDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw ? date : null;
}

export function eligibleAgeGroupIds(dob: Date, rules: EligibilityRule[]): string[] {
  const day = dob.toISOString().slice(0, 10);
  return rules.filter(r => r.birthDateFrom && r.birthDateTo &&
    day >= r.birthDateFrom.toISOString().slice(0, 10) && day <= r.birthDateTo.toISOString().slice(0, 10)).map(r => r.id);
}

export function hasOverlappingRules(rules: EligibilityRule[]): boolean {
  const configured = rules.filter(r => r.birthDateFrom && r.birthDateTo)
    .sort((a, b) => a.birthDateFrom!.getTime() - b.birthDateFrom!.getTime());
  return configured.some((r, i) => i > 0 && r.birthDateFrom! <= configured[i - 1].birthDateTo!);
}
