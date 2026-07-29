import { BaseRepository } from "./BaseRepository";
import { ShiftSchedule, EscalaPattern } from "../../types";

export class PlanningRepository extends BaseRepository {
  public getShifts(): ShiftSchedule[] {
    return this.getAppState().shifts || [];
  }

  public getPatterns(): EscalaPattern[] {
    return this.getAppState().schedulePatterns || [];
  }

  public saveShift(shift: ShiftSchedule): void {
    const state = this.getAppState();
    const shifts = [...(state.shifts || [])];
    const index = shifts.findIndex((s) => s.id === shift.id);

    if (index >= 0) {
      shifts[index] = shift;
    } else {
      shifts.push(shift);
    }

    this.saveAppState({ ...state, shifts, updatedAt: Date.now() });
  }

  public deleteShift(id: string): void {
    const state = this.getAppState();
    const shifts = (state.shifts || []).filter((s) => s.id !== id);
    this.saveAppState({ ...state, shifts, updatedAt: Date.now() });
  }

  public savePattern(pattern: EscalaPattern): void {
    const state = this.getAppState();
    const schedulePatterns = [...(state.schedulePatterns || [])];
    const index = schedulePatterns.findIndex((p) => p.id === pattern.id);

    if (index >= 0) {
      schedulePatterns[index] = pattern;
    } else {
      schedulePatterns.push(pattern);
    }

    this.saveAppState({ ...state, schedulePatterns, updatedAt: Date.now() });
  }

  public deletePattern(id: string): void {
    const state = this.getAppState();
    const schedulePatterns = (state.schedulePatterns || []).filter((p) => p.id !== id);
    this.saveAppState({ ...state, schedulePatterns, updatedAt: Date.now() });
  }
}
