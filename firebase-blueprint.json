import { EscalaPattern, ShiftSchedule } from "../../types";
import { PlanningRepository } from "../repositories/PlanningRepository";

export class PlanningService {
  private repository = new PlanningRepository();

  public getSchedules(): ShiftSchedule[] {
    return this.repository.getShifts();
  }

  public getPatterns(): EscalaPattern[] {
    return this.repository.getPatterns();
  }

  public saveSchedule(shift: ShiftSchedule): void {
    this.repository.saveShift(shift);
  }

  public deleteSchedule(id: string): void {
    this.repository.deleteShift(id);
  }

  public savePattern(pattern: EscalaPattern): void {
    this.repository.savePattern(pattern);
  }

  public deletePattern(id: string): void {
    this.repository.deletePattern(id);
  }

  /**
   * Automatically projects next days' schedules based on a defined EscalaPattern (e.g. 6x1 or 12x36 rotation)
   */
  public generateShiftProjections(pattern: EscalaPattern, startDate: string, daysAhead: number = 30): ShiftSchedule[] {
    const schedules: ShiftSchedule[] = [];
    const baseDate = new Date(startDate);

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];

      // Simple rotation logic depending on scale type
      let isWorking = true;
      let shiftName = pattern.sequenciaTurnos[0] || "Turno A (Manhã)";

      if (pattern.tipoEscala === "6x1") {
        const cycleDay = i % 7;
        if (cycleDay === 6) isWorking = false; // Rest on 7th day
      } else if (pattern.tipoEscala === "12x36") {
        isWorking = i % 2 === 0; // Alternates days
      }

      if (isWorking) {
        schedules.push({
          id: `proj_${pattern.id}_${dateStr}`,
          data: dateStr,
          turno: shiftName,
          frentistaResponsavel: pattern.funcionario,
          checklist: {
            limpezaPistas: false,
            usoEPIs: false,
            afericaoEquipamentosSeguranca: false,
            testeGerador: false,
          },
          status: "Planejado",
        });
      }
    }

    return schedules;
  }
}

export const planningService = new PlanningService();
