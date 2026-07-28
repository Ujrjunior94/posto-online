import { FuelTank } from "../../types";
import { TankRepository } from "../repositories/TankRepository";

export class TankService {
  private repository = new TankRepository();

  public getTanks(): FuelTank[] {
    return this.repository.getAll();
  }

  public getTankById(id: string): FuelTank | undefined {
    return this.repository.getById(id);
  }

  public addOrUpdateTank(tank: FuelTank): void {
    this.repository.save(tank);
  }

  public deleteTank(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Calculates volumetric level using physical dipstick height and diameter
   */
  public calculateVolumetricCurve(heightCm: number, diameterCm: number, lengthCm: number): number {
    const r = diameterCm / 2;
    const h = heightCm;
    const L = lengthCm;

    if (h <= 0) return 0;
    if (h >= diameterCm) return Math.round(Math.PI * r * r * L / 1000);

    // Volumetric curve cylinder segment formula:
    const sectorArea = r * r * Math.acos((r - h) / r);
    const triangleArea = (r - h) * Math.sqrt(2 * r * h - h * h);
    const crossSectionArea = sectorArea - triangleArea;
    
    // Convert cubic cm to liters (divide by 1000)
    const volumeLiters = (crossSectionArea * L) / 1000;
    return Math.round(volumeLiters);
  }

  /**
   * Predicts critical safety runtime remaining (previsão de ruptura de estoque) based on current volume and average sales rate
   */
  public predictStockRuptureDays(currentVolume: number, avgDailySalesLiters: number): number {
    if (avgDailySalesLiters <= 0) return 999;
    return parseFloat((currentVolume / avgDailySalesLiters).toFixed(1));
  }

  /**
   * Analyzes daily volumetric loss/gain variance
   */
  public calculateVariance(physicalStock: number, bookStock: number): { variance: number; pct: number; conforms: boolean } {
    const variance = physicalStock - bookStock;
    const pct = bookStock > 0 ? (variance / bookStock) * 100 : 0;
    
    // ANP rule: tolerance of +-0.6% on total volume
    const conforms = Math.abs(pct) <= 0.6;
    return {
      variance,
      pct: parseFloat(pct.toFixed(2)),
      conforms,
    };
  }

  /**
   * Standard alerts for critical points
   */
  public checkCriticalAlert(tank: FuelTank): { status: "OK" | "CRITICO" | "ALERTA"; message: string } {
    const ratio = tank.volumeAtual / tank.capacidadeMaxima;
    if (tank.volumeAtual <= tank.pontoCriticoAlerta) {
      return { status: "CRITICO", message: `Nível crítico no ${tank.identificador}! Reabastecer urgentemente.` };
    }
    if (ratio <= 0.2) {
      return { status: "ALERTA", message: `Nível baixo de ${tank.combustivel} no ${tank.identificador} (${Math.round(ratio * 100)}%)` };
    }
    return { status: "OK", message: "Nível dentro dos limites operacionais seguros." };
  }
}

export const tankService = new TankService();
