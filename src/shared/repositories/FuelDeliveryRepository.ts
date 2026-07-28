import { BaseRepository } from "./BaseRepository";
import { FuelDelivery } from "../../types";

export class FuelDeliveryRepository extends BaseRepository {
  public getAll(): FuelDelivery[] {
    return this.getAppState().deliveries || [];
  }

  public getById(id: string): FuelDelivery | undefined {
    return this.getAll().find((d) => d.id === id);
  }

  public save(delivery: FuelDelivery): void {
    const state = this.getAppState();
    const deliveries = [...(state.deliveries || [])];
    const index = deliveries.findIndex((d) => d.id === delivery.id);

    if (index >= 0) {
      deliveries[index] = delivery;
    } else {
      deliveries.push(delivery);
    }

    this.saveAppState({ ...state, deliveries, updatedAt: Date.now() });
  }

  public delete(id: string): void {
    const state = this.getAppState();
    const deliveries = (state.deliveries || []).filter((d) => d.id !== id);
    this.saveAppState({ ...state, deliveries, updatedAt: Date.now() });
  }
}
