import { LmcRecord } from "../../types";
import { LMCRepository } from "../repositories/LMCRepository";

export class LmcService {
  private repository = new LMCRepository();

  public getLmcRecords(): LmcRecord[] {
    return this.repository.getAll();
  }

  public getLmcRecordById(id: string): LmcRecord | undefined {
    return this.repository.getById(id);
  }

  public addOrUpdateLmcRecord(record: LmcRecord): void {
    // Perform standard ANP validation & bookkeeping checks before saving
    const opening = Number(record.openingStock) || 0;
    const delivery = Number(record.deliveryVolume) || 0;
    const sold = Number(record.litersSold) || 0;
    const bookStock = opening + delivery - sold;

    const physical = Number(record.physicalStock) || 0;
    const gainLoss = physical - bookStock;

    const updatedRecord: LmcRecord = {
      ...record,
      bookStock: parseFloat(bookStock.toFixed(2)),
      gainLossLiters: parseFloat(gainLoss.toFixed(2)),
    };

    this.repository.save(updatedRecord);
  }

  public deleteLmcRecord(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Generates ANP monthly closing statistics for the audit reports
   */
  public generateMonthlyLmcStats(records: LmcRecord[], fuelType: string): {
    totalOpening: number;
    totalReceived: number;
    totalSold: number;
    finalPhysical: number;
    totalGainLoss: number;
    isCompliant: boolean;
  } {
    const filtered = records.filter((r) => r.fuelType === fuelType);
    if (filtered.length === 0) {
      return { totalOpening: 0, totalReceived: 0, totalSold: 0, finalPhysical: 0, totalGainLoss: 0, isCompliant: true };
    }

    // Sort by date ascending
    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const totalOpening = sorted[0].openingStock;
    const finalPhysical = sorted[sorted.length - 1].physicalStock;

    const totalReceived = filtered.reduce((acc, curr) => acc + (curr.deliveryVolume || 0), 0);
    const totalSold = filtered.reduce((acc, curr) => acc + (curr.litersSold || 0), 0);
    const totalGainLoss = filtered.reduce((acc, curr) => acc + (curr.gainLossLiters || 0), 0);

    const totalBookStock = totalOpening + totalReceived - totalSold;
    const pctDeviation = totalBookStock > 0 ? (totalGainLoss / totalBookStock) * 100 : 0;

    // Conforms to ANP +-0.6% deviation tolerance limits
    const isCompliant = Math.abs(pctDeviation) <= 0.6;

    return {
      totalOpening,
      totalReceived,
      totalSold,
      finalPhysical,
      totalGainLoss: parseFloat(totalGainLoss.toFixed(2)),
      isCompliant,
    };
  }
}

export const lmcService = new LmcService();
