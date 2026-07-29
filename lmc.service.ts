import { BaseRepository } from "./BaseRepository";
import { ShiftSchedule } from "../../types";

export class ChecklistRepository extends BaseRepository {
  public getAllChecklists(): { id: string; date: string; checklist: any; status: string }[] {
    const shifts = this.getAppState().shifts || [];
    return shifts.map((s) => ({
      id: s.id,
      date: s.data,
      checklist: s.checklist,
      status: s.status,
    }));
  }

  public saveChecklist(shiftId: string, checklist: any): void {
    const state = this.getAppState();
    const shifts = [...(state.shifts || [])];
    const index = shifts.findIndex((s) => s.id === shiftId);

    if (index >= 0) {
      shifts[index] = { ...shifts[index], checklist };
      this.saveAppState({ ...state, shifts, updatedAt: Date.now() });
    }
  }
}
