import { Nozzle, NozzleCalibration } from "../../types";
import { NozzleRepository } from "../repositories/NozzleRepository";

export class NozzleService {
  private repository = new NozzleRepository();

  public getNozzles(): Nozzle[] {
    return this.repository.getAll();
  }

  public getNozzleById(id: string): Nozzle | undefined {
    return this.repository.getById(id);
  }

  public addOrUpdateNozzle(nozzle: Nozzle): void {
    this.repository.save(nozzle);
  }

  public deleteNozzle(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Evaluates if nozzle calibration is compliant (conforme) with ANP guidelines (+- 100ml in 20L)
   */
  public evaluateCalibration(measuredVolumeL: number, targetVolumeL: number = 20): { desvioMl: number; conforms: boolean } {
    const desvioMl = Math.round((measuredVolumeL - targetVolumeL) * 1000);
    const conforms = Math.abs(desvioMl) <= 100;
    return { desvioMl, conforms };
  }

  /**
   * Tracks nozzle productivity KPI (average daily sales volume)
   */
  public getNozzleProductivity(nozzleId: string, totalLitersSold: number, activeDays: number): number {
    if (activeDays <= 0) return 0;
    return parseFloat((totalLitersSold / activeDays).toFixed(1));
  }

  /**
   * Determines if a nozzle requires preventive maintenance or is due for calibration
   */
  public isMaintenanceDue(lastCalibrationDate: string): { due: boolean; daysOverdue: number } {
    const lastDate = new Date(lastCalibrationDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Recommended calibration is every 30 days
    const limitDays = 30;
    return {
      due: diffDays > limitDays,
      daysOverdue: Math.max(0, diffDays - limitDays),
    };
  }

  /**
   * QR Code payload generation for hardware pairing/tagging
   */
  public generateQrPayload(nozzle: Nozzle): string {
    return JSON.stringify({
      id: nozzle.id,
      bico: nozzle.numeroBico,
      bomba: nozzle.bombaAssociada,
      preco: nozzle.precoPorLitro,
      tanqueId: nozzle.tanqueId,
    });
  }
}

export const nozzleService = new NozzleService();
