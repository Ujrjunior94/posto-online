import { BaseRepository } from "./BaseRepository";
import { ActivityLog } from "../../types";

export class NotificationRepository extends BaseRepository {
  public getAllLogs(): ActivityLog[] {
    return this.getAppState().audits || [];
  }

  public addLog(log: ActivityLog): void {
    const state = this.getAppState();
    const audits = [log, ...(state.audits || [])];
    this.saveAppState({ ...state, audits, updatedAt: Date.now() });
  }
}
