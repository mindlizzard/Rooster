import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
  const db = new Database("mcplanner.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    )
  `);

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.get("/api/state", (req, res) => {
    try {
      const row = db.prepare("SELECT data FROM state WHERE id = 1").get() as { data: string } | undefined;
      if (row) {
        res.json(JSON.parse(row.data));
      } else {
        // Return default state with some demo employees if database is empty
        const defaultState = {
          employees: [
            { id: 'emp1', name: 'Sophie van Berg', role: 'Manager', contractHours: 38, maxHoursPerWeek: 48, vacationDays: 28, hourlyRate: 22, availability: { allDays: true, days: [0, 1, 2, 3, 4, 5, 6], earliestStart: '07:00', latestEnd: '23:00' }, preferences: { noMornings: false, noLate: false, noWeekend: false } },
            { id: 'emp2', name: 'Liam Janssen', role: 'Shift Leader', contractHours: 32, maxHoursPerWeek: 44, vacationDays: 25, hourlyRate: 18.50, availability: { allDays: false, days: [1, 2, 3, 4, 5, 6], earliestStart: '09:00', latestEnd: '00:00' }, preferences: { noMornings: false, noLate: false, noWeekend: false } },
            { id: 'emp3', name: 'Emma de Vries', role: 'Assistant Manager', contractHours: 24, maxHoursPerWeek: 36, vacationDays: 22, hourlyRate: 15.50, availability: { allDays: false, days: [1, 2, 3, 4, 5], earliestStart: '07:00', latestEnd: '20:00' }, preferences: { noMornings: false, noLate: true, noWeekend: false } }
          ],
          shifts: {},
          openShifts: [],
          snipperdagen: [],
          fixedTasks: [],
          checklists: [],
          tradeRequests: [],
          vacationRequests: [],
          overtimeRequests: [],
          rosterVersions: [],
          settings: {
            currentMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
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
            surcharges: { nightStart: '22:00', nightEnd: '06:00', nightPct: 50, weekendPct: 25, holidayPct: 100, eveningFrom: '18:00', eveningPct: 15 },
            hourlyRates: { 'Shift Leader': 18.50, 'Manager': 22.00, 'Assistant Manager': 15.50 },
            shiftTemplates: [
              { name: 'Ochtend', start: '07:00', end: '15:00' },
              { name: 'Middag', start: '11:00', end: '19:00' },
              { name: 'Avond', start: '15:00', end: '23:00' }
            ],
            budget: 0,
            aiEnabled: false,
            darkMode: false,
            restBlocksPerMonth: 2,
            restBlockSize: 2
          }
        };
        res.json(defaultState);
      }
    } catch (error) {
      console.error("Error loading state:", error);
      res.status(500).json({ error: "Failed to load state" });
    }
  });

  app.post("/api/state", (req, res) => {
    try {
      const data = JSON.stringify(req.body);
      db.prepare("INSERT OR REPLACE INTO state (id, data) VALUES (1, ?)").run(data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving state:", error);
      res.status(500).json({ error: "Failed to save state" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
