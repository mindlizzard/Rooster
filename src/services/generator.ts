import { AppState, Shift, Employee } from "../types";
import { getDaysInMonth, getDateStr, getDayOfWeek, timeToMins, getEffectiveCloseMins, getOpeningHours, minsToTime, shiftDuration, shiftKey, isBusy, isHoliday, calcShiftSalary, validateATWShift } from "../utils";

export const GEN_STRATEGIES = {
  balanced: {
    icon: '⚖️', name: 'Gebalanceerd',
    desc: 'Eerlijke verdeling van ochtenddiensten, avonddiensten en weekends over alle medewerkers. Diensttijden roteren per week.',
    variants: [
      { key: 'strict', label: 'Eerlijk', badge: '✓ Exact contract', desc: 'Precies op contracturen. Alle voorkeuren gerespecteerd.' },
      { key: 'optimal', label: 'Optimaal', badge: '↑ +10% uren', desc: 'Iets boven contract. Betere dekking op drukke dagen.' },
      { key: 'generous', label: 'Ruim bezet', badge: '↑↑ Max dekking', desc: 'Maximale bezetting. Nooit onderbezet, ook bij ziekte.' }
    ]
  },
  blocks: {
    icon: '🧱', name: 'Vrije blokken',
    desc: 'Elke medewerker krijgt 2× 2 aaneengesloten vrije dagen. Staggered over het team zodat dekking altijd gewaarborgd blijft.',
    variants: [
      { key: 'early', label: 'Vrij begin', badge: '📅 Week 1-2 vrij', desc: 'Vrije blokken vroeg in de maand. Druk aan einde.' },
      { key: 'mid', label: 'Vrij midden', badge: '📅 Week 2-3 vrij', desc: 'Vrije blokken middenin. Stabiele start en einde.' },
      { key: 'late', label: 'Vrij einde', badge: '📅 Week 3-4 vrij', desc: 'Vrije blokken laat in de maand. Sterk begin.' }
    ]
  },
  weekend: {
    icon: '🎉', name: 'Weekend focus',
    desc: 'Vrijdag, zaterdag en zondag maximaal bezet voor piektijden. Ma t/m wo bewust lichtere bezetting voor werkplezier.',
    variants: [
      { key: 'strict', label: 'Streng', badge: '📉 Ma-Wo minimaal', desc: 'Doordeweeks alleen minimumbezetting. Weekend alles erop.' },
      { key: 'balanced', label: 'Afgewogen', badge: '📊 Gebalanceerd', desc: 'Weekdagen gedekt maar lean. Weekend maximaal.' },
      { key: 'flex', label: 'Flexibel', badge: '📈 Uren gestuurd', desc: 'Weekend maximaal. Doordeweeks op basis van urenbudget.' }
    ]
  },
  cost: {
    icon: '💰', name: 'Kostenbewust',
    desc: 'Minimaliseert loonkosten. Goedkopere medewerkers op toeslagdagen. Senior staff alleen op drukste momenten.',
    variants: [
      { key: 'minimal', label: 'Minimaal', badge: '€ Min kosten', desc: 'Minimumbezetting. Laagste loonkosten van de maand.' },
      { key: 'optimal', label: 'Geoptimaliseerd', badge: '€€ Beste ratio', desc: 'Balans kosten en dekking. Slim toewijzen per rol.' },
      { key: 'quality', label: 'Kwaliteit', badge: '★ Senior-first', desc: 'Ervaren medewerkers op drukke en complexe diensten.' }
    ]
  },
  rotation: {
    icon: '🔄', name: 'Rotatieschema',
    desc: 'Echte wekelijkse dienstrotatie. Elke medewerker wisselt systematisch van vroeg→midden→laat dienst. Eerlijk en transparant.',
    variants: [
      { key: 'forward', label: 'Voorwaarts', badge: '→ Vroeg▸Mid▸Laat', desc: 'Klassieke voorwaartse rotatie. Elke week een slag later.' },
      { key: 'backward', label: 'Achterwaarts', badge: '← Laat▸Mid▸Vroeg', desc: 'Achterwaartse rotatie. Bewezen beter voor bioritme.' },
      { key: 'biweekly', label: '2-wekelijks', badge: '⏱ Per 2 weken', desc: 'Elke 2 weken wisselen. Meer aanpassingstijd per periode.' }
    ]
  },
  ai: {
    icon: '✨', name: 'AI-Gestuurd',
    desc: 'Laat de AI het perfecte rooster berekenen. Houdt rekening met alle voorkeuren, contracturen, ATW-regels en minimaliseert loonkosten.',
    variants: [
      { key: 'balanced', label: 'Gebalanceerd', badge: '⚖️ AI Balans', desc: 'AI zoekt de beste balans tussen kosten en voorkeuren.' },
      { key: 'cost', label: 'Kosten focus', badge: '💰 AI Kosten', desc: 'AI focust maximaal op het minimaliseren van loonkosten.' },
      { key: 'happy', label: 'Medewerker focus', badge: '😊 AI Voorkeur', desc: 'AI focust maximaal op de wensen van het team.' }
    ]
  }
};

export function generateRoster(state: AppState, strategy: string, label: string, variant: string) {
  const ym = state.settings.currentMonth;
  const days = getDaysInMonth(ym);
  const emps = [...state.employees];
  const shifts: Record<string, Shift> = {};
  
  // Trackers
  const empCons: Record<string, number> = {}; // Consecutive days worked
  const empWeekH: Record<string, Record<number, number>> = {}; // Hours worked per week
  const empMonthH: Record<string, number> = {}; // Hours worked this month
  const empLastEnd: Record<string, number | null> = {}; // End time of last shift in minutes from start of month
  const empRest: Record<string, Set<number>> = {}; // Assigned rest blocks (days)

  // Configuration based on strategy and variant
  const variantTuning: Record<string, number> = {
    'balanced_strict': 1.0, 'balanced_optimal': 1.1, 'balanced_generous': 1.22,
    'blocks_early': 1.0, 'blocks_mid': 1.0, 'blocks_late': 1.0,
    'weekend_strict': 1.0, 'weekend_balanced': 1.05, 'weekend_flex': 1.12,
    'cost_minimal': 0.92, 'cost_optimal': 1.0, 'cost_quality': 1.08,
    'rotation_forward': 1.0, 'rotation_backward': 1.0, 'rotation_biweekly': 1.0
  };
  const hoursMult = variantTuning[`${strategy}_${variant}`] || 1.0;

  const honorPrefs = !['balanced_generous', 'weekend_flex'].includes(`${strategy}_${variant}`);
  const costMode = strategy === 'cost';
  const rotMode = strategy === 'rotation';

  // Initialize trackers
  emps.forEach(e => {
    empCons[e.id] = 0;
    empWeekH[e.id] = {};
    empMonthH[e.id] = 0;
    empLastEnd[e.id] = null;
    empRest[e.id] = new Set();
  });

  // 1. Preserve existing locked, sick, and vacation shifts
  for (let d = 1; d <= days; d++) {
    const ds = getDateStr(ym, d);
    const wk = Math.floor((d - 1) / 7);
    
    emps.forEach(e => {
      const sk = shiftKey(ds, e.id);
      const ex = state.shifts[sk];
      
      if (!empWeekH[e.id][wk]) empWeekH[e.id][wk] = 0;
      
      if (ex && (ex.isLocked || ex.isVacation || ex.isSick || ex.sickHours)) {
        shifts[sk] = { ...ex };
        
        // Calculate hours to deduct from targets
        let dur = 0;
        if (ex.isVacation || ex.isSick) {
          // Full day absence counts as average daily contract hours
          dur = e.contractHours / 5; 
        } else {
          // Actual worked hours + partial sick hours
          dur = shiftDuration(ex.startTime, ex.endTime) + (ex.sickHours || 0);
          
          // Update consecutive days and last end time for ATW
          empCons[e.id]++;
          let em = timeToMins(ex.endTime);
          if (em <= timeToMins(ex.startTime)) em += 1440; // Crosses midnight
          empLastEnd[e.id] = (d - 1) * 1440 + em;
        }
        
        empWeekH[e.id][wk] += dur;
        empMonthH[e.id] += dur;
      } else {
        // Reset consecutive days if no shift
        empCons[e.id] = 0;
      }
    });
  }

  // 2. Assign Rest Blocks (if strategy is blocks)
  if (strategy === 'blocks') {
    const nBlocks = state.settings.restBlocksPerMonth || 2;
    const phaseMap: Record<string, number> = { 'early': 0, 'mid': 1, 'late': 2 };
    const phaseByVariant = phaseMap[variant] || 0;
    
    emps.forEach((emp, ei) => {
      if (nBlocks === 0) return;
      const sp = Math.floor(days / (nBlocks + 1));
      const phase = phaseByVariant * Math.floor(days / 3);
      
      for (let b = 0; b < nBlocks; b++) {
        const eo = Math.round(ei * (sp / Math.max(1, emps.length)));
        let start = ((phase + eo + sp * (b + 1) - 1) % days) + 1;
        start = Math.max(1, Math.min(days - 1, start));
        
        let placed = false;
        // Try to find 2 consecutive days without existing shifts, busy days, or holidays
        for (let a = 0; a < sp && !placed; a++) {
          const d1 = ((start + a - 1) % days) + 1;
          const d2 = d1 % days + 1;
          const s1 = getDateStr(ym, d1), s2 = getDateStr(ym, d2);
          
          if (!shifts[shiftKey(s1, emp.id)] && !shifts[shiftKey(s2, emp.id)] &&
              !isBusy(s1, state.settings.busyDates) && !isHoliday(s1) &&
              !isBusy(s2, state.settings.busyDates) && !isHoliday(s2) &&
              !empRest[emp.id].has(d1) && !empRest[emp.id].has(d2)) {
            empRest[emp.id].add(d1);
            empRest[emp.id].add(d2);
            placed = true;
          }
        }
        // Fallback: just assign the days even if not ideal
        if (!placed) { 
          const d1 = Math.max(1, Math.min(days - 1, start)); 
          empRest[emp.id].add(d1); 
          empRest[emp.id].add(d1 + 1); 
        }
      }
    });
  }

  // Helper: Check if a day is high priority
  function isPriority(ds: string) {
    if (state.settings.busyDates.includes(ds) || isHoliday(ds)) return true;
    if (strategy === 'weekend') { 
      const d = getDayOfWeek(ds); 
      return d === 5 || d === 6 || d === 0; // Fri, Sat, Sun
    }
    return false;
  }

  // Helper: Check if employee can work on a specific day
  function canWork(emp: Employee, d: number, wk: number, openMins: number, opts: any = {}) {
    const ds = getDateStr(ym, d);
    const dow = getDayOfWeek(ds);
    
    // 1. Check existing shift
    if (shifts[shiftKey(ds, emp.id)]) return false;

    // 2. Check rest blocks
    if (!opts.ignoreRest && strategy === 'blocks' && empRest[emp.id].has(d) && !isPriority(ds)) return false;

    // 3. Check availability
    if (!opts.ignoreAvail) {
      const av = emp.availability;
      const adays = av?.allDays ? [0, 1, 2, 3, 4, 5, 6] : (av?.days || [1, 2, 3, 4, 5]);
      if (!adays.includes(dow)) return false;
    }

    // 4. Check preferences
    if (!opts.ignorePrefs && honorPrefs && emp.preferences?.noWeekend && (dow === 0 || dow === 6)) return false;

    // 5. ATW: Max consecutive days (6 days max)
    if (!opts.ignoreCons && empCons[emp.id] >= 6) return false;

    // 6. ATW: Max hours per week (usually 48, max 60)
    if (!opts.ignoreBudget) {
      const currentWeekH = empWeekH[emp.id][wk] || 0;
      if (currentWeekH + 6 > Math.min(emp.maxHoursPerWeek || 48, 60)) return false;
    }

    // 7. Check monthly contract target
    if (!opts.ignoreBudget) {
      const targetMonthH = (emp.contractHours * days / 7) * hoursMult;
      if (empMonthH[emp.id] >= targetMonthH) return false;
    }

    // 8. ATW: Minimum rest between shifts (11 hours = 660 mins)
    if (empLastEnd[emp.id] !== null) {
      const timeSinceLastShift = ((d - 1) * 1440 + openMins) - (empLastEnd[emp.id] as number);
      if (timeSinceLastShift < 660) return false;
    }

    return true;
  }

  // Helper: Generate shift templates for the day
  function generateShiftTemplates(openMins: number, closeMins: number, n: number, strategy: string, variant: string): [number, number][] {
    const wm = closeMins - openMins;
    const dur = Math.min(480, wm); // Max 8 hours per shift
    const templates: [number, number][] = [];
    
    if (n <= 0) return templates;
    if (n === 1) {
      templates.push([openMins, Math.min(closeMins, openMins + dur)]);
      return templates;
    }

    const maxOff = Math.max(0, wm - dur);
    const step = Math.floor(maxOff / (n - 1));
    
    const nudgeMap: Record<string, number> = { 
      'balanced_optimal': -1, 'balanced_generous': 1, 
      'cost_quality': -1, 
      'blocks_early': -1, 'blocks_late': 1, 
      'weekend_flex': 1
    };
    const nudge = nudgeMap[`${strategy}_${variant}`] || 0;

    for (let i = 0; i < n; i++) {
      if (i === 0) {
        templates.push([openMins, Math.min(closeMins, openMins + dur)]);
      } else if (i === n - 1) {
        templates.push([Math.max(openMins, closeMins - dur), closeMins]);
      } else {
        const off = Math.max(0, Math.min(maxOff, Math.round(i * step / 30) * 30 + nudge * Math.max(1, Math.round(step * .15 / 30)) * 30));
        templates.push([openMins + off, Math.min(closeMins, openMins + off + dur)]);
      }
    }
    
    return templates.sort((a, b) => a[0] - b[0]);
  }

  // 3. Generate Schedule Day by Day
  for (let d = 1; d <= days; d++) {
    const ds = getDateStr(ym, d);
    const oh = getOpeningHours(ds, state.settings);
    const wk = Math.floor((d - 1) / 7);
    const dow = getDayOfWeek(ds);
    
    const openMins = timeToMins(oh.open || '09:00');
    const closeMins = getEffectiveCloseMins(oh.open || '09:00', oh.close || '23:00');
    
    // Skip if closed or open for less than 6 hours
    if (closeMins - openMins < 360) { 
      emps.forEach(e => { if (!shifts[shiftKey(ds, e.id)]) empCons[e.id] = 0; }); 
      continue; 
    }

    // Determine required coverage based on open hours
    const openHours = (closeMins - openMins) / 60;
    
    // Get fixed tasks for today
    const tasksToday = state.fixedTasks.filter(t => t.dayOfWeek === null || t.dayOfWeek === dow);
    
    let minCover = 1;
    if (openHours >= 12) minCover = 3; // Long day -> Opener, Mid, Closer
    else if (openHours >= 8) minCover = 2; // Normal day -> Opener, Closer
    
    // Adjust coverage based on strategy
    if (strategy === 'balanced' && variant === 'generous') minCover += 1;
    if (strategy === 'cost' && variant === 'minimal') minCover = Math.max(1, minCover - 1);
    if (strategy === 'weekend') {
      const isWeekend = dow === 5 || dow === 6 || dow === 0;
      if (isWeekend) minCover += (variant === 'strict' ? 2 : variant === 'balanced' ? 1 : 2);
      else minCover = Math.max(1, minCover - (variant === 'strict' ? 1 : 0));
    }

    // Add extra coverage for marked busy dates (like weekend strict)
    if (state.settings.busyDates.includes(ds)) {
      minCover += 2; // Add 2 extra people on busy days
    }

    let templates = generateShiftTemplates(openMins, closeMins, minCover, strategy, variant);

    // Who is already working today? (Fixed shifts)
    const alreadyWorking = emps.filter(e => {
      const s = shifts[shiftKey(ds, e.id)];
      return s && !s.isVacation && !s.isSick;
    });
    
    const hasManager = alreadyWorking.some(e => e.role === 'Manager' || e.role === 'Shift Leader');
    
    // Remove templates covered by alreadyWorking
    alreadyWorking.forEach(emp => {
      const s = shifts[shiftKey(ds, emp.id)];
      const sStart = timeToMins(s.startTime);
      let closestIdx = -1;
      let minDiff = Infinity;
      templates.forEach((t, idx) => {
        const diff = Math.abs(t[0] - sStart);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      if (closestIdx !== -1 && minDiff <= 120) {
        templates.splice(closestIdx, 1);
      } else if (templates.length > 0) {
        templates.splice(0, 1);
      }
    });

    let stillNeed = templates.length;

    // Pool of available employees for today
    const pool = emps.filter(e => !shifts[shiftKey(ds, e.id)]);
    
    // Sort pool by priority
    const sortedPool = pool.sort((a, b) => {
      // 1. Cost strategy: prioritize cheaper employees
      if (costMode && variant === 'minimal') {
        return (state.settings.hourlyRates[a.role] || 15) - (state.settings.hourlyRates[b.role] || 15);
      }
      
      // 2. Target hours remaining
      const aTarget = (a.contractHours * days / 7) * hoursMult;
      const bTarget = (b.contractHours * days / 7) * hoursMult;
      const aLeft = aTarget - empMonthH[a.id];
      const bLeft = bTarget - empMonthH[b.id];
      
      // 3. Consecutive days penalty
      const aCons = empCons[a.id] || 0;
      const bCons = empCons[b.id] || 0;
      
      const aScore = (aLeft / Math.max(1, aTarget)) - (aCons * 0.2);
      const bScore = (bLeft / Math.max(1, bTarget)) - (bCons * 0.2);
      
      return bScore - aScore;
    });

    let sched: Employee[] = [];
    
    // Filter eligible employees (strict)
    let elig = sortedPool.filter(e => canWork(e, d, wk, openMins, {}));

    // Ensure Manager/Shift Leader coverage
    if (!hasManager && stillNeed > 0) {
      let mgrIdx = elig.findIndex(e => e.role === 'Manager' || e.role === 'Shift Leader');
      if (mgrIdx !== -1) {
        sched.push(elig[mgrIdx]);
        elig.splice(mgrIdx, 1);
        stillNeed--;
      } else {
        // Relax budget constraint for managers
        const desperateMgrs = sortedPool.filter(e => 
          (e.role === 'Manager' || e.role === 'Shift Leader') && 
          canWork(e, d, wk, openMins, { ignoreBudget: true })
        );
        if (desperateMgrs.length > 0) {
          sched.push(desperateMgrs[0]);
          stillNeed--;
        }
      }
    }

    // Fill remaining needs
    if (stillNeed > 0) {
      const toAdd = elig.slice(0, stillNeed);
      sched.push(...toAdd);
      stillNeed -= toAdd.length;
    }

    // Relax constraints if still understaffed
    if (stillNeed > 0) {
      // Ignore budget
      const eligNoBudget = sortedPool.filter(e => !sched.includes(e) && canWork(e, d, wk, openMins, { ignoreBudget: true }));
      const toAdd = eligNoBudget.slice(0, stillNeed);
      sched.push(...toAdd);
      stillNeed -= toAdd.length;
    }
    
    if (stillNeed > 0) {
      // Ignore preferences
      const eligNoPrefs = sortedPool.filter(e => !sched.includes(e) && canWork(e, d, wk, openMins, { ignoreBudget: true, ignorePrefs: true }));
      const toAdd = eligNoPrefs.slice(0, stillNeed);
      sched.push(...toAdd);
      stillNeed -= toAdd.length;
    }

    // Assign shift times and place
    sched.forEach((emp, i) => {
      const ei = emps.findIndex(e => e.id === emp.id);
      
      // Get time from template if available, otherwise fallback to an 8-hour shift
      let times = i < templates.length ? templates[i] : [openMins, Math.min(closeMins, openMins + 480)];
      
      // Override with rotation logic if applicable
      if (rotMode) {
        let sl = 0;
        if (variant === 'forward') sl = (ei + wk) % 4;
        else if (variant === 'backward') sl = ((ei * 3) + (wk * 3) + 12) % 4;
        else sl = (ei + Math.floor(wk / 2)) % 4; // biweekly
        
        const dur = Math.min(480, closeMins - openMins);
        if (sl === 0 || sl === 3) times = [openMins, Math.min(closeMins, openMins + dur)]; // Early
        else if (sl === 2) times = [Math.max(openMins, closeMins - dur), closeMins]; // Late
        else {
          const mid = Math.round((openMins + (closeMins - dur) / 2) / 30) * 30;
          times = [Math.max(openMins, mid), Math.min(closeMins, mid + dur)]; // Mid
        }
      }
      
      const startTimeStr = minsToTime(times[0] % 1440);
      const endTimeStr = minsToTime(times[1] % 1440);
      const ds = getDateStr(ym, d);
      
      // Final ATW validation before placing
      const atwCheck = validateATWShift(shifts, emp, ds, startTimeStr, endTimeStr);
      if (atwCheck.isValid) {
        const sk = shiftKey(ds, emp.id);
        shifts[sk] = {
          date: ds,
          employeeId: emp.id,
          startTime: startTimeStr,
          endTime: endTimeStr,
          notes: '',
          isSick: false,
          isVacation: false,
          isLocked: false
        };
        
        // Update trackers
        const dur = (times[1] - times[0]) / 60;
        empCons[emp.id]++;
        empWeekH[emp.id][wk] += dur;
        empMonthH[emp.id] += dur;
        empLastEnd[emp.id] = (d - 1) * 1440 + times[1];
      }
    });

    // Reset consecutive days for those who didn't work
    emps.forEach(e => {
      if (!shifts[shiftKey(ds, e.id)]) {
        empCons[e.id] = 0;
      }
    });
  }

  // 4. Calculate Stats
  let totalHours = 0, totalCost = 0;
  const empStats: Record<string, any> = {};
  
  emps.forEach(e => {
    totalHours += empMonthH[e.id];
    empStats[e.id] = { 
      placed: empMonthH[e.id], 
      target: Math.round(e.contractHours * days / 7) 
    };
  });

  Object.values(shifts).forEach(s => {
    if (s.isVacation || s.isSick) return;
    const emp = emps.find(e => e.id === s.employeeId);
    if (emp) {
      totalCost += calcShiftSalary(s, emp, state.settings.surcharges, state.settings.hourlyRates).total;
    }
  });

  return { label, shifts, totalHours, totalCost, empStats, strategy, variant };
}
