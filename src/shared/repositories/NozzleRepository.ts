import { BaseRepository } from "./BaseRepository";
import { Nozzle } from "../../types";

export class NozzleRepository extends BaseRepository {
  public getAll(): Nozzle[] {
    return this.getAppState().nozzles || [];
  }

  public getById(id: string): Nozzle | undefined {
    return this.getAll().find((n) => n.id === id);
  }

  public save(nozzle: Nozzle): void {
    const state = this.getAppState();
    const nozzles = [...(state.nozzles || [])];
    const index = nozzles.findIndex((n) => n.id === nozzle.id);

    if (index >= 0) {
      nozzles[index] = nozzle;
    } else {
      nozzles.push(nozzle);
    }

    this.saveAppState({ ...state, nozzles, updatedAt: Date.now() });
  }

  public delete(id: string): void {
    const state = this.getAppState();
    const nozzles = (state.nozzles || []).filter((n) => n.id !== id);
    this.saveAppState({ ...state, nozzles, updatedAt: Date.now() });
  }
}
