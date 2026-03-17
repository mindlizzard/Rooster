import { useState, useEffect, useCallback } from 'react';
import { AppState, Role } from '../types';
import { currentMonthStr } from '../utils';

const initialState: AppState = {
  employees: [],
  shifts: {},
  openShifts: [],
  snipperdagen: [],
  fixedTasks: [
    { id: 'ft1', name: 'Daily Inventory', dayOfWeek: null, startTime: '08:00', endTime: '09:00', role: 'Manager' },
    { id: 'ft2', name: 'Weekly Training', dayOfWeek: 1, startTime: '14:00', endTime: '16:00', role: 'Manager' },
    { id: 'ft3', name: 'Admin & Papierwerk', dayOfWeek: 5, startTime: '10:00', endTime: '12:00', role: 'Shift Leader' }
  ],
  checklists: [
    { id: 'c1', text: 'Terras klaarzetten', completed: false, category: 'Opening' },
    { id: 'c2', text: 'Kassa opmaken', completed: false, category: 'Sluiting' },
    { id: 'c3', text: 'Voorraad checken', completed: false, category: 'Algemeen' }
  ],
  tradeRequests: [],
  vacationRequests: [],
  overtimeRequests: [],
  rosterVersions: [],
  settings: {
    currentMonth: currentMonthStr(),
    hasDriveThru: false,
    minStaffTotal: 2,
    minStaffDriveThru: 1,
    openingHours: {
      0: { open: '09:00', close: '23:00', is24h: false },
      1: { open: '09:00', close: '00:00', is24h: false },
      2: { open: '09:00', close: '00:00', is24h: false },
      3: { open: '09:00', close: '00:00', is24h: false },
      4: { open: '09:00', close: '00:00', is24h: false },
      5: { open: '09:00', close: '01:00', is24h: false },
      6: { open: '09:00', close: '01:00', is24h: false }
    },
    dateOverrides: {},
    busyDates: [],
    surcharges: {
      nightStart: '22:00', nightEnd: '06:00', nightPct: 50,
      weekendPct: 25, holidayPct: 100, eveningFrom: '18:00', eveningPct: 15
    },
    hourlyRates: { 'Shift Leader': 18.50, 'Manager': 22.00, 'Assistant Manager': 15.50 },
    shiftTemplates: [
      { name: 'Ochtend', start: '07:00', end: '15:00' },
      { name: 'Middag', start: '11:00', end: '19:00' },
      { name: 'Avond', start: '15:00', end: '23:00' },
      { name: 'Nacht', start: '22:00', end: '06:00' },
      { name: 'Split AM', start: '08:00', end: '16:00' },
      { name: 'Split PM', start: '16:00', end: '00:00' }
    ],
    budget: 0,
    aiEnabled: false,
    darkMode: false,
    restBlocksPerMonth: 2,
    restBlockSize: 2
  }
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadState() {
      try {
        // Try to load from API first
        const response = await fetch('/api/state');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setState(data);
            return;
          }
        }
      } catch (error) {
        console.warn("API load failed, falling back to localStorage:", error);
      }

      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('mcplanner_state');
        if (saved) {
          setState(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Failed to load from localStorage:", error);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, []);

  const saveState = useCallback(async (newState: AppState) => {
    setState(newState);
    
    // Always save to localStorage as a backup/standalone persistence
    try {
      localStorage.setItem('mcplanner_state', JSON.stringify(newState));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }

    // Try to save to API
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState)
      });
    } catch (error) {
      console.warn("API save failed:", error);
    }
  }, []);

  return { state, setState: saveState, loading };
}
