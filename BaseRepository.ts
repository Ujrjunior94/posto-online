import { useCallback } from "react";
import { AppState } from "../../types";
import { dashboardService } from "../services/dashboard.service";

export function useDashboard(appState: AppState) {
  const getInventory = useCallback(() => {
    return dashboardService.getInventorySummary(appState.tanks || []);
  }, [appState.tanks]);

  const getShiftSummary = useCallback(() => {
    return dashboardService.getActiveShiftSummary(appState.shifts || []);
  }, [appState.shifts]);

  const getAlerts = useCallback(() => {
    return dashboardService.getOperationalAlerts(appState);
  }, [appState]);

  return {
    getInventory,
    getShiftSummary,
    getAlerts,
  };
}
