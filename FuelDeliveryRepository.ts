import { useState, useCallback } from "react";
import { LmcRecord } from "../../types";
import { lmcService } from "../services/lmc.service";

export function useLMC(initialLmc: LmcRecord[] = []) {
  const [lmcRecords, setLmcRecords] = useState<LmcRecord[]>(initialLmc);

  const updateLmcValue = useCallback((record: LmcRecord) => {
    lmcService.addOrUpdateLmcRecord(record);
  }, []);

  const getMonthlyCompliance = useCallback((fuelType: string) => {
    return lmcService.generateMonthlyLmcStats(lmcRecords, fuelType);
  }, [lmcRecords]);

  return {
    lmcRecords,
    setLmcRecords,
    updateLmcValue,
    getMonthlyCompliance,
  };
}
