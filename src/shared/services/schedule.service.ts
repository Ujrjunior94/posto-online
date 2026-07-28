import { ShiftSchedule } from "../../types";
import { planningService } from "./planning.service";

export class ScheduleService {
  public getShifts(): ShiftSchedule[] {
    return planningService.getSchedules();
  }

  public saveShift(shift: ShiftSchedule): void {
    planningService.saveSchedule(shift);
  }

  public deleteShift(id: string): void {
    planningService.deleteSchedule(id);
  }

  /**
   * Identifies shifts with unresolved checklists or missing assignments
   */
  public findIncompleteShifts(shifts: ShiftSchedule[]): ShiftSchedule[] {
    return shifts.filter((s) => {
      const checklistValues = Object.values(s.checklist || {});
      const hasPendingChecklist = checklistValues.some((v) => v === false);
      return s.status === "Em Andamento" || (s.status === "Fechado" && hasPendingChecklist);
    });
  }
}

export const scheduleService = new ScheduleService();
