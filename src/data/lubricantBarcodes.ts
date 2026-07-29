/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LubricantBarcodeItem {
  barcode: string;
  nome: string;
  marca: string;
  viscosidade?: string;
  volume: string;
  unidadePadrao: "Frasco" | "Balde" | "Tambor" | "Caixa";
}

export const LUBRICANT_BARCODE_CATALOG: LubricantBarcodeItem[] = [
  // LUBRAX (BR / Vibra)
  { barcode: "7891348000010", nome: "Óleo Lubrax Top Turbo 15W40 CI-4 1L", marca: "Lubrax", viscosidade: "15W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891348000027", nome: "Óleo Lubrax Top Turbo 15W40 CI-4 20L", marca: "Lubrax", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },
  { barcode: "7891348000034", nome: "Óleo Lubrax Valora 5W30 API SP 1L", marca: "Lubrax", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891348000041", nome: "Óleo Lubrax Valora Offroad 5W30 1L", marca: "Lubrax", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891348000058", nome: "Óleo Lubrax Essencial 20W50 SL 1L", marca: "Lubrax", viscosidade: "20W50", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891348000065", nome: "Óleo Lubrax Tecno 10W40 SN 1L", marca: "Lubrax", viscosidade: "10W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891348000072", nome: "Óleo Lubrax Unitractor 10W30 20L", marca: "Lubrax", viscosidade: "10W30", volume: "20L", unidadePadrao: "Balde" },
  { barcode: "7891348000089", nome: "Óleo Lubrax Hydra ISO 68 20L", marca: "Lubrax", viscosidade: "ISO 68", volume: "20L", unidadePadrao: "Balde" },

  // MOBIL
  { barcode: "7891800001010", nome: "Óleo Mobil Super 3000 5W30 D1 1L", marca: "Mobil", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891800001027", nome: "Óleo Mobil Super 2000 10W40 1L", marca: "Mobil", viscosidade: "10W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891800001034", nome: "Óleo Mobil Delvac MX 15W40 1L", marca: "Mobil", viscosidade: "15W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891800001041", nome: "Óleo Mobil Delvac MX 15W40 20L", marca: "Mobil", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },
  { barcode: "7891800001058", nome: "Óleo Mobil 1 ESP 5W30 1L", marca: "Mobil", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },

  // SHELL
  { barcode: "7891010002012", nome: "Óleo Shell Helix Ultra 5W30 1L", marca: "Shell", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891010002029", nome: "Óleo Shell Helix HX8 5W40 1L", marca: "Shell", viscosidade: "5W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891010002036", nome: "Óleo Shell Helix HX7 10W40 1L", marca: "Shell", viscosidade: "10W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891010002043", nome: "Óleo Shell Rimula R4 X 15W40 1L", marca: "Shell", viscosidade: "15W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891010002050", nome: "Óleo Shell Rimula R4 X 15W40 20L", marca: "Shell", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },

  // IPIRANGA
  { barcode: "7891122003015", nome: "Óleo Ipiranga F1 Master Sintético 5W30 1L", marca: "Ipiranga", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891122003022", nome: "Óleo Ipiranga F1 Master Semissintético 10W40 1L", marca: "Ipiranga", viscosidade: "10W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891122003039", nome: "Óleo Ipiranga Brutus 15W40 CI-4 1L", marca: "Ipiranga", viscosidade: "15W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891122003046", nome: "Óleo Ipiranga Brutus 15W40 CI-4 20L", marca: "Ipiranga", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },

  // CASTROL
  { barcode: "7891456004018", nome: "Óleo Castrol Magnatec 5W30 A5 1L", marca: "Castrol", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891456004025", nome: "Óleo Castrol GTX 20W50 SL 1L", marca: "Castrol", viscosidade: "20W50", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891456004032", nome: "Óleo Castrol CRB Multi 15W40 20L", marca: "Castrol", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },

  // HAVOLINE / TEXACO
  { barcode: "7891789005011", nome: "Óleo Havoline ProDS Full Synthetic 5W30 1L", marca: "Havoline", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891789005028", nome: "Óleo Texaco Ursa Super TD 15W40 1L", marca: "Texaco", viscosidade: "15W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891789005035", nome: "Óleo Texaco Ursa Super TD 15W40 20L", marca: "Texaco", viscosidade: "15W40", volume: "20L", unidadePadrao: "Balde" },

  // SELENIA / PETRONAS
  { barcode: "7891999006014", nome: "Óleo Selenia K Pure Energy 5W30 1L", marca: "Selenia", viscosidade: "5W30", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "7891999006021", nome: "Óleo Petronas Syntium 3000 5W40 1L", marca: "Petronas", viscosidade: "5W40", volume: "1L", unidadePadrao: "Frasco" },

  // MOTUL
  { barcode: "3374650238012", nome: "Óleo Motul 8100 X-cess 5W40 1L", marca: "Motul", viscosidade: "5W40", volume: "1L", unidadePadrao: "Frasco" },
  { barcode: "3374650238029", nome: "Óleo Motul 6100 Synergia+ 10W40 1L", marca: "Motul", viscosidade: "10W40", volume: "1L", unidadePadrao: "Frasco" }
];

/**
 * Searches for product details by barcode, or checks history in app state
 */
export function lookupLubricantByBarcode(barcode: string, appStateDeliveries?: any[]): LubricantBarcodeItem | null {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  // 1. Check catalog
  const found = LUBRICANT_BARCODE_CATALOG.find((item) => item.barcode === cleanBarcode);
  if (found) return found;

  // 2. Check history in lubricantDeliveries if available
  if (appStateDeliveries && Array.isArray(appStateDeliveries)) {
    for (const dev of appStateDeliveries) {
      if (dev.produtos && Array.isArray(dev.produtos)) {
        for (const prod of dev.produtos) {
          if (prod.codigoBarras === cleanBarcode) {
            return {
              barcode: cleanBarcode,
              nome: prod.nome,
              marca: "Histórico",
              volume: "1L",
              unidadePadrao: prod.unidade || "Frasco",
            };
          }
        }
      }
    }
  }

  return null;
}
