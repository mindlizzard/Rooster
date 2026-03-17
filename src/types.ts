export type Role = 'Shift Leader' | 'Manager' | 'Assistant Manager';

export interface Availability {
  allDays: boolean;
  days: number[];
  earliestStart: string;
  latestEnd: string;
}

export interface Preferences {
  noMornings: boolean;
  noLate: boolean;
  noWeekend: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  contractHours: number;
  maxHoursPerWeek: number;
  vacationDays: number;
  hourlyRate: number;
  availability: Availability;
  preferences: Preferences;
}

export interface Shift {
  date: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  notes: string;
  isSick: boolean;
  isVacation: boolean;
  isLocked: boolean;
  sickHours?: number;
}

export interface OpeningHours {
  open: string;
  close: string;
  is24h: boolean;
}

export interface Surcharges {
  nightStart: string;
  nightEnd: string;
  nightPct: number;
  weekendPct: number;
  holidayPct: number;
  eveningFrom: string;
  eveningPct: number;
}

export interface ShiftTemplate {
  name: string;
  start: string;
  end: string;
}

export interface VacationRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  month: string;
}

export interface TradeRequest {
  id: string;
  fromId: string;
  toId: string;
  date: string;
  shiftKey: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FixedTask {
  id: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  role: Role;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}

export interface RosterVersion {
  id: string;
  label: string;
  date: string;
  month: string;
  shifts: Record<string, Shift>;
}

export interface Snipperdag {
  id: string;
  employeeId: string;
  date: string;
  note: string;
}

export interface Settings {
  currentMonth: string;
  hasDriveThru: boolean;
  minStaffTotal: number;
  minStaffDriveThru: number;
  openingHours: Record<number, OpeningHours>;
  dateOverrides: Record<string, OpeningHours>;
  busyDates: string[];
  surcharges: Surcharges;
  hourlyRates: Record<Role, number>;
  shiftTemplates: ShiftTemplate[];
  budget: number;
  aiEnabled: boolean;
  darkMode: boolean;
  restBlocksPerMonth: number;
  restBlockSize: number;
}

export interface OpenShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: Role | 'Any';
}

export interface AppState {
  employees: Employee[];
  shifts: Record<string, Shift>;
  openShifts: OpenShift[];
  snipperdagen: Snipperdag[];
  fixedTasks: FixedTask[];
  checklists: ChecklistItem[];
  tradeRequests: TradeRequest[];
  vacationRequests: VacationRequest[];
  overtimeRequests: any[];
  rosterVersions: RosterVersion[];
  settings: Settings;
}
