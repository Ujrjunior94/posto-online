import { BaseRepository } from "./BaseRepository";
import { LmcRecord } from "../../types";

export class LMCRepository extends BaseRepository {
  public getAll(): LmcRecord[] {
    return this.getAppState().lmc || [];
  }

  public getById(id: string): LmcRecord | undefined {
    return this.getAll().find((l) => l.id === id);
  }

  public save(record: LmcRecord): void {
    const state = this.getAppState();
    const lmc = [...(state.lmc || [])];
    const index = lmc.findIndex((l) => l.id === record.id);

    if (index >= 0) {
      lmc[index] = record;
    } else {
      lmc.push(record);
    }

    this.saveAppState({ ...state, lmc, updatedAt: Date.now() });
  }

  public delete(id: string): void {
    const state = this.getAppState();
    const lmc = (state.lmc || []).filter((l) => l.id !== id);
    this.saveAppState({ ...state, lmc, updatedAt: Date.now() });
  }
}
