import { useState, useCallback } from "react";
import { FuelDelivery } from "../../types";
import { fuelDeliveryService } from "../services/fuelDelivery.service";

export function useFuelDelivery(initialDeliveries: FuelDelivery[] = []) {
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>(initialDeliveries);

  const calculateDiscrepancy = useCallback((declared: number, measured: number) => {
    return fuelDeliveryService.calculateDeliveryDiscrepancy(declared, measured);
  }, []);

  const getSafetyItems = useCallback(() => {
    return fuelDeliveryService.getDischargeSafetyChecklist();
  }, []);

  return {
    deliveries,
    setDeliveries,
    calculateDiscrepancy,
    getSafetyItems,
  };
}
