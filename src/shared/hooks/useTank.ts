import { useState, useCallback } from "react";
import { FuelTank } from "../../types";
import { tankService } from "../services/tank.service";

export function useTank(initialTanks: FuelTank[] = []) {
  const [tanks, setTanks] = useState<FuelTank[]>(initialTanks);

  const calculateCurve = useCallback((height: number, diameter: number, length: number) => {
    return tankService.calculateVolumetricCurve(height, diameter, length);
  }, []);

  const getAlertStatus = useCallback((tank: FuelTank) => {
    return tankService.checkCriticalAlert(tank);
  }, []);

  const calculateTankVariance = useCallback((physical: number, book: number) => {
    return tankService.calculateVariance(physical, book);
  }, []);

  return {
    tanks,
    setTanks,
    calculateCurve,
    getAlertStatus,
    calculateTankVariance,
  };
}
