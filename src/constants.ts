import { Role } from "./types";

export const NL_DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
export const NL_DAYS_FULL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
export const NL_MONTHS = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
export const ROLES: Role[] = ['Shift Leader', 'Manager', 'Assistant Manager'];
export const ROLE_KEY: Record<Role, string> = { 'Shift Leader': 'sl', 'Manager': 'mg', 'Assistant Manager': 'am' };

export const DUTCH_HOLIDAYS: Record<string, string> = {
  '2026-01-01': 'Nieuwjaarsdag',
  '2026-04-03': 'Goede Vrijdag',
  '2026-04-05': '1e Paasdag',
  '2026-04-06': '2e Paasdag',
  '2026-04-27': 'Koningsdag',
  '2026-05-05': 'Bevrijdingsdag',
  '2026-05-14': 'Hemelvaartsdag',
  '2026-05-24': '1e Pinksterdag',
  '2026-05-25': '2e Pinksterdag',
  '2026-12-25': '1e Kerstdag',
  '2026-12-26': '2e Kerstdag'
};
