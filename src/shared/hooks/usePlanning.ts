import { useState, useCallback } from "react";
import { EscalaPattern } from "../../types";
import { planningService } from "../services/planning.service";

export function usePlanning(initialPatterns: EscalaPattern[] = []) {
  const [patterns, setPatterns] = useState<EscalaPattern[]>(initialPatterns);

  const projectSchedules = useCallback((pattern: EscalaPattern, startDate: string, days: number = 30) => {
    return planningService.generateShiftProjections(pattern, startDate, days);
  }, []);

  return {
    patterns,
    setPatterns,
    projectSchedules,
  };
}
