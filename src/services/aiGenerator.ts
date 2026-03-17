import { GoogleGenAI, Type } from "@google/genai";
import { AppState, Shift } from "../types";
import { getDaysInMonth, getDateStr, shiftKey } from "../utils";

export async function generateRosterAI(state: AppState, variant: string): Promise<Record<string, Shift>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const ym = state.settings.currentMonth;
  const days = getDaysInMonth(ym);
  
  const employees = state.employees.map(e => ({
    id: e.id,
    name: e.name,
    role: e.role,
    contractHours: e.contractHours,
    maxHoursPerWeek: e.maxHoursPerWeek,
    availability: e.availability,
    preferences: e.preferences
  }));

  const existingShifts = Object.entries(state.shifts)
    .filter(([_, s]) => s.isLocked || s.isVacation || s.isSick)
    .map(([k, s]) => ({ key: k, shift: s }));

  const fixedTasks = state.fixedTasks;

  const prompt = `
Je bent een expert in personeelsplanning. Genereer een rooster voor de maand ${ym}.
Het rooster moet voldoen aan de ATW-regels (Arbeidstijdenwet), contracturen respecteren, en rekening houden met medewerkervoorkeuren.
De strategie is: ${variant}.
Aantal dagen in de maand: ${days}.

Medewerkers:
${JSON.stringify(employees, null, 2)}

Vaste/Vrije diensten (deze MOETEN behouden blijven):
${JSON.stringify(existingShifts, null, 2)}

Vaste taken (deze moeten bij voorkeur gedekt worden door de juiste rollen):
${JSON.stringify(fixedTasks, null, 2)}

Openingstijden:
${JSON.stringify(state.settings.openingHours, null, 2)}

Drukke dagen:
${JSON.stringify(state.settings.busyDates, null, 2)}

Geef als antwoord uitsluitend een JSON object met een 'shifts' property. De 'shifts' property moet een array zijn van objecten.
Elk object in de array moet de volgende properties hebben:
- 'date' (string, formaat 'YYYY-MM-DD')
- 'employeeId' (string)
- 'startTime' (string, formaat 'HH:mm')
- 'endTime' (string, formaat 'HH:mm')
Zorg voor optimale dekking tijdens openingstijden.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shifts: {
              type: Type.ARRAY,
              description: "An array of generated shifts",
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                  employeeId: { type: Type.STRING },
                  startTime: { type: Type.STRING, description: "Start time in HH:mm format" },
                  endTime: { type: Type.STRING, description: "End time in HH:mm format" }
                },
                required: ["date", "employeeId", "startTime", "endTime"]
              }
            }
          },
          required: ["shifts"]
        }
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    const data = JSON.parse(jsonStr);
    
    const finalShifts: Record<string, Shift> = {};
    
    if (data.shifts && Array.isArray(data.shifts)) {
      for (const s of data.shifts) {
        const k = `${s.date}_${s.employeeId}`;
        finalShifts[k] = {
          date: s.date,
          employeeId: s.employeeId,
          startTime: s.startTime,
          endTime: s.endTime,
          notes: '',
          isLocked: false,
          isVacation: false,
          isSick: false
        };
      }
    }

    for (const { key, shift } of existingShifts) {
      finalShifts[key] = { ...shift };
    }

    return finalShifts;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
