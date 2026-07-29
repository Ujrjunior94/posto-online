import { useState, useCallback } from "react";
import { Nozzle } from "../../types";
import { nozzleService } from "../services/nozzle.service";

export function useNozzle(initialNozzles: Nozzle[] = []) {
  const [nozzles, setNozzles] = useState<Nozzle[]>(initialNozzles);

  const checkCalibration = useCallback((measured: number, target: number = 20) => {
    return nozzleService.evaluateCalibration(measured, target);
  }, []);

  const getMaintenanceWarning = useCallback((lastCalibrationDate: string) => {
    return nozzleService.isMaintenanceDue(lastCalibrationDate);
  }, []);

  const getProductivityRate = useCallback((nozzleId: string, totalLiters: number, activeDays: number) => {
    return nozzleService.getNozzleProductivity(nozzleId, totalLiters, activeDays);
  }, []);

  return {
    nozzles,
    setNozzles,
    checkCalibration,
    getMaintenanceWarning,
    getProductivityRate,
  };
}
