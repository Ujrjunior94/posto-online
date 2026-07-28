import { BaseRepository } from "./BaseRepository";
import { DailyBalance } from "../../types";

export class ReportRepository extends BaseRepository {
  public getDailyBalances(): DailyBalance[] {
    return this.getAppState().dailyBalances || [];
  }

  public saveDailyBalance(balance: DailyBalance): void {
    const state = this.getAppState();
    const dailyBalances = [...(state.dailyBalances || [])];
    const index = dailyBalances.findIndex((b) => b.id === balance.id);

    if (index >= 0) {
      dailyBalances[index] = balance;
    } else {
      dailyBalances.push(balance);
    }

    this.saveAppState({ ...state, dailyBalances, updatedAt: Date.now() });
  }

  public deleteDailyBalance(id: string): void {
    const state = this.getAppState();
    const dailyBalances = (state.dailyBalances || []).filter((b) => b.id !== id);
    this.saveAppState({ ...state, dailyBalances, updatedAt: Date.now() });
  }
}
