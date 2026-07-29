import { useState, useCallback } from "react";
import { ocrService } from "../services/ocr.service";
import { fuelDeliveryService } from "../services/fuelDelivery.service";

export function useOCR() {
  const [isScanning, setIsScanning] = useState(false);

  const scanInvoice = useCallback((text: string) => {
    setIsScanning(true);
    const parsed = fuelDeliveryService.parseInvoiceOCR(text);
    setIsScanning(false);
    return parsed;
  }, []);

  const scanRoster = useCallback((text: string) => {
    setIsScanning(true);
    const parsed = ocrService.parseScheduleRosterOCR(text);
    setIsScanning(false);
    return parsed;
  }, []);

  return {
    isScanning,
    scanInvoice,
    scanRoster,
  };
}
