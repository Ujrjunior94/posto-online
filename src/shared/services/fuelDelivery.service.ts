import { FuelDelivery } from "../../types";
import { FuelDeliveryRepository } from "../repositories/FuelDeliveryRepository";

export class FuelDeliveryService {
  private repository = new FuelDeliveryRepository();

  public getDeliveries(): FuelDelivery[] {
    return this.repository.getAll();
  }

  public getDeliveryById(id: string): FuelDelivery | undefined {
    return this.repository.getById(id);
  }

  public addDelivery(delivery: FuelDelivery): void {
    this.repository.save(delivery);
  }

  public deleteDelivery(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Calculates volumetric discrepancies between invoice-declared liters vs actual flowmeter receipt liters.
   * Tolerates standard expansion variations up to 0.5% (ANP limit).
   */
  public calculateDeliveryDiscrepancy(declaredLiters: number, measuredLiters: number): {
    discrepancyLiters: number;
    pct: number;
    acceptable: boolean;
  } {
    const discrepancyLiters = measuredLiters - declaredLiters;
    const pct = declaredLiters > 0 ? (discrepancyLiters / declaredLiters) * 100 : 0;
    const acceptable = Math.abs(pct) <= 0.5; // Up to 0.5% temperature expansion/shrinkage tolerance

    return {
      discrepancyLiters: parseFloat(discrepancyLiters.toFixed(2)),
      pct: parseFloat(pct.toFixed(2)),
      acceptable,
    };
  }

  /**
   * Mock OCR analyzer representing advanced scanning functionality on invoice (Nota Fiscal) files
   */
  public parseInvoiceOCR(rawOcrText: string): Partial<FuelDelivery> {
    try {
      // Find typical pattern for NFe (e.g. "Chave NFe: 3524...")
      const nfeMatch = rawOcrText.match(/(?:NFe|Nota Fiscal|Nº)\s*:\s*(\d+)/i) || rawOcrText.match(/\b\d{9}\b/);
      const volumeMatch = rawOcrText.match(/(?:Volume|Qtd|Lts|Litros)\s*:\s*([\d.,\s]+)/i);
      const fuelMatch = rawOcrText.match(/(Gasolina|Etanol|Diesel)/i);

      let volume = 0;
      if (volumeMatch && volumeMatch[1]) {
        volume = parseFloat(volumeMatch[1].replace(/[^\d]/g, "")) || 0;
      }

      return {
        id: "ocr_" + Date.now(),
        invoiceNumber: nfeMatch ? nfeMatch[1] : "SCAN-" + Math.floor(Math.random() * 100000),
        fuelType: fuelMatch ? fuelMatch[1] : "Gasolina Comum",
        volume: volume > 0 ? volume : 15000,
        driverName: "Motorista Autodetectado",
        truckPlate: "ABC-1234",
      };
    } catch (e) {
      console.warn("OCR Invoice Parser failed:", e);
      return {};
    }
  }

  /**
   * Mandatory safety checklist for discharge operations
   */
  public getDischargeSafetyChecklist(): { id: string; item: string; required: boolean }[] {
    return [
      { id: "aterramento", item: "Cabo de aterramento conectado", required: true },
      { id: "extintores", item: "Extintores portáteis posicionados próximos à área", required: true },
      { id: "isolamento", item: "Isolamento da área de descarga concluído", required: true },
      { id: "amostra_retida", item: "Amostra-testemunha colhida e analisada", required: true },
      { id: "capacidade", item: "Verificado espaço livre no tanque receptor", required: true },
    ];
  }
}

export const fuelDeliveryService = new FuelDeliveryService();
