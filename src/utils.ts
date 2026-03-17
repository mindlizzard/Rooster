import { AppState, Employee, Shift, Surcharges, Role } from "./types";
import { DUTCH_HOLIDAYS } from "./constants";

export function currentMonthStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function getDaysInMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function getDateStr(ym: string, d: number) {
  return ym + '-' + String(d).padStart(2, '0');
}

export function getDayOfWeek(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').getDay();
}

export function timeToMins(t: string) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minsToTime(m: number) {
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function shiftDuration(start: string, end: string) {
  let s = timeToMins(start), e = timeToMins(end);
  if (e <= s) e += 1440;
  return (e - s) / 60;
}

export function shiftKey(dateStr: string, empId: string) { return dateStr + '_' + empId; }

export function uid() { return 'id_' + Math.random().toString(36).slice(2); }

export function isBusy(dateStr: string, busyDates: string[]) { 
  return busyDates.includes(dateStr); 
}

export function isHoliday(dateStr: string) { return !!DUTCH_HOLIDAYS[dateStr]; }

export function isWeekend(dateStr: string) {
  const d = getDayOfWeek(dateStr);
  return d === 0 || d === 6;
}

export function getOpeningHours(dateStr: string, settings: AppState['settings']) {
  const ov = settings.dateOverrides[dateStr];
  if (ov) return ov;
  const dow = getDayOfWeek(dateStr);
  return settings.openingHours[dow] || { open: '09:00', close: '23:00', is24h: false };
}

export function getEffectiveCloseMins(openStr: string, closeStr: string) {
  const openMins = timeToMins(openStr || '09:00');
  if (!closeStr || closeStr === '') return openMins + 960; // fallback 16h
  let closeMins = timeToMins(closeStr);
  if (closeMins <= openMins) closeMins += 1440;
  return closeMins;
}

export interface ATWValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateATWShift(
  shifts: Record<string, Shift>,
  employee: Employee,
  dateStr: string,
  startTime: string,
  endTime: string
): ATWValidationResult {
  const errors: string[] = [];
  const shiftMins = shiftDuration(startTime, endTime) * 60;
  
  // 1. Max shift duration (12 hours)
  if (shiftMins > 12 * 60) {
    errors.push(`Dienst is langer dan 12 uur (${(shiftMins / 60).toFixed(1)}u).`);
  }

  // Calculate current month's hours for the week
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 = Sunday
  const diffToMonday = d.getDate() - dow + (dow === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  
  let weekHours = 0;
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(monday);
    checkDate.setDate(monday.getDate() + i);
    const ds = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    
    if (ds === dateStr) {
      weekHours += shiftMins / 60;
    } else {
      const existingShift = shifts[shiftKey(ds, employee.id)];
      if (existingShift && !existingShift.isVacation && !existingShift.isSick) {
        weekHours += shiftDuration(existingShift.startTime, existingShift.endTime);
      }
    }
  }

  // 2. Max hours per week (60 hours absolute ATW max, but we also check employee max)
  if (weekHours > 60) {
    errors.push(`Overschrijdt ATW maximum van 60 uur per week (${weekHours.toFixed(1)}u).`);
  }
  if (weekHours > employee.maxHoursPerWeek) {
    errors.push(`Overschrijdt contractueel maximum van ${employee.maxHoursPerWeek} uur per week (${weekHours.toFixed(1)}u).`);
  }

  // 3. Minimum rest between shifts (11 hours)
  const currentStartMins = timeToMins(startTime);
  const currentEndMins = timeToMins(endTime) < currentStartMins ? timeToMins(endTime) + 1440 : timeToMins(endTime);
  
  // Check previous day
  const prevDate = new Date(dateStr + 'T12:00:00');
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDs = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0') + '-' + String(prevDate.getDate()).padStart(2, '0');
  const prevShift = shifts[shiftKey(prevDs, employee.id)];
  
  if (prevShift && !prevShift.isVacation && !prevShift.isSick) {
    let prevEndMins = timeToMins(prevShift.endTime);
    if (prevEndMins <= timeToMins(prevShift.startTime)) prevEndMins += 1440;
    
    // Rest time is from prevEndMins to (currentStartMins + 1440)
    const restMins = (currentStartMins + 1440) - prevEndMins;
    if (restMins < 11 * 60) {
      errors.push(`Minder dan 11 uur rust na vorige dienst (${(restMins / 60).toFixed(1)}u rust).`);
    }
  }

  // Check next day
  const nextDate = new Date(dateStr + 'T12:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDs = nextDate.getFullYear() + '-' + String(nextDate.getMonth() + 1).padStart(2, '0') + '-' + String(nextDate.getDate()).padStart(2, '0');
  const nextShift = shifts[shiftKey(nextDs, employee.id)];

  if (nextShift && !nextShift.isVacation && !nextShift.isSick) {
    const nextStartMins = timeToMins(nextShift.startTime);
    const restMins = (nextStartMins + 1440) - currentEndMins;
    if (restMins < 11 * 60) {
      errors.push(`Minder dan 11 uur rust voor volgende dienst (${(restMins / 60).toFixed(1)}u rust).`);
    }
  }

  // 4. Consecutive working days (ATW max 6 days, but usually 5 is preferred. Let's flag > 6)
  let consecutiveBefore = 0;
  for (let i = 1; i <= 6; i++) {
    const checkDate = new Date(dateStr + 'T12:00:00');
    checkDate.setDate(checkDate.getDate() - i);
    const ds = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    const s = shifts[shiftKey(ds, employee.id)];
    if (s && !s.isVacation && !s.isSick) consecutiveBefore++;
    else break;
  }
  
  let consecutiveAfter = 0;
  for (let i = 1; i <= 6; i++) {
    const checkDate = new Date(dateStr + 'T12:00:00');
    checkDate.setDate(checkDate.getDate() + i);
    const ds = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    const s = shifts[shiftKey(ds, employee.id)];
    if (s && !s.isVacation && !s.isSick) consecutiveAfter++;
    else break;
  }

  if (consecutiveBefore + 1 + consecutiveAfter > 6) {
    errors.push(`Meer dan 6 aaneengesloten werkdagen (${consecutiveBefore + 1 + consecutiveAfter} dagen).`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function calcShiftSalary(shift: Shift, emp: Employee, surcharges: Surcharges, hourlyRates: Record<Role, number>) {
  if (!emp) return { total: 0, surchargeList: [], base: 0, nightHours: 0, eveningHours: 0, weekendHours: 0, holidayHours: 0, nightAmt: 0, eveningAmt: 0, weekendAmt: 0, holidayAmt: 0 };
  const rate = hourlyRates[emp.role] || 15;
  const dur = shiftDuration(shift.startTime, shift.endTime);
  const dateStr = shift.date || '';
  const list: string[] = [];
  const base = (dur + (!shift.isSick && !shift.isVacation && shift.sickHours ? shift.sickHours : 0)) * rate;
  let total = base;
  let nightHours = 0, eveningHours = 0, weekendHours = 0, holidayHours = 0;
  let nightAmt = 0, eveningAmt = 0, weekendAmt = 0, holidayAmt = 0;

  if (shift.isSick || shift.isVacation) {
    return { total, base, surchargeList: list, nightHours, eveningHours, weekendHours, holidayHours, nightAmt, eveningAmt, weekendAmt, holidayAmt };
  }

  const shiftS = timeToMins(shift.startTime);
  let shiftE = timeToMins(shift.endTime);
  if (shiftE <= shiftS) shiftE += 1440;

  // Nacht toeslag
  const nightS = timeToMins(surcharges.nightStart || '22:00');
  const nightEraw = timeToMins(surcharges.nightEnd || '06:00');
  const n2 = nightS < nightEraw ? nightEraw + 1440 : nightEraw + 1440;
  const nightOverlap = Math.max(0, Math.min(shiftE, n2) - Math.max(shiftS, nightS)) / 60;
  if (nightOverlap > 0) { nightHours = nightOverlap; nightAmt = nightHours * rate * (surcharges.nightPct / 100); total += nightAmt; list.push('Nacht'); }

  // Avond toeslag
  const evS = timeToMins(surcharges.eveningFrom || '18:00');
  const evE = nightS;
  if (evS < evE) {
    const evOverlap = Math.max(0, Math.min(shiftE, evE) - Math.max(shiftS, evS)) / 60;
    if (evOverlap > 0) { eveningHours = evOverlap; eveningAmt = eveningHours * rate * (surcharges.eveningPct / 100); total += eveningAmt; list.push('Avond'); }
  }

  // Weekend toeslag
  const dow = getDayOfWeek(dateStr);
  if (dow === 0 || dow === 6) { weekendHours = dur; weekendAmt = dur * rate * (surcharges.weekendPct / 100); total += weekendAmt; list.push('Weekend'); }

  // Feestdag toeslag
  if (DUTCH_HOLIDAYS[dateStr]) { holidayHours = dur; holidayAmt = dur * rate * (surcharges.holidayPct / 100); total += holidayAmt; list.push('Feestdag'); }

  return { total, base, surchargeList: list, nightHours, eveningHours, weekendHours, holidayHours, nightAmt, eveningAmt, weekendAmt, holidayAmt };
}

export function calcMonthHours(empId: string, ym: string, shifts: Record<string, Shift>) {
  let h = 0;
  Object.entries(shifts).forEach(([k, s]) => {
    if (k.startsWith(ym) && s.employeeId === empId) {
      h += shiftDuration(s.startTime, s.endTime);
      if (!s.isSick && !s.isVacation && s.sickHours) h += s.sickHours;
    }
  });
  return h;
}

export function calcDetailedStats(empId: string, ym: string, state: AppState) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return null;
  const days = getDaysInMonth(ym);
  let totalHours = 0, baseTotal = 0, nightH = 0, eveningH = 0, weekendH = 0, holidayH = 0;
  let nightAmt = 0, eveningAmt = 0, weekendAmt = 0, holidayAmt = 0, totalSalary = 0;
  let shiftsCount = 0, sickDays = 0, vacDaysInRoster = 0;
  let sickHours = 0, vacHours = 0;
  const weeklyHours = Array.from({ length: Math.ceil(days / 7) }, () => 0);

  for (let d = 1; d <= days; d++) {
    const dateStr = getDateStr(ym, d);
    const s = state.shifts[shiftKey(dateStr, empId)];
    if (!s) continue;
    
    const dur = shiftDuration(s.startTime, s.endTime);
    let dayTotal = dur;
    
    if (s.isSick) {
      sickDays++;
      sickHours += dur;
    } else if (s.isVacation) {
      vacDaysInRoster++;
      vacHours += dur;
    } else if (s.sickHours) {
      sickHours += s.sickHours;
      dayTotal += s.sickHours;
    }

    totalHours += dayTotal;
    weeklyHours[Math.floor((d - 1) / 7)] += dayTotal;
    
    const sal = calcShiftSalary(s, emp, state.settings.surcharges, state.settings.hourlyRates);
    baseTotal += sal.base;
    if (!s.isSick && !s.isVacation) {
      nightH += sal.nightHours; eveningH += sal.eveningHours; weekendH += sal.weekendHours; holidayH += sal.holidayHours;
      nightAmt += sal.nightAmt; eveningAmt += sal.eveningAmt; weekendAmt += sal.weekendAmt; holidayAmt += sal.holidayAmt;
    }
    totalSalary += sal.total; 
    if (!s.isSick && !s.isVacation) shiftsCount++;
  }
  const targetHours = Math.round(emp.contractHours * days / 7 * 10) / 10;
  const overtime = Math.max(0, totalHours - targetHours);
  const shortage = Math.max(0, targetHours - totalHours);
  const snipCount = (state.snipperdagen || []).filter(s => s.employeeId === empId && s.date.startsWith(ym)).length;
  const approvedVacDays = state.vacationRequests.filter(v => v.employeeId === empId && v.status === 'approved')
    .reduce((sum, v) => {
      let cnt = 0;
      const s = new Date(v.startDate + 'T12:00:00'); const e = new Date(v.endDate + 'T12:00:00');
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { if (d.toISOString().slice(0, 7) === ym) cnt++; }
      return sum + cnt;
    }, 0);
  return { emp, totalHours, targetHours, overtime, shortage, baseTotal, nightH, eveningH, weekendH, holidayH, nightAmt, eveningAmt, weekendAmt, holidayAmt, totalSalary, shiftsCount, sickDays, vacDaysInRoster, snipCount, approvedVacDays, weeklyHours, sickHours, vacHours };
}

export function validateATW(state: AppState) {
  const issues: { type: 'error' | 'warn', text: string }[] = [];
  const ym = state.settings.currentMonth;
  const days = getDaysInMonth(ym);

  state.employees.forEach(emp => {
    let consecutive = 0;
    let lastEnd: number | null = null;

    for (let d = 1; d <= days; d++) {
      const dateStr = getDateStr(ym, d);
      const sk = shiftKey(dateStr, emp.id);
      const shift = state.shifts[sk];

      if (shift && !shift.isVacation && !shift.isSick) {
        consecutive++;
        if (consecutive > 5) {
          issues.push({ type: 'error', text: `${emp.name}: meer dan 5 aaneengesloten werkdagen (dag ${d})` });
        }
        if (lastEnd !== null) {
          const thisStart = timeToMins(shift.startTime) + (d - 1) * 1440;
          const restHours = (thisStart - lastEnd) / 60;
          if (restHours < 11) {
            issues.push({ type: 'error', text: `${emp.name}: minder dan 11u rust voor ${dateStr} (${restHours.toFixed(1)}u)` });
          }
        }
        const dur = shiftDuration(shift.startTime, shift.endTime);
        if (dur > 8.5) {
          issues.push({ type: 'error', text: `${emp.name}: dienst op ${dateStr} is ${dur.toFixed(1)}u (max 8.5u)` });
        }
        let endMins = timeToMins(shift.endTime);
        if (endMins <= timeToMins(shift.startTime)) endMins += 1440;
        lastEnd = endMins + (d - 1) * 1440;
      } else {
        consecutive = 0;
        lastEnd = null;
      }
    }

    for (let w = 0; w < Math.ceil(days / 7); w++) {
      let weekHours = 0;
      for (let wd = 0; wd < 7; wd++) {
        const d = w * 7 + wd + 1;
        if (d > days) break;
        const sk = shiftKey(getDateStr(ym, d), emp.id);
        const s = state.shifts[sk];
        if (s && !s.isSick && !s.isVacation) weekHours += shiftDuration(s.startTime, s.endTime);
      }
      if (weekHours > 60) {
        issues.push({ type: 'error', text: `${emp.name}: week ${w + 1} heeft ${weekHours.toFixed(1)}u (max 60u)` });
      }
    }
  });

  return issues;
}
