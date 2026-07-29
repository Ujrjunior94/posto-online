import { BaseRepository } from "./BaseRepository";
import { FuelTank } from "../../types";

export class TankRepository extends BaseRepository {
  public getAll(): FuelTank[] {
    return this.getAppState().tanks || [];
  }

  public getById(id: string): FuelTank | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  public save(tank: FuelTank): void {
    const state = this.getAppState();
    const tanks = [...(state.tanks || [])];
    const index = tanks.findIndex((t) => t.id === tank.id);

    if (index >= 0) {
      tanks[index] = tank;
    } else {
      tanks.push(tank);
    }

    this.saveAppState({ ...state, tanks, updatedAt: Date.now() });
  }

  public delete(id: string): void {
    const state = this.getAppState();
    const tanks = (state.tanks || []).filter((t) => t.id !== id);
    this.saveAppState({ ...state, tanks, updatedAt: Date.now() });
  }
}
